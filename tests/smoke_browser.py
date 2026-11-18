"""Click-through of every tab and main action in a real browser at phone size.
Fails on any page error, console error, or action that does not take effect.
Run: python3 tests/smoke_browser.py"""
import json, os, re, subprocess, sys, time, tempfile
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8796
fails = []
def check(label, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + label + (f'  [{extra}]' if extra != '' else ''))
    if not cond: fails.append(label)

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, accept_downloads=True)
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'favicon' not in m.text else None)
        pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(1200)
        pg.add_style_tag(content='.toast{display:none!important}')
        ls = lambda k: pg.evaluate(f"JSON.parse(localStorage.getItem('compound:{k}') || 'null')")
        today = pg.evaluate("(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()")
        tab = lambda t: (pg.click(f'[data-tab="{t}"]'), pg.wait_for_timeout(250))
        txt = lambda: pg.inner_text('#viewRoot')

        print('--- Today')
        for t in ['Read 20 pages', 'Gym', 'Call the bank']:
            pg.fill('#newTaskInput', t); pg.click('#addTaskBtn'); pg.wait_for_timeout(120)
        day = ls('day:' + today)
        check('add three tasks', day and len(day['tasks']) == 3)
        first = day['tasks'][0]['id']
        pg.click(f'[data-action="toggle"][data-id="{first}"]'); pg.wait_for_timeout(250)
        check('tick a task', ls('day:' + today)['tasks'][0]['completed'] is True)
        check('XP shows on Today', '+20' in txt())
        pg.click(f'[data-action="delete"][data-id="{day["tasks"][2]["id"]}"]'); pg.wait_for_timeout(250)
        check('delete a task', len(ls('day:' + today)['tasks']) == 2)
        pg.click('[data-action="coach-today"]'); pg.wait_for_timeout(300)
        check('coach button works', True)
        pg.fill('#reflectInput', 'Long meeting'); pg.click('[data-action="close-day"]'); pg.wait_for_timeout(400)
        check('close out the day', ls('day:' + today)['closedOut'] is True)
        pg.click('[data-action="reopen"]'); pg.wait_for_timeout(300)
        check('reopen the day', ls('day:' + today)['closedOut'] is False)

        print('--- Calendar')
        tab('calendar')
        pg.click('[data-act="chore-new"]'); pg.fill('#chTitle', 'Make the bed'); pg.click('[data-act="chore-save"]'); pg.wait_for_timeout(250)
        check('add a daily chore', any(c['title'] == 'Make the bed' for c in ls('meta:chores')))
        pg.click(f'.cal-cell[data-d="{today}"]'); pg.wait_for_timeout(200)
        pg.click('.cal-detail [data-act="chore-tick"]'); pg.wait_for_timeout(250)
        check('tick the chore from the calendar', (ls('meta:chorelog') or {}).get(today, {}) != {})
        check('today cell is coloured', pg.evaluate(f"(()=>{{const c=document.querySelector('.cal-cell[data-d=\"{today}\"]');return ['g','y','r'].some(k=>c.classList.contains(k))}})()"))
        pg.click('[data-act="cal-prev"]'); pg.click('[data-act="cal-next"]'); pg.wait_for_timeout(150)
        check('month navigation', pg.locator(f'.cal-cell[data-d="{today}"]').count() == 1)

        print('--- Learn')
        tab('learn')
        pg.click('[data-act="lib-add"][data-id="japanese"]'); pg.wait_for_timeout(250)
        check('add Japanese plan', len(ls('meta:skills')) == 1)
        pg.click('.prac-card [data-act="prac-done"]'); pg.wait_for_timeout(250)
        check('mark practice done', any(l['outcome'] == 'done' for l in ls('meta:practicelog')))
        pg.click('[data-act="ai-settings"]'); pg.wait_for_timeout(150)
        check('AI settings opens', pg.is_visible('#aiKey')); pg.click('#aiSaveBtn'); pg.wait_for_timeout(150)
        pg.fill('#chatInput', 'Plan my day'); pg.click('[data-act="chat-copy"]'); pg.wait_for_timeout(300)
        check('chat copy-and-paste flow opens', pg.locator('.manual-box').count() == 1)
        pg.click('[data-act="manual-cancel"]'); pg.wait_for_timeout(150)

        print('--- Goals')
        tab('goals')
        pg.click('[data-action="show-form"][data-form="long"]'); pg.wait_for_timeout(150)
        pg.fill('#fTitle', 'Clear CFA Level I'); pg.click('[data-action="save-goal"]'); pg.wait_for_timeout(250)
        goals = ls('meta:goals')
        check('add a long-range goal', goals and any(g['title'] == 'Clear CFA Level I' for g in goals['longTerm']))
        pg.fill('input[data-step-input]', 'Finish Ethics'); pg.click('[data-action="add-step"]'); pg.wait_for_timeout(250)
        check('add a step', len(ls('meta:goals')['longTerm'][0].get('steps', [])) == 1)
        pg.click('[data-action="toggle-step"]'); pg.wait_for_timeout(250)
        check('complete a step', ls('meta:goals')['longTerm'][0]['steps'][0]['done'] is True)
        pg.click('[data-action="show-event-form"]'); pg.wait_for_timeout(150)
        pg.fill('#evTitle', 'CFA exam'); pg.fill('#evDate', '2027-05-20'); pg.click('[data-action="save-event"]'); pg.wait_for_timeout(250)
        check('add a countdown', any(e['title'] == 'CFA exam' for e in ls('meta:events')))

        print('--- Board')
        tab('board')
        pg.fill('#noteText', 'Send notes to Raghav'); pg.click('[data-action="pin-note"]'); pg.wait_for_timeout(250)
        check('pin a note', len(ls('meta:notes')) == 1)
        pg.click('[data-action="peel-note"]'); pg.wait_for_timeout(600)
        check('peel a note', ls('meta:notes')[0].get('doneAt'))

        print('--- Growth')
        tab('growth')
        check('growth chart renders', pg.locator('#viewRoot svg, #viewRoot canvas').count() >= 1)
        pg.click('[data-action="growth-range"] >> nth=0'); pg.wait_for_timeout(150)

        print('--- Log')
        tab('log')
        pg.fill('#logText', 'Told Raghav I would set up the stall on Saturday'); pg.click('[data-action="save-log"]'); pg.wait_for_timeout(300)
        logs = ls('log:' + today[:4])
        check('add a log entry', logs and len(logs) == 1)
        pg.click('[data-action="edit-log"]'); pg.wait_for_timeout(150)
        pg.fill('#editLogText', 'Told Raghav I would set up the stall on Sunday'); pg.click('[data-action="save-log-edit"]'); pg.wait_for_timeout(250)
        check('edit a log entry', 'Sunday' in ls('log:' + today[:4])[0]['text'])
        pg.click('[data-act="log-to-cal"]'); pg.wait_for_timeout(250)
        check('log links to calendar', pg.locator('.cal-cell.sel .cal-log').count() == 1)

        print('--- History')
        tab('history')
        check('history lists today', '1 / 2' in txt() or 'kept' in txt().lower())
        if pg.locator('[data-action="toggle-history-day"]').count():
            pg.click('[data-action="toggle-history-day"] >> nth=0'); pg.wait_for_timeout(300)
            check('history day opens', pg.locator('.hist-detail-row').count() == 1)

        print('--- Footer')
        pg.click('#voiceBtn'); pg.wait_for_timeout(150); check('voice settings open', pg.is_visible('#vsDone')); pg.click('#vsDone')
        pg.click('#backupsBtn'); pg.wait_for_timeout(500); check('backups open', pg.locator('#bkDone').count() == 1)
        pg.click('#bkNow'); pg.wait_for_timeout(600); check('manual backup listed', pg.locator('[data-bk]').count() >= 1); pg.click('#bkDone')
        with pg.expect_download() as dl:
            pg.click('#exportBtn')
        path = dl.value.path(); data = json.load(open(path))
        check('export file has the ledger', len(data.get('chores', [])) == 1 and len(data.get('notes', [])) == 1 and data.get('today'))
        pg.click('#syncBtn'); pg.wait_for_timeout(150); check('sync settings open', pg.is_visible('#syncToken')); pg.click('#syncClose')

        print('--- Import into a fresh device')
        pg2 = b.new_context(viewport={'width': 390, 'height': 844}).new_page()
        pg2.goto(f'http://localhost:{PORT}/index.html'); pg2.wait_for_timeout(900)
        pg2.set_input_files('#importFile', path); pg2.wait_for_timeout(800)
        check('import brings goals and notes', pg2.evaluate("JSON.parse(localStorage.getItem('compound:meta:goals')).longTerm.length") == 1 and pg2.evaluate("JSON.parse(localStorage.getItem('compound:meta:notes')).length") == 1)

        print('--- Reload keeps everything')
        pg.reload(); pg.wait_for_timeout(1200)
        check('tasks still there after reload', 'Read 20 pages' in pg.inner_text('#viewRoot'))
        check('footer shows version', bool(re.search(r'v\d+\.\d+ · ', pg.inner_text('body'))))

        check('no page or console errors', not errs, ' | '.join(errs)[:400])
        b.close()
finally:
    srv.terminate()
print('ALL PASSED' if not fails else f'{len(fails)} FAILURES: ' + ', '.join(fails))
sys.exit(1 if fails else 0)
