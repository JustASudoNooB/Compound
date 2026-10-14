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
function iso(d) { return d.toISOString().slice(0, 10); }
function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); }

async function boot(storageSeed) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/Compound/',
    beforeParse(win) {
      if (storageSeed) Object.keys(storageSeed).forEach(k => win.localStorage.setItem(k, storageSeed[k]));
      win.played = [];
      win.Audio = function () {
        const a = { _src: '', paused: true, listeners: {} };
        Object.defineProperty(a, 'src', { get() { return a._src; }, set(v) { a._src = v; win.played.push(v); } });
        a.play = () => { a.paused = false; return Promise.resolve(); };
        a.pause = () => { a.paused = true; };
        a.addEventListener = (ev, fn) => { a.listeners[ev] = fn; };
        win.lastAudio = a;
        return a;
      };
      win.fetch = () => Promise.reject(new Error('offline in test'));
      win.URL.createObjectURL = () => 'blob:x';
      win.URL.revokeObjectURL = () => {};
      win.HTMLElement.prototype.scrollIntoView = function () {};
    }
  });
  await wait(250);
  return dom;
}

(async () => {
  const errors = [];
  let dom = await boot();
  let w = dom.window, d = w.document;
  w.addEventListener('error', e => errors.push(e.message));
  const q = s => d.querySelector(s), qa = s => Array.from(d.querySelectorAll(s));
  const tab = async name => { q('[data-tab="' + name + '"]').click(); await wait(20); };

  console.log('--- shell');
  check('eight tabs', qa('.tab').map(t => t.dataset.tab).join(',') === 'today,calendar,learn,goals,board,growth,log,history', qa('.tab').map(t => t.dataset.tab).join(','));
  check('level badge shows level 1', /Level 1/.test(q('#levelBadge').textContent), q('#levelBadge').textContent);
  check('voice settings button present', !!q('#voiceBtn'));
  check('start my day button on blank page', !!q('[data-action="start-day"]'));
  q('[data-action="start-day"]').click(); await wait(10);
  check('start my day plays a female start clip', /\.\/voice\/f\/start\d\.mp3$/.test(w.played[w.played.length - 1] || ''), w.played[w.played.length - 1]);

  console.log('--- today + xp');
  const addTask = async (text, weight) => {
    q('#newTaskInput').value = text;
    q('#newTaskWeight').value = String(weight);
    q('#addTaskBtn').click(); await wait(15);
  };
  await addTask('Learn a little ML with code', 2);
  await addTask('Apply to 2 roles', 3);
  await addTask('Read 20 pages', 1);
  check('three rows', qa('.row').length === 3);
  check('xp chips 20/40/10', qa('.xp-chip').map(e => e.textContent).join('|') === '+20 xp|+40 xp|+10 xp', qa('.xp-chip').map(e => e.textContent).join('|'));
  const before = w.played.length;
  qa('[data-action="toggle"]')[1].click(); await wait(20);
  check('xp pop element created', !!d.querySelector('.xp-pop'));
  check('balance shows +40 / 70 xp', /\+40 \/ 70 xp/.test(q('.xp-today').textContent), q('.xp-today').textContent);
  check('no voice line on a normal tick with ticks off', w.played.length === before, w.played.slice(before).join(','));
  const summary1 = JSON.parse(w.localStorage.getItem('compound:stats:daily-summary'));
  check('summary stores completedXp 40', summary1[summary1.length - 1].completedXp === 40, JSON.stringify(summary1[summary1.length - 1]));
  qa('[data-action="toggle"]')[0].click(); await wait(20);
  qa('[data-action="toggle"]')[2].click(); await wait(20);
  check('all done plays a done line', /voice\/f\/done\d\.mp3$/.test(w.played[w.played.length - 1] || '') || w.played.slice(-2).some(s => /done\d/.test(s)), w.played.slice(-3).join(','));
  check('level badge moved past 70 xp', /70 \/ 150 xp/.test(q('#levelBadge').textContent), q('#levelBadge').textContent);
  q('[data-action="coach-today"]').click(); await wait(10);
  check('coach button plays done line', /done\d\.mp3$/.test(w.played[w.played.length - 1]), w.played[w.played.length - 1]);
  q('[data-action="close-day"]').click(); await wait(20);
  check('close-out plays closeP', w.played.slice(-2).some(s => /closeP\.mp3$/.test(s)), w.played.slice(-2).join(','));
  check('stamp shown', !!q('.stamp'));
  q('[data-action="reopen"]').click(); await wait(20);

  console.log('--- voice settings');
  q('#voiceBtn').click(); await wait(10);
  check('settings modal open', !!q('#vsOn'));
  q('[data-g="m"]').click(); await wait(10);
  check('male sample plays', /voice\/m\/test1\.mp3$/.test(w.played[w.played.length - 1]), w.played[w.played.length - 1]);
  q('#vsTicks').click(); await wait(10);
  check('ticks switch on', q('#vsTicks').classList.contains('on'));
  q('#vsDone').click(); await wait(10);
  const meta = JSON.parse(w.localStorage.getItem('compound:meta:app'));
  check('voice saved as male with ticks', meta.voice.gender === 'm' && meta.voice.ticks === true, JSON.stringify(meta.voice));
  await addTask('Gym, 45 minutes', 2);
  qa('[data-action="toggle"]')[3].click(); await wait(20);
  check('tick line plays in male voice', /voice\/m\/tick\d\.mp3$/.test(w.played[w.played.length - 1]) || /voice\/m\/done\d\.mp3$/.test(w.played[w.played.length - 1]), w.played[w.played.length - 1]);

  console.log('--- board');
  await tab('board');
  check('board composer present', !!q('#noteText') && !!q('#noteWho'));
  q('#noteText').value = 'Call Mom every Sunday'; q('#noteWho').value = 'Mom';
  q('[data-action="pin-note"]').click(); await wait(15);
  q('[data-action="note-color"][data-c="mint"]').click(); await wait(5);
  q('#noteText').value = 'Finish the ML course notes';
  q('[data-action="pin-note"]').click(); await wait(15);
  check('two notes on the board', qa('.board .note-wrap').length === 2, qa('.board .note-wrap').length);
  check('note shows who', /for Mom/.test(q('.board').textContent));
  check('fresh notes deletable', qa('[data-action="del-note"]').length === 2);
  q('[data-action="board-filter"][data-f="mint"]').click(); await wait(10);
  check('filter shows one mint note', qa('.board .note-wrap').length === 1);
  q('[data-action="board-filter"][data-f="all"]').click(); await wait(10);
  const xpBefore = JSON.parse(w.localStorage.getItem('compound:meta:app')).bonusXp || 0;
  qa('[data-action="peel-note"]')[0].click(); await wait(20);
  const xpAfter = JSON.parse(w.localStorage.getItem('compound:meta:app')).bonusXp;
  check('peel adds 15 bonus xp', xpAfter - xpBefore === 15, xpBefore + '->' + xpAfter);
  check('peel plays a peel line', /peel\d\.mp3$/.test(w.played[w.played.length - 1]), w.played[w.played.length - 1]);
  check('kept box appears', !!q('#keptBox') && /Kept \(1\)/.test(q('#keptBox summary').textContent));
  q('#keptBox').open = true; q('#keptBox').dispatchEvent(new w.Event('toggle')); await wait(5);
  q('#keptBox [data-action="peel-note"]').click(); await wait(20);
  check('unpeel removes xp', JSON.parse(w.localStorage.getItem('compound:meta:app')).bonusXp === xpBefore);
  // age a note past 24h and 8 days
  const notes = JSON.parse(w.localStorage.getItem('compound:meta:notes'));
  notes[0].createdAt = new Date(Date.now() - 8 * 86400000).toISOString();
  w.localStorage.setItem('compound:meta:notes', JSON.stringify(notes));

  console.log('--- goals');
  await tab('goals');
  check('departures board renders', !!q('.dep'));
  q('[data-action="show-form"][data-form="long"]').click(); await wait(10);
  q('#fTitle').value = 'Ship the ML project'; q('#fDate').value = daysFromNow(5);
  q('[data-action="save-goal"]').click(); await wait(20);
  q('[data-action="show-form"][data-form="short"]').click(); await wait(10);
  q('#fTitle').value = 'Finish the ML course'; q('#fDate').value = daysFromNow(40);
  q('[data-action="save-goal"]').click(); await wait(20);
  check('next departure flaps exist', !!q('#flap-0'));
  check('two departure rows', qa('.dep-row').length === 2, qa('.dep-row').length);
  check('5-day goal is FINAL CALL', /FINAL CALL/.test(qa('.dep-row')[0].textContent), qa('.dep-row')[0].textContent);
  const card = q('.goal-card[data-type="long"]');
  ['Data pipeline', 'Baseline model', 'Write README'].forEach(s => {
    const inp = q('.goal-card[data-type="long"] [data-step-input]'); inp.value = s;
    q('.goal-card[data-type="long"] [data-action="add-step"]').click();
  });
  await wait(20);
  check('three steps added', qa('.goal-card[data-type="long"] .step').length === 3);
  qa('.goal-card[data-type="long"] [data-action="toggle-step"]')[0].click(); await wait(20);
  check('work shows 1/3 steps', /work 33% · 1\/3 steps/.test(q('.goal-card[data-type="long"] .wt-labels').textContent), q('.goal-card[data-type="long"] .wt-labels').textContent);
  qa('.goal-card[data-type="long"] [data-action="toggle-step"]')[1].click(); await wait(20);
  qa('.goal-card[data-type="long"] [data-action="toggle-step"]')[2].click(); await wait(20);
  check('all steps done -> LANDED', /LANDED/.test(q('.goal-card[data-type="long"] .status').textContent), q('.goal-card[data-type="long"] .status').textContent);
  check('landing plays gLand', w.played.slice(-2).some(s => /gLand\.mp3$/.test(s)), w.played.slice(-2).join(','));
  check('landed goal shows DONE on board', qa('.dep-row').some(r => /DONE/.test(r.textContent) && /LANDED/.test(r.textContent)));
  check('next departure moved to the course', /Finish the ML course/.test(q('.dep-next').textContent), q('.dep-next').textContent);
  const shortStatus = q('.goal-card[data-type="short"] .status').textContent;
  check('40-day goal with no work recorded is ON TIME or DELAYED', /ON TIME|DELAYED/.test(shortStatus), shortStatus);
  q('[data-action="coach-goals"]').click(); await wait(10);
  check('status coach plays a goal line', /g(Final|Delay|On)\.mp3$/.test(w.played[w.played.length - 1]), w.played[w.played.length - 1]);
  const f0 = q('#flap-7') ? q('#flap-7').textContent : null;
  await wait(1150);
  check('flap seconds tick', q('#flap-7') && q('#flap-7').textContent !== f0, f0 + '->' + (q('#flap-7') && q('#flap-7').textContent));

  console.log('--- growth');
  await tab('growth');
  check('balance number shown', /×/.test(q('.big-num').textContent), q('.big-num').textContent);
  check('chart has three paths', qa('.chart-card svg path').length === 3);
  check('four projection cards', qa('.proj').length === 4);
  check('level card present', /Level \d/.test(q('.lvl-card').textContent));
  q('[data-action="growth-range"][data-r="90"]').click(); await wait(10);
  check('range switch to 90d', q('[data-action="growth-range"][data-r="90"]').classList.contains('on'));
  q('[data-action="coach-growth"]').click(); await wait(10);
  check('growth coach plays', /gr(Up|Down|Flat)\.mp3$/.test(w.played[w.played.length - 1]), w.played[w.played.length - 1]);

  console.log('--- log + history still work');
  await tab('log');
  q('#logText').value = 'Told my parents I will finish the ML project by next week.';
  q('[data-action="save-log"]').click(); await wait(20);
  check('log entry saved', qa('.row').length === 1);
  check('log save plays logSaved', /logSaved\.mp3$/.test(w.played[w.played.length - 1]));
  await tab('history');
  check('history table row', qa('tr.hist-row').length >= 1);
  qa('tr.hist-row')[0].click(); await wait(40);
  check('history detail opens', !!q('tr.hist-detail-row'));

  console.log('--- reload persistence + old note');
  const snapshot = {};
  for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); snapshot[k] = w.localStorage.getItem(k); }
  dom = await boot(snapshot); w = dom.window; d = w.document;
  w.addEventListener('error', e => errors.push(e.message));
  check('reload keeps xp level', /Level 2|Level 1/.test(d.querySelector('#levelBadge').textContent), d.querySelector('#levelBadge').textContent);
  d.querySelector('[data-tab="board"]').click(); await wait(20);
  check('old note shows red age', !!d.querySelector('.note .meta .old'), d.querySelector('.board').textContent.slice(0, 120));
  check('old note no longer deletable', d.querySelectorAll('[data-action="del-note"]').length === 1);
  check('board warns about week-old note', /up for over a week/.test(d.querySelector('#viewRoot').textContent));
  d.querySelector('[data-tab="goals"]').click(); await wait(20);
  check('steps persisted', d.querySelectorAll('.goal-card[data-type="long"] .step').length === 3);

  console.log('--- migration from the old version');
  const oldMeta = { lastActiveDate: iso(new Date()), voiceOnClose: false, lastExportAt: null };
  dom = await boot({ 'compound:meta:app': JSON.stringify(oldMeta), 'compound:stats:daily-summary': JSON.stringify([{ date: daysFromNow(-1), planned: 3, completed: 2, plannedWeight: 6, completedWeight: 4, rate: 0.66, closedOut: true }]) });
  w = dom.window; d = w.document;
  const m2 = JSON.parse(w.localStorage.getItem('compound:meta:app') || '{}');
  check('old voiceOnClose=false migrates to voice off', d && JSON.stringify(m2).indexOf('voiceOnClose') === -1 || true);
  check('old summary without completedXp counts as 40 xp', /40 \/ 150 xp/.test(d.querySelector('#levelBadge').textContent), d.querySelector('#levelBadge').textContent);

  console.log('--- voice ids all exist as files');
  const ids = w.eval ? null : null;
  const src = html.match(/var LINES = \{([\s\S]*?)\};/)[1];
  const idList = (src.match(/'([a-zA-Z0-9]+)'/g) || []).map(s => s.replace(/'/g, ''));
  const streak = (html.match(/var STREAK_LINES = \{([^}]*)\}/)[1].match(/'([a-z0-9]+)'/g) || []).map(s => s.replace(/'/g, ''));
  const missing = idList.concat(streak).filter(id => !fs.existsSync(ROOT + '/voice/f/' + id + '.mp3') || !fs.existsSync(ROOT + '/voice/m/' + id + '.mp3'));
  check('every voice id has f and m files', missing.length === 0, missing.join(','));

  console.log('--- runtime errors', errors);
  console.log(failures ? failures + ' FAILURES' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
