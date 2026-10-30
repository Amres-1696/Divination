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
    return {
        name: nameEl.textContent, title: titleEl ? titleEl.textContent : '',
        symbol: symbolEl ? symbolEl.textContent : '',
        question: (r.dataset.question || '').trim(),
        analysisList: list, changingYaoTexts, changingYaos, hexagramLines,
        hasChange, cgName, cgSymbol, cgExplain, changePos,
        date: new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })
    };
}

function createShareCard(d) {
    if (!d) return '';
    const guaEntry = GUA.find(g => g[0] === d.name);
    const verdict = guaEntry ? getVerdict(guaEntry) : 'ping';
    const verdictText = { ji: '吉', xiong: '凶', ping: '平' };
    const hexLines = (d.hexagramLines && d.hexagramLines.length === 6) ? d.hexagramLines : [8, 8, 8, 8, 8, 8];
    // 分享卡用内联颜色画卦，不依赖页面 CSS（html2canvas 取色更稳）
    const yao = buildYaoArtSvg(hexLines, d.changingYaos || [])
        .replace(/class="yao-svg-line changing"/g, 'style="stroke:#FF8A5C;fill:none"')
        .replace(/class="yao-svg-line"/g, 'style="stroke:#EEF2F7;fill:none"');
    // 先天方图缩略：六十四格里只亮这一格
    const bits = hexLines.map(n => (n === 7 || n === 9) ? '1' : '0');
    const v = shaoValue(bits.slice().reverse().join(''));
    let cells = '';
    for (let k = 0; k < 64; k++) cells += `<i class="${k === v ? 'on' : ''}"></i>`;
    const ordinal = guaEntry ? guaOrdinal(guaEntry) : '';
    const main = (d.analysisList || [])[0] || '';
    const reading = (d.analysisList || []).slice(1).join('');

    // 9:16 竖版，宽 500
    return `<div id="shareCard" class="sc-card">
  <div class="sc-top"><span class="sc-brand">天衍</span><span class="sc-date">${escHtml(d.date || '')}</span></div>
  ${d.question ? `<div class="sc-question"><span>所问</span>${escHtml(d.question)}</div>` : ''}
  <div class="sc-figure">
    <div class="sc-hex">${yao}</div>
    <div class="sc-map"><div class="sc-grid">${cells}</div><span>六十四卦，取其一</span></div>
  </div>
  <div class="sc-name-row"><span class="sc-name">${escHtml(d.name || '')}</span><span class="sc-verdict sc-${verdict}">${verdictText[verdict]}</span></div>
  <div class="sc-sub">${ordinal}${d.title ? '　' + escHtml(d.title) : ''}</div>
  ${d.hasChange && d.cgName ? `<div class="sc-change">变为 ${escHtml(d.cgName)}${d.changePos ? `　${escHtml(d.changePos.replace('变爻位置：', ''))}` : ''}</div>` : ''}
  ${main ? `<div class="sc-main">${escHtml(main)}</div>` : ''}
  ${reading ? `<div class="sc-reading">${escHtml(reading)}</div>` : ''}
  <div class="sc-foot"><span>卦可以看，事情仍由自己决定。</span><span>天衍 · 周易六十四卦</span></div>
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
    preview.innerHTML = '<p class="share-loading">正在生成…</p>';
    container.classList.add('show');

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

function closeShare() {
    document.getElementById('shareImageContainer').classList.remove('show');
    if (_lastBlobUrl) {
        URL.revokeObjectURL(_lastBlobUrl);
        _lastBlobUrl = null;
    }
    _lastBlob = null;
}
