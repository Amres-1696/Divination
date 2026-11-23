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
// 样式表加载失败或太慢（断网、服务停了）时，卡片也不会变成没排版的纯文字。
// 卡面是「图纸背面」：白纸蓝墨，居中留白，只放所问、卦、主断三样。
// 字色都压到够深：纸是浅色，浅蓝小字在手机上看不清
const SHARE_CARD_CSS = `
    :where(#shareCard, #shareCard *) { box-sizing: border-box; margin: 0; }
    .sc-card { position: relative; overflow: hidden; width: 500px; height: 888px; padding: 0 52px; display: flex; flex-direction: column; align-items: center; text-align: center;
      background-color: #EDF0F3; background-image: linear-gradient(200deg, rgba(23, 57, 110, .07) 0%, rgba(23, 57, 110, 0) 45%);
      color: #0F2A54; font-family: 'Noto Serif SC', serif; line-height: 1.6; }
    .sc-bg { position: absolute; left: 0; top: 0; }
    .sc-gap { flex: 1 1 0; min-height: 18px; }
    .sc-lbl { display: block; font-size: 13px; letter-spacing: .6em; text-indent: .6em; color: rgba(15, 42, 84, .66); }
    .sc-ask { position: relative; flex: none; width: 100%; margin-top: 84px; }
    .sc-ask-q { display: block; margin-top: 10px; font-size: 23px; line-height: 1.5; color: #0F2A54; overflow-wrap: anywhere; text-wrap: balance; max-height: 104px; overflow: hidden; }
    .sc-ask-q.long { font-size: 19px; max-height: 87px; }
    .sc-ask-q.blank { color: rgba(15, 42, 84, .6); }
    .sc-glyph { position: relative; flex: none; width: 184px; }
    .sc-bar { position: relative; height: 13px; margin-top: 13px; background: #17396E; }
    .sc-bar:first-child { margin-top: 0; }
    .sc-bar.yin { background: transparent; }
    .sc-bar.yin i { position: absolute; left: 0; top: 0; height: 13px; width: 43%; background: #17396E; }
    .sc-bar.yin i + i { left: auto; right: 0; }
    .sc-bar.moving, .sc-bar.moving i { background: #D63A16; }
    .sc-bar.yin.moving { background: transparent; }
    .sc-name { position: relative; flex: none; margin-top: 34px; font-family: 'ZCOOL XiaoWei', 'Noto Serif SC', serif; font-size: 58px; line-height: 1.1; letter-spacing: .14em; text-indent: .14em; color: #0F2A54; }
    .sc-name.long { font-size: 48px; }
    .sc-meta { position: relative; flex: none; margin-top: 14px; font-size: 15px; letter-spacing: .14em; color: rgba(15, 42, 84, .78); }
    .sc-meta em { font-style: normal; color: #C2360F; }
    .sc-sep { flex: none; width: 36px; margin-top: 40px; border-top: 1px solid rgba(23, 57, 110, .35); }
    .sc-main { position: relative; flex: none; width: 100%; margin-top: 34px; }
    .sc-quote { margin-top: 12px; font-family: 'ZCOOL XiaoWei', 'Noto Serif SC', serif; font-size: 31px; line-height: 1.45; letter-spacing: .06em; color: #0F2A54; text-wrap: balance; }
    .sc-quote.long { font-size: 25px; }
    .sc-quote.xl { font-size: 19px; line-height: 1.7; letter-spacing: .02em; font-family: 'Noto Serif SC', 'Songti SC', serif; }
    .sc-quote .pu { font-family: 'Noto Serif SC', 'Songti SC', serif; letter-spacing: 0; margin-right: -.3em; }
    .sc-quote.xl .pu { margin-right: 0; }
    .sc-quote .cl { display: inline-block; white-space: nowrap; }
    .sc-from { margin-top: 8px; font-size: 14px; letter-spacing: .08em; color: rgba(15, 42, 84, .72); }
    .sc-foot { position: relative; flex: none; margin-bottom: 50px; font-size: 14px; letter-spacing: .24em; color: rgba(15, 42, 84, .72); }
    .sc-foot b { margin-right: 14px; font-family: 'ZCOOL XiaoWei', 'Noto Serif SC', serif; font-size: 19px; font-weight: 400; letter-spacing: .2em; color: #0F2A54; }
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

// 四角裁切线：和出图前的空版对得上（位置 18px、长 22px）
function shareCardBackdrop() {
    const crop = [[18, 18, 1, 1], [482, 18, -1, 1], [18, 870, 1, -1], [482, 870, -1, -1]]
        .map(([x, y, sx, sy]) => `M${x} ${y + sy * 22}V${y}H${x + sx * 22}`).join('');
    return `<svg class="sc-bg" width="500" height="888" viewBox="0 0 500 888" aria-hidden="true">
<path d="${crop}" stroke="#17396E" stroke-opacity=".45" stroke-width="1.2" fill="none"/></svg>`;
}

// 主断用展示字，展示字的标点像西文的「, .」：标点换回正文字体（和结果页一致）。
// 每一小句包成一块不折行：换行只落在标点后面，不会把「或承之羞」拆成「或 / 承之羞」
function shareCardPunct(s) {
    return (String(s).match(/[^，。；：、？！]+[，。；：、？！]*|[，。；：、？！]+/g) || [])
        .map(c => `<span class="cl">${escHtml(c).replace(/[，。；：、？！「」『』]/g, m => `<span class="pu">${m}</span>`)}</span>`).join('');
}

function createShareCard(d) {
    if (!d || !d.gua) return '';
    const gua = d.gua, change = d.change, main = d.main;
    const hexLines = d.hexagramLines;
    const when = shareCardWhen(d);
    const zhi = change.hasChange ? change.changeGua : null;
    const n = change.changingYaos.length;
    // 卦画自上而下画，动爻朱色
    const bars = hexLines.map((line, i) => [line, i]).reverse().map(([line]) => {
        const yang = line === 7 || line === 9, moving = line === 9 || line === 6;
        return `<div class="sc-bar${yang ? '' : ' yin'}${moving ? ' moving' : ''}">${yang ? '' : '<i></i><i></i>'}</div>`;
    }).join('');
    // 卦名每个字一个 span：拼版动画按字落位
    const chars = Array.from(gua[0]);
    const nameHtml = chars.map(ch => `<span>${escHtml(ch)}</span>`).join('');
    const meta = zhi
        ? `${guaOrdinal(gua)}　<em>${'一两三四五六'[n - 1]}爻动</em>　之卦 ${escHtml(zhi[0])}`
        : `${guaOrdinal(gua)}　没有动爻`;
    const q = d.question;
    const quoteLen = main.lines.reduce((s, l) => s + l.text.length, 0);
    const quoteCls = quoteLen > 28 ? ' xl' : quoteLen > 14 ? ' long' : '';
    const mainHtml = main.lines.map(l => `<div class="sc-quote${quoteCls}">${shareCardPunct(l.text)}</div><div class="sc-from">${escHtml(l.from)}</div>`).join('');

    // 9:16 竖版，宽 500
    return `<div id="shareCard" class="sc-card"><style>${SHARE_CARD_CSS}</style>
  ${shareCardBackdrop()}
  <div class="sc-ask"><span class="sc-lbl">所问</span><span class="sc-ask-q${q ? (q.length > 32 ? ' long' : '') : ' blank'}">${q ? escHtml(q) : '心中所念'}</span></div>
  <i class="sc-gap"></i>
  <div class="sc-glyph">${bars}</div>
  <div class="sc-name${chars.length > 4 ? ' long' : ''}">${nameHtml}</div>
  <div class="sc-meta">${meta}</div>
  <i class="sc-sep"></i>
  <div class="sc-main"><span class="sc-lbl">主断</span>${mainHtml}</div>
  <i class="sc-gap"></i>
  <div class="sc-foot"><b>天衍</b>${escHtml(String(when.solar).split(' ')[0])}</div>
</div>`;
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
    setShareActsReady(false);

    // 出图用的卡片放在屏幕外：版框的底色、网格比例都从它取，飞行的落点也按它量
    const tmp = document.createElement('div');
    tmp.style.cssText = 'position:fixed;left:-9999px;top:0;width:560px;pointer-events:none;opacity:0;';
    tmp.innerHTML = createShareCard(data);
    document.body.appendChild(tmp);
    const card = tmp.querySelector('#shareCard');

    preview.innerHTML = `<div class="share-plate">${sharePlateFrame()}</div>`;
    const plate = preview.querySelector('.share-plate');
    // 空版的底和卡面同一张白纸：底色、渐变都从卡上取
    const cardStyle = getComputedStyle(card), base = plate.querySelector('.sp-base');
    base.style.backgroundColor = cardStyle.backgroundColor;
    base.style.backgroundImage = cardStyle.backgroundImage;
    container.classList.add('show');
    pressShareButton();
    const framed = reduce ? Promise.resolve() : drawSharePlate(plate);
    const alive = () => run === _shareRun && container.classList.contains('show');

    try {
        // 让版框的第一帧先画出来，再开始占主线程的活
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (!(await loadHtml2canvas())) throw new Error('分享组件没加载出来，检查一下网络再试');
        if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
        if (!alive()) return;
        scrubShareCardExternalUrls(card, window);
        const canvas = await renderShareCanvas(card, isMobile() ? 1.5 : 2);
        assertCanvasExportable(canvas);
        if (!canvas || !canvas.width || !canvas.height) throw new Error('起卦签没生成出来');
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
        img.alt = '起卦签';
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
            preview.innerHTML = '<p class="share-error">预览没显示出来，可以直接点「保存图片」。</p>';
        };

        const fileName = '天衍_' + data.gua[0] + '_' + Date.now() + '.png';
        const downloadBtn = document.getElementById('shareDownloadBtn');
        const copyBtn = document.getElementById('shareCopyBtn');
        downloadBtn.onclick = () => {
            try {
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = fileName;
                document.body.appendChild(a); // Firefox 要求节点在文档中才能触发 click
                a.click();
                a.remove();
                // iOS Safari 对 <a download> 支持仍不稳定：不说「已保存」，提示长按
                flashShareAct(downloadBtn, isIOS() ? '请长按图片' : '已保存');
            } catch (e) {
                flashShareAct(downloadBtn, '没能保存', true);
            }
        };
        copyBtn.onclick = async () => {
            if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
                flashShareAct(copyBtn, isMobile() ? '请长按图片' : '不支持复制', true);
                return;
            }
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': Promise.resolve(_lastBlob) })]);
                flashShareAct(copyBtn, '已复制');
            } catch (e) {
                flashShareAct(copyBtn, '没能复制', true);
            }
        };
        // 图片显出来才能保存、复制
        setShareActsReady(true);
    } catch (e) {
        if (!alive()) return;
        document.querySelectorAll('.share-flyer').forEach(el => el.remove());
        const msg = (e && e.message) ? e.message : String(e);
        preview.innerHTML = '<p class="share-error">起卦签没有生成出来。<small>' + escHtml(msg) + '</small></p>';
    } finally {
        if (tmp.parentNode) tmp.parentNode.removeChild(tmp);
    }
}

// 弹层里的「保存图片」「复制图片」：成图前不出现，图显出来再淡入；点过之后在按钮上原地回一句，
// 不弹 Toast（手机上 Toast 正好压在这两个按钮上）。按钮里是图标加一段文字，只换文字
function setShareActsReady(on) {
    ['shareDownloadBtn', 'shareCopyBtn'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.disabled = !on;
    });
    const bar = document.querySelector('#shareImageContainer .share-actions');
    if (bar) bar.classList.toggle('waiting', !on);
}
function flashShareAct(btn, text, isError) {
    const node = Array.from(btn.childNodes).find(n => n.nodeType === 3 && n.textContent.trim());
    if (!node) return;
    if (!btn._label) btn._label = node.textContent;
    node.textContent = text;
    btn.classList.toggle('done', !isError);
    btn.classList.toggle('fail', !!isError);
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { node.textContent = btn._label; btn.classList.remove('done', 'fail'); }, isError ? 2600 : 1600);
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

// 版框画出来：白纸从上往下铺开，外框四条边顺着一圈画出，四角裁切线最后落下。
// 白纸不淡入：半透明的白压在深色遮罩上是一层灰，满了又突然亮成白，像闪了一下
function drawSharePlate(plate) {
    if (!plate.animate) return Promise.resolve();
    const k = plate.clientWidth / 500;
    plate.style.setProperty('--k', k.toFixed(4));
    const ease = 'cubic-bezier(.65, 0, .25, 1)';
    const run = (sel, frames, o) => Array.from(plate.querySelectorAll(sel)).map((el, i) => el.animate(frames, { fill: 'backwards', easing: ease, ...o(i) }));
    const all = [
        // 左、上、右三边留出投影的位置，只把下边从顶上拉下来
        ...run('.sp-base', [{ clipPath: 'inset(-60px -60px 100% -60px)' }, { clipPath: 'inset(-60px -60px -60px -60px)' }], () => ({ duration: 520 })),
        ...run('.sp-grid', [{ opacity: 0 }, { opacity: 1 }], () => ({ duration: 520, delay: 120 })),
        ...run('.sp-line.t, .sp-line.b', [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], i => ({ duration: 340, delay: 60 + i * 170 })),
        ...run('.sp-line.r, .sp-line.l', [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], i => ({ duration: 340, delay: 145 + i * 170 })),
        ...run('.sp-crop', [{ opacity: 0, transform: 'scale(1.6)' }, { opacity: 1, transform: 'none' }], i => ({ duration: 300, delay: 380 + i * 40 }))
    ];
    return Promise.all(all.map(a => a.finished.catch(() => {})));
}

// 拼版：结果页上看得见的卦画、卦名，各自飞到版上对应的位置。看不见的不飞，换图时直接出现
function assembleShareCard(plate, card) {
    const p = plate.getBoundingClientRect(), c = card.getBoundingClientRect();
    if (!p.width || !c.width) return Promise.resolve();
    const k = p.width / c.width;
    const onPlate = r => ({ left: p.left + (r.left - c.left) * k, top: p.top + (r.top - c.top) * k, width: r.width * k, height: r.height * k });
    const visible = r => r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    const textRect = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
    const result = document.getElementById('resultArea');
    const flights = [];   // 先把要量的都量完，再一次性建飞行层，避免边读边写反复排版

    // 卦画：落到卡上六根爻条占的那块。正看着之卦时不飞，卡上画的是本卦
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
    // 卦名：一个字一个字落到卡上
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
    // 所问、主断不飞：结果页上是一行，卡上按小句折成两三行，标点字体也不同，
    // 飞过去落地时和卡上对不齐，换图那一下整段会跳。它们跟着图片一起显出来

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
            `font-size:${srcSize}px;line-height:${lh};letter-spacing:${em(f.dst.letterSpacing)}em;color:${f.src.color};text-align:${f.dst.textAlign};` +
            (f.wrap ? `width:${f.wrap / s + 2}px;` : 'white-space:nowrap;');
        const dx = f.to.left - f.from.left, dy = f.to.top - f.from.top;
        return { el, f, frames: [
            // 起飞时是结果页的浅色字，落到白纸上变成卡上的蓝墨色
            { transform: 'none', color: f.src.color },
            { transform: `translate(${dx * .5}px, ${dy * .5 - 40}px) scale(${((1 + s) / 2).toFixed(4)})`, offset: .5 },
            { transform: `translate(${dx}px, ${dy}px) scale(${s.toFixed(4)})`, color: f.dst.color }] };
    });
    plans.forEach(pl => layer.appendChild(pl.el));
    document.body.appendChild(layer);
    const anims = plans.map(pl => pl.el.animate(pl.frames, { duration: pl.f.kind === 'glyph' ? 780 : 720, delay: pl.f.delay, easing: ease, fill: 'both' }));
    // 卦画飞到一半换成纸上的蓝墨、深朱（颜色在 .bar 的伪元素上，靠 CSS 过渡）
    plans.forEach(pl => { if (pl.f.kind === 'glyph') { pl.el.classList.add('share-flyer-glyph'); setTimeout(() => pl.el.classList.add('inked'), pl.f.delay + 390); } });
    return Promise.all(anims.map(a => a.finished.catch(() => {})));
}

// 关闭：卡片缩小飘回「生成起卦签」按钮
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

// ---------- 分享链接：打开就是这一卦 ----------
// ?y=六爻的数（自初爻起，6 老阴 / 7 少阳 / 8 少阴 / 9 老阳）&d=起卦日期 YYYYMMDD&m=c|b（铜钱 / 生辰）&q=所问&from=share
// 所问可能很私人，默认不放进链接，要用户勾选才带上。
// from=share 给统计用：从分享链接进来的访问和之后起的卦，后台记在「朋友分享」名下（track.js 读它）
function buildShareLink(lines, opts) {
    opts = opts || {};
    const p = new URLSearchParams();
    p.set('y', lines.join(''));
    const d = /(\d{4})\D(\d{1,2})\D(\d{1,2})/.exec(opts.date || '');
    if (d) p.set('d', d[1] + d[2].padStart(2, '0') + d[3].padStart(2, '0'));
    if (opts.method === 'coin' || opts.method === 'bazi') p.set('m', opts.method[0]);
    if (opts.question) p.set('q', String(opts.question).trim().slice(0, 80));
    p.set('from', 'share');
    return (opts.base || (location.origin + location.pathname)) + '?' + p.toString();
}
function parseShareLink(search) {
    const p = new URLSearchParams(search || '');
    const y = p.get('y') || '';
    if (!/^[6-9]{6}$/.test(y)) return null;
    const d = /^(\d{4})(\d{2})(\d{2})$/.exec(p.get('d') || '');
    return {
        lines: Array.from(y, Number),
        question: (p.get('q') || '').trim().slice(0, 80),
        date: d ? `${d[1]}/${Number(d[2])}/${Number(d[3])}` : '',
        method: { c: 'coin', b: 'bazi' }[p.get('m')]
    };
}
// 打开带 ?y= 的地址：直接显示这一卦，不记进打开者的牌册
function openSharedReading() {
    if (typeof location === 'undefined') return false;
    const s = parseShareLink(location.search);
    if (!s) return false;
    const bin = s.lines.map(v => (v === 7 || v === 9) ? '1' : '0').reverse().join('');
    const gua = lookupGua(bin);
    if (!gua) return false;
    renderResult(gua, s.lines, calculateChangeGua(s.lines, bin), s.question, bin, null, null,
        { date: s.date, method: s.method, shared: true });
    return true;
}
// 离开分享的这一卦（回首页、打开自己的记录）时，把地址栏的参数去掉，免得刷新又回到别人那一卦
function clearShareParams() {
    if (typeof location === 'undefined' || !location.search || !/[?&]y=/.test(location.search)) return;
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
}

function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text));
    return Promise.resolve(legacyCopy(text));
}
function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-100px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
}

// 结果页的「分享链接」：展开一行链接、一个「附上所问」的勾选和复制 / 发送按钮
function initShareLinkPanel(root) {
    const btn = root.querySelector('#linkBtn');
    const panel = root.querySelector('#linkPanel');
    if (!btn || !panel) return;
    const r = document.getElementById('resultArea');
    const urlEl = panel.querySelector('#linkUrl');
    const withQ = panel.querySelector('#linkWithQ');
    const current = () => buildShareLink(Array.from(r.dataset.lines, Number), {
        date: r.dataset.date, method: r.dataset.method,
        question: withQ && withQ.checked ? r.dataset.question : ''
    });
    const refresh = () => { urlEl.value = current(); };
    btn.addEventListener('click', () => {
        const open = panel.hidden;
        panel.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
        // 展开时不全选链接：一整条反白很刺眼。点进链接框才选中，方便手动复制
        if (open) refresh();
    });
    if (withQ) withQ.addEventListener('change', refresh);
    urlEl.addEventListener('click', () => urlEl.select());
    const copyBtn = panel.querySelector('#linkCopy');
    copyBtn.addEventListener('click', async () => {
        refresh();
        if (await copyText(urlEl.value)) {
            // 复制成功就在按钮上原地回一句，不另外弹提示
            copyBtn.textContent = '已复制';
            copyBtn.classList.add('done');
            clearTimeout(copyBtn._t);
            copyBtn._t = setTimeout(() => { copyBtn.textContent = '复制'; copyBtn.classList.remove('done'); }, 1600);
        } else { urlEl.select(); showToast('没能自动复制，链接已选中，可以手动复制'); }
    });
    const send = panel.querySelector('#linkSend');
    if (send) send.addEventListener('click', () => {
        refresh();
        const name = r.dataset.gua || '';
        navigator.share({ title: `天衍 · ${name}`, text: `我起了一卦：${name}`, url: urlEl.value }).catch(() => {});
    });
}
