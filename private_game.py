"""Private, single-session playtest. The scenario draft stays outside the checkout."""

import argparse
import html
import json
import os
import tempfile
import re
import secrets
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs

from game_rules import PHASES, ROLES, Room

HANDOUTS = ('LORAN', 'DIANNA', 'KIHEL', 'HARRY', 'COREN', 'GUIN')
CSS = Path(__file__).with_name('styles.css').read_text()


def load_scenario(path, handout_dir=None):
    source = path.read_text(encoding='utf-8')
    sheets = re.findall(r'^### B[1-6]\. [^\n]*\n(.*?)(?=^### B|^## C\.)', source, re.M | re.S)
    cards = {
        key: (title, body.replace('**', ''))
        for key, title, body in re.findall(
            r'^\*\*((?:I|S1|S2)-\d{2})｜([^\n]+?)\*\*[^\n]*\n> (.+)$', source, re.M
        )
    }
    expected = {f'{group}-{i:02}' for group, count in [('I', 12), ('S1', 9), ('S2', 9)]
                for i in range(1, count + 1)}
    if handout_dir:
        sheets = [(handout_dir / f'{name}.md').read_text(encoding='utf-8') for name in HANDOUTS]
    for key in ('I-05', 'I-12', 'S1-04', 'S1-07', 'S2-03'):
        if key in cards:
            title, body = cards[key]
            body = body.rstrip('。')
            cards[key] = title, body.rsplit('。', 1)[0] + '。'
    if len(sheets) != len(ROLES) or cards.keys() != expected:
        raise ValueError('役職説明6件と指定された証拠カード30枚が必要です。')
    return sheets, cards


class Game(Room):
    def __init__(self, sheets, cards, rules):
        super().__init__(cards, rules)
        self.sheets = sheets
        self.tokens = {secrets.token_urlsafe(24): role for role in range(-1, len(ROLES))}
        self.csrf = {role: secrets.token_urlsafe(24) for role in self.tokens.values()}
        self.pages = {}
        self.labels = rules['public_names']
        self.identifiers = [secrets.token_urlsafe(12) for _ in ROLES]

    def snapshot(self):
        return {
            'phase': self.phase, 'joined': sorted(self.joined), 'read': sorted(self.read),
            'owners': self.owners, 'public': sorted(self.public),
            'viewers': {key: sorted(roles) for key, roles in self.viewers.items()},
            'offers': self.offers, 'history': self.history,
            'picks': [[phase, role, count] for (phase, role), count in self.picks.items()],
            'answers': list(self.answers.items()), 'votes': list(self.votes.items()),
            'consents': sorted(self.consents), 'detained': self.detained, 'restored': self.restored,
            'leaves': self.leaves, 'passengers': self.passengers, 'facts': self.facts,
            'tokens': self.tokens, 'csrf': list(self.csrf.items()), 'identifiers': self.identifiers,
            'pages': [[role, index, page] for (role, index), page in self.pages.items()],
        }

    def restore(self, state):
        for key in ('phase', 'owners', 'history', 'detained', 'restored', 'leaves',
                    'passengers', 'facts', 'tokens', 'identifiers'):
            setattr(self, key, state[key])
        for key in ('joined', 'read', 'public', 'consents'):
            setattr(self, key, set(state[key]))
        for key in ('answers', 'votes', 'csrf'):
            setattr(self, key, dict(state[key]))
        self.viewers = {key: set(roles) for key, roles in state['viewers'].items()}
        self.offers = {key: tuple(offer) for key, offer in state['offers'].items()}
        self.picks.clear()
        self.picks.update({(phase, role): count for phase, role, count in state['picks']})
        self.pages = {(role, index): page for role, index, page in state['pages']}

    def persist(self, path):
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as output:
            temporary = Path(output.name)
            try:
                json.dump(self.snapshot(), output, ensure_ascii=False)
                output.flush()
                os.fsync(output.fileno())
                os.replace(temporary, path)
            finally:
                temporary.unlink(missing_ok=True)

    def act(self, role, action, data):
        def field(key):
            return data.get(key, [''])[0]

        def number(key):
            value = field(key)
            return int(value) if value.isascii() and value.isdecimal() and len(value) < 4 else -1

        def target():
            value = field('target')
            return self.identifiers.index(value) if value in self.identifiers else -1

        if action == 'advance' and role == -1:
            return number('card') == self.phase and self.advance(field('confirm') == 'yes')
        if action == 'read' and role >= 0 and self.phase >= 1:
            self.read.add(role)
            return True
        if action == 'page' and self.phase >= 1:
            index, page = target(), number('card')
            if index in range(len(ROLES)) and role in (-1, index) and 0 <= page < len(self.sheet_pages(index)):
                self.pages[role, index] = page
                return True
            return False
        if action == 'answer' and role >= 0 and self.phase == 4 and role not in self.answers:
            value = field('answer').strip()
            if value and len(value) <= 200:
                self.answers[role] = value
                return True
        if action == 'vote' and role >= 0:
            return self.vote(role, target())
        if action in ('consent', 'decline') and self.phase == 6 and role > 0 and role != self.detained:
            if action == 'consent':
                self.consents.add(role)
            else:
                self.consents.discard(role)
            return True
        if action == 'finish' and role in (0, -1):
            if role == -1 and self.detained != 0:
                return False
            if field('decision') not in ('stay', 'leave'):
                return False
            picks = data.get('passengers', [])
            if any(value not in self.identifiers[1:] for value in picks):
                return False
            return self.finish(field('decision') == 'leave', [self.identifiers.index(value) for value in picks])
        if action == 'score' and role == -1 and self.phase == 7 and self.facts is None:
            governor = target()
            self.facts = {key: field(key) == 'yes' for key in ('swap', 'awakening', 'promise')}
            self.facts['governor'] = governor if governor in range(len(ROLES)) else None
            return True
        return self.card_action(role, action, field('card'), target())

    def sheet_pages(self, index):
        return [page.strip() for page in re.split(r'(?=^#{1,6} )|(?=^\*\*(?:立場|開始時|目標))',
                                                self.sheets[index], flags=re.M) if page.strip()]

    def form(self, role, action, label, key='', extra=''):
        return (f'<form method="post"><input type="hidden" name="csrf" value="{self.csrf[role]}">'
                f'<input type="hidden" name="action" value="{action}">'
                f'<input type="hidden" name="card" value="{key}">{extra}'
                f'<button>{label}</button></form>')

    def names_select(self, name, excluded=None, empty=False):
        options = ['<option value="">選択してください</option>']
        if empty:
            options.append('<option value="none">該当なし</option>')
        options.extend(f'<option value="{self.identifiers[i]}">{html.escape(label)}</option>' for i, label in enumerate(self.labels)
                       if i != excluded)
        return f'<select name="{name}" required>{"".join(options)}</select>'

    def board(self, role):
        gm = role == -1
        name = 'GM' if gm else html.escape(self.labels[role])
        out = [f'<h1>{name}</h1><h2>{PHASES[self.phase]}</h2>']
        if self.phase >= 2:
            out.append(f'<p>{html.escape(self.rules["chapter_two"])}</p>')
        if gm:
            out.append('<h3>参加状況</h3><ul>')
            for index, label in enumerate(ROLES):
                joined = '入室済み' if index in self.joined else '入室待ち'
                read = '・読了' if index in self.read else ''
                remaining = f'・調査あと {self.remaining(index)} 回' if self.phase in (1, 2) else ''
                out.append(f'<li>{label} {joined}{read}{remaining}</li>')
            out.append('</ul>')
            if self.phase < 5:
                confirm = ''
                if self.phase in (1, 2) and any(self.remaining(i) for i in range(len(ROLES))):
                    confirm = '<label><input type="checkbox" name="confirm" value="yes" required>未使用の調査回数があることを確認した</label>'
                out.append(self.form(role, 'advance', '次の段階へ', str(self.phase), confirm))
            if self.phase >= 4:
                out.append('<h3>個別推理</h3><ul>')
                out.extend(f'<li>{ROLES[i]}：{html.escape(answer)}</li>' for i, answer in self.answers.items())
                out.append('</ul>')
        if self.phase >= 1 or gm:
            for index in range(len(ROLES)) if gm else [role]:
                pages = self.sheet_pages(index)
                page = self.pages.get((role, index), 0)
                sheet = html.escape(pages[page].replace('**', ''))
                out.append(f'<section class="panel"><h3>{html.escape(ROLES[index] if gm else self.labels[index])}の個別資料</h3>'
                           f'<p>{page + 1} / {len(pages)} ページ</p><div class="sheet">{sheet}</div>')
                for step, label in [(-1, '前のページ'), (1, '次のページ')]:
                    if 0 <= page + step < len(pages):
                        out.append(self.form(role, 'page', label, str(page + step),
                                             f'<input type="hidden" name="target" value="{self.identifiers[index]}">'))
                if not gm and role not in self.read and page == len(pages) - 1:
                    out.append(self.form(role, 'read', '読み終えた'))
                out.append('</section>')
        if not gm and self.phase in (1, 2):
            out.append(f'<p>残り調査回数 {self.remaining(role)} 回</p>')
        out.append('<h2>証拠カード</h2><div class="cards">')
        for key, (title, body) in self.cards.items():
            if not self.unlocked(key):
                continue
            owner = self.owners.get(key)
            if self.phase >= 3 and not self.visible(role, key):
                continue
            out.append(f'<article class="panel"><h3>{html.escape(title)}</h3>')
            if self.visible(role, key):
                out.append(f'<p>{html.escape(body)}</p>')
            if owner is not None and gm:
                out.append(f'<p>所持者 {ROLES[owner]}</p>')
            elif owner == role:
                out.append('<p>所持中</p>')
            if key in self.public:
                out.append('<p>全員に公開済み</p>')
            if self.can_investigate(role, key):
                out.append(self.form(role, 'investigate', '調査する', key))
            elif not gm and self.phase in (1, 2):
                status = '調査済み' if owner is not None else '現在は調査できません'
                out.append(f'<p>{status}</p>')
            if self.offers.get(key) == (owner, role):
                out.append(self.form(role, 'accept', '譲渡を受ける', key))
            if not gm and owner == role and self.phase <= 5:
                recipient = self.names_select('target', excluded=role)
                out.append(self.form(role, 'offer', '譲渡を申し込む', key, f'<label>譲渡先{recipient}</label>'))
                if key in self.offers:
                    out.append(self.form(role, 'cancel', '譲渡の申し込みを取り消す', key))
                if key not in self.public:
                    out.append(self.form(role, 'share', 'この人に見せる', key, f'<label>共有先{recipient}</label>'))
                    out.append(self.form(role, 'publish', '全員に公開する', key))
            out.append('</article>')
        out.append('</div>')
        if gm and self.history:
            out.append('<details><summary>カードの操作履歴</summary><ul>')
            actions = {'investigate': '調査', 'accept': '譲渡を受諾', 'publish': '全員公開',
                       'cancel': '申し込み取消', 'offer': '譲渡の申し込み', 'share': '個別共有'}
            for actor, action, key, target in self.history:
                recipient = f' → {ROLES[target]}' if target >= 0 else ''
                out.append(f'<li>{ROLES[actor]} {actions[action]} {html.escape(self.cards[key][0])}{recipient}</li>')
            out.append('</ul></details>')
        if self.phase == 4 and not gm:
            question = self.rules['questions'][role]
            out.append(f'<h3>個別推理</h3><p>{html.escape(question)}</p>')
            if role in self.answers:
                out.append('<p>回答済み</p>')
            else:
                out.append(self.form(role, 'answer', '回答を確定',
                                     extra='<label>回答<input name="answer" maxlength="200" required></label>'))
        if self.phase == 5:
            out.append(f'<p>投票済み {len(self.votes)} / {len(ROLES)} 人</p>')
            if not gm and role not in self.votes:
                out.append(self.form(role, 'vote', '投票を確定', extra=self.names_select('target', excluded=role)))
        if self.phase >= 6:
            counts = [sum(candidate == i for candidate in self.votes.values()) for i in range(len(ROLES))]
            out.append('<h3>投票結果</h3><ul>')
            out.extend(f'<li>{label}：{counts[i]}票</li>' for i, label in enumerate(map(html.escape, self.labels)))
            out.append('</ul>')
            custody = '最多得票が同票のため拘束者なし' if self.detained is None else f'拘束された人物は{html.escape(self.labels[self.detained])}'
            restoration = '復旧しました' if self.restored else '復旧していません'
            out.append(f'<p>{custody}。月光蝶の安全機構は{restoration}。</p>')
        if self.phase == 6:
            if role > 0 and role != self.detained and self.detained != 0:
                action = 'decline' if role in self.consents else 'consent'
                out.append(self.form(role, action, '同乗の同意を取り消す' if action == 'decline' else '同乗に同意する'))
            if role == 0 or gm and self.detained == 0:
                out.append(self.form(role, 'finish', '月に残る', extra='<input type="hidden" name="decision" value="stay">'))
                if self.detained != 0:
                    checks = ''.join(f'<label><input type="checkbox" name="passengers" value="{self.identifiers[i]}">{html.escape(self.labels[i])}</label>'
                                     for i in sorted(self.consents))
                    out.append(self.form(role, 'finish', '地球へ出発する',
                                         extra='<input type="hidden" name="decision" value="leave">'
                                               f'<fieldset><legend>同意済みの同乗者から最大2名</legend>{checks}</fieldset>'))
        if self.phase == 7:
            ending = ('ロランは月に残った。' if not self.leaves else '地球へ安全に帰還した。' if self.safe
                      else '離陸時に月光蝶が発動し、安全な帰還には失敗した。')
            if self.passengers:
                ending += ' 同乗者は' + '、'.join(html.escape(self.labels[i]) for i in self.passengers) + '。'
            out.append(f'<p>{ending}</p>')
            if gm and self.facts is None:
                flags = [('swap', '入れ替わりが全員に公表された'), ('awakening', '覚醒の指示が全員の前で立証された'),
                         ('promise', '統治者が嫌疑訂正を明確に約束した')]
                checks = ''.join(f'<label><input type="checkbox" name="{key}" value="yes">{label}</label>'
                                 for key, label in flags)
                out.append(self.form(role, 'score', 'GM判定と得点を確定',
                                     extra=f'<label>月の最終統治者{self.names_select("target", empty=True)}</label>{checks}'))
            if self.facts is not None:
                out.append('<h3>最終得点</h3><ul>')
                out.extend(f'<li>{name}：{score} / 10点</li>' for name, score in zip(map(html.escape, self.labels), self.scores()))
                out.append('</ul>')
        out.append('<p><a href="/">進行を更新</a></p>')
        out.append(self.form(role, 'logout', 'ログアウト'))
        return ''.join(out)

class Handler(BaseHTTPRequestHandler):
    def send_page(self, content, status=200, cookie=None):
        page = ('<!doctype html><html lang="ja"><meta charset="utf-8">'
                '<meta name="viewport" content="width=device-width,initial-scale=1">'
                '<title>白の終焉・非公開試遊</title>'
                f'<style>{CSS}.sheet{{white-space:pre-wrap}}form{{margin:12px 0}}'
                'h1{font-size:2.5rem}.cards{display:grid;grid-template-columns:'
                'repeat(auto-fit,minmax(min(100%,260px),1fr));gap:14px}'
                'input[type=checkbox]{display:inline;width:auto;margin:0 .5em 0 0}'
                'fieldset label{display:block;margin:.5em 0}</style>'
                f'<main>{content}</main></html>').encode()
        self.send_response(status)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy',
                         "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'")
        if cookie is not None:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(page)

    def role(self):
        try:
            cookie = SimpleCookie(self.headers.get('Cookie', ''))
            return self.server.game.tokens.get(cookie['mm_session'].value)
        except (CookieError, KeyError):
            return None

    def do_GET(self):
        if self.path != '/' or self.headers.get('Host') != self.server.public_host:
            self.send_error(404)
            return
        role = self.role()
        if role is None:
            self.send_page('<h1>白の終焉</h1><form method="post">'
                           '<label>GMから受け取ったアクセスコード'
                           '<input name="token" type="password" required></label>'
                           '<button>入室</button></form>')
        else:
            self.send_page(self.server.game.board(role))

    def redirect(self, cookie=None):
        self.send_response(303)
        self.send_header('Location', '/')
        self.send_header('Cache-Control', 'no-store')
        if cookie is not None:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()

    def do_POST(self):
        if self.path != '/' or self.headers.get('Host') != self.server.public_host:
            self.send_error(404)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 4096:
                raise ValueError
            data = parse_qs(self.rfile.read(length).decode())
        except ValueError:
            self.send_error(400)
            return

        def field(name):
            return data.get(name, [''])[0]

        game = self.server.game
        role = self.role()
        token, action = field('token'), field('action')
        if token in game.tokens:
            if game.tokens[token] >= 0 and game.tokens[token] not in game.joined:
                before = json.dumps(game.snapshot())
                game.joined.add(game.tokens[token])
                if not self.persist_change(before):
                    return
            secure = '; Secure' if self.server.require_secure_cookie else ''
            self.redirect(f'mm_session={token}; HttpOnly; SameSite=Strict; Path=/{secure}')
        elif role is None or field('csrf') != game.csrf[role]:
            self.send_page('<p>入室または操作を確認できませんでした。</p><a href="/">戻る</a>', 403)
        elif action == 'logout':
            self.redirect('mm_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/')
        else:
            before = json.dumps(game.snapshot())
            if game.act(role, action, data):
                if self.persist_change(before):
                    self.redirect()
            else:
                self.send_page('<p>現在の進行状況ではこの操作を実行できません。</p><a href="/">戻る</a>', 409)

    def persist_change(self, before):
        try:
            self.server.game.persist(self.server.state_path)
        except OSError:
            self.server.game.restore(json.loads(before))
            self.send_page('<p>進行を保存できませんでした。</p><a href="/">戻る</a>', 503)
            return False
        return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('scenario', type=Path)
    parser.add_argument('--rules', type=Path, required=True)
    parser.add_argument('--handouts', type=Path)
    parser.add_argument('--state', type=Path, required=True)
    parser.add_argument('--port', type=int, default=8770)
    parser.add_argument('--https-host', help='HTTPSリバースプロキシが渡す公開ホスト名')
    args = parser.parse_args()
    game = Game(*load_scenario(args.scenario, args.handouts), json.loads(args.rules.read_text(encoding='utf-8')))
    if args.state.exists():
        game.restore(json.loads(args.state.read_text(encoding='utf-8')))
    else:
        game.persist(args.state)
    with HTTPServer(('127.0.0.1', args.port), Handler) as server:
        server.game = game
        server.state_path = args.state
        server.public_host = args.https_host or f'127.0.0.1:{args.port}'
        server.require_secure_cookie = bool(args.https_host)
        print(f'非公開試遊: http://127.0.0.1:{args.port}/', flush=True)
        for token, role in game.tokens.items():
            print(f'{ROLES[role] if role >= 0 else "GM"}: {token}', flush=True)
        server.serve_forever()


if __name__ == '__main__':
    main()
