/* ============================================================
   天衍 · DESTINY — 应用逻辑
   算法层(起卦 / 变卦 / 主断 / 八字)与旧版完全一致;
   表现层为「深夜玄学 · 极简暗色」重写版。
   ============================================================ */

const HISTORY_MAX = 50;
const COIN_TO_LINE = { 3: 9, 2: 8, 1: 7, 0: 6 }; // 铜钱法:3阳=老阳9, 2阳=少阴8, 1阳=少阳7, 0阳=老阴6

/* ============ 起卦算法 ============ */

function generateHexagram() {
    const lines = [];
    for (let i = 0; i < 6; i++) {
        const coins = (Math.random() > 0.5 ? 1 : 0) + (Math.random() > 0.5 ? 1 : 0) + (Math.random() > 0.5 ? 1 : 0);
        lines.push(COIN_TO_LINE[coins]);
    }
    return lines;
}

function calculateChangeGua(hexLines, origBin) {
    const changingYaoPositions = [];
    const changeBits = [];
    for (let i = 0; i < hexLines.length; i++) {
        const line = hexLines[i];
        if (line === 9) { changingYaoPositions.push(i); changeBits.push('0'); }
        else if (line === 6) { changingYaoPositions.push(i); changeBits.push('1'); }
        else changeBits.push(line === 7 ? '1' : '0');
    }
    if (!changingYaoPositions.length) return { hasChange: false, changeBinary: origBin, changingYaos: [], changeGua: lookupGua(origBin) };
    const fullBin = changeBits.slice().reverse().join('');
    return { hasChange: true, changeBinary: fullBin, changingYaos: changingYaoPositions, changeGua: lookupGua(fullBin) };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function haptic(ms) { if (navigator.vibrate) navigator.vibrate(ms || 15); }

function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ============ Toast / Confirm ============ */

function showToast(msg, type) {
    type = type || 'info';
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '');
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('toast-out');
        el.addEventListener('animationend', () => el.remove());
    }, 2800);
}

function showConfirm(msg) {
    return new Promise(resolve => {
        const overlay = document.getElementById('confirmOverlay');
        const msgEl = document.getElementById('confirmMsg');
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');
        msgEl.textContent = msg;
        overlay.classList.add('show');
        function cleanup(result) {
            overlay.classList.remove('show');
            yesBtn.removeEventListener('click', onYes);
            noBtn.removeEventListener('click', onNo);
            overlay.removeEventListener('click', onOverlay);
            resolve(result);
        }
        function onYes() { cleanup(true); }
        function onNo() { cleanup(false); }
        function onOverlay(e) { if (e.target === overlay) cleanup(false); }
        yesBtn.addEventListener('click', onYes);
        noBtn.addEventListener('click', onNo);
        overlay.addEventListener('click', onOverlay);
    });
}

/* ============ 工具 ============ */

function simpleHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toRoman(n) {
    const ones = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ'];
    const tens = ['', 'Ⅹ', 'ⅩⅩ', 'ⅩⅩⅩ', 'ⅩⅬ', 'Ⅼ', 'ⅬⅩ', 'ⅬⅩⅩ', 'ⅬⅩⅩⅩ', 'ⅩⅭ'];
    return tens[Math.floor(n / 10)] + ones[n % 10];
}

function guaIndex(gua) {
    const i = GUA.indexOf(gua);
    return i >= 0 ? i + 1 : 1;
}

function getVerdict(gua) {
    return VERDICT_MAP[gua[0]] || 'ping';
}

function binToHexLines(bin) {
    const hex = [];
    for (let i = 0; i < 6; i++) hex.push(bin[5 - i] === '1' ? 7 : 8);
    return hex;
}

/* 六爻 SVG(结果头部 / 卦册缩略图共用) */
function buildYaoArtSvg(hexLines, changingYaos) {
    changingYaos = changingYaos || [];
    const w = 60, h = 80, lineH = 2.4, gap = 8;
    const rowH = lineH + gap;
    const startY = (h - (6 * rowH - gap)) / 2;
    const cx = w / 2, halfW = 22;
    const parts = [];
    for (let i = 0; i < 6; i++) {
        const drawIdx = 5 - i;
        const y = startY + drawIdx * rowH + lineH / 2;
        const line = hexLines[i];
        const isYang = (line === 7 || line === 9);
        const isChanging = changingYaos.includes(i);
        const cls = 'yao-svg-line' + (isChanging ? ' changing' : '');
        const styleAttr = ` style="animation-delay:${i * 120}ms"`;
        if (isYang) {
            parts.push(`<line class="${cls}"${styleAttr} x1="${cx - halfW}" y1="${y}" x2="${cx + halfW}" y2="${y}" />`);
        } else {
            parts.push(`<line class="${cls}"${styleAttr} x1="${cx - halfW}" y1="${y}" x2="${cx - 5}" y2="${y}" />`);
            parts.push(`<line class="${cls}"${styleAttr} x1="${cx + 5}" y1="${y}" x2="${cx + halfW}" y2="${y}" />`);
        }
    }
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
}

/* ============ 起卦仪式:爻线逐根点亮 ============ */

function buildRitualStage(stage, gua, hexLines, change, question) {
    const slots = hexLines.map((line, i) => {
        const isYang = (line === 7 || line === 9);
        const isChanging = change.changingYaos.includes(i);
        const bars = isYang
            ? '<span class="r-bar"></span>'
            : '<span class="r-bar"></span><span class="r-bar"></span>';
        const flag = isChanging ? '<span class="r-flag">变</span>' : '';
        return `<div class="r-slot${isChanging ? ' changing' : ''}" data-i="${i}">${bars}${flag}</div>`;
    }).join('');

    stage.innerHTML = `
<p class="ritual-invocation">心若不诚 · 卦不应人</p>
${question ? `<p class="ritual-question">「${escHtml(question)}」</p>` : ''}
<div class="ritual-hex">${slots}</div>
<p class="ritual-step">&nbsp;</p>
<div class="ritual-name">${gua[0]}</div>
<button class="ritual-skip" type="button">略过</button>`;
}

async function playRitual(stage, gua, hexLines) {
    const stepEl = stage.querySelector('.ritual-step');
    const posNames = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
    const typeNames = { 9: '老阳', 7: '少阳', 8: '少阴', 6: '老阴' };

    await sleep(1000);
    for (let i = 0; i < 6; i++) {
        if (!stage.isConnected) return; // 已被略过并清空
        stepEl.textContent = `${posNames[i]} · ${typeNames[hexLines[i]]}`;
        const slot = stage.querySelector(`.r-slot[data-i="${i}"]`);
        if (slot) slot.classList.add('cast');
        haptic(10);
        await sleep(580);
    }
    if (!stage.isConnected) return;
    stepEl.textContent = '卦成';
    await sleep(420);
    const nameEl = stage.querySelector('.ritual-name');
    if (nameEl) nameEl.classList.add('show');
    haptic(20);
    await sleep(1400);
}

/* ============ 起卦主流程 ============ */

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

    if (settings.method === 'bazi' && !settings.bazi) {
        showToast('请先在设置中填写并保存生辰八字', 'error');
        _divineRunning = false;
        return;
    }

    btn.disabled = true;
    if (btnText) btnText.textContent = '演卦';

    try {
        const hexLines = settings.method === 'bazi'
            ? generateHexagramBazi(settings.bazi, question)
            : generateHexagram();

        const bits = hexLines.map(n => (n === 7 || n === 9) ? '1' : '0');
        const fullBin = bits.slice().reverse().join('');
        const gua = lookupGua(fullBin);
        const change = calculateChangeGua(hexLines, fullBin);

        if (!prefersReducedMotion()) {
            resultArea.innerHTML = '<div class="ritual" id="ritualStage"></div>';
            const stage = document.getElementById('ritualStage');
            buildRitualStage(stage, gua, hexLines, change, question);
            stage.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // 仪式与「略过」竞速:点略过立即出结果
            let skipResolve;
            const skipPromise = new Promise(res => { skipResolve = res; });
            stage.querySelector('.ritual-skip').addEventListener('click', () => skipResolve(), { once: true });
            await Promise.race([playRitual(stage, gua, hexLines), skipPromise]);
        }

        renderResult(gua, hexLines, change, question, fullBin);
        saveToHistory(question, gua, fullBin, hexLines, change);
    } finally {
        btn.disabled = false;
        if (btnText) btnText.textContent = originalText;
        _divineRunning = false;
    }
}

/* ============ 主断:朱熹《易学启蒙》变爻取辞法 ============ */

function getMainReading(gua, change) {
    const yaoArr = gua[3].split('|');
    const changing = change.changingYaos;
    const n = changing.length;
    const benName = gua[0];
    const zhi = change.changeGua;
    const posCN = ['初', '二', '三', '四', '五', '上'];
    const all = [0, 1, 2, 3, 4, 5];

    if (n === 0)
        return { rule: '静卦无变', text: `以本卦《${benName}》卦辞为主断:「${gua[1]}」` };
    if (n === 1)
        return { rule: '一爻动', text: `以本卦《${benName}》${posCN[changing[0]]}爻为主断:${yaoArr[changing[0]] || ''}` };
    if (n === 2)
        return { rule: '二爻动', text: `二爻变,以上动爻为主:${yaoArr[changing[1]] || ''}` };
    if (n === 3)
        return { rule: '三爻动', text: `三爻变,本卦《${benName}》与之卦《${zhi[0]}》卦辞并参:本卦「${gua[1]}」,之卦「${zhi[1]}」。` };
    if (n === 4) {
        const low = all.filter(i => !changing.includes(i))[0];
        return { rule: '四爻动', text: `四爻变,看之卦《${zhi[0]}》中二不变爻,以下爻为主:${zhi[3].split('|')[low] || ''}` };
    }
    if (n === 5) {
        const only = all.filter(i => !changing.includes(i))[0];
        return { rule: '五爻动', text: `五爻变,以之卦《${zhi[0]}》唯一不变之爻为主:${zhi[3].split('|')[only] || ''}` };
    }
    if (benName === '乾为天')
        return { rule: '六爻全变·用九', text: '乾卦六爻全变,用九:「见群龙无首,吉。」' };
    if (benName === '坤为地')
        return { rule: '六爻全变·用六', text: '坤卦六爻全变,用六:「利永贞。」' };
    return { rule: '六爻全变', text: `六爻全变,以之卦《${zhi[0]}》卦辞为主断:「${zhi[1]}」` };
}

/* ============ 结果渲染 ============ */

function renderResult(gua, hexLines, change, question, fullBin) {
    const resultArea = document.getElementById('resultArea');
    const yaoNames = ['初九', '九二', '九三', '九四', '九五', '上九', '初六', '六二', '六三', '六四', '六五', '上六'];
    const idx = guaIndex(gua);
    const roman = toRoman(idx);
    const verdict = getVerdict(gua);
    const verdictText = { ji: '吉', xiong: '凶', ping: '平' };
    const mainReading = getMainReading(gua, change);

    const yaoHtml = hexLines.map((line, i) => {
        const isYang = (line === 9 || line === 7);
        const yaoType = line === 9 ? '老阳' : line === 7 ? '少阳' : line === 8 ? '少阴' : '老阴';
        const yaoName = isYang ? yaoNames[i] : yaoNames[i + 6];
        const yaoText = gua[3].split('|')[i] || '';
        const isChanging = change.changingYaos.includes(i);
        const lineVis = isYang
            ? '<span class="yao-line yang"><span></span></span>'
            : '<span class="yao-line yin"><span></span><span></span></span>';
        const changeBadge = isChanging ? '<span class="yao-badge change">变</span>' : '';
        return `<div class="yao-item${isChanging ? ' changing' : ''}">
<div class="yao-header yao-toggle">${lineVis}<span class="yao-name">${yaoName}</span><span class="yao-badge">${yaoType}</span>${changeBadge}<span class="yao-chevron">›</span></div>
<div class="yao-text">${yaoText}</div></div>`;
    }).join('');

    const analysisHtml = gua[4].split('。').filter(s => s.trim()).map(s =>
        `<div class="analysis-item">${s.trim()}。</div>`
    ).join('');

    let changeHtml = '';
    if (change.hasChange && change.changeGua) {
        const pos = change.changingYaos.map(p => ['初', '二', '三', '四', '五', '上'][p]);
        changeHtml = `<section class="block reveal change-section"><h3 class="block-title">变卦<span class="block-tag">天机易转</span></h3>
<div class="change-comparison">
<div class="gua-box"><div class="gua-label">本卦</div><div class="gua-symbol">${gua[2]}</div><div class="gua-name">${gua[0]}</div></div>
<div class="change-arrow">→</div>
<div class="gua-box changed"><div class="gua-label">变卦</div><div class="gua-symbol">${change.changeGua[2]}</div><div class="gua-name">${change.changeGua[0]}</div></div>
</div>
<div class="change-details"><p>变爻位置:第 ${pos.join('、')} 爻</p><p>${change.changeGua[4]}</p></div></section>`;
    }

    resultArea.innerHTML = `
<section class="result-head reveal">
    <div class="result-kicker">第 ${idx} 卦<span class="result-roman">${roman}</span></div>
    <div class="result-art">${buildYaoArtSvg(hexLines, change.changingYaos)}</div>
    <h2 class="hex-name">${gua[0]}</h2>
    <div class="hex-title">${gua[1]}</div>
    <div class="hex-symbol" hidden>${gua[2]}</div>
    ${question ? `<p class="hex-question">「${escHtml(question)}」</p>` : ''}
    <div class="verdict-seal ${verdict}">${verdictText[verdict]}</div>
    <button class="btn-line btn-share" id="shareBtn">生成分享图</button>
</section>
<section class="block reveal main-reading"><h3 class="block-title">主断<span class="block-tag">${mainReading.rule}</span></h3><div class="analysis-list"><div class="analysis-item">${mainReading.text}</div></div></section>
<section class="block reveal"><h3 class="block-title">卦象解读</h3><div class="analysis-list">${analysisHtml}</div></section>
<section class="block reveal"><h3 class="block-title">六爻之辞</h3><div class="yao-list">${yaoHtml}</div></section>
${changeHtml}
<section class="result-actions reveal">
    <button class="btn-solid" id="newDivineBtn">再问一卦</button>
    <button class="btn-line" id="viewHistoryBtn">翻阅卦册</button>
    <p class="result-warning">占而再三 · 神不告之</p>
</section>`;

    resultArea.querySelector('#shareBtn').addEventListener('click', shareAsImage);
    resultArea.querySelector('#newDivineBtn').addEventListener('click', () => {
        const qEl = document.getElementById('question');
        if (qEl) { qEl.value = ''; qEl.focus(); }
        document.getElementById('divineBtn').classList.remove('charged');
        resultArea.innerHTML = '';
        const target = document.querySelector('.ask');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    resultArea.querySelector('#viewHistoryBtn').addEventListener('click', toggleHistory);

    // 爻辞折叠/展开
    resultArea.querySelectorAll('.yao-toggle').forEach(header => {
        header.addEventListener('click', () => {
            header.closest('.yao-item').classList.toggle('yao-expanded');
        });
    });

    // 分段显形:层层递入
    const sections = resultArea.querySelectorAll('.reveal');
    sections.forEach((el, i) => {
        setTimeout(() => el.classList.add('in'), 60 + i * 150);
    });

    // 断语印:在内容现形后落下
    const seal = resultArea.querySelector('.verdict-seal');
    if (seal) {
        seal.style.opacity = '0';
        setTimeout(() => {
            seal.style.opacity = '';
            seal.classList.add('stamp-in');
            haptic(12);
        }, 1100);
    }

    setTimeout(() => {
        const target = resultArea.querySelector('.result-head') || resultArea;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
}

/* ============ 分享卡 ============ */

function getCurrentGuaData() {
    const r = document.getElementById('resultArea');
    if (!r) return null;
    const nameEl = r.querySelector('.hex-name');
    const titleEl = r.querySelector('.hex-title');
    const symbolEl = r.querySelector('.hex-symbol');
    if (!nameEl) return null;
    const items = r.querySelectorAll('.analysis-item');
    const list = [];
    items.forEach(el => { if (el.textContent.trim()) list.push(el.textContent.trim()); });
    const changingYaos = [];
    const yaoItems = r.querySelectorAll('.yao-item');
    yaoItems.forEach((el, i) => {
        if (el.classList.contains('changing')) changingYaos.push(i);
    });
    const hexagramLines = [];
    yaoItems.forEach((el, i) => {
        const isYang = !!el.querySelector('.yao-line.yang');
        const isChanging = changingYaos.includes(i);
        hexagramLines.push(isYang ? (isChanging ? 9 : 7) : (isChanging ? 6 : 8));
    });
    const hasChange = !!r.querySelector('.change-section');
    let cgName = '', cgSymbol = '', cgExplain = '', changePos = '';
    if (hasChange) {
        const cg = r.querySelector('.gua-box.changed');
        if (cg) {
            cgName = (cg.querySelector('.gua-name') || {}).textContent || '';
            cgSymbol = (cg.querySelector('.gua-symbol') || {}).textContent || '';
        }
        const details = r.querySelector('.change-details');
        if (details) {
            details.querySelectorAll('p').forEach(p => {
                const txt = p.textContent.trim();
                if (txt.startsWith('变爻位置')) changePos = txt;
                else if (txt.length > 10) cgExplain = txt;
            });
        }
    }
    return {
        name: nameEl.textContent, title: titleEl ? titleEl.textContent : '',
        symbol: symbolEl ? symbolEl.textContent : '',
        question: document.getElementById('question').value.trim(),
        analysisList: list, changingYaos, hexagramLines,
        hasChange, cgName, cgSymbol, cgExplain, changePos,
        date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
}

function createShareCard(d) {
    if (!d) return '';
    const guaEntry = GUA.find(g => g[0] === d.name);
    const roman = guaEntry ? toRoman(guaIndex(guaEntry)) : '';
    const num = guaEntry ? guaIndex(guaEntry) : '';
    const verdict = guaEntry ? getVerdict(guaEntry) : 'ping';
    const verdictText = { ji: '吉', xiong: '凶', ping: '平' };
    const verdictColor = verdict === 'ji' ? '#c8a45f' : verdict === 'xiong' ? '#b25e57' : '#8d8779';

    // 六爻 SVG(内联 stroke,不依赖外部 CSS)
    const hexLines = (d.hexagramLines && d.hexagramLines.length === 6)
        ? d.hexagramLines : [8, 8, 8, 8, 8, 8];
    const changingYaos = d.changingYaos || [];
    const shareYaoSvg = (function () {
        const w = 60, h = 80, lineH = 2.4, gap = 8;
        const rowH = lineH + gap;
        const startY = (h - (6 * rowH - gap)) / 2;
        const cx = w / 2, halfW = 22;
        const parts = [];
        for (let i = 0; i < 6; i++) {
            const drawIdx = 5 - i;
            const y = startY + drawIdx * rowH + lineH / 2;
            const line = hexLines[i];
            const isYang = (line === 7 || line === 9);
            const isChanging = changingYaos.includes(i);
            const color = isChanging ? '#c8a45f' : '#e9e4d8';
            const attr = `stroke="${color}" stroke-width="2.8"`;
            if (isYang) {
                parts.push(`<line ${attr} x1="${cx - halfW}" y1="${y}" x2="${cx + halfW}" y2="${y}" />`);
            } else {
                parts.push(`<line ${attr} x1="${cx - halfW}" y1="${y}" x2="${cx - 5}" y2="${y}" />`);
                parts.push(`<line ${attr} x1="${cx + 5}" y1="${y}" x2="${cx + halfW}" y2="${y}" />`);
            }
        }
        return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;">${parts.join('')}</svg>`;
    })();

    return `<div id="shareCard" class="sc-card">
    <div class="sc-frame"></div>
    <div class="sc-frame-inner"></div>

    <div class="sc-header">
        <div class="sc-title">天衍 · DESTINY</div>
        <div class="sc-date">${d.date || ''}</div>
    </div>

    <div class="sc-art-wrap"><div class="sc-art">${shareYaoSvg}</div></div>

    <div class="sc-gua-name">${d.name || ''}</div>
    <div class="sc-gua-title">${d.title || ''}${num ? ` · 第 ${num} 卦` : ''}</div>

    <div class="sc-verdict-wrap">
        <div class="sc-verdict" style="color:${verdictColor};border:1px solid ${verdictColor};">${verdictText[verdict]}</div>
    </div>

    ${d.question ? `<div class="sc-question">「${escHtml(d.question)}」</div>` : '<div class="sc-spacer"></div>'}

    ${d.analysisList && d.analysisList.length ? `<div class="sc-analysis">
        <div class="sc-section-title">卦象解读</div>
        ${d.analysisList.slice(0, 3).map(t => `<div class="sc-analysis-item">${escHtml(t)}</div>`).join('')}
    </div>` : ''}

    ${d.hasChange && d.cgName ? `<div class="sc-change">
        <div class="sc-section-title">变卦演化</div>
        <div class="sc-change-flow">${escHtml(d.name)} → ${escHtml(d.cgName)}</div>
        ${d.changePos ? `<div class="sc-change-pos">${escHtml(d.changePos)}</div>` : ''}
        ${d.cgExplain ? `<div class="sc-change-explain">${escHtml(d.cgExplain)}</div>` : ''}
    </div>` : ''}

    <div class="sc-footer">
        <div>© 天衍 DESTINY</div>
        <div>六十四卦 · 命之所向</div>
    </div>
</div>`;
}

let _lastBlobUrl = null;
let _lastBlob = null;

function canvasToBlob(canvas, type) {
    return new Promise(resolve => canvas.toBlob(resolve, type, 1.0));
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches);
}

function renderShareCanvas(card, scale) {
    return html2canvas(card, { backgroundColor: '#131218', scale, logging: false, useCORS: true });
}

async function shareAsImage() {
    if (typeof html2canvas !== 'function') {
        showToast('分享功能加载失败,请刷新页面后重试', 'error');
        return;
    }
    const container = document.getElementById('shareImageContainer');
    const preview = document.getElementById('shareImagePreview');
    const data = getCurrentGuaData();
    if (!data) { showToast('请先占卜', 'error'); return; }
    preview.innerHTML = '<div class="share-loading"><div class="share-loading-ring"></div><span>生成中</span></div>';
    container.classList.add('show');

    if (_lastBlobUrl) { URL.revokeObjectURL(_lastBlobUrl); _lastBlobUrl = null; }
    _lastBlob = null;

    const tmp = document.createElement('div');
    tmp.style.cssText = 'position:fixed;left:-9999px;top:0;width:560px;pointer-events:none;opacity:0;';
    tmp.innerHTML = createShareCard(data);
    document.body.appendChild(tmp);
    try {
        if (document.fonts && document.fonts.ready) {
            try { await document.fonts.ready; } catch (e) {}
        }
        await sleep(80);
        const card = tmp.querySelector('#shareCard');

        const scale = isMobile() ? 1 : 2;
        let canvas;
        try {
            canvas = await renderShareCanvas(card, scale);
        } catch (e1) {
            canvas = await renderShareCanvas(card, 1);
        }
        if (!canvas || !canvas.width || !canvas.height) {
            canvas = await renderShareCanvas(card, 1);
        }

        let blob = await canvasToBlob(canvas, 'image/png');
        if (!blob) throw new Error('toBlob returned null');

        const objectUrl = URL.createObjectURL(blob);
        _lastBlobUrl = objectUrl;
        _lastBlob = blob;

        const hint = isMobile()
            ? '<div style="margin-top:10px;text-align:center;font-size:12px;color:#8f7440;letter-spacing:2px;">长按图片 · 保存到相册</div>'
            : '';
        preview.innerHTML = '<img id="sharePreviewImg" alt="分享图">' + hint;
        const imgEl = preview.querySelector('#sharePreviewImg');
        imgEl.onerror = function () {
            this.onerror = null;
            preview.innerHTML = '<div style="padding:20px;color:#b25e57;">预览加载失败,可直接点「下载图片」</div>';
        };
        imgEl.src = objectUrl;

        document.getElementById('shareDownloadBtn').onclick = () => {
            try {
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = '天衍_' + Date.now() + '.png';
                document.body.appendChild(a); // Firefox 要求节点在文档中才能触发 click
                a.click();
                a.remove();
                if (isIOS()) {
                    setTimeout(() => showToast('若未自动保存,请长按上方预览图选择「保存到相册」'), 300);
                }
            } catch (e) {
                showToast('下载失败,请长按上方预览图保存到相册', 'error');
            }
        };

        document.getElementById('shareCopyBtn').onclick = async () => {
            if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
                showToast('此浏览器不支持复制图片,请长按预览图保存到相册', 'error');
                return;
            }
            if (!_lastBlob) {
                showToast('图片尚未生成完毕,请稍候再试');
                return;
            }
            try {
                const item = new ClipboardItem({ 'image/png': Promise.resolve(_lastBlob) });
                await navigator.clipboard.write([item]);
                showToast('已复制到剪贴板', 'success');
            } catch (e) {
                showToast(isMobile()
                    ? '复制失败,请长按预览图保存到相册'
                    : '复制失败,请点击下载图片', 'error');
            }
        };
    } catch (e) {
        const msg = (e && e.message) ? e.message : String(e);
        preview.innerHTML =
            '<div style="padding:20px;color:#b25e57;text-align:center;">生成失败' +
            '<br><small style="color:#5f5a50;font-size:11px;word-break:break-all;display:inline-block;margin-top:6px;">' + escHtml(msg) + '</small></div>';
    } finally {
        if (tmp.parentNode) tmp.parentNode.removeChild(tmp);
    }
}

function closeShare() {
    document.getElementById('shareImageContainer').classList.remove('show');
    if (_lastBlobUrl) {
        URL.revokeObjectURL(_lastBlobUrl);
        _lastBlobUrl = null;
    }
    _lastBlob = null;
}

/* ============ 卦册(历史)============ */

function readHistorySafe() {
    try {
        const raw = localStorage.getItem('divinationHistory');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function saveToHistory(question, gua, fullBin, hexLines, change) {
    try {
        const history = readHistorySafe();
        history.unshift({
            question: question || '心中所念',
            gua: gua[0], symbol: gua[2], title: gua[1],
            binary: fullBin, hexagramLines: hexLines,
            changeBinary: change.changeBinary,
            hasChange: change.hasChange,
            changingYaos: change.changingYaos,
            date: new Date().toLocaleString('zh-CN')
        });
        localStorage.setItem('divinationHistory', JSON.stringify(history.slice(0, HISTORY_MAX)));
    } catch (e) {
        showToast('卦册已满,无法记录本次占卜', 'error');
    }
}

function toggleHistory() {
    const panel = document.getElementById('historyPanel');
    const overlay = document.getElementById('historyOverlay');
    panel.classList.toggle('show');
    overlay.classList.toggle('show');
    if (panel.classList.contains('show')) loadHistory();
}

function loadHistory() {
    const history = readHistorySafe();
    const list = document.getElementById('historyList');
    if (history.length === 0) {
        list.innerHTML = `<div class="history-empty">
<div class="history-empty-glyph">☰</div>
<p>尚无记录</p>
<p class="history-empty-hint">请先卜一卦</p>
</div>`;
        return;
    }
    const verdictText = { ji: '吉', xiong: '凶', ping: '平' };
    list.innerHTML = history.map((item, idx) => {
        const guaEntry = item.binary ? lookupGua(item.binary) : null;
        const verdict = guaEntry ? getVerdict(guaEntry) : 'ping';
        const hexLines = (item.hexagramLines && item.hexagramLines.length === 6)
            ? item.hexagramLines
            : binToHexLines(item.binary || '000000');
        const thumb = buildYaoArtSvg(hexLines, item.changingYaos || []);
        return `<div class="history-item" data-idx="${idx}">
<div class="history-thumb">${thumb}</div>
<div class="history-info">
<div class="history-q">${escHtml(item.question)}</div>
<div class="history-meta"><span class="verdict-mini ${verdict}">${verdictText[verdict]}</span><span>${item.symbol || ''} ${item.gua || ''}</span>${item.hasChange ? '<span class="history-tag">变</span>' : ''}</div>
<div class="history-date">${item.date}</div>
</div>
<button class="history-del" data-idx="${idx}" aria-label="删除">×</button>
</div>`;
    }).join('');
    list.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.history-del')) return;
            loadHistoryItem(parseInt(el.dataset.idx));
        });
    });
    list.querySelectorAll('.history-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteHistoryItem(parseInt(btn.dataset.idx));
        });
    });
}

function loadHistoryItem(index) {
    const history = readHistorySafe();
    const item = history[index];
    if (!item) return;
    const gua = item.binary ? lookupGua(item.binary) : (GUA.find(g => g[2] === item.symbol) || GUA[0]);
    if (!gua) return;
    const change = {
        hasChange: item.hasChange,
        changeBinary: item.changeBinary,
        changingYaos: item.changingYaos || [],
        changeGua: item.changeBinary ? lookupGua(item.changeBinary) : null
    };
    if (item.hexagramLines && item.hexagramLines.length === 6) {
        renderResult(gua, item.hexagramLines, change, item.question, item.binary);
    } else {
        const hex = binToHexLines(item.binary || '000000');
        renderResult(gua, hex, change, item.question, item.binary || '000000');
    }
    toggleHistory();
}

function deleteHistoryItem(index) {
    const history = readHistorySafe();
    if (index < 0 || index >= history.length) return;
    const el = document.querySelector(`.history-item[data-idx="${index}"]`);
    if (el) {
        el.style.transition = 'transform 0.35s ease, opacity 0.35s ease, max-height 0.3s ease 0.1s';
        el.style.transform = 'translateX(-100%)';
        el.style.opacity = '0';
        el.style.maxHeight = el.offsetHeight + 'px';
        el.offsetHeight;
        el.style.maxHeight = '0';
        el.style.marginBottom = '0';
        el.style.paddingTop = '0';
        el.style.paddingBottom = '0';
        el.addEventListener('transitionend', () => {
            const fresh = readHistorySafe();
            if (index < fresh.length) fresh.splice(index, 1);
            try { localStorage.setItem('divinationHistory', JSON.stringify(fresh)); } catch (e) {}
            loadHistory();
        }, { once: true });
    } else {
        history.splice(index, 1);
        try { localStorage.setItem('divinationHistory', JSON.stringify(history)); } catch (e) {}
        loadHistory();
    }
}

async function clearHistory() {
    const yes = await showConfirm('确定清空卦册?');
    if (yes) {
        try { localStorage.removeItem('divinationHistory'); } catch (e) {}
        loadHistory();
    }
}

/* ============ 每日一卦 ============ */

function getUserSeed() {
    try {
        let uid = localStorage.getItem('tianyan_uid');
        if (!uid) {
            uid = Math.random().toString(36).substring(2) + Date.now().toString(36);
            localStorage.setItem('tianyan_uid', uid);
        }
        return uid;
    } catch (e) {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
}

function getDailyGua() {
    const d = new Date();
    const dateStr = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    const settings = loadSettings();

    if (settings.bazi) {
        const b = settings.bazi;
        const yearNum = b.year % 100 || 100;
        const nowDay = d.getDate();
        const nowMonth = d.getMonth() + 1;
        const sumUpper = yearNum + b.month + b.day + nowDay;
        const sumLower = sumUpper + (b.hour + 1) + nowMonth;
        const upperIdx = ((sumUpper - 1) % 8 + 8) % 8;
        const lowerIdx = ((sumLower - 1) % 8 + 8) % 8;
        const xiantianOrder = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷'];
        const upperBin = TRIGRAM_TO_BINARY[xiantianOrder[upperIdx]];
        const lowerBin = TRIGRAM_TO_BINARY[xiantianOrder[lowerIdx]];
        return lookupGua(upperBin + lowerBin);
    }

    const uid = getUserSeed();
    const combined = dateStr + ':' + uid;
    let seed = 0;
    for (let i = 0; i < combined.length; i++) seed = ((seed << 5) - seed + combined.charCodeAt(i)) | 0;
    return GUA[Math.abs(seed) % 64];
}

function getDailyMotto() {
    const d = new Date();
    const uid = getUserSeed();
    const str = d.getDate() + uid;
    let seed = 0;
    for (let i = 0; i < str.length; i++) seed = ((seed << 5) - seed + str.charCodeAt(i)) | 0;
    return DAILY_MOTTOS[Math.abs(seed) % DAILY_MOTTOS.length];
}

function renderDailyGua() {
    const el = document.getElementById('dailyGua');
    if (!el) return;
    const gua = getDailyGua();
    const motto = getDailyMotto();
    el.innerHTML = `
<span class="daily-label">今日</span>
<span class="daily-symbol">${gua[2]}</span>
<span class="daily-name">${gua[0]}</span>
<span class="daily-sep">·</span>
<span class="daily-motto">${motto}</span>`;
    el.onclick = () => showGuaDetail(getDailyGua());
}

/* Hero 右侧爻线 = 今日卦象 */
function renderHeroGlyph() {
    const el = document.getElementById('heroGlyph');
    if (!el) return;
    const gua = getDailyGua();
    const bin = TRIGRAM_TO_BINARY[gua[2][0]] + TRIGRAM_TO_BINARY[gua[2][1]];
    const lines = binToHexLines(bin);
    el.innerHTML = lines.map((l, i) => {
        const isYang = (l === 7 || l === 9);
        const bar = `<span class="g-bar" style="--i:${i}"></span>`;
        return `<div class="g-row">${isYang ? bar : bar + bar}</div>`;
    }).join('');
    const cap = document.getElementById('heroGlyphName');
    if (cap) cap.textContent = '今日卦象 · ' + gua[0];
}

/* ============ 卦象详解 ============ */

function showGuaDetail(gua) {
    const old = document.querySelector('.detail-overlay');
    if (old) old.remove();

    const yaos = gua[3].split('|');
    const yaoHtml = yaos.map(y => {
        const i = y.indexOf('：');
        const pos = i > 0 ? y.substring(0, i) : '';
        const txt = i > 0 ? y.substring(i + 1) : y;
        return `<div class="detail-yao"><span class="detail-yao-name">${pos}</span>${txt}</div>`;
    }).join('');

    const analysis = gua[4].split('。').filter(s => s.trim()).map(s =>
        `<p>${s.trim()}。</p>`
    ).join('');

    const upper = getTrigramName(gua[2][0]);
    const lower = getTrigramName(gua[2][1]);
    const roman = toRoman(guaIndex(gua));

    const overlay = document.createElement('div');
    overlay.className = 'detail-overlay';
    overlay.innerHTML = `
<div class="detail-box">
    <div class="detail-head">
        <div class="detail-symbol">${gua[2]}</div>
        <div class="detail-info">
            <div class="detail-roman">${roman}</div>
            <h2>${gua[0]}</h2>
            <div class="detail-sub">${gua[1]}</div>
        </div>
        <button class="detail-close" id="detailCloseBtn" aria-label="关闭">×</button>
    </div>
    <div class="detail-meta">上卦 ${upper} · 下卦 ${lower}</div>
    <div class="detail-section"><h3>爻辞</h3>${yaoHtml}</div>
    <div class="detail-section"><h3>卦象解读</h3><div class="detail-analysis">${analysis}</div></div>
</div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    overlay.querySelector('#detailCloseBtn').addEventListener('click', () => overlay.remove());
    requestAnimationFrame(() => overlay.classList.add('show'));
}

function getTrigramName(sym) {
    const map = { '☰': '乾(天)', '☱': '兑(泽)', '☲': '离(火)', '☳': '震(雷)', '☴': '巽(风)', '☵': '坎(水)', '☶': '艮(山)', '☷': '坤(地)' };
    return map[sym] || sym;
}

/* ============ 设置 ============ */

const DEFAULT_SETTINGS = {
    method: 'coin',
    showDaily: true,
    bazi: null
};

function loadSettings() {
    try {
        const raw = localStorage.getItem('tianyan_settings');
        if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {}
    return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
    try {
        localStorage.setItem('tianyan_settings', JSON.stringify(settings));
    } catch (e) {}
}

function saveSetting(key, value) {
    const settings = loadSettings();
    settings[key] = value;
    saveSettings(settings);
    applySettings(settings);
}

function saveBazi() {
    const year = document.getElementById('baziYear').value;
    const month = document.getElementById('baziMonth').value;
    const day = document.getElementById('baziDay').value;
    const hour = document.getElementById('baziHour').value;
    const status = document.getElementById('baziStatus');

    if (!year || !month || !day || hour === '') {
        status.textContent = '请填写完整的生辰八字信息';
        status.className = 'bazi-status error';
        return;
    }
    if (year < 1900 || year > 2100) {
        status.textContent = '年份范围:1900-2100';
        status.className = 'bazi-status error';
        return;
    }
    const maxDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    if (day < 1 || day > maxDay) {
        status.textContent = `${month}月最多${maxDay}天,请检查日期`;
        status.className = 'bazi-status error';
        return;
    }

    const bazi = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour) };
    const settings = loadSettings();
    settings.bazi = bazi;
    saveSettings(settings);

    const shiChen = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    status.textContent = `已保存:${year}年${month}月${day}日 ${shiChen[hour]}时`;
    status.className = 'bazi-status success';

    // 八字会影响每日一卦,立即刷新
    renderDailyGua();
    renderHeroGlyph();
}

function applySettings(settings) {
    const dailyEl = document.getElementById('dailyGua');
    if (dailyEl) dailyEl.style.display = settings.showDaily ? '' : 'none';
}

function restoreSettingsUI() {
    const settings = loadSettings();

    const methodEl = document.getElementById('settingMethod');
    if (methodEl) methodEl.value = settings.method;

    const dailyEl = document.getElementById('settingDaily');
    if (dailyEl) dailyEl.checked = settings.showDaily;

    if (settings.bazi) {
        const b = settings.bazi;
        document.getElementById('baziYear').value = b.year || '';
        document.getElementById('baziMonth').value = b.month || '';
        document.getElementById('baziDay').value = b.day || '';
        document.getElementById('baziHour').value = b.hour !== undefined ? b.hour : '';
        const shiChen = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
        const status = document.getElementById('baziStatus');
        if (status) {
            status.textContent = `当前:${b.year}年${b.month}月${b.day}日 ${shiChen[b.hour]}时`;
            status.className = 'bazi-status success';
        }
    }

    applySettings(settings);
}

function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    const overlay = document.getElementById('settingsOverlay');
    panel.classList.toggle('show');
    overlay.classList.toggle('show');
}

/* ============ 八字起卦 ============ */

// 归一化问题:去空白、去标点、全角转半角、统一小写
// 让「同一个问题」在语义上恒定,不因末尾空格 / 标点差异而改变卦象
function normalizeQuestion(q) {
    if (!q) return '';
    return q
        .normalize('NFKC')
        .replace(/\s+/g, '')
        .replace(/[\p{P}\p{S}]/gu, '')
        .toLowerCase();
}

// 八字起卦(纯宿命版):卦象 = f(八字, 归一化问题),不掺入当前时间
// 同一人 + 同一问题 → 永远同一卦。再三问亦不改,暗合蒙卦「初筮告,再三渎,渎则不告」。
function generateHexagramBazi(bazi, question) {
    const qn = normalizeQuestion(question);
    const qNum = qn ? simpleHash(qn) : 0;

    const yearNum = bazi.year % 100 || 100;
    // 梅花易数:以八字「年月日」起上卦,「年月日时」起下卦
    const baseUpper = yearNum + bazi.month + bazi.day;
    const baseLower = baseUpper + (bazi.hour + 1);

    const sumUpper = baseUpper + (qNum % 97);
    const sumLower = baseLower + (Math.floor(qNum / 97) % 89);
    const sumYao = sumUpper + sumLower; // 动爻=上下卦总数 mod 6(梅花传统)

    const upperIdx = ((sumUpper - 1) % 8 + 8) % 8;
    const lowerIdx = ((sumLower - 1) % 8 + 8) % 8;
    const changingYao = ((sumYao - 1) % 6 + 6) % 6;

    const xiantianOrder = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷'];
    const upperBin = TRIGRAM_TO_BINARY[xiantianOrder[upperIdx]];
    const lowerBin = TRIGRAM_TO_BINARY[xiantianOrder[lowerIdx]];

    const lines = [];
    for (let i = 0; i < 3; i++) lines.push(lowerBin[2 - i] === '1' ? 7 : 8);
    for (let i = 0; i < 3; i++) lines.push(upperBin[2 - i] === '1' ? 7 : 8);

    if (lines[changingYao] === 7) lines[changingYao] = 9;
    else lines[changingYao] = 6;

    return lines;
}

/* ============ 初始化 ============ */

document.addEventListener('DOMContentLoaded', () => {
    // 页面不可见时暂停所有循环 CSS 动画,省后台 GPU
    document.addEventListener('visibilitychange', () => {
        document.documentElement.style.setProperty('--anim-state', document.hidden ? 'paused' : 'running');
    });

    renderDailyGua();
    renderHeroGlyph();
    restoreSettingsUI();
    loadHistory();

    document.getElementById('settingsGear').addEventListener('click', toggleSettings);
    document.getElementById('settingsOverlay').addEventListener('click', toggleSettings);
    document.getElementById('settingsCloseBtn').addEventListener('click', toggleSettings);
    document.getElementById('divineBtn').addEventListener('click', divine);
    document.getElementById('historyBtn').addEventListener('click', toggleHistory);
    document.getElementById('historyOverlay').addEventListener('click', toggleHistory);
    document.getElementById('historyCloseBtn').addEventListener('click', toggleHistory);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
    document.getElementById('saveBaziBtn').addEventListener('click', saveBazi);
    document.getElementById('closeShareBtn').addEventListener('click', closeShare);

    const shareContainer = document.getElementById('shareImageContainer');
    if (shareContainer) shareContainer.addEventListener('click', e => { if (e.target === shareContainer) closeShare(); });

    document.getElementById('settingMethod').addEventListener('change', function () {
        saveSetting('method', this.value);
        // 选八字起卦但尚未填八字:就地提示并高亮表单
        if (this.value === 'bazi' && !loadSettings().bazi) {
            showToast('八字起卦需先填写并保存生辰八字', 'error');
            const grid = document.getElementById('baziGrid');
            if (grid) {
                grid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                grid.classList.add('hint-flash');
                setTimeout(() => grid.classList.remove('hint-flash'), 1600);
            }
        }
    });
    document.getElementById('settingDaily').addEventListener('change', function () { saveSetting('showDaily', this.checked); });

    // Esc 关闭当前打开的弹层(按层级从上往下)
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const detail = document.querySelector('.detail-overlay.show');
        if (detail) { detail.remove(); return; }
        const confirmO = document.getElementById('confirmOverlay');
        if (confirmO && confirmO.classList.contains('show')) { document.getElementById('confirmNo').click(); return; }
        const share = document.getElementById('shareImageContainer');
        if (share && share.classList.contains('show')) { closeShare(); return; }
        const settingsO = document.getElementById('settingsOverlay');
        if (settingsO && settingsO.classList.contains('show')) { toggleSettings(); return; }
        const historyO = document.getElementById('historyOverlay');
        if (historyO && historyO.classList.contains('show')) { toggleHistory(); return; }
    });

    const questionInput = document.getElementById('question');
    const divineButton = document.getElementById('divineBtn');
    questionInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); divine(); }
    });
    questionInput.addEventListener('input', () => {
        divineButton.classList.toggle('charged', questionInput.value.trim().length > 0);
    });

    // 回到顶部:用 IntersectionObserver 观察首屏哨兵,避免 scroll 监听
    const bttBtn = document.getElementById('backToTop');
    const sentinel = document.getElementById('topSentinel');
    if (bttBtn && sentinel && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                bttBtn.classList.toggle('visible', !entry.isIntersecting);
            });
        }, { threshold: 0 });
        io.observe(sentinel);
        bttBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});
