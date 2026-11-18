// Every release must bump all version markers together, or devices will not update.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).version;
const app = (html.match(/var APP_VERSION = '([\d.]+)';/) || [])[1];
const foot = (html.match(/v([\d.]+) · \d+ \w+/) || [])[1];
const cache = (sw.match(/const CACHE_NAME = 'compound-v([\d-]+)';/) || [])[1];
let fails = 0;
const check = (l, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + l + ' [' + x + ']'); if (!c) fails++; };
check('version.json matches APP_VERSION', v === app, v + ' / ' + app);
check('footer label matches', foot === v, foot);
check('service worker cache name matches', cache === v.replace(/\./g, '-'), cache);
check('version.json is never cached by the worker', /version\\\.json/.test(sw));
console.log(fails ? fails + ' FAILURES' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
