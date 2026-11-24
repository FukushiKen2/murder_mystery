'use strict';

const roles = ['ロラン', 'ディアナ', 'キエル', 'ハリー', 'コレン', 'グエン'];
const phases = [
  { title: '第1章', guide: '各自2枚まで調査し、話し合います。', next: '第2章へ' },
  { title: '第2章', guide: '各自2枚調査し、集まった手がかりを確認します。', next: '第3章へ' },
  { title: '第3章', guide: '最終討論を終えたら、投票に進みます。', next: '投票へ' },
  { title: '投票', guide: 'GMが各プレイヤーの推理を入力してください。' },
  { title: '結末', guide: '集計を確認し、ロランの最後の選択を記録してください。' },
];
const evidence = [
  ["ホワイトドール引渡要求書", "アグリッパからロランへ渡された要求書。「本日、白い機体を自ら確認した。危険な機構が存在するため、月政府の管理下へ移す必要がある」。末尾にロランの筆跡で「引き渡せません」。", "I-01"],
  ["血の付いた整備用手袋", "ホワイトドールの整備場所に残された手袋。指先が裂け、血が付着している。近くに血の付いた整備工具。負傷の正確な時刻は不明。", "I-02"],
  ["古い宮殿の私物箱", "現在キエルとして暮らしている人物が宮殿保管庫から引き取った私物箱。300年前の宮殿写真と地球帰還政策をめぐる対立を記した無署名の私的覚書。", "I-03"],
  ["古い宮殿の拳銃", "現在キエルとして暮らしている人物が引き取った保管箱の旧式護身用拳銃。最後に使われた時期・発砲者は不明。", "I-04"],
  ["宮殿来訪・連絡記録", "事件当日17時にアグリッパが女王に面会。夕刻、地球側の複数の関係者が来訪。グエンは18:20頃に東側通路から入館し、18:55頃に退館。他の地球側関係者のうち、記録上18:30–18:50に東側通路を利用できた者はグエンだけ。別紙にはグエンが月軍との非公式連絡に使う本人専用認証番号 L-17。", "I-05"],
  ["宮殿内部図と警備予定", "女王私室と機密文書室を結ぶ経路。21時頃に警備交代。文書室へ向かう経路に誰かの印。", "I-06"],
  ["金糸のほつれた制服", "親衛隊長ハリーの制服。襟元の金糸が数本失われ、新しいほつれ。損傷の時刻・場所は不明。", "I-07"],
  ["親衛隊長の事情説明書", "ハリーの書面「事件当夜、21時から21時30分までディアナ女王の私室で面会していた」。女王本人の確認署名なし。", "I-08"],
  ["三百年前の軍人身分証", "ディアナ派兵士コレンの身分証。「宮殿での銃撃事件に際して重傷を負い、長期冷凍睡眠による治療に移行」。", "I-09"],
  ["旧警備隊の命令記録", "コレンは事件当日女王居室から離れた警備区域にいた。銃声後に配置場所を離れたが正確な時刻不明。後日アグリッパ銃撃容疑者として追記。", "I-10"],
  ["旧文明の記録A", "月光蝶の制限装置の構造(X)と復旧操作手順(Y)を記載、安全確認(Z)は欠落。", "I-11"],
  ["月軍との暗号通信", "正式承認なしに保存人物の覚醒処置を命じた通信。送信者名なし。認証番号 L-17、送信時刻、宛先は月軍の非公開覚醒施設。", "I-12"],
  ["アグリッパの手帳", "「15時。白い機体を調べた。予想外の反応。後で確認する必要がある」「17時。女王は、あの夜のことを忘れたかのようだった」「18時30分。明日の取引について交渉。条件はまだ折り合わない」。相手の名前なし。", "S1-01"],
  ["遺体の右手に残った繊維", "アグリッパの右手に金色の細い繊維。争った形跡、相手の衣服から引きちぎった可能性。", "S1-02"],
  ["アグリッパの伝言", "「明日の技術提供について、今夜中にもう一度確認しておきたい」。宛先不明。届いたかも不明。", "S1-03"],
  ["夜間の警備巡回記録", "20:50–21:20頃、宮殿の一部の巡回記録が途切れる。勤務交代や警備区域変更で複数人の所在不明。", "S1-04"],
  ["女王の夜間面会予定", "21時台にハリーと女王の面会予定。面会実施記録はあるが開始時刻不明。", "S1-05"],
  ["宮殿使用人の証言", "アグリッパは17時面会後「女王はあの夜のことを忘れたような顔をしていた」。現在キエルとして暮らす人物はアグリッパの生存に激しく動揺。", "S1-06"],
  ["夕刻の訪問者についての証言", "事件当日の18:30頃、アグリッパは地球側の人物と月での政治的復権、旧文明技術の提供について会談。相手は東側連絡通路から出入りし、顔は確認されていない。会談は18:50頃まで。", "S1-07"],
  ["機密文書室の入室記録", "21時頃に機密文書室が使用。正式な入室申請なし、利用者不明。", "S1-08"],
  ["格納庫の整備日誌", "ロランの自己記録。20:30頃から整備、20:40に特殊機構警告、20:50頃指を負傷。", "S1-09"],
  ["格納庫の操作履歴", "15時頃ホワイトドール整備端末が操作され、月光蝶に関係する安全制限が解除され復旧されていない。操作者不明。", "S2-01"],
  ["旧文明技術の移送準備記録", "翌日の技術資料提供の準備。主要資料は保管されたままで引渡し未実施。相手氏名なし。", "S2-02"],
  ["覚醒施設の作業記録", "アグリッパが正式承認なしに覚醒。施設は外部指示を受けた。L-17、受信時刻、対象アグリッパが記録される。", "S2-03"],
  ["アグリッパ派の警備報告", "300年前「女王の保護のためアグリッパ卿が居室へ向かった」「銃声後、コレンが現れたため襲撃犯と誤認し護衛が発砲」。コレンがアグリッパを撃つのを目撃していない。", "S2-04"],
  ["宮殿侍従の古い証言", "300年前、アグリッパが女王居室へ向かった後に1発銃声。護衛が駆けつけた。女王の護身用拳銃が事件後見当たらない。発砲瞬間の目撃なし。", "S2-05"],
  ["旧文明の記録B", "復旧操作(Y)と安全確認(Z)、制限装置の構造(X)不足。", "S2-06"],
  ["旧文明の記録C", "制限装置の構造(X)と安全確認(Z)、復旧操作(Y)不足。", "S2-07"],
  ["アグリッパの取引覚書", "翌日地球側へ旧文明技術情報の提供予定、見返りに月での政治復権。相手名なし。親衛隊から中止要求あり。", "S2-08"],
  ["三百年前の搬送記録", "300年前の事件当夜に二名搬送。コレン名あり。もう一人は胸に銃創のある氏名非公開患者で軍の別施設へ。両名とも長期治療が必要。", "S2-09"],
];
const chapters = [evidence.slice(0, 21), evidence];
const investigationLimit = 2;
const storageKey = 'murder-mystery-evidence-session-v1';
const get = (id) => document.getElementById(id);

function restoreInvestigations(saved) {
  return chapters.map((cards, chapter) => roles.map((_, role) => {
    const picks = saved?.[chapter]?.[role];
    if (!Array.isArray(picks)) return [];
    return [...new Set(picks.filter((pick) => Number.isInteger(pick)
      && pick >= 0 && pick < cards.length))].slice(0, investigationLimit);
  }));
}

function validDeparture(ending) {
  if (!ending) return false;
  const { detained, leaves, passengers } = ending;
  return Number.isInteger(detained) && detained >= -1 && detained < roles.length
    && typeof leaves === 'boolean' && Array.isArray(passengers)
    && passengers.length <= 2 && new Set(passengers).size === passengers.length
    && (!leaves ? passengers.length === 0 : detained !== 0)
    && passengers.every((role) => Number.isInteger(role) && role > 0
      && role < roles.length && role !== detained);
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
        ending: phase === 4 && validDeparture(saved.ending) && saved.ending.detained === detainedByVote(votes) ? saved.ending : null,
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

  const holders = new Map();
  investigations.slice(0, phase + 1).forEach((byRole, chapter) => {
    byRole.forEach((rolePicks, owner) => {
      rolePicks.forEach((index) => holders.set(chapters[chapter][index][2], owner));
    });
  });
  const displayCards = cards ?? evidence.filter(([, , id]) => holders.has(id));
  displayCards.forEach(([title, , id], index) => {
    const related = id.startsWith('I-');
    const owner = holders.get(id);
    const card = document.createElement('article');
    card.className = 'clue-card';
    const heading = document.createElement('h5');
    heading.textContent = title;
    const details = document.createElement('p');
    details.textContent = `${related ? '人物関連の所持品' : '状況証拠'} · ${owner === undefined ? '未取得' : `所持者：${playerLabel(owner)}`}`;
    if (owner !== undefined) card.classList.add('clue-recorded');
    card.append(heading, details);

    if (cards && owner === undefined) {
      const ownItem = related && Math.floor((Number(id.slice(2)) - 1) / 2) === role;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = ownItem ? 'この役では調査不可' : '調査を記録';
      button.setAttribute('aria-label', `${title}：${button.textContent}`);
      button.disabled = ownItem || picks.length >= investigationLimit;
      button.addEventListener('click', () => {
        const updated = structuredClone(investigations);
        updated[phase][role].push(index);
        saveSession({ ...session, investigations: updated }, 'clue-notes');
      });
      card.append(button);
    }
    board.append(card);
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

function voteCounts(votes) {
  return roles.map((_, candidate) => votes.filter((vote) => vote === candidate).length);
}

function detainedByVote(votes) {
  const counts = voteCounts(votes);
  const highest = Math.max(...counts);
  return counts.indexOf(highest) === counts.lastIndexOf(highest) ? counts.indexOf(highest) : -1;
}

function renderResults() {
  const counts = voteCounts(session.votes);
  const highest = Math.max(...counts);
  const leaders = roles.filter((_, candidate) => counts[candidate] === highest);
  get('verdict').textContent = leaders.length === 1
    ? `最多得票は ${leaders[0]}（${highest}票）です。`
    : `同票です。最多得票は ${leaders.join('、')}（各${highest}票）です。`;
  get('totals').replaceChildren(...roles.map((role, index) => listItem(`${role}：${counts[index]}票`)));
}

function updateDepartureOptions() {
  const detained = String(detainedByVote(session.votes));
  const choice = get('departure-choice');
  choice.disabled = detained === '0';
  choice.options[2].disabled = choice.disabled;
  if (choice.disabled) choice.value = 'stay';

  const passengers = get('passengers');
  passengers.hidden = choice.value !== 'leave';
  const boxes = [...passengers.querySelectorAll('input')];
  for (const box of boxes) {
    if (passengers.hidden || box.value === detained) box.checked = false;
  }
  const full = boxes.filter((box) => box.checked).length >= 2;
  for (const box of boxes) {
    box.disabled = passengers.hidden || box.value === detained || (full && !box.checked);
  }
}

function renderDeparture() {
  const { ending } = session;
  get('departure-form').hidden = Boolean(ending);
  const result = get('departure-result');
  result.hidden = !ending;
  if (ending) {
    const { detained, leaves, passengers } = ending;
    const custody = detained === -1 ? '拘束者なし。' : `拘束された役は${playerLabel(detained)}。`;
    const journey = leaves
      ? `ロランは地球へ出発します。${passengers.length ? `同乗者は${passengers.map(playerLabel).join('、')}。` : '同乗者はいません。'}`
      : detained === 0 ? 'ロランは拘束され、出発できません。' : 'ロランは月に残ります。';
    result.textContent = custody + journey;
    return;
  }

  const detained = detainedByVote(session.votes);
  get('detention-result').textContent = detained === -1
    ? '最多得票が同票のため、拘束者はいません。'
    : `拘束された役は ${playerLabel(detained)} です。`;
  get('departure-choice').value = '';
  const passengers = get('passengers');
  passengers.querySelectorAll('label').forEach((label) => label.remove());
  roles.slice(1).forEach((_, index) => {
    const role = index + 1;
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = String(role);
    addField(passengers, playerLabel(role), box);
  });
  updateDepartureOptions();
}

get('departure-form').addEventListener('change', updateDepartureOptions);
get('departure-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (session?.phase !== 4 || session.ending
      || get('departure-choice').value === '') return;
  const ending = {
    detained: detainedByVote(session.votes),
    leaves: get('departure-choice').value === 'leave',
    passengers: [...get('passengers').querySelectorAll('input:checked')].map((box) => Number(box.value)),
  };
  if (validDeparture(ending)) saveSession({ ...session, ending }, 'departure-result');
});

function render() {
  get('setup').hidden = Boolean(session);
  get('session').hidden = !session;
  if (!session) return;

  const { phase } = session;
  get('phase').textContent = phases[phase].title;
  get('phase-guide').textContent = phases[phase].guide;
  if (phase === 1) {
    get('phase-guide').textContent += ' アグリッパの直接死因は絞殺です。月光蝶の安全制限は、記録A・B・Cの異なる2枚で復旧できます。';
  }
  get('roster').replaceChildren(...roles.map((_, index) => listItem(playerLabel(index))));
  get('advance').hidden = phase >= 3;
  get('advance').textContent = phases[phase].next ?? '';
  get('voting').hidden = phase !== 3;
  get('results').hidden = phase !== 4;
  renderInvestigation();
  if (phase === 3) renderBallots();
  if (phase === 4) {
    renderResults();
    renderDeparture();
  }
}

function startSession(names) {
  saveSession({ names, phase: 0, votes: [], investigations: restoreInvestigations() });
}

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
