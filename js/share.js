// share —— 抓取当前卦数据、生成 9:16 分享卡、html2canvas 导图、下载/复制
// 分享卡只用纯色、文字和内联 SVG，file:// 下也不会污染画布。

// 分享卡
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
    const changingYaoTexts = [];
    const changingYaos = [];
    // 页面上六爻自上而下排列，按 data-i（0=初爻）还原顺序
    const yaoItems = Array.from(r.querySelectorAll('.yao-item'))
        .sort((a, b) => Number(a.dataset.i) - Number(b.dataset.i));
    yaoItems.forEach((el, i) => {
        if (el.classList.contains('changing')) {
            changingYaos.push(i);
            const n = el.querySelector('.yao-name');
            const t = el.querySelector('.yao-text');
            if (n && t) changingYaoTexts.push(n.textContent + '：' + t.textContent);
        }
    });
    // 从六爻列表的阴阳类反推 hexagramLines（7=少阳, 8=少阴, 9=老阳, 6=老阴）
    const hexagramLines = [];
    yaoItems.forEach((el, i) => {
        const isYang = !!el.querySelector('.yao-line.yang');
        const isChanging = changingYaos.includes(i);
        hexagramLines.push(isYang ? (isChanging ? 9 : 7) : (isChanging ? 6 : 8));
    });
    const hasChange = !!r.querySelector('.change-section');
    let cgName='', cgSymbol='', cgExplain='', changePos='';
    if (hasChange) {
        const cg = r.querySelector('.gua-box.changed');
        if (cg) {
            cgName = (cg.querySelector('.gua-name')||{}).textContent || '';
            cgSymbol = (cg.querySelector('.gua-symbol')||{}).textContent || '';
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
    // 分享卡上写起卦那一刻，而不是生成图片的时间；旧记录只有本地化日期字符串时原样用
    const when = r.dataset.createdAt ? new Date(r.dataset.createdAt) : null;
    const date = when && !isNaN(when)
        ? when.toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })
        : (r.dataset.date || new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }));
    return {
        name: nameEl.textContent, title: titleEl ? titleEl.textContent : '',
        symbol: symbolEl ? symbolEl.textContent : '',
        question: (r.dataset.question || '').trim(),
        analysisList: list, changingYaoTexts, changingYaos, hexagramLines,
        hasChange, cgName, cgSymbol, cgExplain, changePos, date,
        createdAt: when && !isNaN(when) ? when.toISOString() : ''
    };
}

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

// 背景：蓝晒纸的细网格、四角裁切线，和压在卦名后面的先天圆环（橙色刻度＝六十四取一）
function shareCardBackdrop() {
    const lines = [];
    for (let x = 24; x < 500; x += 24) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="888"/>`);
    for (let y = 24; y < 888; y += 24) lines.push(`<line x1="0" y1="${y}" x2="500" y2="${y}"/>`);
    const crop = [[18, 18, 1, 1], [482, 18, -1, 1], [18, 870, 1, -1], [482, 870, -1, -1]]
        .map(([x, y, sx, sy]) => `<path d="M${x} ${y + sy * 22}V${y}H${x + sx * 22}"/>`).join('');
    return `<svg class="sc-bg" width="500" height="888" viewBox="0 0 500 888" aria-hidden="true">
<g stroke="#EEF2F7" stroke-opacity=".05" stroke-width="1">${lines.join('')}</g>
<g stroke="#EEF2F7" stroke-opacity=".5" stroke-width="1.2" fill="none">${crop}</g></svg>`;
}
function shareCardRing() {
    const cx = 392, cy = 150, ticks = [];
    for (let k = 0; k < 64; k++) {
        const a = k * 5.625 * Math.PI / 180, on = k === 0;
        const r1 = on ? 100 : 118, r2 = on ? 146 : (k % 8 === 0 ? 132 : 126);
        ticks.push(`<line x1="${(cx + r1 * Math.sin(a)).toFixed(1)}" y1="${(cy - r1 * Math.cos(a)).toFixed(1)}" x2="${(cx + r2 * Math.sin(a)).toFixed(1)}" y2="${(cy - r2 * Math.cos(a)).toFixed(1)}" stroke="${on ? '#FF8A5C' : '#EEF2F7'}" stroke-opacity="${on ? 1 : .32}" stroke-width="${on ? 2.4 : 1}"/>`);
    }
    return `<svg class="sc-ring" width="500" height="300" viewBox="0 0 500 300" aria-hidden="true">
<circle cx="${cx}" cy="${cy}" r="138" fill="none" stroke="#EEF2F7" stroke-opacity=".14"/>
<circle cx="${cx}" cy="${cy}" r="104" fill="none" stroke="#EEF2F7" stroke-opacity=".22" stroke-dasharray="2 5"/>
${ticks.join('')}</svg>`;
}

function createShareCard(d) {
    if (!d) return '';
    const guaEntry = GUA.find(g => g[0] === d.name);
    const verdict = guaEntry ? getVerdict(guaEntry) : 'ping';
    const verdictText = { ji: '吉', xiong: '凶', ping: '平' };
    const hexLines = (d.hexagramLines && d.hexagramLines.length === 6) ? d.hexagramLines : [8, 8, 8, 8, 8, 8];
    const bits = hexLines.map(n => (n === 7 || n === 9) ? '1' : '0');
    const v = shaoValue(bits.slice().reverse().join(''));
    const ordinal = guaEntry ? guaOrdinal(guaEntry) : '';
    const main = (d.analysisList || [])[0] || '';
    const reading = (d.analysisList || []).slice(1).join('');
    const when = shareCardWhen(d);
    // 大卦画：六根爻条从卡片左缘伸进来，动爻橙色，并按古法在末端标 ○（老阳）/ ×（老阴）
    const bars = hexLines.map((line, i) => {
        const yang = line === 7 || line === 9, moving = line === 9 || line === 6;
        const top = 16 + (5 - i) * 48;
        const cls = 'sc-bar' + (yang ? '' : ' yin') + (moving ? ' moving' : '');
        return `<div class="${cls}" style="top:${top}px">${yang ? '' : '<i></i><i></i>'}</div>` +
            (moving ? `<span class="sc-mark" style="top:${top - 4}px">${line === 9 ? '○' : '×'}</span>` : '');
    }).join('');
    const chars = Array.from(d.name || '');
    const nameHtml = chars.map(ch => `<span>${escHtml(ch)}</span>`).join('');

    // 9:16 竖版，宽 500
    return `<div id="shareCard" class="sc-card">
  ${shareCardBackdrop()}
  <div class="sc-head">
    <div class="sc-brand">天衍<span>起卦签</span></div>
    <div class="sc-when">${when.lunar ? `<b>${escHtml(when.lunar)}</b>` : ''}<span>${escHtml(when.solar)}</span></div>
  </div>
  <div class="sc-stage">
    ${shareCardRing()}
    ${bars}
    <div class="sc-name${chars.length > 3 ? ' long' : ''}">${nameHtml}</div>
    <div class="sc-seal sc-${verdict}"><span>${verdictText[verdict]}</span></div>
  </div>
  <div class="sc-meta">${ordinal}<em>·</em>上${TRIGRAM_BY_VALUE[v & 7]}下${TRIGRAM_BY_VALUE[v >> 3]}${d.title ? `<em>·</em>${escHtml(d.title)}` : ''}</div>
  ${d.hasChange && d.cgName ? `<div class="sc-change">之卦　${escHtml(d.cgName)}${d.changePos ? `　<span>${escHtml(d.changePos.replace('变爻位置：', ''))}</span>` : ''}</div>` : ''}
  ${d.question ? `<div class="sc-ask"><span>所问</span>${escHtml(d.question)}</div>` : ''}
  ${main ? `<div class="sc-main">${escHtml(main)}</div>` : ''}
  ${reading ? `<div class="sc-reading">${escHtml(reading)}</div>` : ''}
  <div class="sc-foot"><span>卦可以看，事情仍由自己决定。</span><span>六十四卦 · 取其一</span></div>
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

async function shareAsImage() {
    if (typeof html2canvas !== 'function') {
        showToast('分享功能加载失败，请刷新页面后重试', 'error');
        return;
    }
    const container = document.getElementById('shareImageContainer');
    const preview = document.getElementById('shareImagePreview');
    const data = getCurrentGuaData();
    if (!data) { showToast('请先占卜', 'error'); return; }
    preview.classList.remove('developing');
    preview.innerHTML = '<div class="share-paper"><span>显影中</span></div>';
    container.classList.add('show');
    shareBoxMotion(container, true);

    if (_lastBlobUrl) { URL.revokeObjectURL(_lastBlobUrl); _lastBlobUrl = null; }
    _lastBlob = null;

    const tmp = document.createElement('div');
    tmp.style.cssText = 'position:fixed;left:-9999px;top:0;width:560px;pointer-events:none;opacity:0;';
    tmp.innerHTML = createShareCard(data);
    document.body.appendChild(tmp);
    try {
        if (document.fonts && document.fonts.ready) {
            try { await document.fonts.ready; } catch(e) {}
        }
        await sleep(80);
        const card = tmp.querySelector('#shareCard');
        scrubShareCardExternalUrls(card, window);

        // 根据设备选择 scale，避免双次渲染
        const scale = isMobile() ? 1.5 : 2;
        let canvas = await renderShareCanvas(card, scale);
        assertCanvasExportable(canvas);
        if (!canvas || !canvas.width || !canvas.height) {
            throw new Error('分享画布生成失败');
        }

        const blob = await canvasToBlob(canvas, 'image/png');
        if (!blob) throw new Error('toBlob returned null');

        const objectUrl = URL.createObjectURL(blob);
        _lastBlobUrl = objectUrl;
        _lastBlob = blob;

        // 直接使用 blob URL，跳过昂贵的 toDataURL base64 编码
        const hint = isMobile() ? '<p class="share-hint">长按图片可保存到相册</p>' : '';
        preview.innerHTML = '<img id="sharePreviewImg" alt="分享图预览">' + hint;
        const imgEl = preview.querySelector('#sharePreviewImg');
        imgEl.onerror = function() {
            this.onerror = null;
            preview.innerHTML = '<p class="share-error">预览加载失败，可以直接点「下载图片」。</p>';
        };
        imgEl.src = objectUrl;
        // 图片像蓝晒照片一样显影：先过曝发白，再慢慢显出蓝色，一道光从上往下扫过
        preview.classList.add('developing');

        document.getElementById('shareDownloadBtn').onclick = () => {
            try {
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = '天衍_' + (data.name || '卦') + '_' + Date.now() + '.png';
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

                const item = new ClipboardItem({
                    'image/png': Promise.resolve(_lastBlob)
                });
                await navigator.clipboard.write([item]);
                showToast('已复制到剪贴板', 'success');
            } catch (e) {
                showToast(isMobile()
                    ? '复制失败，请长按预览图保存到相册'
                    : '复制失败，请点击下载图片', 'error');
            }
        };
    } catch(e) {
        const msg = (e && e.message) ? e.message : String(e);
        preview.innerHTML = '<p class="share-error">分享图没有生成出来。<small>' + escHtml(msg) + '</small></p>';
    } finally {
        if (tmp.parentNode) tmp.parentNode.removeChild(tmp);
    }
}

// 分享弹层从「生成分享图」按钮的位置升起放大；关闭时缩回按钮
function shareBoxMotion(container, open) {
    const box = container && container.querySelector('.share-box');
    const btn = document.getElementById('shareBtn');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!box || !btn || typeof box.animate !== 'function' || reduce) return;
    box.getAnimations().forEach(a => a.cancel());
    const b = box.getBoundingClientRect(), s = btn.getBoundingClientRect();
    if (!s.width || !b.width) return;
    const dx = (s.left + s.width / 2) - (b.left + b.width / 2);
    const dy = (s.top + s.height / 2) - (b.top + b.height / 2);
    const at = `translate(${dx}px, ${dy}px) scale(${Math.max(.12, s.width / b.width).toFixed(3)})`;
    const frames = [
        { transform: at, opacity: 0, borderRadius: '2px' },
        { transform: `translate(${dx * .18}px, ${dy * .18 - 18}px) scale(.94)`, opacity: 1, offset: .6 },
        { transform: 'none', opacity: 1 }
    ];
    if (open) box.animate(frames, { duration: 620, easing: 'cubic-bezier(.2, .8, .25, 1)' });
    // 收回后停在按钮处（下次打开前会先取消），免得弹层淡出前闪回原位
    else box.animate(frames.slice().reverse(), { duration: 300, easing: 'cubic-bezier(.5, 0, .75, .2)', fill: 'forwards' });
}

function closeShare() {
    const container = document.getElementById('shareImageContainer');
    if (container.classList.contains('show')) shareBoxMotion(container, false);
    container.classList.remove('show');
    if (_lastBlobUrl) {
        URL.revokeObjectURL(_lastBlobUrl);
        _lastBlobUrl = null;
    }
    _lastBlob = null;
}
