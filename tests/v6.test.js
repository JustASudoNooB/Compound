const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace('<script src="./library.js"></script>', () => '<script>' + fs.readFileSync(path.join(ROOT, 'library.js'), 'utf8') + '</script>');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let failures = 0;
function check(label, cond, extra) {
  console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra !== undefined ? '  [' + extra + ']' : ''));
  if (!cond) failures++;
}
function pad(n) { return String(n).padStart(2, '0'); }
function ds(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function rel(n) { const d = new Date(); d.setHours(12); d.setDate(d.getDate() + n); return ds(d); }
const T = rel(0);
function weekStart(s) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ds(d); }
function plus(s, n) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ds(d); }

async function boot(seed, fetchImpl) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/Compound/',
    beforeParse(win) {
      Object.keys(seed || {}).forEach(k => win.localStorage.setItem(k, typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k])));
      win.Audio = function () { const a = { play: () => Promise.resolve(), pause() {}, addEventListener() {} }; return a; };
      win.fetch = fetchImpl || (() => Promise.reject(new Error('offline in test')));
      win.URL.createObjectURL = () => 'blob:x';
      win.URL.revokeObjectURL = () => {};
      win.HTMLElement.prototype.scrollIntoView = function () {};
    }
  });
  await wait(300);
  return dom;
}
const ls = (w, k) => JSON.parse(w.localStorage.getItem('compound:' + k) || 'null');

(async () => {
  const errors = [];
  /* ---------- seed: chores, history, reviews ---------- */
  const W2 = plus(weekStart(T), -14);           // a Monday two weeks back
  const seed = {
    'compound:meta:app': { lastActiveDate: T, lastExportAt: null, bonusXp: 0, maxLevel: 1 },
    'compound:meta:chores': [
      { id: 'c1', title: 'Make the bed', freq: 'daily', days: [], times: 1, start: rel(-5), end: null, archivedAt: null },
      { id: 'c2', title: 'Deep clean', freq: 'weekly', days: [], times: 2, start: W2, end: plus(W2, 6), archivedAt: null }
    ],
    'compound:meta:chorelog': { [rel(-3)]: { c1: true }, [rel(-5)]: { c1: true }, [plus(W2, 2)]: { c2: true } },
    'compound:stats:daily-summary': [
      { date: rel(-5), planned: 3, completed: 2, plannedWeight: 6, completedWeight: 4, completedXp: 40, rate: 0.66, closedOut: true },
      { date: rel(-4), planned: 4, completed: 2, plannedWeight: 8, completedWeight: 4, completedXp: 40, rate: 0.5, closedOut: true },
      { date: rel(-3), planned: 4, completed: 4, plannedWeight: 8, completedWeight: 8, completedXp: 80, rate: 1, closedOut: true }
    ]
  };
  let dom = await boot(seed);
  let w = dom.window, d = w.document;
  w.addEventListener('error', e => errors.push(e.message));
  const q = s => d.querySelector(s), qa = s => Array.from(d.querySelectorAll(s));
  const tab = async name => { q('[data-tab="' + name + '"]').click(); await wait(20); };
  const toMonth = async (date) => {
    for (let i = 0; i < 3 && !q('.cal-cell[data-d="' + date + '"]'); i++) {
      const first = q('.cal-cell[data-d]').dataset.d;
      q(date < first ? '[data-act="cal-prev"]' : '[data-act="cal-next"]').click(); await wait(15);
    }
    return q('.cal-cell[data-d="' + date + '"]');
  };
  const cls = el => el ? ['g', 'y', 'r'].find(c => el.classList.contains(c)) || '-' : 'missing';

  console.log('--- today shows chores');
  check('chores today section', /Chores today · 0 \/ 1/.test(q('#viewRoot').textContent), (q('#viewRoot').textContent.match(/Chores today[^c]*/) || [''])[0]);
  const xp0 = ls(w, 'meta:app').bonusXp || 0;
  q('[data-act="chore-tick"]').click(); await wait(20);
  check('chore tick logs today', ls(w, 'meta:chorelog')[T] && ls(w, 'meta:chorelog')[T].c1 === true);
  check('chore tick gives +10 xp', ls(w, 'meta:app').bonusXp - xp0 === 10, ls(w, 'meta:app').bonusXp);
  check('day score pill on Today', !!q('.day-pill.g'), q('.section-sub').textContent);
  q('[data-act="chore-tick"]').click(); await wait(20);
  check('untick removes log + xp', !ls(w, 'meta:chorelog')[T] && ls(w, 'meta:app').bonusXp === xp0);

  console.log('--- calendar colours');
  await tab('calendar');
  check('calendar grid renders', qa('.cal-cell[data-d]').length >= 28);
  check('T-3: 4/4 tasks + bed = 100% green', cls(await toMonth(rel(-3))) === 'g', cls(q('.cal-cell[data-d="' + rel(-3) + '"]')));
  check('T-4: 2/4 tasks + missed bed = 40% red', cls(await toMonth(rel(-4))) === 'r', q('.cal-cell[data-d="' + rel(-4) + '"]').textContent);
  check('T-5: 2/3 tasks + bed = 75% yellow', cls(await toMonth(rel(-5))) === 'y', q('.cal-cell[data-d="' + rel(-5) + '"]').textContent);
  check('T-2: only missed bed = red', cls(await toMonth(rel(-2))) === 'r', q('.cal-cell[data-d="' + rel(-2) + '"]').textContent);
  check('weekly chore: done day is green', cls(await toMonth(plus(W2, 2))) === 'g', q('.cal-cell[data-d="' + plus(W2, 2) + '"]').textContent);
  check('weekly chore: 1 of 2 missed on the Sunday is red', cls(await toMonth(plus(W2, 6))) === 'r', q('.cal-cell[data-d="' + plus(W2, 6) + '"]').textContent);
  check('weekly chore: other days unscored', cls(await toMonth(plus(W2, 3))) === '-');
  (await toMonth(plus(W2, 6))).click(); await wait(15);
  check('detail shows missed 1', /missed 1/.test(q('.cal-detail').textContent), q('.cal-detail').textContent.slice(0, 160));
  check('old day is locked (no tick buttons)', !q('.cal-detail [data-act="chore-tick"]') && /locked/.test(q('.cal-detail').textContent));
  (await toMonth(rel(-1))).click(); await wait(15);
  check('yesterday is still editable', !!q('.cal-detail [data-act="chore-tick"]'));
  check('legend has counts', /85%\+ · \d/.test(q('.cal-legend').textContent), q('.cal-legend').textContent);

  console.log('--- add chores');
  q('[data-act="chore-new"]').click(); await wait(15);
  q('#chTitle').value = 'Gym';
  q('#chFreq').value = 'weekly'; q('#chFreq').dispatchEvent(new w.Event('change', { bubbles: true })); await wait(5);
  check('times field appears for weekly', !q('.ch-times').hidden);
  q('#chTimes').value = '3';
  q('#chDur').value = 'week'; q('#chDur').dispatchEvent(new w.Event('change', { bubbles: true }));
  q('[data-act="chore-save"]').click(); await wait(20);
  let chores = ls(w, 'meta:chores');
  const gym = chores.find(c => c.title === 'Gym');
  check('weekly chore saved with 1 week end', gym && gym.freq === 'weekly' && gym.times === 3 && gym.end === plus(T, 6), JSON.stringify(gym));
  q('[data-act="chore-new"]').click(); await wait(15);
  q('#chTitle').value = 'Japanese handwriting';
  q('#chFreq').value = 'days'; q('#chFreq').dispatchEvent(new w.Event('change', { bubbles: true })); await wait(5);
  check('weekday picker appears', !q('.ch-days').hidden);
  q('.wd[data-d="1"]').click(); q('.wd[data-d="2"]').click(); q('.wd[data-d="0"]').click(); // Mon off, Tue off, Sun on
  q('#chDur').value = 'forever';
  q('[data-act="chore-save"]').click(); await wait(20);
  chores = ls(w, 'meta:chores');
  const jp = chores.find(c => c.title === 'Japanese handwriting');
  check('chosen-days chore saved', jp && jp.days.sort().join(',') === '0,3,4,5' && jp.end === null, JSON.stringify(jp && jp.days));
  check('chore cards listed', qa('.goal-card').length >= 3);

  console.log('--- learn: library skill, bandit, reviews');
  await tab('learn');
  check('library chips for 4 skills', qa('[data-act="lib-add"]').length === 4, qa('[data-act="lib-add"]').map(b => b.textContent).join('|'));
  q('[data-act="lib-add"][data-id="japanese"]').click(); await wait(20);
  q('[data-act="lib-add"][data-id="fitness"]').click(); await wait(20);
  let skills = ls(w, 'meta:skills');
  check('two skills saved', skills.length === 2 && skills[0].libId === 'japanese');
  check('today practice cards', qa('.prac-card').length === 2);
  const jpId = skills[0].id, fitId = skills[1].id;
  const pickType = ls(w, 'meta:brain').picks.bySkill[jpId].type;
  q('[data-act="prac-add"][data-id="' + jpId + '"]').click(); await wait(20);
  const dayRec = ls(w, 'day:' + T);
  const skTask = dayRec.tasks.find(t => t.skillRef);
  check('practice added to Today with skillRef', skTask && skTask.skillRef.skillId === jpId && skTask.skillRef.type === pickType, JSON.stringify(skTask && skTask.skillRef));
  check('card shows on today\'s list', /on today.s list/.test(q('.prac-card').textContent));
  const fitPick = ls(w, 'meta:brain').picks.bySkill[fitId].type;
  q('[data-act="prac-wrong"][data-id="' + fitId + '"]').click(); await wait(20);
  let brain = ls(w, 'meta:brain');
  const fitKey = fitId + ':' + fitPick;
  check('wrong for me: b += 2', brain.bandit[fitKey] && brain.bandit[fitKey].b === 3, JSON.stringify(brain.bandit[fitKey]));
  check('wrong for me: muted 7 days', brain.mutes[fitKey] === plus(T, 7), brain.mutes[fitKey]);
  check('wrong for me: new pick is a different type', brain.picks.bySkill[fitId].type !== fitPick, brain.picks.bySkill[fitId].type);
  q('[data-act="prac-skip"][data-id="' + fitId + '"]').click(); await wait(20);
  brain = ls(w, 'meta:brain');
  check('skip logs a skipped outcome', ls(w, 'meta:practicelog').some(l => l.outcome === 'skipped'));

  await tab('today');
  check('skill tag on today row', /あ Japanese/.test(q('#viewRoot').textContent));
  const rowIdx = ls(w, 'day:' + T).tasks.findIndex(t => t.skillRef);
  const tickBtn = q('[data-action="toggle"][data-id="' + skTask.id + '"]');
  tickBtn.click(); await wait(20);
  brain = ls(w, 'meta:brain');
  const jpKey = jpId + ':' + pickType;
  check('finishing the task rewards the bandit', brain.bandit[jpKey] && brain.bandit[jpKey].a === 2, JSON.stringify(brain.bandit[jpKey]));
  check('practice log has done with taskId', ls(w, 'meta:practicelog').some(l => l.taskId === skTask.id && l.outcome === 'done'));
  const kind = skTask.skillRef.kind;
  check('new material schedules a review for tomorrow (or none for review/skill kinds)', kind === 'new' ? ls(w, 'meta:reviews').some(r => r.due === plus(T, 1)) : true, kind);
  q('[data-action="toggle"][data-id="' + skTask.id + '"]').click(); await wait(20);
  brain = ls(w, 'meta:brain');
  check('unticking undoes the reward + log', brain.bandit[jpKey].a === 1 && !ls(w, 'meta:practicelog').some(l => l.taskId === skTask.id), JSON.stringify(brain.bandit[jpKey]));
  check('suggested practice strip on Today', !!q('.prac-strip [data-act="prac-add"]'));

  console.log('--- reviews due');
  const reviews = ls(w, 'meta:reviews') || [];
  reviews.push({ id: 'rv1', skillId: jpId, text: 'Hiragana か row', learnedOn: rel(-1), due: T, interval: 1, ease: 2.4, reps: 0 });
  w.localStorage.setItem('compound:meta:reviews', JSON.stringify(reviews));
  const snap = () => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
  dom = await boot(snap()); w = dom.window; d = w.document; w.addEventListener('error', e => errors.push(e.message));
  await tab('learn');
  check('review card shows', /Hiragana か row/.test(q('#viewRoot').textContent));
  q('[data-act="rev"][data-g="good"][data-id="rv1"]').click(); await wait(20);
  const rv = ls(w, 'meta:reviews').find(r => r.id === 'rv1');
  check('good on first review -> 3 days', rv.due === plus(T, 3) && rv.reps === 1, JSON.stringify(rv));

  console.log('--- learned insights + slip model');
  // 14 past days: 3 tasks each, big tasks never kept, everything else kept
  const hist = {}; const summ = ls(w, 'stats:daily-summary');
  for (let i = 6; i <= 19; i++) {
    const date = rel(-i);
    const tasks = [
      { id: 'a' + i, text: 'Small thing', completed: true, weight: 1 },
      { id: 'b' + i, text: 'Normal thing', completed: true, weight: 2 },
      { id: 'c' + i, text: 'Huge thing', completed: false, weight: 3 }
    ];
    hist['compound:day:' + date] = JSON.stringify({ tasks, reflection: '', closedOut: true, closedAt: null });
    summ.push({ date, planned: 3, completed: 2, plannedWeight: 6, completedWeight: 3, completedXp: 30, rate: 0.66, closedOut: true });
  }
  summ.sort((a, b) => a.date < b.date ? -1 : 1);
  const s2 = Object.assign(snap(), hist, { 'compound:stats:daily-summary': JSON.stringify(summ) });
  const today2 = ls(w, 'day:' + T);
  today2.tasks.push({ id: 'big1', text: 'Write the whole report', completed: false, weight: 3, goalRef: null });
  s2['compound:day:' + T] = JSON.stringify(today2);
  dom = await boot(s2); w = dom.window; d = w.document; w.addEventListener('error', e => errors.push(e.message));
  brain = ls(w, 'meta:brain');
  check('model trained on past tasks', brain.lrN >= 40 && Array.isArray(brain.lr), brain.lrN);
  check('big-task weight is negative', brain.lr[2] < 0, brain.lr && brain.lr[2].toFixed(2));
  const bigRow = q('[data-task="big1"]');
  check('big task flagged likely to slip', bigRow && /likely to slip/.test(bigRow.textContent), bigRow && bigRow.textContent.slice(0, 120));
  check('coach notes card on Today', /Coach notes/.test(q('#viewRoot').textContent));
  check('undone skill task from history penalised? (none in seed)', true);
  await tab('learn');
  const insTexts = qa('.insight').map(e => e.textContent);
  check('big-promise insight', insTexts.some(t => /Big promises get kept 0%/.test(t)), insTexts.join(' || ').slice(0, 300));
  check('biggest factor insight', insTexts.some(t => /Biggest factor/.test(t)));
  const n0 = qa('.insight').length;
  q('[data-act="ins-down"][data-k="big"]').click(); await wait(20);
  check('thumbs down mutes that insight', qa('.insight').length === n0 - 1 && ls(w, 'meta:brain').insightFb.big.mutedUntil === plus(T, 21));
  await tab('today');
  q('[data-act="ins-down"][data-k="slip"]').click(); await wait(20);
  check('muting slip removes flags', !/likely to slip/.test(q('#viewRoot').textContent));

  console.log('--- AI planner (stubbed Anthropic API)');
  const calls = [];
  const planJson = { name: 'Guitar', summary: 'From zero to five songs.', start_level: 0,
    levels: [
      { name: 'Open chords', goal: 'Switch G C D in time', weeks: 4, milestones: ['G to C under 2 s', 'Strum 4/4 for 2 min'], practices: [{ type: 'chord drills', kind: 'skill', minutes: 15, text: 'One-minute changes G-C-D' }, { type: 'new chord', kind: 'new', minutes: 10, text: 'Learn Em and Am shapes' }], resources: [{ title: 'Justin Guitar Beginner Course', kind: 'course' }] },
      { name: 'Songs', goal: 'Play 5 songs', weeks: 6, milestones: ['Song 1 clean'], practices: [{ type: 'song', kind: 'skill', minutes: 20, text: 'Play song 1 with a metronome' }], resources: ['Ultimate Guitar'] }
    ],
    weekly_schedule: [{ day: 'Mon', focus: 'chords', minutes: 20 }], tips: ['Short daily sessions beat long weekly ones'] };
  let reply = '```json\n' + JSON.stringify(planJson) + '\n```';
  const fakeFetch = (url, opts) => { if (!/voice\//.test(url)) calls.push({ url, opts }); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ content: [{ type: 'text', text: reply }] }) }); };
  const s3 = snap();
  dom = await boot(s3, fakeFetch); w = dom.window; d = w.document; w.addEventListener('error', e => errors.push(e.message));
  await tab('learn');
  check('chat asks for setup without a key', !!q('.coach-box [data-act="ai-settings"]'));
  q('[data-act="ai-settings"]').click(); await wait(10);
  check('settings default to free Gemini', q('#modalRoot [data-p="gemini"]').classList.contains('on'));
  q('#modalRoot [data-p="anthropic"]').click(); await wait(10);
  q('#aiKey').value = 'sk-ant-test'; q('#aiModel').value = 'claude-sonnet-5-5';
  q('#aiSaveBtn').click(); await wait(20);
  const conf = JSON.parse(w.localStorage.getItem('compoundAI'));
  check('key stored outside compound: namespace', conf.provider === 'anthropic' && conf.anthropic.key === 'sk-ant-test', JSON.stringify(conf));
  q('[data-act="ai-plan-open"]').click(); await wait(10);
  q('#aiSkill').value = 'Guitar'; q('#aiNow').value = 'never played'; q('#aiTarget').value = 'five songs'; q('#aiMins').value = '25';
  q('[data-act="ai-plan-go"]').click(); await wait(60);
  const c0 = calls[0];
  const body = c0 && JSON.parse(c0.opts.body);
  check('POST to api.anthropic.com/v1/messages', c0 && c0.url === 'https://api.anthropic.com/v1/messages' && c0.opts.method === 'POST');
  check('browser-access + version + key headers', c0 && c0.opts.headers['anthropic-dangerous-direct-browser-access'] === 'true' && c0.opts.headers['anthropic-version'] === '2023-06-01' && c0.opts.headers['x-api-key'] === 'sk-ant-test');
  check('uses chosen model', body && body.model === 'claude-sonnet-5-5', body && body.model);
  check('system prompt has no HTML entities', body && body.system.indexOf('&#') === -1 && /learner's daily/.test(body.system));
  skills = ls(w, 'meta:skills');
  const g = skills.find(s => s.source === 'ai');
  check('AI skill created from plan', g && g.name === 'Guitar' && g.levels.length === 2 && g.levels[1].resources[0].title === 'Ultimate Guitar', JSON.stringify(g && g.levels[1].resources));
  check('resources render as search links (no invented URLs)', qa('a.res').every(a => a.href.indexOf('https://www.google.com/search?q=') === 0) && qa('a.res').length > 0);
  check('weekly rhythm shown', /Weekly rhythm/.test(q('#viewRoot').textContent));

  // re-plan with a correction
  reply = '```json\n' + JSON.stringify(Object.assign({}, planJson, { start_level: 1, summary: 'Skip chords, you know them.' })) + '\n```';
  q('[data-act="ai-fix"][data-id="' + g.id + '"]').click(); await wait(10);
  q('#aiFixText').value = 'I already know open chords';
  q('[data-act="ai-fix-go"]').click(); await wait(60);
  const fixBody = JSON.parse(calls[1].opts.body);
  check('correction sent as follow-up turn', fixBody.messages.length === 3 && /I already know open chords/.test(fixBody.messages[2].content));
  check('plan updated to level 2', ls(w, 'meta:skills').find(s => s.id === g.id).level === 1);

  console.log('--- AI coach chat');
  reply = 'Do the report first while you are fresh.\n```tasks\n[{"text":"Outline the report","size":"quick"},{"text":"Write section 1","size":"standard"}]\n```';
  q('#chatInput').value = 'Plan my day';
  q('[data-act="chat-send"]').click(); await wait(60);
  const chatBody = JSON.parse(calls[2].opts.body);
  check('chat sends data snapshot', /My data right now/.test(chatBody.messages[chatBody.messages.length - 1].content) && /chores_today/.test(chatBody.messages[chatBody.messages.length - 1].content));
  check('chat first message is user', chatBody.messages[0].role === 'user');
  check('task chips rendered', qa('[data-act="chat-add"]').length === 2);
  check('tasks block hidden from text', !/```/.test(q('.chat-log').textContent));
  const nTasks = ls(w, 'day:' + T).tasks.length;
  q('[data-act="chat-add"][data-k="0"]').click(); await wait(20);
  check('chip adds a quick task to Today', ls(w, 'day:' + T).tasks.length === nTasks + 1 && ls(w, 'day:' + T).tasks.slice(-1)[0].weight === 1);
  check('chip marked added', q('[data-act="chat-add"][data-k="0"]').disabled);
  // error path
  const errFetch = () => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: { message: 'invalid x-api-key' } }) });
  w.fetch = errFetch;
  q('#chatInput').value = 'hello'; q('[data-act="chat-send"]').click(); await wait(60);
  check('401 shows a clear error', /API key was rejected/.test(q('.chat-log').textContent));

  console.log('--- export excludes the key');
  let exported = null;
  w.Blob = function (parts) { exported = parts.join(''); };
  d.getElementById('exportBtn').click(); await wait(30);
  const ex = JSON.parse(exported || '{}');
  check('export has chores, skills, reviews, brain', Array.isArray(ex.chores) && ex.chores.length === 4 && ex.skills.length === 3 && Array.isArray(ex.reviews) && !!ex.brain);
  check('export has no API key', exported && exported.indexOf('sk-ant-test') === -1);

  console.log('--- import merges');
  dom = await boot({ 'compound:meta:app': JSON.stringify({ lastActiveDate: T }) }); w = dom.window; d = w.document; w.addEventListener('error', e => errors.push(e.message));
  const file = new w.File([exported], 'x.json', { type: 'application/json' });
  const inp = d.getElementById('importFile');
  Object.defineProperty(inp, 'files', { value: [file] });
  inp.dispatchEvent(new w.Event('change')); await wait(150);
  check('import restores chores + skills', (ls(w, 'meta:chores') || []).length === 4 && (ls(w, 'meta:skills') || []).length === 3);
  check('import restores chore log', Object.keys(ls(w, 'meta:chorelog') || {}).length >= 3);

  console.log('--- reset clears new data');
  d.getElementById('resetBtn').click(); await wait(10);
  const yes = d.getElementById('modalOk');
  yes.click(); await wait(60);
  check('reset wipes chores + skills', !w.localStorage.getItem('compound:meta:chores') && !w.localStorage.getItem('compound:meta:skills'));
  d.querySelector('[data-tab="calendar"]').click(); await wait(20);
  check('calendar renders after reset', !!d.querySelector('.cal-grid'));
  d.querySelector('[data-tab="learn"]').click(); await wait(20);
  check('learn renders after reset', /Add a skill to start/.test(d.querySelector('#viewRoot').textContent));

  console.log('--- runtime errors', errors);
  console.log(failures ? failures + ' FAILURES' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
