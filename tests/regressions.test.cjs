// Run with: node --test tests/regressions.test.cjs
// Isolated storage, clock, DOM and network: never uses browser data or real API keys.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');

test('method changes synchronize the home picker, settings picker and birth fields', () => {
    const f = fixture();
    let syncs = 0;
    f.context.syncMethodPickers = () => { syncs++; };
    assert.equal(f.run("saveSetting('method', 'bazi')"), true);
    assert.equal(f.byId('homeMethod').value, 'bazi');
    assert.equal(f.byId('settingMethod').value, 'bazi');
    assert.equal(f.byId('baziSettings').hidden, false);
    assert.equal(f.run("saveSetting('method', 'coin')"), true);
    assert.equal(f.byId('homeMethod').value, 'coin');
    assert.equal(f.byId('settingMethod').value, 'coin');
    assert.equal(f.byId('baziSettings').hidden, true);
    assert.equal(syncs, 2);
});

test('failed method changes preserve the last synchronized picker state', () => {
    const f = fixture();
    f.run("saveSetting('method', 'coin')");
    let syncs = 0;
    f.context.syncMethodPickers = () => { syncs++; };
    f.failWrites();
    assert.equal(f.run("saveSetting('method', 'bazi')"), false);
    assert.equal(f.byId('homeMethod').value, 'coin');
    assert.equal(f.byId('settingMethod').value, 'coin');
    assert.equal(f.byId('baziSettings').hidden, true);
    assert.equal(syncs, 0);
});

function fixture() {
    const storage = new Map(), elements = new Map(), timers = new Map(), frames = new Map();
    const documentEvents = new Map(), notices = [];
    let nextId = 0, now = new Date(2026, 8, 7, 12).getTime();
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    function element() {
        const classes = new Set(), queries = new Map(), events = new Map();
        return {
            innerHTML: '', textContent: '', value: '', checked: false, disabled: false,
            style: { setProperty() {} }, dataset: {}, children: [], options: [], selectedIndex: 0,
            classList: {
                add(...names) { names.forEach(n => classes.add(n)); },
                remove(...names) { names.forEach(n => classes.delete(n)); },
                contains(n) { return classes.has(n); },
                toggle(n, force) { const yes = force === undefined ? !classes.has(n) : force; yes ? classes.add(n) : classes.delete(n); return yes; }
            },
            appendChild(child) { this.children.push(child); child.parentNode = this; },
            remove() { this.parentNode = null; },
            addEventListener(type, fn) { if (!events.has(type)) events.set(type, new Set()); events.get(type).add(fn); },
            removeEventListener(type, fn) { events.get(type)?.delete(fn); },
            async fire(type) { for (const fn of [...(events.get(type) || [])]) await fn.call(this, { target: this }); },
            querySelector(selector) {
                if (selector.startsWith('#')) return byId(selector.slice(1));
                if (!queries.has(selector)) queries.set(selector, element());
                return queries.get(selector);
            },
            querySelectorAll() { return []; }, closest() { return null; },
            setAttribute() {}, scrollIntoView() {}, focus() {},
            getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
        };
    }
    function byId(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }
    const setTimer = (fn, delay) => { const id = ++nextId; timers.set(id, { fn, delay }); return id; };
    const context = vm.createContext({
        console, Date: Clock, Math, Promise, TextDecoder, TextEncoder,
        setTimeout: setTimer, setInterval: setTimer, clearTimeout: id => timers.delete(id),
        requestAnimationFrame(fn) { const id = ++nextId; frames.set(id, fn); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        navigator: {},
        window: { innerWidth: 1000, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, setTimeout: setTimer, matchMedia() { return { matches: false }; } },
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        document: {
            hidden: false, body: element(), documentElement: element(), getElementById: byId,
            querySelector() { return null; }, querySelectorAll() { return []; }, createElement: element,
            addEventListener(type, fn) { if (!documentEvents.has(type)) documentEvents.set(type, []); documentEvents.get(type).push(fn); }
        },
        fetch() { throw new Error('Unexpected network call'); }
    });
    const run = source => vm.runInContext(source, context);
    function load(file) { vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file }); }
    for (const file of ['data.js', ...['core', 'lunar', 'glyphs', 'ritual', 'ai', 'settings', 'share', 'history', 'daily', 'divination'].map(n => 'js/' + n + '.js')]) load(file);
    context.showToast = (...args) => notices.push(args);
    run(`var gua = lookupGua('111111'); var lines = [7,7,7,7,7,7]; var change = calculateChangeGua(lines, '111111');`);
    return { run, load, context, storage, byId, timers, frames, notices, documentEvents,
        advanceDay() { now += 86400000; },
        failWrites() { context.localStorage.setItem = () => { throw new Error('QuotaExceededError'); }; },
        fireTimer(id) { const task = timers.get(id); timers.delete(id); task.fn(); }
    };
}

function twoRecords(f) {
    f.run(`var older = saveToHistory('工作', gua, '111111', lines, change, {date:'2020/1/1 12:00:00',method:'coin'});
        var newer = saveToHistory('工作', gua, '111111', lines, change, {method:'bazi'});`);
}
function configureAi(f, extra = '') {
    f.run(`var settings = loadSettings(); settings.ai.enabled = true;
        Object.assign(settings.ai.profiles[0], {baseUrl:'https://invalid.example/v1',apiKey:'test-only',model:'test',prompt:'{time}|{method}|{readingTime}'});
        ${extra} saveSettings(settings);`);
}

test('all 4096 line combinations retain correct transformations and valid main readings', () => {
    const f = fixture();
    assert.equal(f.run('Object.keys(GUA_LOOKUP).length'), 64);
    assert.equal(f.run(`(()=>{for(let n=0;n<4096;n++){
        const a=Array.from({length:6},(_,i)=>6+((n>>(2*i))&3));
        const b=a.map(x=>x%2?'1':'0').reverse().join('');
        const c=calculateChangeGua(a,b);
        if(c.changeBinary!==a.map(x=>x===6||x===7?'1':'0').reverse().join(''))return false;
        if(!getMainReading(lookupGua(b),c).text)return false;
    }return true})()`), true);
});

test('AI persists by ID, even when old and new readings have identical content', () => {
    const f = fixture(); twoRecords(f);
    f.run(`persistAiReading('old answer',older);persistAiReading('new answer',newer);`);
    assert.equal(f.run('readHistorySafe().find(h=>h.id===older).aiReading'), 'old answer');
    assert.equal(f.run('readHistorySafe().find(h=>h.id===newer).aiReading'), 'new answer');
});

test('deleted or unsaved AI target never falls back to a similar record', () => {
    const f = fixture(); twoRecords(f);
    f.run(`localStorage.setItem('divinationHistory',JSON.stringify(readHistorySafe().filter(h=>h.id!==older)));
        persistAiReading('deleted target',older);persistAiReading('unsaved target',null);`);
    assert.equal(f.run('readHistorySafe()[0].aiReading'), undefined);
});

test('AI save errors notify without changing stored reading', () => {
    const f = fixture(); twoRecords(f); f.failWrites();
    f.run(`persistAiReading('answer',older);`);
    assert.equal(f.run('readHistorySafe().find(h=>h.id===older).aiReading'), undefined);
    assert.match(f.notices.at(-1)[0], /未能保存/);
});

test('legacy records retain a stable ID and use their saved date and unknown method', () => {
    const f = fixture();
    f.run(`localStorage.setItem('divinationHistory',JSON.stringify([{question:'old',binary:'111111',date:'2020/1/1 12:00:00'}]));
        var legacy = readHistorySafe()[0];var renderArgs; renderResult=(...args)=>renderArgs=args;toggleHistory=()=>{};
        loadHistoryItem(legacy.id);`);
    assert.equal(f.run('renderArgs[7].historyId'), f.run('legacy.id'));
    assert.equal(f.run(`buildAiContext(gua,change,'old',renderArgs[7]).time`), '2020/1/1 12:00:00');
    assert.match(f.run(`buildAiContext(gua,change,'old',renderArgs[7]).method`), /未知/);
});

test('saved history metadata, not current settings, reaches AI request and retry', async () => {
    const f = fixture(); twoRecords(f); configureAi(f, `settings.method='bazi';`);
    const prompts = [];
    f.context.fetch = async (_, options) => {
        prompts.push(JSON.parse(options.body).messages[0].content);
        if (prompts.length === 1) return { ok: false, status: 503, text: async () => 'retry' };
        return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ choices: [{ message: { content: 'retried answer' } }] }) };
    };
    f.run(`toggleHistory=()=>{};loadHistoryItem(older);`);
    await f.byId('aiRunBtn').fire('click');
    await new Promise(resolve => setImmediate(resolve));
    await f.byId('aiRetryBtn').fire('click');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(prompts.length, 2);
    assert.ok(prompts.every(p => p.startsWith('2020/1/1 12:00:00|铜钱法（三枚铜钱）|')));
    assert.equal(f.run('readHistorySafe().find(h=>h.id===older).aiReading'), 'retried answer');
    assert.equal(f.run('readHistorySafe().find(h=>h.id===newer).aiReading'), undefined);
});

test('live divination saves its start snapshot and ID before rendering', async () => {
    const f = fixture();
    await f.run(`(async()=>{
        showInvocation=async()=>{const s=loadSettings();s.method='bazi';saveSettings(s)};
        window.matchMedia=()=>({matches:true});
        var originalRender=renderResult;
        renderResult=(...args)=>{globalThis.rendered=args;globalThis.storedAtRender=readHistorySafe()[0]};
        await divine();
    })()`);
    assert.equal(f.run('rendered[7].historyId'), f.run('storedAtRender.id'));
    assert.equal(f.run('storedAtRender.method'), 'coin');
    assert.equal(f.run('storedAtRender.createdAt'), f.run('rendered[7].createdAt'));
    assert.equal(f.run('_divineRunning'), false);
});

test('history storage failure still renders result without any AI persistence target', async () => {
    const f = fixture(); f.failWrites();
    await f.run(`showInvocation=async()=>{};window.matchMedia=()=>({matches:true});
        renderResult=(...args)=>globalThis.rendered=args;divine();`);
    assert.equal(f.run('rendered[7].historyId'), null);
    assert.equal(f.run('_divineRunning'), false);
});

test('auto-run uses the newly saved record and ignores an identical older record', async () => {
    const f = fixture(); twoRecords(f); configureAi(f, 'settings.ai.autoRun=true;');
    let idAtRequest;
    f.context.fetch = async () => {
        idAtRequest = f.run('readHistorySafe()[0].id');
        return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ choices: [{ message: { content: 'automatic answer' } }] }) };
    };
    f.byId('question').value = '工作';
    await f.run(`showInvocation=async()=>{};window.matchMedia=()=>({matches:true});generateHexagram=()=>lines;divine();`);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.run('readHistorySafe()[0].id'), idAtRequest);
    assert.equal(f.run('readHistorySafe()[0].aiReading'), 'automatic answer');
    assert.equal(f.run('readHistorySafe().find(h=>h.id===newer).aiReading'), undefined);
});

test('successful settings and profile changes still persist and report success', async () => {
    const f = fixture();
    assert.equal(f.run(`saveSetting('showDaily',false)`), true);
    assert.equal(f.run('loadSettings().showDaily'), false);
    assert.equal(f.byId('dailyGua').style.display, 'none');
    f.byId('aiProfileName').value = 'first'; f.byId('aiApiKey').value = 'first-test-key';
    assert.equal(f.run('saveAiConfig()'), true);
    assert.match(f.byId('aiStatus').textContent, /已保存/);
    f.run('newAiProfile()');
    assert.equal(f.run('loadSettings().ai.activeProfile'), 1);
    f.byId('aiApiKey').value = 'second-test-key'; f.run('switchAiProfile(0)');
    assert.equal(f.byId('aiApiKey').value, 'first-test-key');
    assert.equal(f.run('loadSettings().ai.profiles[1].apiKey'), 'second-test-key');
    await f.run('showConfirm=async()=>true;deleteAiProfile();Promise.resolve();');
    assert.equal(f.run('loadSettings().ai.profiles.length'), 1);
    assert.equal(f.byId('aiApiKey').value, 'second-test-key');
});

test('history click during the casting phase is blocked, casting can still finish', async () => {
    const f = fixture(); twoRecords(f);
    await f.run(`(async()=>{
        sleep=()=>Promise.resolve();showInvocation=async()=>{};
        const cast=HexRitual.prototype.actCast;
        let ready;const casting=new Promise(r=>ready=r);
        HexRitual.prototype.actCast=function(){globalThis.activeRitual=this;const p=cast.call(this);ready();return p};
        renderResult=(...args)=>globalThis.rendered=args;toggleHistory=()=>{};
        globalThis.pendingDivine=divine();await casting;
        loadHistoryItem(older);
    })()`);
    assert.equal(f.run('typeof rendered'), 'undefined');
    assert.equal(f.run('_divineRunning'), true);
    assert.match(f.notices.at(-1)[0], /正在起卦/);
    await f.run(`(async()=>{for(let i=0;i<6;i++) await activeRitual._castHandler(); await pendingDivine;})()`);
    assert.equal(f.run('_divineRunning'), false);
    assert.equal(f.byId('divineBtn').disabled, false);
    assert.equal(f.run('activeRitual.cast'), 6);
    f.run('loadHistoryItem(older)');
    assert.equal(f.run('rendered[7].historyId'), f.run('older'));
});

test('each cast keeps exactly the hexagrams that match every line so far', () => {
    const f = fixture();
    assert.equal(f.run(`(()=>{for(let v=0;v<64;v++){
        const lines=linesFromShao(v);
        const bin=lines.map(x=>x%2?'1':'0').reverse().join('');
        if(shaoValue(bin)!==v) return 'roundtrip '+v;
        if(lookupGua(bin)[0]!==lookupGua(bin)[0]) return 'lookup';
        let alive=[...Array(64).keys()];
        for(let i=0;i<6;i++){alive=alive.filter(u=>shaoBit(u,i)===shaoBit(v,i)); if(alive.length!==64>>(i+1)) return 'count '+v+' '+i;}
        if(alive[0]!==v) return 'survivor '+v;
    }return 'ok'})()`), 'ok');
    assert.equal(f.run("shaoValue('111111')"), 63);
    assert.equal(f.run("TRIGRAM_BY_VALUE[shaoValue(TRIGRAM_TO_BINARY['☵']+TRIGRAM_TO_BINARY['☳'])>>3]"), '震');
});

test('daily detail always opens the visible snapshot', () => {
    const f = fixture();
    f.run(`renderDailyGua();var shown=getDailyGua()[0];showGuaDetail=g=>globalThis.clicked=g[0];
        getDailyGua=()=>GUA.find(g=>g[0]!==shown);document.getElementById('dailyGua').onclick();`);
    assert.equal(f.run('clicked'), f.run('shown'));
});

function setBirthForm(f) {
    for (const [id, value] of Object.entries({ baziYear: '1990', baziMonth: '1', baziDay: '1', baziHour: '0' })) f.byId(id).value = value;
}

test('birth save refreshes daily display and its matching detail', () => {
    const f = fixture(); setBirthForm(f);
    f.run(`renderDailyGua();saveBazi();showGuaDetail=g=>globalThis.clicked=g[0];document.getElementById('dailyGua').onclick();`);
    assert.equal(f.run('clicked'), f.run('getDailyGua()[0]'));
    assert.ok(f.byId('dailyGua').innerHTML.includes(f.run('clicked')));
});

test('daily refresh is skipped on same day and occurs when date changes', () => {
    const f = fixture();
    f.run(`renderDailyGua();var count=0;var renderDailyOriginal=renderDailyGua;
        renderDailyGua=(...args)=>{count++;renderDailyOriginal(...args)};refreshDailyGuaIfNeeded();`);
    assert.equal(f.run('count'), 0);
    f.advanceDay(); f.run('refreshDailyGuaIfNeeded();refreshDailyGuaIfNeeded()');
    assert.equal(f.run('count'), 1);
});

test('failed birth save reports error, preserves form and does not refresh daily display', () => {
    const f = fixture(); setBirthForm(f); f.failWrites();
    f.run(`var refreshes=0;renderDailyGua=()=>refreshes++;saveBazi();`);
    assert.match(f.byId('baziStatus').textContent, /保存失败/);
    assert.equal(f.byId('baziYear').value, '1990');
    assert.equal(f.run('loadSettings().bazi'), null);
    assert.equal(f.run('refreshes'), 0);
});

test('failed AI save keeps edits and connection test makes no request', async () => {
    const f = fixture(); configureAi(f); f.byId('aiApiKey').value = 'unsaved-edit'; f.failWrites();
    let calls = 0; f.context.fetch = () => { calls++; throw new Error('Must not request'); };
    assert.equal(f.run('saveAiConfig()'), false);
    await f.run('testAiConnection()');
    assert.equal(calls, 0);
    assert.equal(f.byId('aiApiKey').value, 'unsaved-edit');
    assert.match(f.byId('aiStatus').textContent, /保存失败/);
});

test('failed profile switch, create and delete leave stored profiles and edits intact', async () => {
    const f = fixture(); configureAi(f, `settings.ai.profiles.push(makeAiProfile('second',{}));`);
    f.byId('aiApiKey').value = 'unsaved-edit'; f.failWrites();
    f.run('switchAiProfile(1)');
    assert.equal(f.byId('aiProfileSelect').value, '0');
    assert.equal(f.run('loadSettings().ai.activeProfile'), 0);
    f.run('newAiProfile()');
    assert.equal(f.run('loadSettings().ai.profiles.length'), 2);
    await f.run('showConfirm=async()=>true;deleteAiProfile();Promise.resolve();');
    assert.equal(f.run('loadSettings().ai.profiles.length'), 2);
    assert.equal(f.byId('aiApiKey').value, 'unsaved-edit');
    assert.match(f.byId('aiStatus').textContent, /删除失败/);
});

test('startup survives unavailable local storage; failed switches revert without clearing forms', async () => {
    const f = fixture();
    f.context.localStorage.getItem = () => { throw new Error('SecurityError'); }; f.failWrites();
    f.load('js/main.js');
    for (const fn of f.documentEvents.get('DOMContentLoaded')) fn();
    f.byId('aiApiKey').value = 'keep-this';
    f.byId('settingMethod').value = 'bazi'; await f.byId('settingMethod').fire('change');
    assert.equal(f.byId('settingMethod').value, 'coin');
    f.byId('settingDaily').checked = false; await f.byId('settingDaily').fire('change');
    assert.equal(f.byId('settingDaily').checked, true);
    for (const id of ['settingAiEnabled', 'settingAiAuto']) {
        f.byId(id).checked = true; await f.byId(id).fire('change'); assert.equal(f.byId(id).checked, false);
    }
    assert.equal(f.byId('aiApiKey').value, 'keep-this');
});

test('foreground visibility and minute timer both check for daily rollover', () => {
    const f = fixture(); f.load('js/main.js');
    for (const fn of f.documentEvents.get('DOMContentLoaded')) fn();
    f.run('var checks=0;refreshDailyGuaIfNeeded=()=>checks++');
    for (const fn of f.documentEvents.get('visibilitychange')) fn();
    for (const timer of f.timers.values()) if (timer.delay === 60000) timer.fn();
    assert.equal(f.run('checks'), 2);
});

test('card numbers follow the received (King Wen) sequence, not the binary array order', () => {
    const f = fixture();
    assert.equal(f.run("new Set(GUA.map(guaNumber)).size"), 64);
    assert.equal(f.run("guaOrdinal(lookupGua('111111'))"), '第一卦');
    assert.equal(f.run("guaOrdinal(GUA.find(g=>g[0]==='山风蛊'))"), '第十八卦');
    assert.equal(f.run("guaOrdinal(GUA.find(g=>g[0]==='火水未济'))"), '第六十四卦');
});

test('escHtml tolerates fields missing from old or hand-edited records', () => {
    const f = fixture();
    assert.equal(f.run(`escHtml(undefined) + '|' + escHtml(null) + '|' + escHtml('<a>')`), '||&lt;a&gt;');
});

test('daily motto uses the full date, so the same day number in different months can differ', () => {
    const f = fixture();
    const distinct = f.run(`new Set(Array.from({length: 12}, (_, m) => getDailyMotto(new Date(2026, m, 7)))).size`);
    assert.ok(distinct > 1);
});

test('without storage the daily seed stays the same for the whole page session', () => {
    const f = fixture();
    f.context.localStorage.getItem = () => { throw new Error('SecurityError'); };
    assert.equal(f.run('getUserSeed() === getUserSeed()'), true);
});

test('AI stream keeps the final event even when it has no trailing newline', async () => {
    const f = fixture();
    configureAi(f);
    const enc = new TextEncoder();
    const chunks = [
        enc.encode('data: {"choices":[{"delta":{"content":"甲"}}]}\n'),
        enc.encode('data: {"choices":[{"delta":{"content":"乙"}}]}')
    ];
    f.context.fetch = async () => {
        let i = 0;
        return {
            ok: true,
            headers: { get: () => 'text/event-stream' },
            body: { getReader: () => ({ read: async () => i < chunks.length ? { done: false, value: chunks[i++] } : { done: true } }) }
        };
    };
    const text = await f.run(`requestAiReading(gua, change, '问', document.getElementById('aiBody'), {})`);
    assert.equal(text, '甲乙');
});

test('share card shows when the reading was cast, not when the image is made', () => {
    const f = fixture();
    const date = f.run(`var r = document.getElementById('resultArea');
        r.dataset.createdAt = new Date(2020, 0, 2, 3, 4).toISOString();
        getCurrentGuaData().date`);
    assert.match(date, /2020/);
    assert.doesNotMatch(date, /2026/);
});
