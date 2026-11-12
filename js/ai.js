// ai —— AI 解卦全链：上下文构建、流式请求、多配置档案管理、默认提示词
// 必须在 settings.js 之前加载（DEFAULT_SETTINGS 引用了本文件的 DEFAULT_AI）

/* ============ AI 解卦 ============ */
const AI_METHOD_LABEL = { coin: '铜钱法（三枚铜钱）', bazi: '生辰起卦（公历生日换算农历，梅花易数取数）' };

function buildAiContext(gua, change, question, readingContext = {}) {
    const changing = change.changingYaos || [];
    const changePos = changing.length
        ? changing.map(p => YAO_POS_CN[p]).join('、') + ' 爻动'
        : '静卦无变';
    // 主断之爻：复用既有取爻规则，只给 AI 主断指向的那一爻，而非六爻全丢
    const main = getMainReading(gua, change);
    const bianGua = (change.hasChange && change.changeGua)
        ? `${change.changeGua[0]}（${change.changeGua[1]}）`
        : '无（静卦）';
    return {
        question: (question && question.trim()) ? question.trim() : '未具问，泛问吉凶',
        time: readingContext.date || readingContext.createdAt || '未知（原记录未保存起卦时间）',
        readingTime: new Date().toLocaleString('zh-CN'),
        method: AI_METHOD_LABEL[readingContext.method] || '未知（原记录未保存起卦方式）',
        benGua: gua[0],
        benTitle: gua[1],
        symbol: gua[2],
        bianGua,
        changePos,
        changeYao: main.text
    };
}

function fillPrompt(tpl, ctx) {
    return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (k in ctx ? ctx[k] : m));
}

// 按唯一 ID 写回；记录已删除/未能保存时不猜测，也不写入相似记录。
function persistAiReading(reading, historyId) {
    if (!historyId) return;
    const settings = loadSettings();
    if (!settings.ai || !settings.ai.saveToHistory) return;
    try {
        const history = readHistorySafe();
        const idx = history.findIndex(h => h.id === historyId);
        if (idx !== -1) {
            history[idx].aiReading = reading;
            localStorage.setItem('divinationHistory', JSON.stringify(history.slice(0, HISTORY_MAX)));
        }
    } catch (e) {
        showToast('解读已生成，但未能保存到牌册，请先复制留存', 'error');
    }
}

const AI_IDLE_TIMEOUT_MS = 90000;
async function requestAiReading(gua, change, question, bodyEl, readingContext = {}) {
    const ai = loadSettings().ai || {};
    const profile = getActiveAiProfile(ai);
    if (!profile.baseUrl || !profile.apiKey || !profile.model) {
        bodyEl.innerHTML = '<div class="ai-error">请先在「设置 · AI 解卦」中填写完整配置（接口地址 / API Key / 模型）。</div>';
        return;
    }

    const prompt = fillPrompt(profile.prompt || DEFAULT_AI_PROMPT, buildAiContext(gua, change, question, readingContext));
    bodyEl.innerHTML = '<div class="ai-loading"><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span><span class="ai-loading-text">正在解读…</span></div>';

    const url = profile.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    let acc = '';
    let textEl = null;
    const paint = (s) => {
        if (!textEl) {
            bodyEl.innerHTML = '<div class="ai-reading-text"></div>';
            textEl = bodyEl.querySelector('.ai-reading-text');
        }
        textEl.textContent = s;
    };
    const fail = (msg) => {
        bodyEl.innerHTML = `<div class="ai-error">${escHtml(msg)}</div><button class="btn" id="aiRetryBtn">重试</button>`;
        const rb = bodyEl.querySelector('#aiRetryBtn');
        if (rb) rb.addEventListener('click', () => {
            requestAiReading(gua, change, question, bodyEl, readingContext).then(t => { if (t) persistAiReading(t, readingContext.historyId); });
        });
    };

    // 接口久不回话（连不上、流卡在半路）就掐断，换成可重试的错误，不让加载一直转下去
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    let idle = 0;
    const watch = () => { clearTimeout(idle); if (ctrl) idle = setTimeout(() => ctrl.abort(), AI_IDLE_TIMEOUT_MS); };
    try {
        watch();
        const resp = await fetch(url, {
            signal: ctrl ? ctrl.signal : undefined,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + profile.apiKey },
            body: JSON.stringify({
                model: profile.model,
                temperature: typeof ai.temperature === 'number' ? ai.temperature : 0.8,
                stream: true,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!resp.ok) {
            let detail = '';
            try { detail = (await resp.text()).slice(0, 240); } catch (e) {}
            fail(`接口返回错误 ${resp.status}。${detail}`);
            return;
        }

        // 回退为一次性解析：无可读流，或服务端无视 stream 直接返回整段 JSON
        const ctype = (resp.headers.get('content-type') || '').toLowerCase();
        const canStream = resp.body && typeof resp.body.getReader === 'function';
        if (!canStream || ctype.indexOf('json') !== -1) {
            const data = await resp.json();
            acc = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
            if (!acc) { fail('接口没有返回解读内容。'); return; }
            paint(acc);
            return acc;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let streamError = '';   // 有的接口在流中途用 {"error": …} 报错，记下来，最后没内容时显示它
        const eat = (raw) => {
            const line = raw.trim();
            if (!line || !line.startsWith('data:')) return;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') return;
            try {
                const json = JSON.parse(payload);
                if (json && json.error) {
                    const e = json.error;
                    streamError = typeof e === 'string' ? e : (e.message || JSON.stringify(e));
                    return;
                }
                const delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
                if (delta) { acc += delta; paint(acc); }
            } catch (e) { /* 不是完整的 JSON（按行切过，正常不会出现），跳过这一行 */ }
        };
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            watch();
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n');
            buffer = parts.pop();
            parts.forEach(eat);
        }
        // 流结束时最后一行可能没有换行符，别把它丢掉
        buffer += decoder.decode();
        if (buffer) eat(buffer);
        if (!acc) { fail(streamError ? `接口报错：${streamError.slice(0, 240)}` : '接口没有返回解读内容。'); return; }
        // 已经写出一部分又报错：留着已写的，末尾注明中断
        if (streamError) { paint(acc + `\n\n（接口中途报错，解读未写完：${streamError.slice(0, 160)}）`); return acc; }
        paint(acc);
        return acc;
    } catch (err) {
        if (err && err.name === 'AbortError') {
            fail(`接口超过 ${AI_IDLE_TIMEOUT_MS / 1000} 秒没有回应，已中断。`);
            return;
        }
        fail('请求失败：' + (err && err.message ? err.message : String(err)) + '。可能是网络问题或接口被跨域(CORS)拦截。');
    } finally {
        clearTimeout(idle);
    }
}

function setAiField(key, value) {
    const settings = loadSettings();
    settings.ai = { ...settings.ai, [key]: value };
    return saveSettings(settings);
}

function setAiStatus(txt, cls) {
    const status = document.getElementById('aiStatus');
    if (status) { status.textContent = txt; status.className = 'bazi-status' + (cls ? ' ' + cls : ''); }
}

// 读表单 → 写入当前激活档案（不落盘、不提示）
function writeFormToActiveProfile(ai) {
    const get = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const p = ai.profiles[ai.activeProfile];
    if (!p) return;
    const nameEl = document.getElementById('aiProfileName');
    if (nameEl && nameEl.value.trim()) p.name = nameEl.value.trim();
    p.baseUrl = get('aiBaseUrl').trim();
    p.apiKey = get('aiApiKey').trim();
    p.model = get('aiModel').trim();
    p.prompt = get('aiPrompt') || DEFAULT_AI_PROMPT;
}

// 当前激活档案 → 回填表单
function loadActiveProfileToForm(ai) {
    const p = ai.profiles[ai.activeProfile] || {};
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('aiProfileName', p.name || '');
    setVal('aiBaseUrl', p.baseUrl || '');
    setVal('aiApiKey', p.apiKey || '');
    setVal('aiModel', p.model || '');
    setVal('aiPrompt', p.prompt || DEFAULT_AI_PROMPT);
}

// 重建下拉、计数、按钮可用态
function renderAiProfileSelect(ai) {
    const sel = document.getElementById('aiProfileSelect');
    if (sel) {
        sel.innerHTML = ai.profiles.map((p, i) =>
            `<option value="${i}">${escHtml(p.name || ('配置 ' + (i + 1)))}</option>`
        ).join('');
        sel.value = String(ai.activeProfile);
    }
    const countEl = document.getElementById('aiProfileCount');
    if (countEl) countEl.textContent = ai.profiles.length + '/' + AI_PROFILE_MAX;
    const newBtn = document.getElementById('aiProfileNew');
    if (newBtn) newBtn.disabled = ai.profiles.length >= AI_PROFILE_MAX;
    const delBtn = document.getElementById('aiProfileDelete');
    if (delBtn) delBtn.disabled = ai.profiles.length <= 1;
}

function saveAiConfig() {
    const settings = loadSettings();
    writeFormToActiveProfile(settings.ai);
    if (!saveSettings(settings)) {
        setAiStatus('保存失败，表单内容已保留，请检查浏览器存储后重试', 'error');
        return false;
    }
    renderAiProfileSelect(settings.ai);
    setAiStatus('已保存「' + (settings.ai.profiles[settings.ai.activeProfile].name) + '」', 'success');
    return true;
}

function switchAiProfile(index) {
    const settings = loadSettings();
    const ai = settings.ai;
    writeFormToActiveProfile(ai); // 切走前先把当前编辑留在原档案
    index = parseInt(index, 10);
    if (isNaN(index) || index < 0 || index >= ai.profiles.length) index = 0;
    ai.activeProfile = index;
    if (!saveSettings(settings)) {
        const sel = document.getElementById('aiProfileSelect');
        if (sel) sel.value = String(loadSettings().ai.activeProfile);
        setAiStatus('切换失败，当前编辑已保留，请重试', 'error');
        return;
    }
    loadActiveProfileToForm(ai);
    renderAiProfileSelect(ai);
    setAiStatus('已切换到「' + (ai.profiles[index].name) + '」', 'success');
}

function newAiProfile() {
    const settings = loadSettings();
    const ai = settings.ai;
    if (ai.profiles.length >= AI_PROFILE_MAX) { setAiStatus('最多保存 ' + AI_PROFILE_MAX + ' 套配置', 'error'); return; }
    writeFormToActiveProfile(ai); // 保住当前编辑
    const p = makeAiProfile('配置 ' + (ai.profiles.length + 1), {});
    ai.profiles.push(p);
    ai.activeProfile = ai.profiles.length - 1;
    if (!saveSettings(settings)) {
        setAiStatus('新建失败，当前编辑已保留，请重试', 'error');
        return;
    }
    loadActiveProfileToForm(ai);
    renderAiProfileSelect(ai);
    setAiStatus('已新建「' + p.name + '」，填写后保存', 'success');
}

function deleteAiProfile() {
    const settings = loadSettings();
    const ai = settings.ai;
    if (ai.profiles.length <= 1) { setAiStatus('至少保留一套配置', 'error'); return; }
    const idx = ai.activeProfile;
    const removed = ai.profiles[idx];
    showConfirm('确定删除配置「' + (removed.name || ('配置 ' + (idx + 1))) + '」？').then(ok => {
        if (!ok) return;
        const fresh = loadSettings();
        const fAi = fresh.ai;
        if (fAi.profiles.length <= 1) return;
        const rmIdx = Math.min(idx, fAi.profiles.length - 1);
        fAi.profiles.splice(rmIdx, 1);
        fAi.activeProfile = Math.max(0, rmIdx - 1);
        if (!saveSettings(fresh)) {
            setAiStatus('删除失败，配置未删除，请重试', 'error');
            return;
        }
        loadActiveProfileToForm(fAi);
        renderAiProfileSelect(fAi);
        setAiStatus('已删除', 'success');
    });
}

async function testAiConnection() {
    if (!saveAiConfig()) return;
    const ai = loadSettings().ai || {};
    const profile = getActiveAiProfile(ai);
    const status = document.getElementById('aiStatus');
    const setStatus = (txt, cls) => { if (status) { status.textContent = txt; status.className = 'bazi-status' + (cls ? ' ' + cls : ''); } };
    if (!profile.baseUrl || !profile.apiKey || !profile.model) { setStatus('请先填写完整的接口配置', 'error'); return; }
    setStatus('测试中…', '');
    try {
        const resp = await fetch(profile.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + profile.apiKey },
            body: JSON.stringify({ model: profile.model, stream: false, max_tokens: 8, messages: [{ role: 'user', content: '回复一个字：通' }] })
        });
        if (resp.ok) { setStatus('连接成功 ✓', 'success'); }
        else { let t = ''; try { t = (await resp.text()).slice(0, 160); } catch (e) {} setStatus(`失败 ${resp.status}：${t}`, 'error'); }
    } catch (e) {
        setStatus('连接失败：' + (e && e.message ? e.message : String(e)) + '（或被跨域拦截）', 'error');
    }
}

// 以前的默认提示词。档案里存的还是它（用户没改过）时，自动换成新的默认
const LEGACY_AI_PROMPTS = [`你是一位精通《周易》象数与义理的解卦师，既懂卦象推演，也善于把卦理落到问卦者的现实处境上。请依据下列卦象，为问卦者写一份诚恳、具体、能用得上的解读。

【所问之事】{question}
【起卦时间】{time}
【起卦方式】{method}
【本卦】{benGua}（{benTitle}）
【卦象】{symbol}
【变卦】{bianGua}
【变爻位置】{changePos}
【主断之爻】{changeYao}

解读要求：
1. 紧扣「所问之事」与本卦、变爻、之卦的关系来谈，不要写放之四海皆准的空话或万能算命套话。
2. 以本卦为当下情势、之卦为发展走向、主断之爻为关键转折，三者串起来讲清因果与流向。
3. 可明确点出形势的利弊倾向、宜与忌，不必含糊；但落点是启发与建议，而非铁口直断。
4. 若「所问之事」空泛或未具，则就近期整体运势与心境立论。

输出格式（务必遵守）：
- 用简体中文、纯文本分段，段首以方括号小标题标注，如【卦象总览】。
- 不要使用 Markdown 符号（如 #、*、**），它们会原样显示。
- 共五段，依次为：【卦象总览】【应问而断】【变爻玄机】【行止之议】【箴言】。
- 每段约 2 至 4 句，【箴言】一句收束；全文约 400 至 700 字，语气古雅而通俗，如对坐谈心。`];

const DEFAULT_AI_PROMPT = `你是熟悉《周易》的解卦人，懂卦象，也会把卦理落到问卦人的实际处境上。请根据下面这一卦，回答问卦人的问题。

【所问】{question}
【起卦时间】{time}
【起卦方式】{method}
【本卦】{benGua}（{benTitle}）
【卦象】{symbol}
【之卦】{bianGua}
【动爻】{changePos}
【主断】{changeYao}

要求：
1. 紧扣所问来谈本卦、动爻和之卦，不写放到哪个问题上都成立的空话。
2. 本卦看眼下的处境，之卦看事情往哪里走，主断是最要紧的那一句，把三者连起来讲清楚。
3. 利弊、宜忌可以直说，不必含糊；但给的是参考和建议，不是断言。
4. 没写问题时，就近况和心态来谈。

格式：
- 简体中文纯文本，不用 Markdown 符号（#、* 这类会原样显示）。
- 分五段，段首用方括号标题：【卦象】【所问】【动爻】【怎么做】【一句话】。
- 每段两到四句，【一句话】只写一句；全文四百到七百字。说人话，像当面聊，不要堆文言。`;

const DEFAULT_AI = {
    enabled: false,
    temperature: 0.8,
    autoRun: false,
    saveToHistory: true
};

// 一套配置最多保存数量
const AI_PROFILE_MAX = 5;
function makeAiProfile(name, src) {
    src = src || {};
    return {
        name: name || '新配置',
        baseUrl: src.baseUrl || '',
        apiKey: src.apiKey || '',
        model: src.model || '',
        prompt: src.prompt || DEFAULT_AI_PROMPT
    };
}

function getActiveAiProfile(ai) {
    return ai.profiles[ai.activeProfile] || ai.profiles[0];
}

// 迁移 + 校正：老的单套配置自动包成「配置 1」，此后只保留 profiles 数据源
function ensureAiProfiles(ai) {
    if (!Array.isArray(ai.profiles) || ai.profiles.length === 0) {
        ai.profiles = [ makeAiProfile('配置 1', ai) ];
        ai.activeProfile = 0;
    }
    if (ai.profiles.length > AI_PROFILE_MAX) ai.profiles = ai.profiles.slice(0, AI_PROFILE_MAX);
    ai.profiles.forEach(p => { if (!p.prompt || LEGACY_AI_PROMPTS.includes(p.prompt)) p.prompt = DEFAULT_AI_PROMPT; });
    if (typeof ai.activeProfile !== 'number' || ai.activeProfile < 0 || ai.activeProfile >= ai.profiles.length) {
        ai.activeProfile = 0;
    }
    delete ai.baseUrl;
    delete ai.apiKey;
    delete ai.model;
    delete ai.prompt;
    return ai;
}
