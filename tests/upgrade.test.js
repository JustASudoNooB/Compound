// Upgrade safety: data saved by an older version must survive the current build untouched.
// Run: npm test   (needs jsdom and fake-indexeddb)
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace('<script src="./library.js"></script>', () => '<script>' + fs.readFileSync(path.join(ROOT, 'library.js'), 'utf8') + '</script>');
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
function check(label, cond, extra) {
  console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra !== undefined ? '  [' + extra + ']' : ''));
  if (!cond) failures++;
}
const pad = n => String(n).padStart(2, '0');
function rel(n) { const d = new Date(); d.setHours(12); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
const T = rel(0);

let idb = new IDBFactory();
async function boot(seed, keepStorage) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/Compound/',
    beforeParse(win) {
      if (seed) Object.keys(seed).forEach(k => win.localStorage.setItem(k, seed[k]));
      win.indexedDB = idb;
      win.Audio = function () { return { play: () => Promise.resolve(), pause() {}, addEventListener() {} }; };
      win.fetch = () => Promise.reject(new Error('offline'));
      win.HTMLElement.prototype.scrollIntoView = function () {};
    } });
  await wait(400);
  dom.window.errors = [];
  dom.window.addEventListener('error', e => dom.window.errors.push(e.message));
  return dom;
}
const dump = w => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
// every value the old version saved is still present (new fields may be added)
function contains(oldV, newV, loose) {
  if (Array.isArray(oldV)) return Array.isArray(newV) && oldV.every(o => newV.some(n => contains(o, n, loose)));
  if (oldV && typeof oldV === 'object') return !!newV && typeof newV === 'object' && Object.keys(oldV).every(k => k in newV && contains(oldV[k], newV[k], loose));
  return loose ? true : deepEq(oldV, newV);
}
function snapshots(w) {
  return new Promise((res, rej) => {
    const r = w.indexedDB.open('compound-backups', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('snaps', { keyPath: 'id' });
    r.onsuccess = () => { const g = r.result.transaction('snaps').objectStore('snaps').getAll(); g.onsuccess = () => { r.result.close(); res(g.result); }; g.onerror = rej; };
    r.onerror = rej;
  });
}

// A realistic ledger written by v6.1 (no version stamp yet)
const J = JSON.stringify;
function v61Seed() {
  const s = {};
  const summary = [];
  for (let i = 20; i >= 1; i--) {
    const tasks = [{ id: 'a' + i, text: 'Task A ' + i, completed: i % 3 !== 0, goalRef: { type: 'long', id: 'g1' }, weight: 2 },
      { id: 'b' + i, text: 'Big task ' + i, completed: i % 2 === 0, goalRef: null, weight: 3 },
      { id: 'c' + i, text: 'Kana handwriting', completed: true, goalRef: null, weight: 1, skillRef: { skillId: 'sk1', type: 'handwriting', kind: 'new', minutes: 20 } }];
    s['compound:day:' + rel(-i)] = J({ tasks, reflection: i === 4 ? 'tired' : '', closedOut: true, closedAt: rel(-i) + 'T22:00:00.000Z' });
    const done = tasks.filter(t => t.completed).length;
    summary.push({ date: rel(-i), planned: 3, completed: done, plannedWeight: 6, completedWeight: done * 2, completedXp: done * 20, rate: done / 3, closedOut: true });
  }
  s['compound:day:' + T] = J({ tasks: [{ id: 't1', text: 'Apply to 2 roles', completed: false, goalRef: null, weight: 3 }], reflection: '', closedOut: false, closedAt: null });
  s['compound:stats:daily-summary'] = J(summary);
  s['compound:meta:app'] = J({ lastActiveDate: T, lastExportAt: rel(-3) + 'T10:00:00.000Z', voice: { on: true, gender: 'm', ticks: true, chime: true }, bonusXp: 420, maxLevel: 6 });
  s['compound:meta:goals'] = J({ longTerm: [{ id: 'g1', title: 'Land a markets role', description: '', archived: false, createdAt: rel(-60), targetDate: rel(150), stats: { planned: 20, completed: 13 }, steps: [{ id: 's1', text: 'CV', done: true, doneAt: rel(-30) + 'T09:00:00.000Z' }] }], shortTerm: [] });
  s['compound:meta:events'] = J([{ id: 'e1', title: "Mom's birthday", targetDate: rel(20), targetTime: '', note: '', createdAt: rel(-5) }]);
  s['compound:meta:notes'] = J([{ id: 'n1', text: 'Call Mom on Sunday', who: 'Mom', color: 'orange', createdAt: rel(-9) + 'T08:00:00.000Z', doneAt: null }]);
  s['compound:log:' + T.slice(0, 4)] = J([{ id: 'l1', date: rel(-2), text: 'Told my parents about the plan', createdAt: rel(-2) + 'T20:00:00.000Z' }]);
  s['compound:meta:chores'] = J([{ id: 'c1', title: 'Make the bed', freq: 'daily', days: [], times: 1, start: rel(-20), end: null, createdAt: rel(-20), archivedAt: null },
    { id: 'c2', title: 'Gym', freq: 'weekly', days: [], times: 3, start: rel(-20), end: rel(40), createdAt: rel(-20), archivedAt: null }]);
  s['compound:meta:chorelog'] = J({ [rel(-1)]: { c1: true }, [rel(-2)]: { c1: true, c2: true } });
  s['compound:meta:skills'] = J([{ id: 'sk1', libId: 'japanese', name: 'Japanese', icon: 'あ', summary: 'x', source: 'library', levels: [{ name: 'Kana', goal: 'kana', weeks: 3, milestones: ['m1', 'm2'], practices: [{ type: 'handwriting', kind: 'new', minutes: 20, text: 'Write kana' }], resources: [] }], level: 0, milestones: { 0: [true, false] }, createdAt: rel(-20), active: true }]);
  s['compound:meta:practicelog'] = J([{ id: 'p1', date: rel(-1), skillId: 'sk1', type: 'handwriting', kind: 'new', minutes: 20, outcome: 'done', taskId: 'c1' }]);
  s['compound:meta:reviews'] = J([{ id: 'r1', skillId: 'sk1', text: 'Write kana', learnedOn: rel(-1), due: T, interval: 1, ease: 2.4, reps: 0 }]);
  s['compound:meta:brain'] = J({ bandit: { 'sk1:handwriting': { a: 4, b: 1.5 } }, mutes: {}, picks: { date: null, bySkill: {} }, insightFb: { big: { up: 0, down: 1, mutedUntil: rel(10) } }, seenDays: {}, lr: null, lrN: 0, lrAt: null });
  s['compound:meta:aichat'] = J([{ role: 'user', content: 'Plan my day', at: rel(-1) + 'T08:00:00.000Z' }]);
  s['compoundAI'] = J({ provider: 'gemini', gemini: { key: 'AIza-keep-me' } });
  return s;
}
// learned state and bookkeeping that the app may legitimately update on launch
const LOOSE = new Set(['compound:meta:app', 'compound:meta:brain']);

(async () => {
  console.log('--- upgrading a v6.1 ledger');
  const seed = v61Seed();
  let dom = await boot(seed);
  let w = dom.window, d = w.document;
  const after = dump(w);
  const lost = Object.keys(seed).filter(k => !(k in after));
  check('no saved key disappears', lost.length === 0, lost.join(','));
  const changed = Object.keys(seed).filter(k => k in after && !contains(JSON.parse(seed[k]), JSON.parse(after[k]), LOOSE.has(k)));
  check('every saved value is still present', changed.length === 0, changed.join(','));
  check('AI key untouched', after.compoundAI === seed.compoundAI);
  const ver = JSON.parse(after['compound:meta:version'] || 'null');
  check('version stamp written', ver && ver.app === '6.3' && ver.data === 2, JSON.stringify(ver));
  let snaps = await snapshots(w);
  const up = snaps.find(s => /before update to v6\.3/.test(s.reason));
  const seedNs = Object.fromEntries(Object.entries(seed).filter(([k]) => k.startsWith('compound:')));
  check('backup taken before the update', !!up);
  check('backup is an exact copy of the old ledger', up && deepEq(Object.keys(up.data).sort(), Object.keys(seedNs).sort()) && Object.keys(seedNs).every(k => up.data[k] === seedNs[k]));
  check('backup never contains the AI key', up && JSON.stringify(up.data).indexOf('AIza-keep-me') === -1);
  check('daily backup taken', snaps.some(s => s.reason === 'daily'));
  check('app renders after upgrade', /Apply to 2 roles/.test(d.querySelector('#viewRoot').textContent));
  check('no runtime errors', w.errors.length === 0, w.errors.join('|'));

  console.log('--- relaunching the same version');
  const n0 = snaps.length;
  dom = await boot(dump(w)); w = dom.window; d = w.document;
  snaps = await snapshots(w);
  check('no extra backups on a normal relaunch', snaps.length === n0, n0 + '->' + snaps.length);

  console.log('--- restoring a backup');
  w.localStorage.removeItem('compound:meta:chores');
  w.localStorage.setItem('compound:meta:notes', '[]');
  d.getElementById('backupsBtn').click(); await wait(80);
  const rows = Array.from(d.querySelectorAll('[data-bk]'));
  check('backups listed with contents', rows.length >= 2 && /21 days · 61 tasks · 2 chores · 1 skills · 1 notes/.test(d.querySelector('.bk-list').textContent), d.querySelector('.bk-list') && d.querySelector('.bk-list').textContent.slice(0, 160));
  rows.find(b => b.dataset.bk === up.id).click(); await wait(20);
  d.getElementById('modalOk').click(); await wait(150);
  const restored = dump(w);
  check('restore brings the old ledger back exactly', Object.keys(seedNs).every(k => restored[k] === seedNs[k]));
  snaps = await snapshots(w);
  check('restore saved the state it replaced', snaps.some(s => s.reason === 'before restore' && !('compound:meta:chores' in s.data)));

  console.log('--- reset can be undone');
  dom = await boot(dump(w)); w = dom.window; d = w.document;
  d.getElementById('resetBtn').click(); await wait(20);
  d.getElementById('modalOk').click(); await wait(150);
  check('reset cleared the ledger', !w.localStorage.getItem('compound:meta:skills'));
  snaps = await snapshots(w);
  const pre = snaps.find(s => s.reason === 'before reset');
  check('reset took a full backup first', pre && pre.data['compound:meta:skills'] === seedNs['compound:meta:skills']);

  console.log('--- unreadable data is set aside, not destroyed');
  idb = new IDBFactory();
  const bad = v61Seed(); bad['compound:meta:goals'] = '{"longTerm":[{"id":"g1","title":"Land a ma';
  dom = await boot(bad); w = dom.window;
  const corrupt = Object.keys(dump(w)).filter(k => k.startsWith('compound-corrupt:meta:goals:'));
  check('broken key copied aside', corrupt.length === 1 && w.localStorage.getItem(corrupt[0]) === bad['compound:meta:goals']);
  snaps = await snapshots(w);
  check('upgrade backup still holds the original text', snaps.some(s => s.data['compound:meta:goals'] === bad['compound:meta:goals']));

  console.log('--- upgrading straight from v5 (before chores and skills existed)');
  idb = new IDBFactory();
  const v5 = {};
  ['compound:day:' + T, 'compound:stats:daily-summary', 'compound:meta:goals', 'compound:meta:events', 'compound:meta:notes', 'compound:log:' + T.slice(0, 4)].forEach(k => { v5[k] = seed[k]; });
  v5['compound:meta:app'] = J({ lastActiveDate: T, lastExportAt: null, voice: { on: true, gender: 'f', ticks: false, chime: true }, bonusXp: 60, maxLevel: 2 });
  for (let i = 1; i <= 3; i++) v5['compound:day:' + rel(-i)] = seed['compound:day:' + rel(-i)];
  dom = await boot(v5); w = dom.window; d = w.document;
  const a5 = dump(w);
  check('v5 keys all intact', Object.keys(v5).every(k => k in a5 && contains(JSON.parse(v5[k]), JSON.parse(a5[k]), LOOSE.has(k))));
  snaps = await snapshots(w);
  check('v5 upgrade backed up first', snaps.some(s => /before update/.test(s.reason) && Object.keys(v5).every(k => s.data[k] === v5[k])));
  d.querySelector('[data-tab="calendar"]').click(); await wait(30);
  d.querySelector('[data-tab="learn"]').click(); await wait(30);
  check('new tabs work on old data', !!d.querySelector('.coach-box') && w.errors.length === 0, w.errors.join('|'));

  console.log('--- importing an export never overwrites local data');
  idb = new IDBFactory();
  dom = await boot(v61Seed()); w = dom.window; d = w.document;
  let exported = '';
  w.Blob = function (parts) { exported = parts.join(''); };
  w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
  d.getElementById('exportBtn').click(); await wait(50);
  const local = {
    'compound:meta:app': J({ lastActiveDate: T, bonusXp: 5 }),
    'compound:meta:goals': J({ longTerm: [{ id: 'g9', title: 'Local goal', archived: false, createdAt: T, stats: { planned: 0, completed: 0 } }], shortTerm: [] }),
    'compound:meta:events': J([{ id: 'e9', title: 'Local event', targetDate: rel(9), targetTime: '', note: '', createdAt: T }]),
    ['compound:day:' + T]: J({ tasks: [{ id: 'local1', text: 'Local task', completed: true, goalRef: null, weight: 2 }], reflection: '', closedOut: false, closedAt: null }),
    'compound:stats:daily-summary': J([{ date: rel(-1), planned: 5, completed: 5, plannedWeight: 10, completedWeight: 10, completedXp: 100, rate: 1, closedOut: true }])
  };
  dom = await boot(local); w = dom.window; d = w.document;
  const file = new w.File([exported], 'x.json', { type: 'application/json' });
  const inp = d.getElementById('importFile');
  Object.defineProperty(inp, 'files', { value: [file] });
  inp.dispatchEvent(new w.Event('change')); await wait(200);
  const g = JSON.parse(w.localStorage.getItem('compound:meta:goals'));
  check('import keeps local goals and adds imported ones', g.longTerm.some(x => x.id === 'g9') && g.longTerm.some(x => x.id === 'g1'));
  const ev = JSON.parse(w.localStorage.getItem('compound:meta:events'));
  check('import keeps local events', ev.some(x => x.id === 'e9') && ev.some(x => x.id === 'e1'));
  const td = JSON.parse(w.localStorage.getItem('compound:day:' + T));
  check('import keeps today\'s local tasks', td.tasks.some(x => x.id === 'local1') && td.tasks.some(x => x.id === 't1'));
  const sm = JSON.parse(w.localStorage.getItem('compound:stats:daily-summary'));
  check('import does not replace a day already recorded', sm.find(x => x.date === rel(-1)).planned === 5 && sm.length >= 20);
  snaps = await snapshots(w);
  check('import took a backup first', snaps.some(s => s.reason === 'before import' && s.data['compound:meta:goals'] === local['compound:meta:goals']));

  console.log(failures ? failures + ' FAILURES' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
