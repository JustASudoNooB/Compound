"""Real-browser tests for the v7 features: weekly review, time blocks, streaks
and year view, CFA pack, search, templates, month recap, mood, focus timer,
reminders. Run: python3 tests/features_browser.py"""
import json, os, subprocess, sys, time, datetime, random
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8795
fails = []
def check(label, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + label + (f'  [{extra}]' if extra != '' else ''))
    if not cond: fails.append(label)

today = datetime.date.today()
ds = lambda n: (today + datetime.timedelta(days=n)).isoformat()
random.seed(3)
seed = {}
summary = []
for i in range(1, 40):
    tasks = [{'id': f't{i}a', 'text': f'Read chapter {i}', 'completed': True, 'weight': 2},
             {'id': f't{i}b', 'text': f'Big report part {i}', 'completed': i % 3 == 0, 'weight': 3},
             {'id': f't{i}c', 'text': 'Call home', 'completed': i % 2 == 0, 'weight': 1}]
    seed['compound:day:' + ds(-i)] = json.dumps({'tasks': tasks, 'reflection': '', 'closedOut': True})
    done = sum(t['completed'] for t in tasks)
    summary.append({'date': ds(-i), 'planned': 3, 'completed': done, 'plannedWeight': 6, 'completedWeight': done * 2, 'completedXp': done * 20, 'rate': done / 3, 'closedOut': True})
summary.sort(key=lambda e: e['date'])
seed['compound:stats:daily-summary'] = json.dumps(summary)
seed['compound:meta:app'] = json.dumps({'lastActiveDate': ds(0), 'bonusXp': 0})
seed['compound:day:' + ds(0)] = json.dumps({'tasks': [
    {'id': 'a1', 'text': 'Deep work on CFA', 'completed': False, 'weight': 3},
    {'id': 'a2', 'text': 'Gym', 'completed': False, 'weight': 2},
    {'id': 'a3', 'text': 'Reply to emails', 'completed': True, 'weight': 1}], 'reflection': '', 'closedOut': False})
seed['compound:meta:chores'] = json.dumps([{'id': 'c1', 'title': 'Make the bed', 'freq': 'daily', 'days': [], 'times': 1, 'start': ds(-60), 'end': None, 'archivedAt': None}])
seed['compound:meta:chorelog'] = json.dumps({ds(-i): {'c1': True} for i in range(1, 40) if i not in (5, 6)})
seed['compound:log:' + ds(0)[:4]] = json.dumps([{'id': 'l1', 'dateFor': ds(-2), 'text': 'Promised Raghav the stall poster by Friday', 'createdAt': ds(-2) + 'T10:00:00.000Z'}])

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(500)
        pg.evaluate("s => { localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); }", seed)
        pg.reload(); pg.wait_for_timeout(1200)
        pg.add_style_tag(content='.toast{display:none!important}')
        ls = lambda k: pg.evaluate(f"JSON.parse(localStorage.getItem('compound:{k}') || 'null')")
        tab = lambda t: (pg.click(f'[data-tab="{t}"]'), pg.wait_for_timeout(250))
        txt = lambda: pg.inner_text('#viewRoot')

        print('--- weekly review')
        check('Today offers the week review', pg.locator('[data-act="wk-open"]').count() == 1)
        pg.click('[data-act="wk-open"]'); pg.wait_for_timeout(300)
        check('review shows 7 day bars', pg.locator('.wk-day').count() == 7)
        check('review lists what slipped', pg.locator('.wk-list li').count() >= 3)
        check('review shows stats', 'tasks kept' in txt() and 'green days' in txt())
        pg.fill('#wkNote', 'Big tasks keep slipping on weekdays')
        ins = pg.locator('.wk-in')
        ins.nth(0).fill('Finish CFA Ethics'); ins.nth(1).fill('Gym 3 times')
        pg.click('[data-act="wk-save"]'); pg.wait_for_timeout(300)
        weeks = ls('meta:weeks')
        reviewed = [w for w, r in weeks.items() if r.get('reviewedAt')]
        check('review saved', len(reviewed) == 1 and weeks[reviewed[0]]['note'].startswith('Big tasks'))
        tab('today')
        check('priorities show on Today', 'Finish CFA Ethics' in txt() and 'Gym 3 times' in txt())
        check('review card gone after reviewing', pg.locator('[data-act="wk-open"]').count() == 0)
        pg.click('.wk-today [data-act="wk-pri"] >> nth=0'); pg.wait_for_timeout(300)
        cur = [r for r in ls('meta:weeks').values() if any(p.get('text') == 'Finish CFA Ethics' for p in r.get('priorities', []))][0]
        check('tick a weekly priority', cur['priorities'][0]['done'] is True)

        print('--- time blocks')
        pg.click('[data-act="task-time"][data-id="a1"]'); pg.wait_for_timeout(150)
        pg.fill('#ttAt', '09:00'); pg.select_option('#ttMins', '120'); pg.click('#ttSave'); pg.wait_for_timeout(250)
        t1 = [t for t in ls('day:' + ds(0))['tasks'] if t['id'] == 'a1'][0]
        check('time block saved on the task', t1.get('at') == '09:00' and t1.get('mins') == 120)
        check('schedule appears', pg.locator('.sched-row').count() == 1 and '09:00–11:00' in txt())
        pg.click('[data-act="task-time"][data-id="a2"]'); pg.fill('#ttAt', '10:00'); pg.select_option('#ttMins', '240'); pg.click('#ttSave'); pg.wait_for_timeout(250)
        check('overlap warning', 'Overlap' in txt())
        pg.evaluate("""() => { const d = JSON.parse(localStorage.getItem('compound:day:' + new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10))); }""")

        print('--- year view and streaks')
        tab('calendar')
        pg.click('[data-act="cal-view"][data-v="year"]'); pg.wait_for_timeout(300)
        n_days = pg.locator('.hm-grid.yr button.hm').count()
        check('year view shows about a year of days', 360 <= n_days <= 371, n_days)
        check('year view has coloured days', pg.locator('.hm-grid.yr button.hm.g, .hm-grid.yr button.hm.y, .hm-grid.yr button.hm.r').count() >= 39)
        pg.click(f'.hm-grid.yr button[data-d="{ds(-3)}"]'); pg.wait_for_timeout(300)
        check('tapping a day opens it in the month view', pg.locator(f'.cal-cell.sel[data-d="{ds(-3)}"]').count() == 1)
        check('chore card shows a heatmap', pg.locator('.goal-card .hm-grid .hm.done').count() >= 20)
        check('chore card shows streak and best', 'day streak' in txt() and 'best' in txt())


        print('--- CFA Level I')
        tab('learn')
        pg.click('[data-act="cfa-on"]'); pg.wait_for_timeout(200)
        pg.fill('#cfaDate', '2027-05-18'); pg.click('#cdSave'); pg.wait_for_timeout(250)
        check('CFA panel appears with countdown', 'CFA Level I' in txt() and 'days left' in txt())
        check('all 10 topics listed', pg.locator('.cfa-row').count() == 10)
        check('2027 weights used (Ethics 10–15%)', 'Ethical and Professional Standards10–15%' in txt().replace('\n', '') or '10–15% of the exam' in txt())
        check('reading plan shown', pg.locator('.cfa-plan .sched-row').count() == 10)
        pg.click('[data-act="cfa-open"][data-id="quant"]'); pg.wait_for_timeout(150)
        pg.fill('#cfaN', '40'); pg.fill('#cfaC', '22'); pg.click('[data-act="cfa-log"]'); pg.wait_for_timeout(200)
        pg.click('[data-act="cfa-open"][data-id="fi"]'); pg.wait_for_timeout(150)
        pg.fill('#cfaN', '30'); pg.fill('#cfaC', '27'); pg.click('[data-act="cfa-log"]'); pg.wait_for_timeout(200)
        cf = ls('meta:cfa')
        check('question sets logged', cf['topics']['quant']['qs'][0] == {'date': ds(0), 'n': 40, 'c': 22} and cf['topics']['quant']['status'] == 'reading')
        check('weakest topic called out', 'Weakest for the score: Quantitative Methods' in txt().replace('\n', ' '))
        pg.click('[data-act="cfa-open"][data-id="fi"]'); pg.wait_for_timeout(100)
        pg.click('[data-act="cfa-open"][data-id="fi"]'); pg.wait_for_timeout(100)
        pg.click('[data-act="cfa-status"][data-id="fi"][data-s="done"]'); pg.wait_for_timeout(200)
        check('mark a topic read', ls('meta:cfa')['topics']['fi']['status'] == 'done' and pg.locator('.cfa-plan .sched-row').count() == 9)
        pg.fill('#cfaF', 'Modified duration = Macaulay / (1 + y)'); pg.click('[data-act="cfa-formula"]'); pg.wait_for_timeout(200)
        check('formula goes into spaced reviews', any(r['skillId'] == 'cfa' and 'Macaulay' in r['text'] for r in ls('meta:reviews')))
        pg.click('[data-act="cfa-today"]'); pg.wait_for_timeout(200)
        check('study block added to Today', any(t['text'].startswith('CFA: study') for t in ls('day:' + ds(0))['tasks']))

        print('--- search')
        pg.click('#searchBtn'); pg.wait_for_timeout(500)
        pg.fill('#searchQ', 'raghav poster'); pg.wait_for_timeout(200)
        check('search finds a log entry', pg.locator('.search-hit').count() == 1 and 'log' in pg.inner_text('.search-hit'))
        pg.fill('#searchQ', 'big report'); pg.wait_for_timeout(200)
        check('search finds past tasks', pg.locator('.search-hit').count() >= 30)
        pg.fill('#searchQ', 'raghav'); pg.wait_for_timeout(150)
        pg.click('.search-hit'); pg.wait_for_timeout(300)
        check('result opens the Log at that day', pg.locator('.tab.active[data-tab="log"]').count() == 1)

        print('--- templates')
        tab('today')
        pg.click('[data-act="templates"]'); pg.wait_for_timeout(150)
        pg.fill('#tplName', 'Study day'); pg.click('#tplSave'); pg.wait_for_timeout(200)
        check('template saved', ls('meta:templates')[0]['name'] == 'Study day' and len(ls('meta:templates')[0]['tasks']) == 4)
        check('template keeps time blocks', any(t.get('at') == '09:00' for t in ls('meta:templates')[0]['tasks']))
        pg.click('#tplClose')
        pg.evaluate(f"(() => {{ const k = 'compound:day:{ds(0)}'; const d = JSON.parse(localStorage.getItem(k)); d.tasks = d.tasks.filter(t => t.id !== 'a2'); localStorage.setItem(k, JSON.stringify(d)); }})()")
        pg.reload(); pg.wait_for_timeout(1000); pg.add_style_tag(content='.toast{display:none!important}')
        pg.click('[data-act="templates"]'); pg.wait_for_timeout(150)
        pg.click('[data-tpl-apply]'); pg.wait_for_timeout(300)
        check('applying adds only missing tasks', len(ls('day:' + ds(0))['tasks']) == 4 and any(t['text'] == 'Gym' for t in ls('day:' + ds(0))['tasks']))

        print('--- mood and energy')
        pg.click('[data-act="mood"][data-k="m"][data-v="4"]'); pg.wait_for_timeout(150)
        pg.click('[data-act="mood"][data-k="e"][data-v="2"]'); pg.wait_for_timeout(150)
        mo = ls('meta:mood')[ds(0)]
        check('mood and energy saved', mo['m'] == 4 and mo['e'] == 2)
        check('chosen buttons highlighted', pg.locator('.mood-b.on').count() == 2)

        print('--- focus timer')
        pg.select_option('#focusTask', 'a1'); pg.select_option('#focusMins', '25'); pg.click('[data-act="focus-start"]'); pg.wait_for_timeout(1300)
        check('focus bar running', pg.is_visible('#focusBar') and 'Deep work on CFA' in pg.inner_text('#focusBar'))
        t1 = pg.inner_text('.fb-time')
        check('countdown shows about 25 minutes', t1.startswith('24:') or t1 == '25:00', t1)
        pg.evaluate("(() => { const r = JSON.parse(localStorage.getItem('compound-focus-run')); r.startedAt -= 25*60000 - 1500; localStorage.setItem('compound-focus-run', JSON.stringify(r)); })()")
        pg.wait_for_timeout(2600)
        check('block ends and asks to mark the task done', pg.locator('#modalOk').count() == 1 and 'Did you finish' in pg.inner_text('.modal'))
        pg.click('#modalOk'); pg.wait_for_timeout(300)
        check('focus time logged', ls('meta:focus')[0]['mins'] == 25 and ls('meta:focus')[0]['taskId'] == 'a1')
        check('task marked done from the timer', [t for t in ls('day:' + ds(0))['tasks'] if t['id'] == 'a1'][0]['completed'] is True)
        check('focus bar hidden after', not pg.is_visible('#focusBar'))

        print('--- month recap')
        tab('calendar')
        pg.click('[data-act="cal-view"][data-v="recap"]'); pg.wait_for_timeout(300)
        check('recap shows month stats', 'avg day score' in txt() and 'focused time' in txt() and '25m' in txt())
        pg.click('[data-act="cal-prev"]'); pg.wait_for_timeout(200)
        check('recap moves between months', 'tasks kept' in txt())

        print('--- reminders')
        tab('today')
        pg.click('[data-act="reminders"]'); pg.wait_for_timeout(150)
        check('reminder settings open', pg.is_visible('#remOn'))
        with pg.expect_download() as dl:
            pg.click('#icsDaily')
        ics = open(dl.value.path()).read()
        check('daily calendar reminders file', 'RRULE:FREQ=DAILY' in ics and 'Compound: close out today' in ics and ics.count('BEGIN:VEVENT') == 2)
        with pg.expect_download() as dl2:
            pg.click('#icsBlocks')
        ics2 = open(dl2.value.path()).read()
        check('time blocks exported to calendar', 'Gym' in ics2 and 'TRIGGER:-PT5M' in ics2)
        pg.check('#remOn'); pg.click('#remSaveBtn'); pg.wait_for_timeout(200)
        check('reminders setting saved', pg.evaluate("JSON.parse(localStorage.getItem('compound-reminders')).on") is True)

        print('--- weekly review stats include focus, priorities survive reload')
        pg.reload(); pg.wait_for_timeout(1000)
        check('This week priorities still on Today', 'Finish CFA Ethics' in txt())

        b.close()
        check('no page or console errors', not errs, ' | '.join(errs)[:400])
finally:
    srv.terminate()
print('ALL PASSED' if not fails else f'{len(fails)} FAILURES: ' + ', '.join(fails))
sys.exit(1 if fails else 0)
