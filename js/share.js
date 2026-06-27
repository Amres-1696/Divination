// share —— 抓取当前卦数据、生成 9:16 分享卡、html2canvas 导图、下载/复制

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
    const yaoItems = r.querySelectorAll('.yao-item');
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
        question: document.getElementById('question').value.trim(),
        analysisList: list, changingYaoTexts, changingYaos, hexagramLines,
        hasChange, cgName, cgSymbol, cgExplain, changePos,
        date: new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })
    };
}

function createShareCard(d) {
    if (!d) return '';
    const guaEntry = GUA.find(g => g[0] === d.name);
    const roman = guaEntry ? toRoman(guaIndex(guaEntry)) : '';
    const verdict = guaEntry ? getVerdict(guaEntry) : 'ping';
    const verdictText = { ji: '吉', xiong: '凶', ping: '平' };
    const verdictColor = verdict === 'ji' ? '#c97a2e' : verdict === 'xiong' ? '#a84848' : '#8a7a5a';

    // 六爻立牌 SVG（内联 stroke，不依赖 CSS）
    const hexLines = (d.hexagramLines && d.hexagramLines.length === 6)
        ? d.hexagramLines : [8,8,8,8,8,8];
    const changingYaos = d.changingYaos || [];
    const shareYaoSvg = (function() {
        const w = 60, h = 80, lineH = 2.4, gap = 8;
        const rowH = lineH + gap;
        const startY = (h - (6*rowH - gap)) / 2;
        const cx = w/2, halfW = 22;
        const parts = [];
        for (let i = 0; i < 6; i++) {
            const drawIdx = 5 - i;
            const y = startY + drawIdx * rowH + lineH/2;
            const line = hexLines[i];
            const isYang = (line === 7 || line === 9);
            const isChanging = changingYaos.includes(i);
            const color = isChanging ? '#a84848' : '#1a1412';
            const attr = `stroke="${color}" stroke-width="2.8" stroke-linecap="round"`;
            if (isYang) {
                parts.push(`<line ${attr} x1="${cx-halfW}" y1="${y}" x2="${cx+halfW}" y2="${y}" />`);
            } else {
                parts.push(`<line ${attr} x1="${cx-halfW}" y1="${y}" x2="${cx-5}" y2="${y}" />`);
                parts.push(`<line ${attr} x1="${cx+5}" y1="${y}" x2="${cx+halfW}" y2="${y}" />`);
            }
        }
        return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;">${parts.join('')}</svg>`;
    })();

    // 9:16 竖屏卡片，500×888
    return `<div id="shareCard" class="sc-card">
    <div class="sc-border-outer"></div>
    <div class="sc-border-inner"></div>
    <div class="sc-corner sc-corner-tl"></div>
    <div class="sc-corner sc-corner-tr"></div>
    <div class="sc-corner sc-corner-bl"></div>
    <div class="sc-corner sc-corner-br"></div>

    <div class="sc-header">
        <div class="sc-title">天衍 · DESTINY</div>
        <div class="sc-date">${d.date || ''}</div>
        <div class="sc-divider"></div>
    </div>

    <div class="sc-card-wrap">
        <div class="sc-tarot">
            <div class="sc-tarot-frame"></div>
            <div class="sc-tarot-corner sc-tarot-corner-tl"></div>
            <div class="sc-tarot-corner sc-tarot-corner-tr"></div>
            <div class="sc-tarot-corner sc-tarot-corner-bl"></div>
            <div class="sc-tarot-corner sc-tarot-corner-br"></div>
            ${roman ? `<div class="sc-tarot-roman">${roman}</div>` : ''}
            ${d.symbol ? `<div class="sc-tarot-watermark"><span>${d.symbol[0] || ''}</span><span>${d.symbol[1] || ''}</span></div>` : ''}
            <div class="sc-tarot-art"><div class="sc-tarot-art-inner">${shareYaoSvg}</div></div>
            <div class="sc-tarot-name">${d.name || ''}</div>
            <div class="sc-tarot-band"></div>
        </div>
    </div>

    <div class="sc-gua-info">
        <div class="sc-gua-name">《${d.name || ''}》</div>
        <div class="sc-gua-title">${d.title || ''}</div>
    </div>

    <div class="sc-verdict-wrap">
        <div class="sc-verdict" style="color:${verdictColor};border:1px solid ${verdictColor};">〔${verdictText[verdict]}〕</div>
    </div>

    ${d.question ? `<div class="sc-question">
        <div class="sc-question-text">
            <span class="sc-quote">❝</span>
            心之所念 · ${escHtml(d.question)}
            <span class="sc-quote">❞</span>
        </div>
    </div>` : '<div class="sc-spacer"></div>'}

    ${d.analysisList && d.analysisList.length ? `<div class="sc-analysis">
        <div class="sc-section-title">· 卦象奥义 ·</div>
        <div class="sc-analysis-list">${d.analysisList.slice(0, 3).map(t =>
            `<div class="sc-analysis-item">${escHtml(t)}</div>`
        ).join('')}</div>
    </div>` : ''}

    ${d.hasChange && d.cgName ? `<div class="sc-change">
        <div class="sc-section-title">· 变卦演化 ·</div>
        <div class="sc-change-flow">${escHtml(d.name)} ⟶ ${escHtml(d.cgName)}</div>
        ${d.changePos ? `<div class="sc-change-pos">${escHtml(d.changePos)}</div>` : ''}
        ${d.cgExplain ? `<div class="sc-change-explain">${escHtml(d.cgExplain)}</div>` : ''}
    </div>` : ''}

    <div class="sc-footer">
        <div class="sc-copyright">© 天衍 · DESTINY</div>
        <div class="sc-slogan">六十四卦 · 命之所向</div>
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
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+
}

function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches);
}

function renderShareCanvas(card, scale) {
    return html2canvas(card, { backgroundColor: '#e8dcc0', scale, logging: false, useCORS: true });
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
    preview.innerHTML = '<div class="share-loading"><div class="share-loading-ring"></div><span>生成中…</span></div>';
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

        // 根据设备选择 scale，避免双次渲染
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

        // 直接使用 blob URL，跳过昂贵的 toDataURL base64 编码
        const hint = isMobile()
            ? '<div style="margin-top:10px;text-align:center;font-size:12px;color:#8a6d3a;letter-spacing:2px;">长按图片 · 保存到相册</div>'
            : '';
        preview.innerHTML =
            '<img id="sharePreviewImg" alt="分享图" style="max-width:100%;border-radius:4px;border:1px solid #c9a96e;box-shadow:0 8px 24px rgba(0,0,0,0.3);">' + hint;
        const imgEl = preview.querySelector('#sharePreviewImg');
        imgEl.onerror = function() {
            this.onerror = null;
            preview.innerHTML = '<div style="padding:20px;color:#a84848;">预览加载失败，可直接点「下载图片」</div>';
        };
        imgEl.src = objectUrl;

        document.getElementById('shareDownloadBtn').onclick = () => {
            try {
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = '天衍_Arcana_' + Date.now() + '.png';
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
        preview.innerHTML =
            '<div style="padding:20px;color:#a84848;text-align:center;">生成失败' +
            '<br><small style="color:#666;font-size:11px;opacity:0.7;word-break:break-all;display:inline-block;margin-top:6px;">' + escHtml(msg) + '</small></div>';
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
