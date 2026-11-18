"""Automatic updates, end to end, in a real browser with the service worker on.
An installed copy with data in it must move to a newer version published on the
server without the user doing anything, keep every piece of data, and still
open offline afterwards. Run: python3 tests/update_browser.py"""
import json, os, re, shutil, subprocess, sys, tempfile, time, datetime
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8790
fails = []
def check(label, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + label + (f'  [{extra}]' if extra != '' else ''))
    if not cond: fails.append(label)

cur = json.load(open(os.path.join(ROOT, 'version.json')))['version']
major, minor = cur.split('.')
nxt = f'{major}.{int(minor) + 1}'
site = tempfile.mkdtemp()
def publish(version):
    shutil.copytree(ROOT, site, dirs_exist_ok=True, ignore=shutil.ignore_patterns('.git', 'tests', 'node_modules', 'docs', '*.md'))
    if version != cur:
        p = os.path.join(site, 'index.html'); s = open(p).read()
        s = s.replace(f"var APP_VERSION = '{cur}';", f"var APP_VERSION = '{version}';")
        s = re.sub(r'v\d+\.\d+ · \d+ \w+', f'v{version} · test', s, count=1)
        open(p, 'w').write(s)
        p = os.path.join(site, 'service-worker.js'); s = open(p).read()
        s = re.sub(r"const CACHE_NAME = '[^']+';", f"const CACHE_NAME = 'compound-test-{version}';", s)
        open(p, 'w').write(s)
        open(os.path.join(site, 'version.json'), 'w').write(json.dumps({'version': version}))
publish(cur)
today = datetime.date.today().isoformat()
seed = {
    'compound:meta:app': json.dumps({'lastActiveDate': today, 'bonusXp': 140}),
    'compound:day:' + today: json.dumps({'tasks': [{'id': 'k1', 'text': 'Keep me through the update', 'completed': True, 'weight': 2}], 'reflection': '', 'closedOut': False}),
    'compound:log:' + today[:4]: json.dumps([{'id': 'l1', 'dateFor': today, 'text': 'Logged before the update', 'createdAt': today + 'T08:00:00.000Z'}]),
    'compound:meta:goals': json.dumps({'longTerm': [{'id': 'g1', 'title': 'Clear CFA Level I', 'steps': []}], 'shortTerm': []}),
    'compound:meta:achievements': json.dumps({'close-1': today}),
    'compound-theme': 'sakura', 'compound-looks-seen': '1'
}
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', site], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
URL = f'http://localhost:{PORT}/index.html'
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 820, 'height': 1180}, service_workers='allow')
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(500)
        pg.evaluate("s => { for (const k in s) localStorage.setItem(k, s[k]); }", seed)
        pg.reload(); pg.wait_for_timeout(2500)
        pg.evaluate("Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 15000))])"); pg.wait_for_timeout(500)
        before = pg.evaluate("(() => { const o = {}; for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k.startsWith('compound:')) o[k] = localStorage.getItem(k); } return o; })()")
        check(f'running v{cur}', f'v{cur}' in pg.inner_text('body'))
        check('service worker controls the page', pg.evaluate("!!navigator.serviceWorker.controller"))

        print(f'--- v{nxt} is published while the app stays open')
        publish(nxt)
        pg.fill('#newTaskInput', 'half-typed task')
        pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(2000)
        check('does not reload while you are typing', 'half-typed task' == pg.input_value('#newTaskInput'))
        check('shows an update button instead', pg.locator('#updBar').count() == 1)
        pg.fill('#newTaskInput', '')
        with pg.expect_navigation(timeout=15000):
            pg.click('#updGo')
        pg.wait_for_timeout(2500)
        body = pg.inner_text('body')
        check(f'now running v{nxt}', f'v{nxt}' in body, re.findall(r'v\d+\.\d+ · \S+', body)[:1])
        check('address cleaned up after the update', '?v=' not in pg.url, pg.url)
        after = pg.evaluate("(() => { const o = {}; for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k.startsWith('compound:')) o[k] = localStorage.getItem(k); } return o; })()")
        lost = [k for k in before if k not in after]
        check('no saved key lost', not lost, lost)
        check('today\'s task still there', 'Keep me through the update' in body)
        check('log entry still there', 'Logged before the update' in after.get('compound:log:' + today[:4], ''))
        check('goal still there', 'Clear CFA Level I' in after.get('compound:meta:goals', ''))
        check('look kept', pg.evaluate("document.documentElement.getAttribute('data-theme')") == 'sakura')
        snaps = pg.evaluate("""new Promise(res => { const r = indexedDB.open('compound-backups', 1); r.onsuccess = () => { const g = r.result.transaction('snaps').objectStore('snaps').getAll(); g.onsuccess = () => res(g.result.map(s => s.reason)); }; r.onerror = () => res([]); })""")
        check(f'backup taken before v{nxt} first ran', any(f'before update to v{nxt}' in s for s in snaps), snaps)

        print('--- automatic when idle')
        nn = f'{major}.{int(minor) + 2}'
        publish(nn)
        with pg.expect_navigation(timeout=15000):
            pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
        pg.wait_for_timeout(2500)
        check(f'idle app moved to v{nn} on its own', f'v{nn}' in pg.inner_text('body'))
        check('still has today\'s task', 'Keep me through the update' in pg.inner_text('body'))

        print('--- offline after updating')
        ctx.set_offline(True)
        pg.reload(); pg.wait_for_timeout(2000)
        check('opens offline on the new version', f'v{nn}' in pg.inner_text('body') and 'Keep me through the update' in pg.inner_text('body'))
        ctx.set_offline(False)
        check('no page errors', not errs, ' | '.join(errs)[:300])
        b.close()
finally:
    srv.terminate(); shutil.rmtree(site, ignore_errors=True)
print('ALL PASSED' if not fails else f'{len(fails)} FAILURES: ' + ', '.join(fails))
sys.exit(1 if fails else 0)
