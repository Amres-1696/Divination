// divination —— 占卜主流程 divine()、主断取爻 getMainReading、
// 结果页渲染 renderResult、八字起卦 generateHexagramBazi

let _divineRunning = false;
async function divine() {
    if (_divineRunning) return;
    _divineRunning = true;
    const question = document.getElementById('question').value.trim();
    const resultArea = document.getElementById('resultArea');
    const btn = document.getElementById('divineBtn');
    const btnText = btn.querySelector('.btn-text');
    const originalText = btnText ? btnText.textContent : '起卦';

    const settings = loadSettings();
    const startedAt = new Date();
    const readingContext = {
        method: settings.method,
        createdAt: startedAt.toISOString(),
        date: startedAt.toLocaleString('zh-CN')
    };

    // 八字起卦需要检查八字数据
    if (settings.method === 'bazi' && !settings.bazi) {
        showToast('请先在设置中填写并保存公历生辰', 'error');
        _divineRunning = false;
        return;
    }

    btn.disabled = true;
    if (btnText) btnText.textContent = '演卦';

    try {
        await showInvocation();

        if (typeof setPageView === 'function') setPageView('ritual');
        resultArea.innerHTML = '<div class="ritual-stage" id="ritualStage"></div>';

        const stage = document.getElementById('ritualStage');
        if (window.scrollTo) window.scrollTo({ top: 0 });

        const hexLines = settings.method === 'bazi'
            ? generateHexagramBazi(settings.bazi, question)
            : generateHexagram();

        const bits = hexLines.map(n => (n === 7 || n === 9) ? '1' : '0');
        const fullBin = bits.slice().reverse().join('');
        const gua = lookupGua(fullBin);
        const change = calculateChangeGua(hexLines, fullBin);

        // prefers-reduced-motion：跳过六幕仪式直接渲染（章节 4.5）
        const prefersReducedMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let chosenCard = null;
        if (!prefersReducedMotion) {
            const ritual = new HexRitual(stage, gua, hexLines, change, settings.method);
            // 仪式与「跳过」信号竞速：点跳过即直奔结果，不触碰内部动画时序
            let skipped = false;
            const skipPromise = new Promise(res => { ritual._onSkip = () => { skipped = true; ritual.abort(); res(); }; });
            await Promise.race([ritual.run(), skipPromise]);
            // 跳过时也让方图里对应的那一卦飞到结果页
            chosenCard = skipped ? { cosmosValue: ritual.value } : ritual.chosenCard;
        }

        // 先落库拿到唯一 ID，自动 AI 解读和重试都绑定本条记录。
        readingContext.historyId = saveToHistory(question, gua, fullBin, hexLines, change, readingContext);
        renderResult(gua, hexLines, change, question, fullBin, chosenCard, null, readingContext);
    } catch (error) {
        if (typeof setPageView === 'function') setPageView('home');
        resultArea.innerHTML = '';
        showToast('起卦未完成，请重试', 'error');
        console.error(error);
    } finally {
        btn.disabled = false;
        if (btnText) btnText.textContent = originalText;
        _divineRunning = false;
    }
}


// 主断：依朱熹《易学启蒙》变爻取辞法，明确「该以哪一条为主断」
// changingYaos 为升序（0=初爻 … 5=上爻）
function getMainReading(gua, change) {
    const yaoArr = gua[3].split('|');
    const changing = change.changingYaos;
    const n = changing.length;
    const benName = gua[0];
    const zhi = change.changeGua;
    const posCN = ['初', '二', '三', '四', '五', '上'];
    const all = [0, 1, 2, 3, 4, 5];

    if (n === 0)
        return { rule: '静卦无变', text: `以本卦《${benName}》卦辞为主断：「${gua[1]}」` };
    if (n === 1)
        return { rule: '一爻动', text: `以本卦《${benName}》${posCN[changing[0]]}爻为主断 —— ${yaoArr[changing[0]] || ''}` };
    if (n === 2)
        return { rule: '二爻动', text: `二爻变，以上动爻为主 —— ${yaoArr[changing[1]] || ''}` };
    if (n === 3)
        return { rule: '三爻动', text: `三爻变，本卦《${benName}》与之卦《${zhi[0]}》卦辞并参 —— 本卦「${gua[1]}」，之卦「${zhi[1]}」。` };
    if (n === 4) {
        const low = all.filter(i => !changing.includes(i))[0];
        return { rule: '四爻动', text: `四爻变，看之卦《${zhi[0]}》中二不变爻，以下爻为主 —— ${zhi[3].split('|')[low] || ''}` };
    }
    if (n === 5) {
        const only = all.filter(i => !changing.includes(i))[0];
        return { rule: '五爻动', text: `五爻变，以之卦《${zhi[0]}》唯一不变之爻为主 —— ${zhi[3].split('|')[only] || ''}` };
    }
    if (benName === '乾为天')
        return { rule: '六爻全变·用九', text: '乾卦六爻全变，用九：「见群龙无首，吉。」' };
    if (benName === '坤为地')
        return { rule: '六爻全变·用六', text: '坤卦六爻全变，用六：「利永贞。」' };
    return { rule: '六爻全变', text: `六爻全变，以之卦《${zhi[0]}》卦辞为主断：「${zhi[1]}」` };
}

function buildCallouts(hexLines, changingYaos) {
    // 卦画右侧的标注：每一爻一条引线，动爻用橙色并注明变后的爻
    const rows = [];
    for (let i = 5; i >= 0; i--) {
        const line = hexLines[i];
        const moving = changingYaos.includes(i);
        const after = moving ? yaoLabel(line === 9 ? 8 : 7, i) : '';
        rows.push(`<li class="co${moving ? ' moving' : ''}" style="--r:${5 - i}" data-i="${i}">
<span class="co-name" data-ben="${yaoLabel(line, i)}" data-zhi="${moving ? after : yaoLabel(line, i)}">${yaoLabel(line, i)}</span>${moving ? `<span class="co-note">动 → ${after}</span>` : ''}</li>`);
    }
    return `<ol class="callouts" aria-hidden="true">${rows.join('')}</ol>`;
}

function buildMiniMap(v) {
    let cells = '';
    for (let k = 0; k < 64; k++) cells += `<i${k === v ? ' class="on"' : ''}></i>`;
    return `<span class="minimap" aria-hidden="true">${cells}</span>`;
}

function renderResult(gua, hexLines, change, question, fullBin, sourceCard, savedAi, readingContext = {}) {
    const resultArea = document.getElementById('resultArea');
    const verdict = getVerdict(gua);
    const verdictText = { ji: '吉', xiong: '凶', ping: '平' };
    const mainReading = getMainReading(gua, change);
    const zhi = change.hasChange ? change.changeGua : null;
    const v = shaoValue(fullBin || guaBinary(gua));

    const yaoArr = gua[3].split('|');
    const yaoHtml = hexLines.map((line, i) => {
        const isYang = (line === 9 || line === 7);
        const raw = yaoArr[i] || '';
        const cut = raw.indexOf('：');
        const yaoName = cut > 0 ? raw.slice(0, cut) : yaoLabel(line, i);
        const yaoText = cut > 0 ? raw.slice(cut + 1) : raw;
        const isChanging = change.changingYaos.includes(i);
        const lineVis = isYang
            ? '<span class="yao-line yang" aria-hidden="true"><span></span></span>'
            : '<span class="yao-line yin" aria-hidden="true"><span></span><span></span></span>';
        return `<li class="yao-item${isChanging ? ' changing' : ''}" data-i="${i}">
${lineVis}<span class="yao-name">${yaoName}</span><span class="yao-text">${yaoText}</span><span class="yao-type">${YAO_TYPE_CN[line]}${isChanging ? '，动' : ''}</span></li>`;
    }).reverse().join('');

    const analysisHtml = gua[4].split('。').filter(s => s.trim()).map(s =>
        `<span class="analysis-item">${s.trim()}。</span>`
    ).join('');

    const methodText = readingContext.method === 'bazi' ? '生辰起卦' : readingContext.method === 'coin' ? '铜钱起卦' : '未记录';
    const upperName = TRIGRAM_BY_VALUE[v & 7], lowerName = TRIGRAM_BY_VALUE[v >> 3];

    let changeHtml = '';
    if (zhi) {
        const pos = change.changingYaos.map(p => YAO_POS_CN[p]);
        changeHtml = `<section class="block change-section"><h3>变卦</h3>
<div class="change-comparison">
  <div class="gua-box"><div class="gua-mini">${buildYaoArtSvg(hexLines, change.changingYaos)}</div><div class="gua-label">本卦</div><div class="gua-name">${gua[0]}</div><span class="gua-symbol" hidden>${gua[2]}</span></div>
  <div class="change-arrow" aria-hidden="true"><svg viewBox="0 0 48 12"><path d="M0 6h44M39 1l6 5-6 5"/></svg></div>
  <div class="gua-box changed"><div class="gua-mini">${buildYaoArtSvg(binToHexLines(change.changeBinary), change.changingYaos)}</div><div class="gua-label">之卦</div><div class="gua-name">${zhi[0]}</div><span class="gua-symbol" hidden>${zhi[2]}</span></div>
</div>
<div class="change-details"><p>变爻位置：第 ${pos.join('、')} 爻</p><p>${zhi[4]}</p></div></section>`;
    }

    const aiSettings = loadSettings().ai || {};
    const showAiCard = !!savedAi || aiSettings.enabled;
    const aiHtml = showAiCard
        ? `<section class="block card-ai" id="aiReadingCard"><h3>AI 解读</h3><div class="ai-reading-body" id="aiReadingBody"></div></section>`
        : '';

    // 记录本卦所问和起卦时间，供分享卡读取（不读实时输入框和当前时间：回看历史时分享卡要对得上那一卦）
    resultArea.dataset.question = question || '';
    resultArea.dataset.createdAt = readingContext.createdAt || '';
    resultArea.dataset.date = readingContext.date || '';
    if (typeof setPageView === 'function') setPageView('result');

    resultArea.innerHTML = `
<div class="result entering">
  <div class="result-bar" style="--d:0"><button class="back-link" id="backHomeBtn"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>回到起卦</button></div>
  <div class="result-question" style="--d:1"><span class="rq-label">所问</span><h1>${question ? escHtml(question) : '心中所念'}</h1></div>
  <div class="reading-layout">
    <aside class="result-header">
      <figure class="glyph-figure">
        <div class="result-glyph${sourceCard ? ' awaiting' : ''}" id="resultGlyph" data-v="${v}">${buildHexBars(hexLines, change.changingYaos, 'hx-big')}</div>
        ${buildCallouts(hexLines, change.changingYaos)}
      </figure>
      ${zhi ? `<div class="ben-zhi" role="group" aria-label="切换本卦与之卦" style="--d:4">
        <button type="button" class="bz-opt" id="benBtn" aria-pressed="true">本卦<b>${gua[0]}</b></button>
        <button type="button" class="bz-opt" id="zhiBtn" aria-pressed="false">之卦<b>${zhi[0]}</b></button>
        <span class="bz-mark" aria-hidden="true"></span>
      </div>` : '<p class="zhi-none" style="--d:4">六爻皆静，没有之卦</p>'}
      <dl class="title-block" style="--d:5">
        <div class="tb-wide"><dt>卦名</dt><dd>${gua[0]}${buildMiniMap(v)}</dd></div>
        <div><dt>卦序</dt><dd>${guaOrdinal(gua)}</dd></div>
        <div><dt>上下</dt><dd>上${upperName} 下${lowerName}</dd></div>
        <div><dt>起卦</dt><dd>${methodText}</dd></div>
        <div><dt>动爻</dt><dd>${change.changingYaos.length ? change.changingYaos.map(p => YAO_POS_CN[p]).join('、') : '无'}</dd></div>
        <div class="tb-wide"><dt>时间</dt><dd>${readingContext.date ? escHtml(String(readingContext.date)) : '—'}</dd></div>
      </dl>
    </aside>
    <article class="reading" id="readingColumn">
      <header class="reading-head" style="--d:2">
        <div class="reading-name-row"><h2 class="hex-name">${gua[0]}</h2><span class="verdict-seal ${verdict}" aria-label="${verdictText[verdict]}"><span>${verdictText[verdict]}</span></span></div>
        <p class="hex-title">${gua[1]}</p>
        <span class="hex-symbol" hidden>${gua[2]}</span>
      </header>
      <div class="reading-sheet">
      <section class="block main-reading" style="--d:3"><h3>主断 <span class="rule-tag">${mainReading.rule}</span></h3><p class="analysis-list lead"><span class="analysis-item">${mainReading.text}</span></p></section>
      <section class="block" style="--d:4"><h3>卦象</h3><p class="analysis-list">${analysisHtml}</p></section>
      ${changeHtml.replace('<section class="block change-section">', '<section class="block change-section" style="--d:5">')}
      ${aiHtml.replace('<section class="block card-ai"', '<section style="--d:5" class="block card-ai"')}
      <section class="block yao-details" style="--d:6"><h3>六爻 <span class="rule-tag">自上而下</span></h3><ol class="yao-list">${yaoHtml}</ol></section>
      </div>
      <div class="result-actions" style="--d:7">
        <button class="btn btn-primary" id="shareBtn">生成分享图</button>
        <button class="btn" id="newDivineBtn">再问一卦</button>
        <button class="btn btn-quiet" id="viewHistoryBtn">翻阅牌册</button>
      </div>
      <p class="result-warning" style="--d:7">卦可以看，事情仍由自己决定。</p>
    </article>
  </div>
</div>`;
    const backBtn = resultArea.querySelector('#backHomeBtn');
    if (backBtn) backBtn.addEventListener('click', () => { if (typeof returnToInquiry === 'function') returnToInquiry(); });

    resultArea.querySelector('#shareBtn').addEventListener('click', shareAsImage);
    const newBtn = resultArea.querySelector('#newDivineBtn');
    if (newBtn) newBtn.addEventListener('click', () => {
        if (typeof returnToInquiry === 'function') returnToInquiry({ clear: true });
    });
    const viewBtn = resultArea.querySelector('#viewHistoryBtn');
    if (viewBtn) viewBtn.addEventListener('click', toggleHistory);

    // 本卦 ⇄ 之卦：动爻在原处阴阳互变，标注同步改写
    const benBtn = resultArea.querySelector('#benBtn');
    const zhiBtn = resultArea.querySelector('#zhiBtn');
    const showZhi = (on) => {
        const glyph = resultArea.querySelector('#resultGlyph');
        const header = resultArea.querySelector('.result-header');
        const was = header && header.classList && header.classList.contains('as-zhi');
        if (!header || was === on) return;
        header.classList.toggle('as-zhi', on);
        if (glyph && glyph.querySelectorAll) glyph.querySelectorAll('.bar.chg').forEach(b => {
            b.classList.toggle('yang');
            b.classList.toggle('yin');
        });
        if (header.querySelectorAll) header.querySelectorAll('.co-name').forEach(n => {
            n.textContent = on ? n.dataset.zhi : n.dataset.ben;
        });
        benBtn.setAttribute('aria-pressed', String(!on));
        zhiBtn.setAttribute('aria-pressed', String(on));
    };
    if (benBtn && zhiBtn && zhi) {
        benBtn.addEventListener('click', () => showZhi(false));
        zhiBtn.addEventListener('click', () => showZhi(true));
    }

    const aiBody = resultArea.querySelector('#aiReadingBody');
    if (aiBody) {
        const runAi = () => {
            requestAiReading(gua, change, question, aiBody, readingContext).then(text => {
                if (text) persistAiReading(text, readingContext.historyId);
            });
        };
        if (savedAi) {
            aiBody.innerHTML = '<div class="ai-reading-text"></div>';
            aiBody.querySelector('.ai-reading-text').textContent = savedAi;
        } else if (aiSettings.autoRun) {
            runAi();
        } else {
            aiBody.innerHTML = '<button class="btn" id="aiRunBtn">请 AI 解读这一卦</button>';
            aiBody.querySelector('#aiRunBtn').addEventListener('click', runAi);
        }
    }

    if (window.scrollTo) window.scrollTo({ top: 0 });
    const glyphEl = resultArea.querySelector('#resultGlyph');
    const header = resultArea.querySelector('.result-header');
    const land = () => {
        if (glyphEl) glyphEl.classList.remove('awaiting');
        if (header) header.classList.add('landed');
    };
    if (sourceCard && typeof Cosmos !== 'undefined') {
        // 方图（或牌册缩略图）里的那一卦飞到这里，落定后换成页面上的卦画
        requestAnimationFrame(() => Cosmos.toResult(sourceCard.cosmosValue, glyphEl, {
            fromRect: sourceCard.fromRect || null,
            done: land
        }));
    } else {
        if (typeof Cosmos !== 'undefined') Cosmos.hide();
        setTimeout(land, 250);
    }
    const page = resultArea.querySelector('.result');
    setTimeout(() => { if (page && page.classList) page.classList.remove('entering'); }, 2200);
}

// 归一化问题：去空白、去标点符号、全角转半角、统一小写
// 让「同一个问题」在语义上恒定，不因末尾空格 / 标点差异而改变卦象
function normalizeQuestion(q) {
    if (!q) return '';
    return q
        .normalize('NFKC')               // 全角数字 / 字母 / 符号归一为半角
        .replace(/\s+/g, '')             // 去除所有空白
        .replace(/[\p{P}\p{S}]/gu, '')   // 去除标点与符号
        .toLowerCase();
}

// 八字起卦（纯宿命版）：卦象 = f(八字, 归一化问题)，不掺入当前时间
// 同一人 + 同一问题 → 永远同一卦。再三问亦不改，暗合蒙卦「初筮告，再三渎，渎则不告」。
function generateHexagramBazi(bazi, question) {
    const qn = normalizeQuestion(question);
    const qNum = qn ? simpleHash(qn) : 0;        // 稳定非负整数，同问题恒定

    // 梅花易数以农历起卦：年取地支数（子1…亥12）、月日取农历月日（闰月按其月数计）
    // 公历生辰先换算；早于1900年正月初一换算失败时退回公历数值，确定性不变
    const lunar = solarToLunar(bazi.year, bazi.month, bazi.day);
    const yearNum = lunar ? lunarYearBranch(lunar.year) : (bazi.year % 100 || 100);
    const monthNum = lunar ? lunar.month : bazi.month;
    const dayNum = lunar ? lunar.day : bazi.day;

    // 梅花易数：以「年月日」起上卦，「年月日时」起下卦——八字即先天之命
    const baseUpper = yearNum + monthNum + dayNum;
    const baseLower = baseUpper + (bazi.hour + 1);

    // 融入所问之事（确定性：同一问题恒定，不同问题分散；取质数模以打散分布）
    const sumUpper = baseUpper + (qNum % 97);
    const sumLower = baseLower + (Math.floor(qNum / 97) % 89);
    // 动爻＝年月日时总数 mod 6（梅花传统，同下卦总数；问题项随下卦总数自然融入，
    // 观梅占原例：34 起兑为上、43 起离为下，动爻 43%6=1 取初爻——总数只计一次）
    const sumYao   = sumLower;

    const upperIdx = ((sumUpper - 1) % 8 + 8) % 8;
    const lowerIdx = ((sumLower - 1) % 8 + 8) % 8;
    const changingYao = ((sumYao - 1) % 6 + 6) % 6;

    const xiantianOrder = ['☰','☱','☲','☳','☴','☵','☶','☷'];
    const upperBin = TRIGRAM_TO_BINARY[xiantianOrder[upperIdx]];
    const lowerBin = TRIGRAM_TO_BINARY[xiantianOrder[lowerIdx]];

    const lines = [];
    for (let i = 0; i < 3; i++) lines.push(lowerBin[2 - i] === '1' ? 7 : 8);
    for (let i = 0; i < 3; i++) lines.push(upperBin[2 - i] === '1' ? 7 : 8);

    if (lines[changingYao] === 7) lines[changingYao] = 9;
    else lines[changingYao] = 6;

    return lines;
}
