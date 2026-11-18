"""Looks (themes) and rewards in a real browser.
Run: python3 tests/looks_browser.py"""
import json, os, subprocess, sys, time, datetime
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8791
fails = []
def check(label, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + label + (f'  [{extra}]' if extra != '' else ''))
    if not cond: fails.append(label)
today = datetime.date.today().isoformat()
seed = {'compound:meta:app': json.dumps({'lastActiveDate': today}),
        'compound:day:' + today: json.dumps({'tasks': [{'id': 'a', 'text': 'One', 'completed': False, 'weight': 2},
                                                       {'id': 'b', 'text': 'Two', 'completed': False, 'weight': 2},
                                                       {'id': 'c', 'text': 'Three', 'completed': False, 'weight': 3}], 'reflection': '', 'closedOut': False})}
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(400)
        pg.evaluate("s => { localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); }", seed)
        pg.reload(); pg.wait_for_timeout(1500)

        print('--- picker')
        check('new looks banner on Today', pg.locator('.looks-banner').count() == 1)
        pg.click('[data-act="looks"]'); pg.wait_for_timeout(200)
        check('ten looks offered (drop, four futuristic, five classic)', pg.locator('[data-theme-pick]').count() == 10, pg.locator('[data-theme-pick]').count())
        check('banner gone once opened', pg.locator('.looks-banner').count() == 0)
        for t in ['matchday', 'terminal', 'manga', 'sakura']:
            pg.click(f'[data-theme-pick="{t}"]'); pg.wait_for_timeout(150)
            check(f'{t} applies', pg.evaluate("document.documentElement.getAttribute('data-theme')") == t)
        bg = pg.evaluate("getComputedStyle(document.body).backgroundColor")
        check('sakura changes the page colours', bg == 'rgb(29, 26, 58)', bg)
        pg.click('[data-theme-pick="ledger"]'); pg.wait_for_timeout(150)
        check('ledger removes the attribute', pg.evaluate("document.documentElement.hasAttribute('data-theme')") is False)
        print('--- futuristic')
        for f in ['neon', 'aurora', 'holo', 'orbit']:
            pg.click(f'[data-theme-pick="{f}"]'); pg.wait_for_timeout(150)
            st = pg.evaluate("[document.documentElement.getAttribute('data-theme'), document.documentElement.getAttribute('data-fam'), document.documentElement.hasAttribute('data-dark'), getComputedStyle(document.documentElement, '::before').content]")
            check(f'{f} applies with its animated background', st[0] == f and st[1] == f and st[3] != 'none', st)
            check(f'{f} dark setting right', st[2] == (f != 'holo'))
        bgs = pg.evaluate("getComputedStyle(document.body, '::before').animationName")
        check('orbit stars twinkle', bgs == 'twinkle', bgs)
        print('--- weekly drop')
        a = pg.evaluate("window.__compoundDrop('2026-11-16')"); b2 = pg.evaluate("window.__compoundDrop('2026-11-22')"); c = pg.evaluate("window.__compoundDrop('2026-11-23')")
        check('same drop all week', a == b2, (a, b2))
        check('new drop next Monday', a['week'] != c['week'] and (a['fam'] != c['fam'] or a['h1'] != c['h1']), (a, c))
        drops = {json.dumps(pg.evaluate(f"window.__compoundDrop('{d}')")) for d in ['2026-11-02','2026-11-09','2026-11-16','2026-11-23','2026-11-30','2026-12-07']}
        check('six weeks give six different looks', len(drops) == 6)
        pg.click('[data-theme-pick="weekly"]'); pg.wait_for_timeout(150)
        cur = pg.evaluate("window.__compoundDrop()")
        st = pg.evaluate("[document.documentElement.getAttribute('data-theme'), document.documentElement.style.getPropertyValue('--h1')]")
        check('picking the drop applies this week\'s family and colour', st[0] == cur['fam'] and st[1].strip() == str(cur['h1']), (st, cur))
        check('drop card names the look', cur['name'] in pg.inner_text('.drop-card'))
        pg.click('#lkKeep'); pg.wait_for_timeout(200)
        saved = pg.evaluate("JSON.parse(localStorage.getItem('compound-looks-saved'))")
        check('save keeps this week\'s look', len(saved) == 1 and saved[0]['h1'] == cur['h1'])
        check('saved look listed and current', pg.locator('[data-theme-pick^="fav-"]').count() == 1 and pg.evaluate("localStorage.getItem('compound-theme')").startswith('fav-'))
        pg.click('[data-theme-pick="aurora"]'); pg.wait_for_timeout(100)
        pg.click('#lkDone'); pg.reload(); pg.wait_for_timeout(300)
        st = pg.evaluate("[document.documentElement.getAttribute('data-theme'), document.documentElement.hasAttribute('data-dark'), document.querySelector('meta[name=theme-color]').content]")
        check('futuristic look applied before the app script runs', st[0] == 'aurora' and st[1] and st[2] == '#04060c', st)
        pg.wait_for_timeout(800)
        pg.evaluate("document.querySelector('#looksBtn').click()"); pg.wait_for_timeout(150)
        pg.click('[data-theme-pick="terminal"]'); pg.click('#lkDone')
        pg.reload(); pg.wait_for_timeout(300)
        check('look is applied before the app script runs (no flash)', pg.evaluate("document.documentElement.getAttribute('data-theme')") == 'terminal')
        check('futuristic attributes cleared for a classic look', pg.evaluate("!document.documentElement.hasAttribute('data-fam') && !document.documentElement.hasAttribute('data-dark')"))
        check('browser bar colour follows the look', pg.evaluate("document.querySelector('meta[name=theme-color]').content") == '#000000')
        pg.wait_for_timeout(1200)

        print('--- rewards')
        check('progress ring at 0%', pg.locator('.ring .rg-txt').inner_text() == '0%')
        pg.click('[data-action="toggle"][data-id="a"]'); pg.wait_for_timeout(250)
        check('tick bursts particles', pg.evaluate("document.querySelectorAll('.fx-p').length") > 0)
        check('ring moves to 33%', pg.locator('.ring .rg-txt').inner_text() == '33%')
        xp0 = pg.evaluate("JSON.parse(localStorage.getItem('compound:meta:app')).bonusXp || 0")
        pg.click('[data-action="toggle"][data-id="b"]'); pg.wait_for_timeout(250)
        check('second quick tick shows a combo', pg.locator('.combo').count() == 1 and 'Combo ×2' in pg.locator('.combo').inner_text())
        check('combo adds bonus xp', pg.evaluate("JSON.parse(localStorage.getItem('compound:meta:app')).bonusXp || 0") - xp0 >= 5)
        pg.click('[data-action="toggle"][data-id="b"]'); pg.wait_for_timeout(150)
        pg.click('[data-action="toggle"][data-id="b"]'); pg.wait_for_timeout(250)
        check('untick and re-tick does not farm combos', pg.locator('.combo').count() <= 1)
        pg.wait_for_timeout(1300)
        pg.click('[data-action="toggle"][data-id="c"]'); pg.wait_for_timeout(700)
        check('perfect day opens the look\'s celebration', pg.locator('.cele').count() == 1 and '100.00%' in pg.inner_text('.cele'))
        check('terminal look runs the ticker', pg.locator('.ticker').count() == 1)
        check('ring full with a check', pg.locator('.ring.full').count() == 1)
        pg.click('.cele'); pg.wait_for_timeout(500)
        check('tap closes the celebration', pg.locator('.cele').count() == 0)

        print('--- achievements')
        pg.click('[data-action="close-day"]'); pg.wait_for_timeout(2600)
        got = pg.evaluate("JSON.parse(localStorage.getItem('compound:meta:achievements') || '{}')")
        check('closing the day unlocks "First entry"', 'close-1' in got, got)
        pg.click('[data-tab="growth"]'); pg.wait_for_timeout(300)
        check('Growth lists achievements with progress', pg.locator('.ach').count() >= 20 and pg.locator('.ach.got').count() >= 1)

        print('--- celebrations off')
        pg.evaluate("localStorage.setItem('compound-fx', 'off')")
        pg.evaluate("document.querySelector('#looksBtn').click()"); pg.wait_for_timeout(150)
        pg.click('#lkTry'); pg.wait_for_timeout(300)
        check('off means no overlay', pg.locator('.cele').count() == 0)

        check('no errors', not errs, ' | '.join(errs)[:300])
        b.close()
finally:
    srv.terminate()
print('ALL PASSED' if not fails else f'{len(fails)} FAILURES: ' + ', '.join(fails))
sys.exit(1 if fails else 0)
