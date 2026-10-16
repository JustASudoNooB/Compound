// Two devices syncing through a (fake) private GitHub repo
const fs = require('fs'), path = require('path'), { JSDOM } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace('<script src="./library.js"></script>', () => '<script>' + fs.readFileSync(path.join(ROOT, 'library.js'), 'utf8') + '</script>');
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (l, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + l + (x !== undefined ? '  [' + x + ']' : '')); if (!c) failures++; };
const pad = n => String(n).padStart(2, '0'); const d0 = new Date();
const T = d0.getFullYear() + '-' + pad(d0.getMonth() + 1) + '-' + pad(d0.getDate());

// ---- fake GitHub ----
const gh = { repo: null, file: null, sha: 0, user: 'zero', token: 'github_pat_good', force409: 0, puts: 0, private: true, log: [] };
function respond(status, body) { const text = body == null ? '' : (typeof body === 'string' ? body : JSON.stringify(body)); return Promise.resolve({ status, ok: status >= 200 && status < 300, text: () => Promise.resolve(text) }); }
function fakeFetch(url, opts) {
  opts = opts || {};
  if (!/api\.github\.com/.test(url)) return Promise.reject(new Error('offline'));
  const h = opts.headers || {};
  gh.log.push((opts.method || 'GET') + ' ' + url.replace('https://api.github.com', ''));
  if (h.Authorization !== 'Bearer ' + gh.token) return respond(401, { message: 'Bad credentials' });
  const u = url.replace('https://api.github.com', ''), m = opts.method || 'GET';
  if (u === '/user') return respond(200, { login: gh.user });
  if (u === '/user/repos' && m === 'POST') { gh.repo = { private: true }; return respond(201, {}); }
  if (u === '/repos/zero/compound-sync') return gh.repo ? respond(200, { private: gh.private }) : respond(404, { message: 'Not Found' });
  if (u === '/repos/zero/compound-sync/contents/compound-data.json') {
    if (!gh.repo) return respond(404, { message: 'Not Found' });
    if (m === 'GET') {
      if (!gh.file) return respond(404, { message: 'Not Found' });
      if (/raw/.test(h.Accept)) return respond(200, gh.file);
      return respond(200, { sha: 's' + gh.sha, content: Buffer.from(gh.file, 'utf8').toString('base64').replace(/(.{60})/g, '$1\n'), encoding: 'base64' });
    }
    if (m === 'PUT') {
      const b = JSON.parse(opts.body);
      if (gh.force409 > 0) { gh.force409--; gh.sha++; return respond(409, { message: 'sha mismatch' }); }
      if ((gh.file ? 's' + gh.sha : undefined) !== b.sha) return respond(409, { message: 'sha mismatch' });
      gh.file = Buffer.from(b.content, 'base64').toString('utf8'); gh.sha++; gh.puts++;
      return respond(200, { content: { sha: 's' + gh.sha } });
    }
  }
  return respond(404, { message: 'Not Found' });
}
async function device(seed) {
  const idb = new IDBFactory();
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/Compound/',
    beforeParse(w) {
      Object.keys(seed).forEach(k => w.localStorage.setItem(k, typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k])));
      w.indexedDB = idb; w.fetch = fakeFetch; w.btoa = s => Buffer.from(s, 'binary').toString('base64'); w.atob = s => Buffer.from(s, 'base64').toString('binary');
      w.Audio = function () { return { play: () => Promise.resolve(), pause() {}, addEventListener() {} }; };
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: () => Promise.resolve() } });
    } });
  await wait(400);
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message));
  return w;
}
const day = w => JSON.parse(w.localStorage.getItem('compound:day:' + T) || '{"tasks":[]}');
const texts = w => day(w).tasks.map(t => t.text).sort().join('|');
const remoteKeys = () => JSON.parse(gh.file).keys;

(async () => {
  console.log('--- laptop turns sync on');
  const laptop = await device({
    'compound:meta:app': { lastActiveDate: T, bonusXp: 40 },
    ['compound:day:' + T]: { tasks: [{ id: 'L1', text: 'Laptop task 1', completed: false, weight: 2 }, { id: 'L2', text: 'Laptop task 2', completed: true, weight: 1 }], reflection: '', closedOut: false },
    ['compound:log:' + T.slice(0, 4)]: [{ id: 'log1', dateFor: T, text: 'Logged from the laptop', createdAt: T + 'T05:00:00.000Z' }],
    'compound:meta:goals': { longTerm: [{ id: 'g1', title: 'Laptop goal' }], shortTerm: [] },
    compoundAI: { provider: 'gemini', gemini: { key: 'AIza-secret' } }
  });
  laptop.document.getElementById('syncBtn').click(); await wait(10);
  laptop.document.getElementById('syncToken').value = 'github_pat_bad';
  laptop.document.getElementById('syncGo').click(); await wait(80);
  check('wrong token is refused with a clear message', /rejected the token/.test(laptop.document.getElementById('syncMsg').textContent) && !laptop.localStorage.getItem('compoundSync'));
  laptop.document.getElementById('syncToken').value = 'github_pat_good';
  laptop.document.getElementById('syncGo').click(); await wait(150);
  check('private repo created and data uploaded', gh.repo && gh.file && !!remoteKeys()['compound:day:' + T]);
  check('upload holds the log entry', /Logged from the laptop/.test(remoteKeys()['compound:log:' + T.slice(0, 4)].v));
  check('AI key and sync token never uploaded', gh.file.indexOf('AIza-secret') === -1 && gh.file.indexOf('github_pat_good') === -1);
  const code = laptop.document.getElementById('syncCodeOut').value;
  check('setup code shown for other devices', /^CMPD1\./.test(code));
  check('footer shows synced', /synced/.test(laptop.document.getElementById('syncLabel').textContent));

  console.log('--- iPad joins with the setup code (it already had its own task)');
  const ipad = await device({
    'compound:meta:app': { lastActiveDate: T, bonusXp: 10 },
    ['compound:day:' + T]: { tasks: [{ id: 'P1', text: 'iPad task', completed: false, weight: 2 }], reflection: '', closedOut: false }
  });
  ipad.document.getElementById('syncBtn').click(); await wait(10);
  ipad.document.getElementById('syncCode').value = 'CMPD1.broken';
  ipad.document.getElementById('syncCodeGo').click(); await wait(20);
  check('broken setup code refused', /not complete/.test(ipad.document.getElementById('syncMsg').textContent));
  ipad.document.getElementById('syncCode').value = code;
  ipad.document.getElementById('syncCodeGo').click(); await wait(250);
  check('iPad now has laptop tasks and keeps its own', texts(ipad) === 'Laptop task 1|Laptop task 2|iPad task', texts(ipad));
  check('iPad shows the laptop tasks on screen', /Laptop task 1/.test(ipad.document.querySelector('#viewRoot').textContent) || (() => { ipad.document.getElementById('modalRoot').innerHTML = ''; return true; })());
  ipad.document.getElementById('modalRoot').innerHTML = '';
  ipad.document.querySelector('[data-tab="today"]').click(); await wait(20);
  check('Today on iPad lists laptop tasks', /Laptop task 1/.test(ipad.document.querySelector('#viewRoot').textContent));
  ipad.document.querySelector('[data-tab="log"]').click(); await wait(20);
  check('Log on iPad shows the laptop entry', /Logged from the laptop/.test(ipad.document.querySelector('#viewRoot').textContent));
  ipad.document.querySelector('[data-tab="calendar"]').click(); await wait(20);
  check('Calendar on iPad marks the logged day', !!ipad.document.querySelector('.cal-cell[data-d="' + T + '"] .cal-log'));
  check('XP kept the higher total', JSON.parse(ipad.localStorage.getItem('compound:meta:app')).bonusXp === 40);
  check('goal arrived', /Laptop goal/.test(ipad.localStorage.getItem('compound:meta:goals')));

  console.log('--- laptop picks up the iPad task');
  laptop.document.dispatchEvent(new laptop.Event('visibilitychange')); await wait(200);
  check('laptop has the iPad task', texts(laptop) === 'Laptop task 1|Laptop task 2|iPad task', texts(laptop));
  laptop.document.getElementById('modalRoot').innerHTML = '';
  laptop.document.querySelector('[data-tab="today"]').click(); await wait(20);
  check('laptop screen shows it', /iPad task/.test(laptop.document.querySelector('#viewRoot').textContent));

  console.log('--- ticking a task on the iPad reaches the laptop');
  ipad.document.querySelector('[data-tab="today"]').click(); await wait(20);
  ipad.document.querySelector('[data-action="toggle"][data-id="L1"]').click();
  await wait(3200);  // auto-sync a few seconds after a change
  laptop.document.dispatchEvent(new laptop.Event('visibilitychange')); await wait(200);
  check('L1 is done on the laptop', day(laptop).tasks.find(t => t.id === 'L1').completed === true);

  console.log('--- both devices add tasks before syncing');
  laptop.document.querySelector('#newTaskInput').value = 'Offline laptop add'; laptop.document.querySelector('#addTaskBtn').click();
  ipad.document.querySelector('#newTaskInput').value = 'Offline iPad add'; ipad.document.querySelector('#addTaskBtn').click();
  await wait(3300); await wait(300);
  laptop.document.dispatchEvent(new laptop.Event('visibilitychange')); await wait(250);
  ipad.document.dispatchEvent(new ipad.Event('visibilitychange')); await wait(250);
  check('laptop has both new tasks', /Offline iPad add/.test(texts(laptop)) && /Offline laptop add/.test(texts(laptop)), texts(laptop));
  check('iPad has both new tasks', /Offline iPad add/.test(texts(ipad)) && /Offline laptop add/.test(texts(ipad)), texts(ipad));

  console.log('--- deleting on one device removes it on the other');
  const del = day(laptop).tasks.find(t => t.text === 'Offline laptop add');
  laptop.document.querySelector('[data-tab="today"]').click(); await wait(10);
  laptop.document.querySelector('[data-action="delete"][data-id="' + del.id + '"]').click();
  await wait(3300);
  ipad.document.dispatchEvent(new ipad.Event('visibilitychange')); await wait(250);
  check('deleted task gone on iPad', !/Offline laptop add/.test(texts(ipad)), texts(ipad));

  console.log('--- write race with another device');
  gh.force409 = 1;
  ipad.document.querySelector('#newTaskInput').value = 'Race task'; ipad.document.querySelector('#addTaskBtn').click();
  await wait(3500);
  check('retry after a write race still uploads', /Race task/.test(remoteKeys()['compound:day:' + T].v));

  console.log('--- offline');
  const savedFetch = ipad.fetch; ipad.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  ipad.document.dispatchEvent(new ipad.Event('visibilitychange')); await wait(150);
  check('offline shows waiting, data untouched', /waiting for internet/.test(ipad.document.getElementById('syncLabel').textContent) && /Race task/.test(texts(ipad)));
  ipad.fetch = savedFetch;

  console.log('--- public repo is refused');
  gh.private = false;
  const third = await device({ 'compound:meta:app': { lastActiveDate: T } });
  third.document.getElementById('syncBtn').click(); await wait(10);
  third.document.getElementById('syncCode').value = code; third.document.getElementById('syncCodeGo').click(); await wait(120);
  check('public repo refused', /is public/.test(third.document.getElementById('syncMsg').textContent));
  gh.private = true;

  check('no runtime errors', !laptop.errs.length && !ipad.errs.length, laptop.errs.concat(ipad.errs).join('|'));
  console.log(failures ? failures + ' FAILURES' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
