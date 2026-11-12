// share —— 抓取当前卦数据、生成 9:16 分享卡、html2canvas 导图、下载/复制
// 分享卡只用纯色、文字和内联 SVG，file:// 下也不会污染画布。

// 分享卡的数据：只用结果页记下的六爻、所问和起卦时间，卦、之卦、主断现算。
// 不从页面上的元素去读：结果页一改版，分享图就跟着出错（#22 就因此把卦全画成了阴爻）
function getCurrentGuaData() {
    const r = document.getElementById('resultArea');
    if (!r) return null;
    const lines = /^[6-9]{6}$/.test(r.dataset.lines || '') ? Array.from(r.dataset.lines, Number) : null;
    let gua = null, change = null, main = null;
    if (lines) {
        const fullBin = lines.map(n => (n === 7 || n === 9) ? '1' : '0').reverse().join('');
        gua = lookupGua(fullBin);
        change = calculateChangeGua(lines, fullBin);
        main = getMainReading(gua, change);
    }
    // 分享卡上写起卦那一刻，而不是生成图片的时间；旧记录只有本地化日期字符串时原样用
    const when = r.dataset.createdAt ? new Date(r.dataset.createdAt) : null;
    const fmt = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const date = when && !isNaN(when) ? when.toLocaleDateString('zh-CN', fmt) : (r.dataset.date || new Date().toLocaleDateString('zh-CN', fmt));
    return {
        gua, change, main, hexagramLines: lines || [],
        question: (r.dataset.question || '').trim(),
        date, createdAt: when && !isNaN(when) ? when.toISOString() : ''
    };
}

// 分享卡的样式随卡片一起走（作为 <style> 放进卡片里）：html2canvas 出图时会在隐藏框架里重新加载页面样式表，
// 样式表加载失败或太慢（断网、服务停了）时，卡片也不会变成没排版的纯文字
const SHARE_CARD_CSS = `
    :where(#shareCard, #shareCard *) { box-sizing: border-box; margin: 0; }
    .sc-card { position: relative; overflow: hidden; width: 500px; height: 888px; padding: 40px 36px 34px; display: flex; flex-direction: column; background: linear-gradient(165deg, #1B4482 0%, #143668 46%, #0D2547 100%); color: #EEF2F7; font-family: 'Noto Serif SC', serif; line-height: 1.8; }
    .sc-bg { position: absolute; left: 0; top: 0; }
    .sc-head { position: relative; display: flex; justify-content: space-between; align-items: flex-start; }
    .sc-brand { font-family: 'ZCOOL XiaoWei', 'Noto Serif SC', serif; font-size: 26px; line-height: 1; letter-spacing: .16em; }
    .sc-brand span { display: block; margin-top: 10px; font-family: 'Noto Serif SC', serif; font-size: 12px; letter-spacing: .5em; color: #A7B8D3; }
    .sc-when { text-align: right; line-height: 1.5; }
    .sc-when b { display: block; font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 17px; font-weight: 400; letter-spacing: .12em; color: #EEF2F7; }
    .sc-when span { font-size: 12px; letter-spacing: .08em; color: #A7B8D3; }
    .sc-stage { position: relative; margin: 34px -36px 0; width: 500px; height: 300px; flex: none; }
    .sc-ring { position: absolute; left: 0; top: 0; }
    .sc-bar { position: absolute; left: -10px; width: 290px; height: 28px; background: #EEF2F7; }
    .sc-bar.yin { background: transparent; }
    .sc-bar.yin i { position: absolute; top: 0; height: 28px; width: 122px; background: #EEF2F7; }
    .sc-bar.yin i + i { left: 168px; }
    .sc-bar.moving, .sc-bar.moving i { background: #FF8A5C; }
    .sc-bar.yin.moving { background: transparent; }
    .sc-mark { position: absolute; left: 292px; width: 24px; text-align: center; font-size: 22px; line-height: 36px; color: #FF8A5C; }
    .sc-name { position: absolute; left: 392px; top: 150px; width: 80px; margin: -96px 0 0 -40px; height: 192px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: 'ZCOOL XiaoWei', 'Noto Serif SC', serif; font-size: 54px; line-height: 1.08; }
    .sc-name.long { font-size: 44px; }
    .sc-name span { display: block; }
    .sc-info { position: relative; display: flex; align-items: flex-start; gap: 18px; margin-top: 18px; }
    .sc-info-text { flex: 1; min-width: 0; padding-top: 6px; }
    .sc-seal-wrap { flex: none; display: flex; flex-direction: column; align-items: center; gap: 6px; margin-right: 30px; }
    .sc-seal { position: relative; width: 50px; height: 50px; padding: 3px; border: 2px solid; background: #11305C; transform: rotate(-6deg); }
    .sc-seal span { display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; border: 1px solid; font-family: 'ZCOOL XiaoWei', 'Noto Serif SC', serif; font-size: 22px; line-height: 1; }
    .sc-ji { color: #C5D1E2; border-color: #C5D1E2; }
    .sc-xiong { color: #C5D1E2; border-color: #C5D1E2; }
    .sc-xiong span { background: #C5D1E2; color: #11305C; border-color: #C5D1E2; }
    .sc-ping { color: #8EA2C2; border-color: #8EA2C2; }
    .sc-seal-note { font-size: 12px; letter-spacing: .2em; color: #8EA2C2; }
    .sc-meta { position: relative; font-size: 14px; line-height: 1.9; letter-spacing: .14em; color: #C5D1E2; }
    .sc-meta em { font-style: normal; margin: 0 .6em; color: #A7B8D3; }
    .sc-change { position: relative; font-size: 14px; line-height: 1.9; letter-spacing: .14em; color: #FF8A5C; }
    .sc-change span { color: #C5D1E2; letter-spacing: .06em; }
    .sc-ask { position: relative; flex: none; margin-top: 26px; padding-left: 16px; border-left: 3px solid #EEF2F7; font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 27px; line-height: 1.4; overflow-wrap: anywhere; max-height: 140px; overflow: hidden; }
    .sc-ask span { display: block; margin-bottom: 4px; font-family: 'Noto Serif SC', serif; font-size: 12px; letter-spacing: .5em; color: #A7B8D3; }
    .sc-main { position: relative; flex: none; margin-top: 20px; padding-left: 16px; border-left: 2px solid #EEF2F7; }
    .sc-label { display: block; font-size: 12px; letter-spacing: .5em; color: #A7B8D3; }
    .sc-quote { margin-top: 6px; font-family: 'ZCOOL XiaoWei', 'Noto Serif SC', serif; font-size: 30px; line-height: 1.35; letter-spacing: .04em; color: #EEF2F7; }
    .sc-quote.long { font-size: 23px; }
    .sc-quote.xl { font-size: 17px; line-height: 1.65; font-family: 'Noto Serif SC', 'Songti SC', serif; }
    .sc-from { margin-top: 4px; font-size: 13px; letter-spacing: .06em; color: #A7B8D3; }
    .sc-reading { position: relative; flex: 0 1 auto; min-height: 0; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(238, 242, 247, .14); font-size: 15px; line-height: 1.9; color: #A7B8D3;  overflow: hidden; }
    .sc-foot { position: relative; margin-top: auto; padding-top: 14px; display: flex; justify-content: space-between; border-top: 1px dashed rgba(238, 242, 247, .3); font-size: 12px; letter-spacing: .1em; color: #A7B8D3; }
`;

// 起卦时刻写成干支农历（乙巳年九月初十 午时）；旧记录没有精确时间时退回原日期字符串
function shareCardWhen(d) {
    const when = d.createdAt ? new Date(d.createdAt) : null;
    if (!when || isNaN(when)) return { lunar: '', solar: d.date || '' };
    const lu = solarToLunar(when.getFullYear(), when.getMonth() + 1, when.getDate());
    const shi = DI_ZHI[Math.floor((when.getHours() + 1) / 2) % 12] + '时';
    const pad = n => String(n).padStart(2, '0');
    return {
        lunar: lu ? `${ganZhiYear(lu.year)}年${lunarMonthName(lu.month, lu.isLeap)}${lunarDayName(lu.day)} ${shi}` : '',
        solar: `${when.getFullYear()}.${pad(when.getMonth() + 1)}.${pad(when.getDate())} ${pad(when.getHours())}:${pad(when.getMinutes())}`
    };
}

// 背景：蓝晒纸的细网格、四角裁切线，和压在卦名后面的先天圆环（橙色刻度＝六十四取一）。
// 每组线都合成一条 path：html2canvas 会给每个节点复制一遍计算样式，上百根 <line> 会让出图卡顿
function shareCardBackdrop() {
    let grid = '';
    for (let x = 24; x < 500; x += 24) grid += `M${x} 0V888`;
    for (let y = 24; y < 888; y += 24) grid += `M0 ${y}H500`;
    const crop = [[18, 18, 1, 1], [482, 18, -1, 1], [18, 870, 1, -1], [482, 870, -1, -1]]
        .map(([x, y, sx, sy]) => `M${x} ${y + sy * 22}V${y}H${x + sx * 22}`).join('');
    return `<svg class="sc-bg" width="500" height="888" viewBox="0 0 500 888" aria-hidden="true">
<path d="${grid}" stroke="#EEF2F7" stroke-opacity=".05" stroke-width="1"/>
<path d="${crop}" stroke="#EEF2F7" stroke-opacity=".5" stroke-width="1.2" fill="none"/></svg>`;
}
function shareCardRing() {
    const cx = 392, cy = 150, pt = (r, a) => `${(cx + r * Math.sin(a)).toFixed(1)} ${(cy - r * Math.cos(a)).toFixed(1)}`;
    let ticks = '';
    for (let k = 1; k < 64; k++) {
        const a = k * 5.625 * Math.PI / 180;
        ticks += `M${pt(118, a)}L${pt(k % 8 === 0 ? 132 : 126, a)}`;
    }
    return `<svg class="sc-ring" width="500" height="300" viewBox="0 0 500 300" aria-hidden="true">
<circle cx="${cx}" cy="${cy}" r="138" fill="none" stroke="#EEF2F7" stroke-opacity=".14"/>
<circle cx="${cx}" cy="${cy}" r="104" fill="none" stroke="#EEF2F7" stroke-opacity=".22" stroke-dasharray="2 5"/>
<path d="${ticks}" stroke="#EEF2F7" stroke-opacity=".32" stroke-width="1"/>
<path d="M${pt(100, 0)}L${pt(146, 0)}" stroke="#EEF2F7" stroke-width="2.4"/></svg>`;
}

function createShareCard(d) {
    if (!d || !d.gua) return '';
    const gua = d.gua, change = d.change, main = d.main;
    const verdict = getVerdict(gua);
    const verdictText = { ji: '吉', xiong: '凶', ping: '平' };
    const hexLines = d.hexagramLines;
    const v = shaoValue(hexLines.map(n => (n === 7 || n === 9) ? '1' : '0').reverse().join(''));
    const when = shareCardWhen(d);
    const zhi = change.hasChange ? change.changeGua : null;
    const movingText = change.changingYaos.length ? change.changingYaos.map(p => YAO_POS_CN[p]).join('、') + '爻动' : '';
    // 大卦画：六根爻条从卡片左缘伸进来，动爻橙色，并按古法在末端标 ○（老阳）/ ×（老阴）
    const bars = hexLines.map((line, i) => {
        const yang = line === 7 || line === 9, moving = line === 9 || line === 6;
        const top = 16 + (5 - i) * 48;
        const cls = 'sc-bar' + (yang ? '' : ' yin') + (moving ? ' moving' : '');
        return `<div class="${cls}" style="top:${top}px">${yang ? '' : '<i></i><i></i>'}</div>` +
            (moving ? `<span class="sc-mark" style="top:${top - 4}px">${line === 9 ? '○' : '×'}</span>` : '');
    }).join('');
    const chars = Array.from(gua[0]);
    const nameHtml = chars.map(ch => `<span>${escHtml(ch)}</span>`).join('');
    // 主断和结果页一样：辞放大，下面一行小字写出处。辞长时字号跟着收
    const quoteLen = main.lines.reduce((n, l) => n + l.text.length, 0);
    const quoteCls = quoteLen > 28 ? ' xl' : quoteLen > 14 ? ' long' : '';
    const mainHtml = main.lines.map(l => `<div class="sc-quote${quoteCls}">${escHtml(l.text)}</div><div class="sc-from">${escHtml(l.from)}</div>`).join('');

    // 9:16 竖版，宽 500
    return `<div id="shareCard" class="sc-card"><style>${SHARE_CARD_CSS}</style>
  ${shareCardBackdrop()}
  <div class="sc-head">
    <div class="sc-brand">天衍<span>起卦签</span></div>
    <div class="sc-when">${when.lunar ? `<b>${escHtml(when.lunar)}</b>` : ''}<span>${escHtml(when.solar)}</span></div>
  </div>
  <div class="sc-stage">
    ${shareCardRing()}
    ${bars}
    <div class="sc-name${chars.length > 3 ? ' long' : ''}">${nameHtml}</div>
  </div>
  <div class="sc-info">
    <div class="sc-info-text">
      <div class="sc-meta">${guaOrdinal(gua)}<em>·</em>上${TRIGRAM_BY_VALUE[v & 7]}下${TRIGRAM_BY_VALUE[v >> 3]}</div>
      ${zhi ? `<div class="sc-change">之卦　${escHtml(zhi[0])}　<span>${escHtml(movingText)}</span></div>` : '<div class="sc-meta">六爻皆静</div>'}
    </div>
    <div class="sc-seal-wrap"><div class="sc-seal sc-${verdict}"><span>${verdictText[verdict]}</span></div><div class="sc-seal-note">本卦底色</div></div>
  </div>
  ${d.question ? `<div class="sc-ask"><span>所问</span>${escHtml(d.question)}</div>` : ''}
  <div class="sc-main"><span class="sc-label">主断</span>${mainHtml}</div>
  <div class="sc-reading">${escHtml(gua[4])}</div>
  <div class="sc-foot"><span>卦可以看，事情仍由自己决定。</span><span>六十四卦 · 取其一</span></div>
</div>`;
}

// 卡片高度固定，底下那段白话只能用剩下的空间：按整行截断，不留半行字
function fitShareReading(card) {
    const rd = card && card.querySelector('.sc-reading');
    if (!rd) return;
    const cs = getComputedStyle(rd);
    const lh = parseFloat(cs.lineHeight), pad = parseFloat(cs.paddingTop) || 0;
    if (!(lh > 0)) return;
    const lines = Math.floor((rd.clientHeight - pad) / lh);
    if (lines < 1) { rd.style.display = 'none'; return; }
    rd.style.flex = 'none';
    rd.style.height = `${pad + lines * lh}px`;
}

let _lastBlobUrl = null;
let _lastBlob = null;

function scrubShareCardExternalUrls(card, view) {
    if (!card) return;
    const win = view || window;
    const nodes = [card, ...card.querySelectorAll('*')];
    const urlRe = /url\(["']?([^"')]+)["']?\)/gi;

    nodes.forEach(el => {
        let bg = '';
        try { bg = win.getComputedStyle(el).backgroundImage || ''; } catch (e) {}
        if (!bg || !/url\(/i.test(bg)) return;

        const urls = [];
        let m;
        urlRe.lastIndex = 0;
        while ((m = urlRe.exec(bg))) urls.push(m[1]);

        // 导出节点只允许 data:image/... 纹理。这样即便页面是 file://，
        // 或主题 CSS 后续又加入本地图片，也不会污染导出 canvas。
        if (urls.some(src => !/^data:image\//i.test(src))) {
            el.style.setProperty('background-image', 'none', 'important');
        }
    });
}

function canvasToBlob(canvas, type) {
    return new Promise(resolve => canvas.toBlob(resolve, type, 1.0));
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+
}

function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches);
}

function renderShareCanvas(card, scale) {
    return html2canvas(card, {
        backgroundColor: '#1A3D72',
        scale,
        logging: false,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 8000,
        // 只克隆分享卡所在的那一支：整页克隆要复制上千个节点并重算样式，主线程会卡近两秒。
        // <head> 里的样式表和字体不在 body 下，照常保留。
        ignoreElements: el => document.body.contains(el) && el !== document.body &&
            !el.contains(card) && !card.contains(el),
        onclone: clonedDoc => {
            const clonedCard = clonedDoc.getElementById('shareCard');
            if (!clonedCard) return;
            scrubShareCardExternalUrls(clonedCard, clonedDoc.defaultView);
        }
    });
}

function assertCanvasExportable(canvas) {
    // 比等到 toBlob 再报 SecurityError 更早发现污染，并立即走纯色兜底。
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx) throw new Error('无法读取分享画布');
    ctx.getImageData(0, 0, 1, 1);
}

// html2canvas 近 200KB，只有出分享图才用：不放进首屏，页面空闲时再悄悄取来，点分享时多半已经在了
let _html2canvasLoad = null;
function loadHtml2canvas() {
    if (typeof html2canvas === 'function') return Promise.resolve(true);
    if (!_html2canvasLoad) {
        _html2canvasLoad = new Promise(resolve => {
            const s = document.createElement('script');
            s.src = 'html2canvas.min.js';
            s.onload = () => resolve(typeof html2canvas === 'function');
            s.onerror = () => { _html2canvasLoad = null; s.remove(); resolve(false); };
            document.head.appendChild(s);
        });
    }
    return _html2canvasLoad;
}

// 分享图的出场是「拼版」：先画出一张空版（外框、裁切线、网格），后台同时出图；
// 图出好以后，结果页上的卦画、卦名、所问、主断各自飞到版上的位置，最后换成生成好的图片。
// 顺序是「先出图，再飞」：html2canvas 会占住主线程，飞行和它错开才不卡。
// 版框的线条只动 transform / opacity，出图占着主线程时也照样画得动。
let _shareRun = 0;
async function shareAsImage() {
    const data = getCurrentGuaData();
    if (!data || !data.gua) { showToast('请先起一卦', 'error'); return; }
    const run = ++_shareRun;
    const container = document.getElementById('shareImageContainer');
    const preview = document.getElementById('shareImagePreview');
    const reduce = _reduceShareMotion();
    document.querySelectorAll('.share-flyer').forEach(el => el.remove());
    const box = container.querySelector('.share-box');
    if (box && box.getAnimations) box.getAnimations().forEach(a => a.cancel());   // 上次关闭时卡片停在按钮处，先复位
    if (_lastBlobUrl) { URL.revokeObjectURL(_lastBlobUrl); _lastBlobUrl = null; }
    _lastBlob = null;

    // 出图用的卡片放在屏幕外：版框的底色、网格比例都从它取，飞行的落点也按它量
    const tmp = document.createElement('div');
    tmp.style.cssText = 'position:fixed;left:-9999px;top:0;width:560px;pointer-events:none;opacity:0;';
    tmp.innerHTML = createShareCard(data);
    document.body.appendChild(tmp);
    const card = tmp.querySelector('#shareCard');

    preview.innerHTML = `<div class="share-plate">${sharePlateFrame()}</div>`;
    const plate = preview.querySelector('.share-plate');
    plate.querySelector('.sp-base').style.backgroundImage = getComputedStyle(card).backgroundImage;
    container.classList.add('show');
    pressShareButton();
    const framed = reduce ? Promise.resolve() : drawSharePlate(plate);
    const alive = () => run === _shareRun && container.classList.contains('show');

    try {
        // 让版框的第一帧先画出来，再开始占主线程的活
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (!(await loadHtml2canvas())) throw new Error('分享功能没有加载出来，请检查网络后重试');
        if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
        if (!alive()) return;
        fitShareReading(card);
        scrubShareCardExternalUrls(card, window);
        const canvas = await renderShareCanvas(card, isMobile() ? 1.5 : 2);
        assertCanvasExportable(canvas);
        if (!canvas || !canvas.width || !canvas.height) throw new Error('分享画布生成失败');
        const blob = await canvasToBlob(canvas, 'image/png');
        if (!blob) throw new Error('toBlob returned null');
        if (!alive()) return;
        const objectUrl = URL.createObjectURL(blob);
        _lastBlobUrl = objectUrl;
        _lastBlob = blob;

        // 图片先在后台解码好，换上去的那一下不卡
        const img = new Image();
        img.id = 'sharePreviewImg';
        img.className = 'share-plate-img';
        img.alt = '分享图预览';
        img.src = objectUrl;
        try { if (img.decode) await img.decode(); } catch (e) {}
        await framed;
        if (!alive()) return;
        plate.appendChild(img);
        if (!reduce) await assembleShareCard(plate, card);
        if (!alive()) return;
        img.classList.add('in');
        document.querySelectorAll('.share-flyer').forEach(f => {
            const a = f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-out', fill: 'forwards' });
            a.onfinish = () => f.remove();
        });
        if (isMobile()) preview.insertAdjacentHTML('beforeend', '<p class="share-hint">长按图片可保存到相册</p>');
        img.onerror = function() {
            this.onerror = null;
            preview.innerHTML = '<p class="share-error">预览加载失败，可以直接点「保存图片」。</p>';
        };

        const fileName = '天衍_' + data.gua[0] + '_' + Date.now() + '.png';
        document.getElementById('shareDownloadBtn').onclick = () => {
            try {
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = fileName;
                document.body.appendChild(a); // Firefox 要求节点在文档中才能触发 click
                a.click();
                a.remove();
                if (isIOS()) {
                    // iOS Safari 对 <a download> 支持仍不稳定 —— 兜底引导
                    setTimeout(() => showToast('若未自动保存，请长按上方预览图选择「保存到相册」'), 300);
                }
            } catch (e) {
                showToast('下载失败，请长按上方预览图保存到相册', 'error');
            }
        };
        document.getElementById('shareCopyBtn').onclick = async () => {
            if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
                showToast('此浏览器不支持复制图片，请长按预览图保存到相册', 'error');
                return;
            }
            if (!_lastBlob) {
                showToast('图片尚未生成完毕，请稍候再试');
                return;
            }
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': Promise.resolve(_lastBlob) })]);
                showToast('已复制到剪贴板', 'success');
            } catch (e) {
                showToast(isMobile() ? '复制失败，请长按预览图保存到相册' : '复制失败，请点击下载图片', 'error');
            }
        };
    } catch (e) {
        if (!alive()) return;
        document.querySelectorAll('.share-flyer').forEach(el => el.remove());
        const msg = (e && e.message) ? e.message : String(e);
        preview.innerHTML = '<p class="share-error">分享图没有生成出来。<small>' + escHtml(msg) + '</small></p>';
    } finally {
        if (tmp.parentNode) tmp.parentNode.removeChild(tmp);
    }
}

const _reduceShareMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// 空版：底色、网格、四角裁切线、外框。网格和裁切线的位置与卡片上的一致，换成图片时对得上
function sharePlateFrame() {
    return '<i class="sp-base"></i><i class="sp-grid"></i>' +
        '<i class="sp-line t"></i><i class="sp-line r"></i><i class="sp-line b"></i><i class="sp-line l"></i>' +
        '<i class="sp-crop tl"></i><i class="sp-crop tr"></i><i class="sp-crop bl"></i><i class="sp-crop br"></i>';
}

function pressShareButton() {
    const btn = document.getElementById('shareBtn');
    if (btn && btn.animate && !_reduceShareMotion()) btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(.93)', offset: .35 }, { transform: 'scale(1)' }],
        { duration: 420, easing: 'ease-out' });
}

// 版框画出来：底色和网格淡入，外框四条边顺着一圈画出，四角裁切线最后落下。只动 transform / opacity
function drawSharePlate(plate) {
    if (!plate.animate) return Promise.resolve();
    const k = plate.clientWidth / 500;
    plate.style.setProperty('--k', k.toFixed(4));
    const ease = 'cubic-bezier(.65, 0, .25, 1)';
    const run = (sel, frames, o) => Array.from(plate.querySelectorAll(sel)).map((el, i) => el.animate(frames, { fill: 'backwards', easing: ease, ...o(i) }));
    const all = [
        ...run('.sp-base', [{ opacity: 0 }, { opacity: 1 }], () => ({ duration: 420 })),
        ...run('.sp-grid', [{ opacity: 0 }, { opacity: 1 }], () => ({ duration: 520, delay: 120 })),
        ...run('.sp-line.t, .sp-line.b', [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], i => ({ duration: 340, delay: 60 + i * 170 })),
        ...run('.sp-line.r, .sp-line.l', [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], i => ({ duration: 340, delay: 145 + i * 170 })),
        ...run('.sp-crop', [{ opacity: 0, transform: 'scale(1.6)' }, { opacity: 1, transform: 'none' }], i => ({ duration: 300, delay: 380 + i * 40 }))
    ];
    return Promise.all(all.map(a => a.finished.catch(() => {})));
}

// 拼版：结果页上看得见的卦画、卦名、所问、主断，各自飞到版上对应的位置。看不见的不飞，换图时直接出现
function assembleShareCard(plate, card) {
    const p = plate.getBoundingClientRect(), c = card.getBoundingClientRect();
    if (!p.width || !c.width) return Promise.resolve();
    const k = p.width / c.width;
    const onPlate = r => ({ left: p.left + (r.left - c.left) * k, top: p.top + (r.top - c.top) * k, width: r.width * k, height: r.height * k });
    const visible = r => r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    const textRect = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
    const result = document.getElementById('resultArea');
    const flights = [];   // 先把要量的都量完，再一次性建飞行层，避免边读边写反复排版

    // 卦画：落到卡上六根爻条占的那块（左边出血的部分不算）。正看着之卦时不飞，卡上画的是本卦
    const glyph = result.querySelector('#resultGlyph');
    const asZhi = result.querySelector('.result-header.as-zhi');
    const bars = Array.from(card.querySelectorAll('.sc-bar')).map(el => el.getBoundingClientRect());
    if (glyph && !asZhi && bars.length) {
        const s = glyph.getBoundingClientRect();
        if (visible(s)) {
            const left = Math.max(c.left, Math.min(...bars.map(r => r.left)));
            const to = onPlate({ left, top: Math.min(...bars.map(r => r.top)), width: Math.max(...bars.map(r => r.right)) - left, height: Math.max(...bars.map(r => r.bottom)) - Math.min(...bars.map(r => r.top)) });
            flights.push({ kind: 'glyph', html: glyph.innerHTML, from: s, to, delay: 0 });
        }
    }
    // 卦名：横排的字一个个落成卡上竖排的字
    const name = result.querySelector('.hex-name');
    const slots = Array.from(card.querySelectorAll('.sc-name span'));
    const node = name && name.firstChild;
    if (node && node.nodeType === 3 && slots.length === node.textContent.length) {
        const cs = getComputedStyle(name), ts = getComputedStyle(slots[0]);
        slots.forEach((slot, i) => {
            const r = document.createRange();
            r.setStart(node, i); r.setEnd(node, i + 1);
            const from = r.getBoundingClientRect();
            if (!visible(from)) return;
            flights.push({ kind: 'text', text: node.textContent[i], from, to: onPlate(textRect(slot)), src: cs, dst: ts, k, delay: 70 + i * 55 });
        });
    }
    // 所问、主断：按卡上的宽度折行，落地时和卡上一行对一行
    const pairs = [[result.querySelector('.result-question h1'), card.querySelector('.sc-ask'), 160]];
    const quotes = result.querySelectorAll('.mr-quote'), cardQuotes = card.querySelectorAll('.sc-quote');
    quotes.forEach((q, i) => { if (cardQuotes[i]) pairs.push([q, cardQuotes[i], 230 + i * 70]); });
    pairs.forEach(([src, dst, delay]) => {
        if (!src || !dst) return;
        // 卡上的「所问」块前面还有一个小标签，只取后面那段文字
        const textNode = Array.from(dst.childNodes).reverse().find(n => n.nodeType === 3 && n.textContent.trim());
        let to;
        if (textNode) { const r = document.createRange(); r.selectNodeContents(textNode); to = r.getBoundingClientRect(); }
        else to = textRect(dst);
        const from = textRect(src);
        if (!visible(from) || !to.width) return;
        flights.push({ kind: 'text', text: (textNode || dst).textContent.trim(), from, to: onPlate(to), src: getComputedStyle(src), dst: getComputedStyle(dst), k, delay, wrap: onPlate(to).width });
    });

    if (!flights.length) return Promise.resolve();
    const ease = 'cubic-bezier(.45, 0, .2, 1)';
    const layer = document.createDocumentFragment();
    const plans = flights.map(f => {
        const el = document.createElement('div');
        el.className = 'share-flyer';
        let sx, sy;
        if (f.kind === 'glyph') {
            el.innerHTML = f.html;
            el.style.cssText = `left:${f.to.left}px;top:${f.to.top}px;width:${f.to.width}px;height:${f.to.height}px;`;
            sx = f.from.width / f.to.width; sy = f.from.height / f.to.height;
            const dx = f.from.left - f.to.left, dy = f.from.top - f.to.top;
            return { el, f, frames: [
                { transform: `translate(${dx}px, ${dy}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})` },
                { transform: `translate(${dx * .4}px, ${dy * .4 - 60}px) scale(${((sx + 1) / 2 * 1.06).toFixed(4)}, ${((sy + 1) / 2 * 1.06).toFixed(4)})`, offset: .5 },
                { transform: 'none' }] };
        }
        // 文字：用落点的字体、字距、行高，起飞时按出发处的字号排，飞行中缩放到落点的字号
        const srcSize = parseFloat(f.src.fontSize), dstSize = parseFloat(f.dst.fontSize) * f.k;
        const s = dstSize / srcSize;
        const em = v => (parseFloat(v) || 0) / parseFloat(f.dst.fontSize);
        const lh = f.dst.lineHeight === 'normal' ? 1.4 : em(f.dst.lineHeight);
        el.classList.add('share-flyer-text');
        el.textContent = f.text;
        el.style.cssText = `left:${f.from.left}px;top:${f.from.top}px;font-family:${f.dst.fontFamily};font-weight:${f.dst.fontWeight};` +
            `font-size:${srcSize}px;line-height:${lh};letter-spacing:${em(f.dst.letterSpacing)}em;color:${f.src.color};` +
            (f.wrap ? `width:${f.wrap / s + 2}px;` : 'white-space:nowrap;');
        const dx = f.to.left - f.from.left, dy = f.to.top - f.from.top;
        return { el, f, frames: [
            { transform: 'none' },
            { transform: `translate(${dx * .5}px, ${dy * .5 - 40}px) scale(${((1 + s) / 2).toFixed(4)})`, offset: .5 },
            { transform: `translate(${dx}px, ${dy}px) scale(${s.toFixed(4)})` }] };
    });
    plans.forEach(pl => layer.appendChild(pl.el));
    document.body.appendChild(layer);
    const anims = plans.map(pl => pl.el.animate(pl.frames, { duration: pl.f.kind === 'glyph' ? 780 : 720, delay: pl.f.delay, easing: ease, fill: 'both' }));
    return Promise.all(anims.map(a => a.finished.catch(() => {})));
}

// 关闭：卡片缩小飘回「生成分享图」按钮
function shareCloseMotion(container) {
    const box = container.querySelector('.share-box');
    const btn = document.getElementById('shareBtn');
    document.querySelectorAll('.share-flyer').forEach(el => el.remove());
    if (_reduceShareMotion() || !box || !btn || typeof box.animate !== 'function') return;
    const b = box.getBoundingClientRect(), s = btn.getBoundingClientRect();
    if (!s.width || !b.width) return;
    const dx = (s.left + s.width / 2) - (b.left + b.width / 2), dy = (s.top + s.height / 2) - (b.top + b.height / 2);
    box.getAnimations().forEach(a => a.cancel());
    // 停在按钮处（下次打开前会先取消），免得弹层淡出前闪回原位
    const a = box.animate([
        { transform: 'none', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${Math.max(.08, s.width / b.width).toFixed(3)})`, opacity: 0 }
    ], { duration: 320, easing: 'cubic-bezier(.5, 0, .75, .2)', fill: 'forwards' });
    container._closing = a;
}

function closeShare() {
    _shareRun++;   // 还在出图、拼版的这一轮作废，后面的步骤都不再执行
    const container = document.getElementById('shareImageContainer');
    if (container.classList.contains('show')) shareCloseMotion(container);
    container.classList.remove('show');
    if (_lastBlobUrl) {
        URL.revokeObjectURL(_lastBlobUrl);
        _lastBlobUrl = null;
    }
    _lastBlob = null;
}
