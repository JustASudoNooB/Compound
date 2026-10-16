// If the browser's backup storage hangs (seen on some iOS versions), the ledger must still load
const fs = require('fs'), path = require('path'), { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace('<script src="./library.js"></script>', () => '<script>' + fs.readFileSync(path.join(ROOT, 'library.js'), 'utf8') + '</script>');
const pad = n => String(n).padStart(2, '0'); const d0 = new Date();
const T = d0.getFullYear() + '-' + pad(d0.getMonth() + 1) + '-' + pad(d0.getDate());
(async () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/Compound/',
    beforeParse(w) {
      w.localStorage.setItem('compound:meta:app', JSON.stringify({ lastActiveDate: T }));
      w.localStorage.setItem('compound:day:' + T, JSON.stringify({ tasks: [{ id: 't1', text: 'Task I set today', completed: false, weight: 2 }], reflection: '', closedOut: false }));
      w.localStorage.setItem('compound:log:' + T.slice(0, 4), JSON.stringify([{ id: 'l1', dateFor: T, text: 'My log line', createdAt: T + 'T08:00:00.000Z' }]));
      w.indexedDB = { open() { return {}; } };            // never answers
      Object.defineProperty(w.navigator, 'storage', { value: { persist: () => new Promise(() => {}) } });
      w.Audio = function () { return { play: () => Promise.resolve(), pause() {}, addEventListener() {} }; };
      w.fetch = () => Promise.reject(new Error('x'));
    } });
  await new Promise(r => setTimeout(r, 3600));
  const d = dom.window.document;
  const ok1 = /Task I set today/.test(d.querySelector('#viewRoot').textContent);
  d.querySelector('[data-tab="log"]').click(); await new Promise(r => setTimeout(r, 30));
  const ok2 = /My log line/.test(d.querySelector('#viewRoot').textContent);
  console.log((ok1 ? 'PASS' : 'FAIL') + ' today\'s tasks load even if backup storage hangs');
  console.log((ok2 ? 'PASS' : 'FAIL') + ' log loads even if backup storage hangs');
  console.log(ok1 && ok2 ? 'ALL PASSED' : 'FAILURES'); process.exit(ok1 && ok2 ? 0 : 1);
})();
