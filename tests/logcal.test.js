// Log entries show on the calendar and link back to the Log
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace('<script src="./library.js"></script>', () => '<script>' + fs.readFileSync(path.join(ROOT, 'library.js'), 'utf8') + '</script>');
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (l, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + l + (x !== undefined ? '  [' + x + ']' : '')); if (!c) failures++; };
const pad = n => String(n).padStart(2, '0');
const rel = n => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const T = rel(0), Y = rel(-1);
const lastYear = String(new Date().getFullYear() - 1);
(async () => {
  const seed = {
    'compound:meta:app': JSON.stringify({ lastActiveDate: T }),
    ['compound:log:' + T.slice(0, 4)]: JSON.stringify([
      { id: 'l1', dateFor: Y, text: 'Told my parents I will finish the ML project by next week.', createdAt: Y + 'T09:15:00.000Z', editedAt: null },
      { id: 'l2', dateFor: Y, text: 'Second note', createdAt: Y + 'T18:00:00.000Z', editedAt: null }]),
    ['compound:log:' + lastYear]: JSON.stringify([{ id: 'old', dateFor: lastYear + '-12-31', text: 'Year end note', createdAt: lastYear + '-12-31T20:00:00.000Z', editedAt: null }])
  };
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/Compound/',
    beforeParse(w) { Object.keys(seed).forEach(k => w.localStorage.setItem(k, seed[k])); w.Audio = function () { return { play: () => Promise.resolve(), pause() {}, addEventListener() {} }; }; w.fetch = () => Promise.reject(new Error('x')); w.HTMLElement.prototype.scrollIntoView = function () { w.scrolled = this.id; }; } });
  await wait(400);
  const w = dom.window, d = w.document, q = s => d.querySelector(s);
  const errors = []; w.addEventListener('error', e => errors.push(e.message));
  const toMonth = async ds => { for (let i = 0; i < 14 && !q('.cal-cell[data-d="' + ds + '"]'); i++) { q(ds < q('.cal-cell[data-d]').dataset.d ? '[data-act="cal-prev"]' : '[data-act="cal-next"]').click(); await wait(10); } return q('.cal-cell[data-d="' + ds + '"]'); };
  q('[data-tab="calendar"]').click(); await wait(20);
  const cell = await toMonth(Y);
  check('logged day is marked with the count', cell.classList.contains('logged') && /✎2/.test(cell.querySelector('.cal-log').textContent) && /2 log entries/.test(cell.getAttribute('aria-label')));
  check('unlogged day has no mark', !(await toMonth(T)).querySelector('.cal-log') || T === Y);
  check('legend explains the mark', /✎ logged/.test(q('.cal-legend').textContent));
  (await toMonth(Y)).click(); await wait(20);
  check('day detail shows the log entries', /Log · 2 entries/.test(q('.cal-detail').textContent) && /Told my parents/.test(q('.cal-detail').textContent));
  q('.cal-log-item').click(); await wait(30);
  check('clicking opens the Log tab at that day', q('.tab.active').dataset.tab === 'log' && w.scrolled === 'log-day-' + Y && q('#log-day-' + Y).classList.contains('log-focus'));
  q('#log-day-' + Y + ' [data-act="log-to-cal"]').click(); await wait(30);
  check('Log links back to that calendar day', q('.tab.active').dataset.tab === 'calendar' && q('.cal-cell.sel').dataset.d === Y);
  const oldCell = await toMonth(lastYear + '-12-31');
  check('entries from earlier years show too', oldCell && oldCell.classList.contains('logged'));
  check('no runtime errors', errors.length === 0, errors.join('|'));
  console.log(failures ? failures + ' FAILURES' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
