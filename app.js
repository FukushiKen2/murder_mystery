'use strict';

const roles = ['ロラン', 'ディアナ', 'キエル', 'ハリー', 'コレン', 'グエン'];
const phases = [
  { title: '第1章', guide: '各自2枚調査し、会話と交換を進めます。', next: '第2章へ' },
  { title: '第2章', guide: '各自2枚調査し、集まった手がかりを確認します。', next: '第3章へ' },
  { title: '第3章', guide: '最終討論とカードの譲渡を終えたら、投票に進みます。', next: '投票へ' },
  { title: '投票', guide: 'GMが各プレイヤーの推理を入力してください。' },
  { title: '結末', guide: '集計を確認し、ロランの出発選択と得点計算を進行してください。' },
];
const sampleChapters = [
  [
    ['展望室の時計', '時計は22時14分で止まっている。机の上の予備時計は動いていた。'],
    ['廊下の足跡', '展望室へ向かう足跡には、整備区画で使われる白い粉が付いている。'],
    ['通信メモ', '「先に展望室へ」とだけ記されている。宛名の部分は切り取られている。'],
    ['機材の貸出簿', '22時前に携帯灯が貸し出された。返却欄は空白だ。'],
  ],
  [
    ['停電の記録', '照明が落ちたのは22時12分。予備電源は3分後に復旧した。'],
    ['整備区画の記録', '当日の午後、白い粉を使う作業は予定より早く終了している。'],
    ['扉の点検票', '展望室の扉は、停電中でも内側から開けられる。'],
    ['放送の下書き', '「予定を変更する」と書かれた一行だけが取り消されている。'],
  ],
];
const investigationLimit = 2;
let chapters = sampleChapters;
const sampleStorageKey = 'murder-mystery-session-v1';
let storageKey = sampleStorageKey;
const get = (id) => document.getElementById(id);

function parseEvidence(source) {
  const section = source.match(/^## C\. [^\n]*\n([\s\S]*?)(?=^## D\.|(?![\s\S]))/m)?.[1] ?? '';
  const entries = [...section.matchAll(
    /^\*\*((?:I|S1|S2)-\d{2})｜([^\n]+?)\*\*[^\n]*\n> (.+)$/gm
  )];
  const cards = new Map(entries.map(([, id, title, body]) => [
    id, [`${id} ${title}`, body.replaceAll('**', ''), id],
  ]));
  const ids = (group, count) => Array.from({ length: count }, (_, index) =>
    `${group}-${String(index + 1).padStart(2, '0')}`);
  const items = ids('I', 12);
  const chapterOne = ids('S1', 9);
  const chapterTwo = ids('S2', 9);
  if (entries.length !== 30 || ![...items, ...chapterOne, ...chapterTwo].every((id) => cards.has(id))) {
    throw new Error('証拠カード30枚を確認できませんでした。');
  }
  return [[...items, ...chapterOne], [...items, ...chapterOne, ...chapterTwo]]
    .map((chapter) => chapter.map((id) => cards.get(id)));
}

function restoreInvestigations(saved) {
  return chapters.map((cards, chapter) => roles.map((_, role) => {
    const picks = saved?.[chapter]?.[role];
    if (!Array.isArray(picks)) return [];
    return [...new Set(picks.filter((pick) => Number.isInteger(pick)
      && pick >= 0 && pick < cards.length))].slice(0, investigationLimit);
  }));
}

function readSession() {
  get('status').textContent = '';
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved) return null;
    const { names, phase, votes } = saved;
    const validNames = Array.isArray(names) && names.length === roles.length
      && names.every((name) => typeof name === 'string' && name.trim() && name.length <= 40);
    const validPhase = Number.isInteger(phase) && phase >= 0 && phase < phases.length;
    const validVotes = Array.isArray(votes) && votes.length === roles.length
      && votes.every((vote, voter) => Number.isInteger(vote) && vote >= 0
        && vote < roles.length && vote !== voter);
    if (validNames && validPhase && (phase < 4 || validVotes)) {
      return {
        names, phase, votes: phase === 4 ? votes : [],
        investigations: restoreInvestigations(saved.investigations),
      };
    }
    get('status').textContent = '保存済みの進行を読み込めませんでした。';
  } catch {
    get('status').textContent = '保存済みの進行を読み込めませんでした。';
  }
  return null;
}

let session = readSession();

function saveSession(next, focusTarget) {
  session = next;
  try {
    if (session) localStorage.setItem(storageKey, JSON.stringify(session));
    else localStorage.removeItem(storageKey);
    get('status').textContent = '';
  } catch {
    get('status').textContent = '保存できませんでした。再読み込みすると最新の進行が失われることがあります。';
  }
  render();
  if (session) get(focusTarget ?? 'phase').focus();
  else get('participants').querySelector('input').focus();
}

function addField(container, text, control) {
  const label = document.createElement('label');
  label.append(text, control);
  container.append(label);
}

function listItem(text) {
  const item = document.createElement('li');
  item.textContent = text;
  return item;
}

roles.forEach((role) => {
  const card = document.createElement('article');
  const title = document.createElement('h3');
  title.textContent = role;
  card.append(title);
  get('roles').append(card);

  const input = document.createElement('input');
  input.required = true;
  input.maxLength = 40;
  input.autocomplete = 'off';
  input.addEventListener('input', () => input.setCustomValidity(''));
  addField(get('participants'), role, input);
});

function playerLabel(index) {
  return `${roles[index]}（${session.names[index]}）`;
}

function renderInvestigation() {
  const { phase, investigations } = session;
  get('investigation').hidden = phase > chapters.length;
  if (phase > chapters.length) return;

  const roleSelect = get('investigator');
  const role = Number(roleSelect.value);
  roleSelect.replaceChildren(...roles.map((_, index) => new Option(playerLabel(index), index)));
  roleSelect.value = String(role);

  const board = get('clue-board');
  board.replaceChildren();
  const cards = chapters[phase];
  const picks = investigations[phase]?.[role];
  get('clue-limit').textContent = cards
    ? `この章の残り調査回数 ${investigationLimit - picks.length} 回`
    : 'これまでに調べたカードを見直せます。';

  const found = new Set(investigations.slice(0, phase + 1).flatMap((byRole, chapter) =>
    byRole.flatMap((rolePicks) => rolePicks.map((index) => chapters[chapter][index][2]))));
  cards?.forEach(([title, , id], index) => {
    const ownItem = id?.startsWith('I-') && Math.floor((Number(id.slice(2)) - 1) / 2) === role;
    const unavailable = picks.includes(index) || (id && found.has(id)) || ownItem;
    const button = document.createElement('button');
    button.type = 'button';
    const suffix = ownItem ? '（自分の関連品）' : unavailable ? '（調査済み）' : 'を調査';
    button.textContent = title + suffix;
    button.disabled = unavailable || picks.length >= investigationLimit;
    button.addEventListener('click', () => {
      const updated = structuredClone(investigations);
      updated[phase][role].push(index);
      saveSession({ ...session, investigations: updated }, 'clue-notes');
    });
    board.append(button);
  });

  const notes = investigations.slice(0, phase + 1).flatMap((byRole, chapter) =>
    byRole[role].map((index) => {
      const [title, clue] = chapters[chapter][index];
      return listItem(`第${chapter + 1}章　${title}：${clue}`);
    }));
  get('clue-notes').replaceChildren(...(notes.length ? notes : [listItem('調査したカードはまだありません。')]));
}

get('investigator').addEventListener('change', renderInvestigation);

function renderBallots() {
  get('ballots').replaceChildren();
  roles.forEach((_, voter) => {
    const select = document.createElement('select');
    select.required = true;
    select.add(new Option('投票先を選択', ''));
    roles.forEach((_, candidate) => {
      if (candidate !== voter) select.add(new Option(playerLabel(candidate), candidate));
    });
    addField(get('ballots'), playerLabel(voter), select);
  });
}

function renderResults() {
  const counts = roles.map((_, candidate) => session.votes.filter((vote) => vote === candidate).length);
  const highest = Math.max(...counts);
  const leaders = roles.filter((_, candidate) => counts[candidate] === highest);
  get('verdict').textContent = leaders.length === 1
    ? `最多得票は ${leaders[0]}（${highest}票）です。`
    : `同票です。最多得票は ${leaders.join('、')}（各${highest}票）です。`;
  get('totals').replaceChildren(...roles.map((role, index) => listItem(`${role}：${counts[index]}票`)));
}

function render() {
  get('setup').hidden = Boolean(session);
  get('session').hidden = !session;
  if (!session) return;

  const { phase } = session;
  get('phase').textContent = phases[phase].title;
  get('phase-guide').textContent = phases[phase].guide;
  if (chapters !== sampleChapters && phase === 1) {
    get('phase-guide').textContent += ' アグリッパの直接死因は絞殺です。月光蝶の安全制限は、記録A・B・Cの異なる2枚で復旧できます。';
  }
  get('roster').replaceChildren(...roles.map((_, index) => listItem(playerLabel(index))));
  get('advance').hidden = phase >= 3;
  get('advance').textContent = phases[phase].next ?? '';
  get('voting').hidden = phase !== 3;
  get('results').hidden = phase !== 4;
  renderInvestigation();
  if (phase === 3) renderBallots();
  if (phase === 4) renderResults();
}

function startSession(names) {
  saveSession({ names, phase: 0, votes: [], investigations: restoreInvestigations() });
}

get('scenario-file').addEventListener('change', async ({ currentTarget: input }) => {
  const file = input.files[0];
  if (!file) return;
  try {
    const source = (await file.text()).replace(/\r\n/g, '\n');
    if (input.files[0] !== file) return;
    chapters = parseEvidence(source);
    storageKey = 'murder-mystery-evidence-session-v1';
    session = readSession();
    get('scenario-status').textContent = '証拠カード30枚を読み込みました。ページを開き直したら、同じ原稿を選ぶと進行を再開できます。';
    get('demo').textContent = '仮の名前で第1章を開始';
    render();
  } catch {
    if (input.files[0] !== file) return;
    get('scenario-status').textContent = '原稿を読み込めませんでした。CHARACTERS_AND_CARDS.md を選び直してください。';
    input.value = '';
  }
});

get('demo').addEventListener('click', () => {
  if (!session) startSession(roles.map((_, index) => `参加者${index + 1}`));
});

get('setup').addEventListener('submit', (event) => {
  event.preventDefault();
  const inputs = [...get('participants').querySelectorAll('input')];
  const blank = inputs.find((input) => !input.value.trim());
  if (blank) {
    blank.setCustomValidity('参加者名を入力してください。');
    blank.reportValidity();
    return;
  }
  startSession(inputs.map((input) => input.value.trim()));
});

get('advance').addEventListener('click', () => {
  if (session && session.phase < 3) saveSession({ ...session, phase: session.phase + 1 });
});

get('voting').addEventListener('submit', (event) => {
  event.preventDefault();
  if (session?.phase !== 3) return;
  const votes = [...get('ballots').querySelectorAll('select')].map((select) => Number(select.value));
  saveSession({ ...session, phase: 4, votes });
});

get('reset').addEventListener('click', () => {
  if (!window.confirm('参加者と進行を消去してセッションを終了しますか？')) return;
  get('setup').reset();
  saveSession(null);
});

render();
get('start').disabled = false;
get('demo').disabled = false;
get('scenario-file').disabled = false;
