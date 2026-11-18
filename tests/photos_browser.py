"""Real-browser test for memories (photos): compression, on-device storage,
viewer, and sync of photos between two devices through a fake GitHub API.
Run: python3 tests/photos_browser.py  (needs Playwright with Chromium)"""
import base64, json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import tempfile
from PIL import Image
IMG_DIR = tempfile.mkdtemp()
_im = Image.new('RGB', (4000, 3000))
_px = _im.load()
for _x in range(0, 4000, 8):
    for _y in range(0, 3000, 8):
        _px[_x, _y] = ((_x * 7) % 256, (_y * 5) % 256, ((_x + _y) * 3) % 256)
_im.save(os.path.join(IMG_DIR, 'big.jpg'), quality=92)
Image.new('RGB', (800, 1200), (30, 120, 90)).save(os.path.join(IMG_DIR, 'tall.png'))
PORT = 8799
fails = []
def check(label, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + label + (f'  [{extra}]' if extra != '' else ''))
    if not cond: fails.append(label)

# ---- fake GitHub (one private repo) ----
repo = {'exists': False, 'files': {}, 'n': 0}
def gh_route(route):
    req = route.request
    url = req.url.split('api.github.com', 1)[1]
    path = url.split('?')[0]
    auth = req.headers.get('authorization', '')
    cors = {'access-control-allow-origin': '*'}
    def send(status, body=None, raw=None):
        if raw is not None:
            route.fulfill(status=status, headers=cors, body=raw, content_type='application/octet-stream')
        else:
            route.fulfill(status=status, headers=cors, content_type='application/json', body=json.dumps(body) if body is not None else '')
    if auth != 'Bearer github_pat_ok':
        return send(401, {'message': 'Bad credentials'})
    if path == '/user': return send(200, {'login': 'zero'})
    if path == '/user/repos' and req.method == 'POST':
        repo['exists'] = True; return send(201, {})
    if path == '/repos/zero/compound-sync':
        return send(200, {'private': True}) if repo['exists'] else send(404, {'message': 'Not Found'})
    pre = '/repos/zero/compound-sync/contents/'
    if path.startswith(pre):
        fp = path[len(pre):]
        f = repo['files'].get(fp)
        if req.method == 'GET':
            if not f: return send(404, {'message': 'Not Found'})
            if 'raw' in req.headers.get('accept', ''): return send(200, raw=f['bytes'])
            return send(200, {'sha': f['sha'], 'content': base64.b64encode(f['bytes']).decode(), 'encoding': 'base64'})
        body = json.loads(req.post_data or '{}')
        if req.method == 'PUT':
            if f and body.get('sha') != f['sha']: return send(409 if body.get('sha') else 422, {'message': 'sha'})
            repo['n'] += 1
            repo['files'][fp] = {'bytes': base64.b64decode(body['content']), 'sha': 's%d' % repo['n']}
            return send(201, {'content': {'sha': 's%d' % repo['n']}})
        if req.method == 'DELETE':
            if not f: return send(404, {'message': 'Not Found'})
            del repo['files'][fp]; return send(200, {})
    send(404, {'message': 'Not Found'})

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
URL = f'http://localhost:{PORT}/index.html'
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        def device(ua=None):
            ctx = b.new_context(viewport={'width': 820, 'height': 1180}, user_agent=ua) if ua else b.new_context(viewport={'width': 820, 'height': 1180})
            ctx.route('https://api.github.com/**', gh_route)
            pg = ctx.new_page(); pg.errs = []
            pg.on('pageerror', lambda e: pg.errs.append(str(e)))
            pg.goto(URL); pg.wait_for_timeout(800)
            pg.add_style_tag(content='.toast{display:none!important}')
            return pg
        def photo_meta(pg): return pg.evaluate("JSON.parse(localStorage.getItem('compound:meta:photos')||'[]')")
        def loaded_tiles(pg): return pg.evaluate("[...document.querySelectorAll('.ph-tile img')].filter(i=>i.naturalWidth>0).length")

        print('--- laptop adds photos (no sync yet)')
        A = device()
        A.set_input_files('input[data-photo-date]', [os.path.join(IMG_DIR, 'big.jpg'), os.path.join(IMG_DIR, 'tall.png')])
        A.wait_for_timeout(2500)
        meta = photo_meta(A)
        check('two memories saved for today', len(meta) == 2 and all(m['date'] for m in meta), len(meta))
        big = [m for m in meta if m['w'] >= m['h']][0]
        check('big photo resized to 1600 px', max(big['w'], big['h']) == 1600, f"{big['w']}x{big['h']}")
        check('stored size far below the 3.4 MB original', big['bytes'] < 900_000, big['bytes'])
        check('thumbnails render on Today', loaded_tiles(A) == 2, loaded_tiles(A))
        check('"only on this device" hint while sync is off', 'only on this device' in A.inner_text('#viewRoot'))
        A.click('.ph-tile[data-act="ph-open"]'); A.wait_for_timeout(500)
        check('viewer shows the full photo', A.evaluate("document.getElementById('phFull').naturalWidth") > 1000)
        A.fill('#phCaption', 'Sunset at the lake'); A.click('#phSave'); A.wait_for_timeout(300)
        check('caption saved', any(m['caption'] == 'Sunset at the lake' for m in photo_meta(A)))
        A.click('[data-tab="calendar"]'); A.wait_for_timeout(300)
        today = A.evaluate("(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()")
        check('calendar marks the day with photos', A.locator(f'.cal-cell[data-d="{today}"] .cal-ph').count() == 1)
        A.click(f'.cal-cell[data-d="{today}"]'); A.wait_for_timeout(400)
        check('calendar day panel shows the memories', A.evaluate("[...document.querySelectorAll('.cal-detail .ph-tile img')].filter(i=>i.naturalWidth>0).length") == 2)

        print('--- reload keeps photos')
        A.reload(); A.wait_for_timeout(1200)
        check('photos still there after reload', loaded_tiles(A) == 2)

        print('--- laptop turns sync on')
        A.click('#syncBtn'); A.fill('#syncToken', 'github_pat_ok'); A.click('#syncGo'); A.wait_for_timeout(4000)
        photo_files = [k for k in repo['files'] if k.startswith('photos/')]
        check('photos uploaded to the private repo', len(photo_files) == 2, photo_files)
        check('photo list synced in the data file', 'Sunset at the lake' in repo['files']['compound-data.json']['bytes'].decode())
        code = A.input_value('#syncCodeOut')
        A.click('#syncClose')

        print('--- iPad joins')
        B = device('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')
        B.click('#syncBtn'); B.fill('#syncCode', code); B.click('#syncCodeGo'); B.wait_for_timeout(5000)
        B.click('#syncClose'); B.click('[data-tab="today"]'); B.wait_for_timeout(1500)
        check('iPad downloads and shows both photos', loaded_tiles(B) == 2, loaded_tiles(B))
        check('caption arrived on iPad', 'Sunset at the lake' in B.inner_text('#viewRoot'))
        B.click('.ph-tile[data-act="ph-open"]'); B.wait_for_timeout(600)
        check('iPad viewer shows the full-size photo', B.evaluate("document.getElementById('phFull').naturalWidth") > 1000)
        B.click('#phClose')

        print('--- iPad adds a photo, laptop receives it')
        B.set_input_files('input[data-photo-date]', [os.path.join(IMG_DIR, 'tall.png')])
        B.wait_for_timeout(6500)
        check('iPad photo uploaded', len([k for k in repo['files'] if k.startswith('photos/')]) == 3)
        A.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); A.wait_for_timeout(4000)
        A.click('[data-tab="today"]'); A.wait_for_timeout(800)
        check('laptop shows the iPad photo', loaded_tiles(A) == 3, loaded_tiles(A))

        print('--- delete on laptop removes it everywhere')
        A.click('.ph-tile[data-act="ph-open"]'); A.wait_for_timeout(300)
        A.click('#phDelete'); A.click('#modalOk'); A.wait_for_timeout(6000)
        check('photo file removed from the repo', len([k for k in repo['files'] if k.startswith('photos/')]) == 2)
        B.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); B.wait_for_timeout(4000)
        B.click('[data-tab="today"]'); B.wait_for_timeout(800)
        check('iPad no longer shows the deleted photo', B.locator('.ph-tile[data-act="ph-open"]').count() == 2)

        print('--- install offer')
        C = device('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36')
        check('Android tab offers to install', C.locator('.install-banner').count() == 1 and C.is_visible('#installBtn'))
        C.click('.install-banner [data-act="install"]'); C.wait_for_timeout(200)
        check('install steps shown', 'Install app' in C.inner_text('.modal'))
        C.click('#instClose'); C.click('[data-act="install-dismiss"]'); C.wait_for_timeout(200)
        check('banner can be dismissed', C.locator('.install-banner').count() == 0)

        errs = A.errs + B.errs + C.errs
        check('no page errors', not errs, ' | '.join(errs)[:300])
        b.close()
finally:
    srv.terminate()
print('ALL PASSED' if not fails else f'{len(fails)} FAILURES')
sys.exit(1 if fails else 0)
