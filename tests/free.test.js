const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace('<script src="./library.js"></script>', () => '<script>' + fs.readFileSync(path.join(ROOT, 'library.js'), 'utf8') + '</script>');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let failures = 0;
function check(label, cond, extra) {
  console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra !== undefined ? '  [' + extra + ']' : ''));
  if (!cond) failures++;
}
function pad(n) { return String(n).padStart(2, '0'); }
const now = new Date(); const T = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

async function boot(seed, fetchImpl, clip) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/Compound/',
    beforeParse(win) {
      Object.keys(seed || {}).forEach(k => win.localStorage.setItem(k, typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k])));
      win.Audio = function () { return { play: () => Promise.resolve(), pause() {}, addEventListener() {} }; };
      win.fetch = fetchImpl || ((url) => /voice\//.test(url) ? Promise.reject(new Error('no audio')) : Promise.reject(new Error('offline in test')));
      win.copied = [];
      if (clip !== false) Object.defineProperty(win.navigator, 'clipboard', { configurable: true, value: { writeText: t => { win.copied.push(t); return Promise.resolve(); } } });
      win.URL.createObjectURL = () => 'blob:x'; win.URL.revokeObjectURL = () => {};
      win.HTMLElement.prototype.scrollIntoView = function () {};
    }
  });
  await wait(300);
  return dom;
}
const snap = w => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };

const planJson = { name: 'Spanish', summary: 'Beginner to simple conversations.', start_level: 0,
  levels: [
    { name: 'Sounds and basics', goal: 'Introduce yourself', weeks: 3, milestones: ['Say 20 phrases'], practices: [{ type: 'speaking', kind: 'skill', minutes: 15, text: 'Shadow 10 phrases aloud' }, { type: 'vocab', kind: 'new', minutes: 10, text: 'Learn 10 new words' }], resources: [{ title: 'Language Transfer Complete Spanish', kind: 'audio course' }] },
    { name: 'Present tense', goal: 'Talk about your day', weeks: 5, milestones: ['Describe your day in 10 sentences'], practices: [{ type: 'writing', kind: 'skill', minutes: 20, text: 'Write 5 sentences about today' }], resources: ['Anki'] }
  ], weekly_schedule: [{ day: 'Mon', focus: 'speaking', minutes: 20 }], tips: ['Speak out loud every day'] };

(async () => {
  const errors = [];
  const base = { 'compound:meta:app': { lastActiveDate: T, bonusXp: 0 } };
  let dom = await boot(base);
  let w = dom.window, d = w.document;
  w.addEventListener('error', e => errors.push(e.message));
  let q = s => d.querySelector(s), qa = s => Array.from(d.querySelectorAll(s));
  const tab = async n => { q('[data-tab="' + n + '"]').click(); await wait(20); };
  const ls = k => JSON.parse(w.localStorage.getItem('compound:' + k) || 'null');

  console.log('--- no key: copy and paste plan');
  await tab('learn');
  check('chat offers free copy mode without a key', !!q('[data-act="chat-copy"]') && /Free with no setup/.test(q('.coach-box').textContent));
  q('[data-act="ai-plan-open"]').click(); await wait(10);
  check('plan form shows Copy prompt, not Make my plan', !!q('[data-act="ai-plan-copy"]') && !q('[data-act="ai-plan-go"]'));
  q('#aiSkill').value = 'Spanish'; q('#aiNow').value = 'zero'; q('#aiTarget').value = 'chat with my host family'; q('#aiMins').value = '20';
  q('[data-act="ai-plan-copy"]').click(); await wait(30);
  const prompt = w.copied[w.copied.length - 1] || '';
  check('prompt copied with instructions and inputs', /INSTRUCTIONS FOR YOU/.test(prompt) && /Reply with JSON only/.test(prompt) && /"skill":"Spanish"/.test(prompt) && /"minutes_per_day":20/.test(prompt), prompt.slice(0, 80));
  check('prompt has no HTML entities', prompt.indexOf('&#') === -1 && /learner's daily/.test(prompt));
  check('chat app links shown', ['claude.ai/new', 'chatgpt.com', 'gemini.google.com'].every(u => qa('.manual-box a').some(a => a.href.indexOf(u) >= 0)));
  check('step saved for app reloads', ls('meta:manual') && ls('meta:manual').kind === 'plan');
  q('#manualReply').value = 'Sure! Here is your plan, let me know if you want changes.';
  q('[data-act="manual-import"]').click(); await wait(20);
  check('reply without JSON shows a clear error', /No plan found/.test(q('.manual-box').textContent));
  q('#manualReply').value = 'Here is your plan:\n\n```json\n' + JSON.stringify(planJson, null, 2) + '\n```\n\nGood luck!';
  q('[data-act="manual-import"]').click(); await wait(20);
  let skills = ls('meta:skills') || [];
  check('pasted reply becomes a skill', skills.length === 1 && skills[0].name === 'Spanish' && skills[0].source === 'ai' && skills[0].levels.length === 2);
  check('copy step cleared', !ls('meta:manual') && !q('.manual-box'));
  check('practice card for new skill', qa('.prac-card').length === 1);

  console.log('--- fix plan by copy and paste');
  const sid = skills[0].id;
  if (!q('[data-act="ai-fix"][data-id="' + sid + '"]')) { q('[data-act="skill-open"][data-id="' + sid + '"]').click(); await wait(10); }
  q('[data-act="ai-fix"][data-id="' + sid + '"]').click(); await wait(10);
  check('fix form offers Copy prompt without key', !!q('[data-act="ai-fix-copy"]') && !q('[data-act="ai-fix-go"]'));
  q('#aiFixText').value = 'I already know basic phrases';
  q('[data-act="ai-fix-copy"]').click(); await wait(30);
  const fixPrompt = w.copied[w.copied.length - 1];
  check('fix prompt carries current plan + correction', /Here is my current plan/.test(fixPrompt) && /YOU SAID:/.test(fixPrompt) && /I already know basic phrases/.test(fixPrompt));
  q('#manualReply').value = JSON.stringify(Object.assign({}, planJson, { start_level: 1 }));
  q('[data-act="manual-import"]').click(); await wait(20);
  check('fix applied (now level 2)', ls('meta:skills')[0].level === 1);

  console.log('--- chat by copy and paste, surviving a reload');
  q('#chatInput').value = 'Plan my day';
  q('[data-act="chat-copy"]').click(); await wait(30);
  const chatPrompt = w.copied[w.copied.length - 1];
  check('chat prompt includes data snapshot + question', /My data right now/.test(chatPrompt) && /skills/.test(chatPrompt) && /Plan my day$/.test(chatPrompt));
  check('question shown in chat log', /Plan my day/.test(q('.chat-log').textContent));
  // iOS may reload the app while you are in the chat app
  dom = await boot(snap(w)); w = dom.window; d = w.document; w.addEventListener('error', e => errors.push(e.message));
  q = s => d.querySelector(s); qa = s => Array.from(d.querySelectorAll(s));
  check('reopens on Learn with the paste box waiting', q('.tab.active').dataset.tab === 'learn' && !!q('.coach-box .manual-box'));
  q('#manualReply').value = 'Start with the speaking drill, then writing.\n\ntasks\n[{"text":"Shadow 10 phrases","size":"quick"},{"text":"Write 5 sentences","size":"standard"}]';
  q('[data-act="manual-import"]').click(); await wait(20);
  check('pasted answer shows with task chips (even without code fences)', qa('[data-act="chat-add"]').length === 2, qa('.msg.ai').map(m => m.textContent).join('|').slice(0, 120));
  q('[data-act="chat-add"][data-k="0"]').click(); await wait(20);
  check('chip adds the task to Today', JSON.parse(w.localStorage.getItem('compound:day:' + T)).tasks.some(t => t.text === 'Shadow 10 phrases' && t.weight === 1));
  q('[data-act="chat-quick"]').click(); await wait(30);
  check('quick chip copies in free mode', /Plan my day from my goals and skills$/.test(w.copied[w.copied.length - 1]));
  const nChat = JSON.parse(w.localStorage.getItem('compound:meta:aichat')).length;
  q('[data-act="manual-cancel"]').click(); await wait(20);
  check('cancel drops the unanswered question', JSON.parse(w.localStorage.getItem('compound:meta:aichat')).length === nChat - 1 && !q('.manual-box'));

  console.log('--- clipboard blocked');
  dom = await boot(snap(w), null, false); w = dom.window; d = w.document; w.addEventListener('error', e => errors.push(e.message));
  q = s => d.querySelector(s);
  q('[data-tab="learn"]').click(); await wait(20);
  q('#chatInput').value = 'hello';
  q('[data-act="chat-copy"]').click(); await wait(30);
  check('prompt shown open for manual copy when clipboard fails', q('details.manual-prompt') && q('details.manual-prompt').open && /hello$/.test(q('details.manual-prompt textarea').value));
  q('[data-act="manual-cancel"]').click(); await wait(10);

  console.log('--- free Gemini key');
  const gcalls = [];
  let gMode = 'ok';
  const gFetch = (url, opts) => {
    if (/voice\//.test(url)) return Promise.reject(new Error('no audio'));
    gcalls.push({ url, opts: opts || {} });
    const json = (status, body) => Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(body) });
    if (/\/models\?/.test(url)) return json(200, { models: [
      { name: 'models/gemini-9-flash', displayName: 'Gemini 9 Flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
      { name: 'models/gemini-9-flash-lite', displayName: 'Gemini 9 Flash-Lite', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-9-flash-tts', displayName: 'TTS', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/text-embedding-9', displayName: 'Embed', supportedGenerationMethods: ['embedContent'] } ] });
    if (gMode === '404' && /gemini-flash-latest/.test(url)) return json(404, { error: { code: 404, message: 'models/gemini-flash-latest is not found for API version v1beta' } });
    if (gMode === '429') return json(429, { error: { code: 429, message: 'Resource has been exhausted (e.g. check quota).' } });
    if (gMode === 'badkey') return json(400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } });
    const body = JSON.parse(opts.body);
    const isPlan = /Reply with JSON only/.test(body.systemInstruction.parts[0].text);
    const text = /single word OK/.test(body.systemInstruction.parts[0].text) ? 'OK' : isPlan ? JSON.stringify(planJson) :
      'Do the speaking drill first.\n```tasks\n[{"text":"Speaking drill","size":"quick"}]\n```';
    return json(200, { candidates: [{ content: { role: 'model', parts: [{ text: 'thinking...', thought: true }, { text }] }, finishReason: 'STOP' }] });
  };
  const gs = Object.assign(snap(w), { compoundAI: JSON.stringify({ provider: 'gemini', gemini: { key: 'AIzaTestKey' } }) });
  dom = await boot(gs, gFetch); w = dom.window; d = w.document; w.addEventListener('error', e => errors.push(e.message));
  q = s => d.querySelector(s); qa = s => Array.from(d.querySelectorAll(s));
  q('[data-tab="learn"]').click(); await wait(20);
  check('with a key, chat shows Send and names Google', !!q('[data-act="chat-send"]') && /to Google only when you press Send/.test(q('.coach-box').textContent));
  q('#chatInput').value = 'What first?';
  q('[data-act="chat-send"]').click(); await wait(60);
  const c0 = gcalls.find(c => /generateContent/.test(c.url));
  const b0 = c0 && JSON.parse(c0.opts.body);
  check('calls generateContent on gemini-flash-latest', c0 && c0.url === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent' && c0.opts.method === 'POST', c0 && c0.url);
  check('key sent in x-goog-api-key header, not URL', c0 && c0.opts.headers['x-goog-api-key'] === 'AIzaTestKey' && c0.url.indexOf('key=') === -1);
  check('system prompt as systemInstruction', b0 && /coach inside Compound/.test(b0.systemInstruction.parts[0].text));
  check('user turn carries data snapshot', b0 && b0.contents[b0.contents.length - 1].role === 'user' && /My data right now/.test(b0.contents[b0.contents.length - 1].parts[0].text));
  check('thought parts dropped from the answer', !/thinking\.\.\./.test(q('.chat-log').textContent) && /speaking drill first/.test(q('.chat-log').textContent));
  check('task chip from Gemini reply', qa('[data-act="chat-add"]').length >= 1);
  q('#chatInput').value = 'And then?';
  q('[data-act="chat-send"]').click(); await wait(60);
  const c1 = gcalls.filter(c => /generateContent/.test(c.url)).pop();
  const b1 = JSON.parse(c1.opts.body);
  check('earlier answers sent with role model', b1.contents.some(c => c.role === 'model') && b1.contents[0].role === 'user');

  // plan via Gemini asks for JSON output
  q('[data-act="ai-plan-open"]').click(); await wait(10);
  q('#aiSkill').value = 'Guitar';
  q('[data-act="ai-plan-go"]').click(); await wait(60);
  const cp = gcalls.filter(c => /generateContent/.test(c.url)).pop();
  check('plan request sets responseMimeType json', JSON.parse(cp.opts.body).generationConfig.responseMimeType === 'application/json');
  check('Gemini plan imported', JSON.parse(w.localStorage.getItem('compound:meta:skills')).length === 2);

  console.log('--- Gemini model moved (404) -> auto-pick');
  gMode = '404';
  q('#chatInput').value = 'Check model';
  q('[data-act="chat-send"]').click(); await wait(80);
  const conf = JSON.parse(w.localStorage.getItem('compoundAI'));
  check('switched to a current Flash model and saved it', conf.gemini.model === 'gemini-9-flash', conf.gemini.model);
  check('answer still arrived', /speaking drill first/.test(Array.from(d.querySelectorAll('.msg.ai')).pop().textContent));
  check('model list skips tts/embedding', conf.gemini.models.map(m => m.id).join(',') === 'gemini-9-flash,gemini-9-flash-lite', conf.gemini.models.map(m => m.id).join(','));

  console.log('--- Gemini limits and bad keys');
  gMode = '429';
  q('#chatInput').value = 'Again'; q('[data-act="chat-send"]').click(); await wait(60);
  check('429 explains the free limit', /Free Gemini limit reached/.test(q('.chat-log').textContent));
  gMode = 'badkey';
  q('#chatInput').value = 'Again'; q('[data-act="chat-send"]').click(); await wait(60);
  check('bad key explains where to get one', /aistudio\.google\.com/.test(Array.from(d.querySelectorAll('.msg.ai')).pop().textContent));

  console.log('--- settings: Test fills the model list');
  gMode = 'ok';
  const conf2 = JSON.parse(w.localStorage.getItem('compoundAI')); delete conf2.gemini.models; conf2.gemini.model = 'gemini-flash-latest';
  w.localStorage.setItem('compoundAI', JSON.stringify(conf2));
  q('[data-act="ai-settings"]').click(); await wait(10);
  check('privacy note on free tier', /used to improve Google/.test(q('.modal').textContent));
  q('#aiTest').click(); await wait(80);
  check('test reports connected', /Connected\. Gemini replied: OK/.test(q('#aiTestMsg').textContent), q('#aiTestMsg').textContent);
  check('model select lists models from the key', Array.from(d.querySelectorAll('#aiModel option')).some(o => o.value === 'gemini-9-flash-lite'));
  d.querySelector('#modalRoot [data-p="anthropic"]').click(); await wait(10);
  check('switching to Claude keeps Gemini key stored', JSON.parse(w.localStorage.getItem('compoundAI')).gemini.key === 'AIzaTestKey' && q('#aiKey').value === '');
  q('#aiSaveBtn').click(); await wait(20);
  check('Claude with no key falls back to copy mode', !!q('[data-act="chat-copy"]'));

  console.log('--- old v6 settings migrate');
  dom = await boot(Object.assign(snap(w), { compoundAI: JSON.stringify({ key: 'sk-ant-old', model: 'claude-haiku-5-5' }) }), gFetch);
  w = dom.window; d = w.document;
  d.querySelector('[data-tab="learn"]').click(); await wait(20);
  check('v6 Claude key still works', !!d.querySelector('[data-act="chat-send"]') && /Claude · paid/.test(d.querySelector('.coach-box').textContent));

  console.log('--- export never includes keys');
  let exported = '';
  w.Blob = function (parts) { exported = parts.join(''); };
  d.getElementById('exportBtn').click(); await wait(30);
  check('no keys in export', exported.length > 0 && exported.indexOf('sk-ant-old') === -1 && exported.indexOf('AIzaTestKey') === -1);

  console.log('--- runtime errors', errors);
  console.log(failures ? failures + ' FAILURES' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
