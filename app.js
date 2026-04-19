// ========== 吉凶速判 ==========
function judgeFortuneLevel(guaCi) {
    // 根据卦辞关键词判断吉凶等级
    if (/大吉|元亨利贞|元亨/.test(guaCi)) return { level: '大吉', cls: 'fortune-great' };
    if (/吉|亨|利/.test(guaCi)) return { level: '吉', cls: 'fortune-good' };
    if (/无咎|悔亡/.test(guaCi)) return { level: '无咎', cls: 'fortune-neutral' };
    if (/厉|艰|小亨|悔|吝/.test(guaCi)) return { level: '需慎', cls: 'fortune-caution' };
    if (/凶|不利|否|险/.test(guaCi)) return { level: '凶', cls: 'fortune-bad' };
    return { level: '中平', cls: 'fortune-neutral' };
}

// ========== 起卦模式 ==========
var currentMode = 'random';

function switchMode(mode) {
    currentMode = mode;
    document.getElementById('modeRandom').classList.toggle('active', mode === 'random');
    document.getElementById('modeBazi').classList.toggle('active', mode === 'bazi');
    document.getElementById('baziArea').classList.toggle('show', mode === 'bazi');
}

// ========== 卦象生成 ==========
function generateHexagram() {
    const lines = [];
    for (let i = 0; i < 6; i++) {
        const s = (Math.random()>0.5?1:0)+(Math.random()>0.5?1:0)+(Math.random()>0.5?1:0);
        lines.push(s===3?9:s===2?8:s===1?7:6);
    }
    return lines;
}

// 确定性哈希函数（FNV-1a）
function hashStr(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x45d9f3b);
    h ^= h >>> 16;
    return h >>> 0;
}

// 基于生辰的确定性起卦（加入当前日期时间避免同一问题永远相同结果）
function generateHexagramFromBazi(year, month, day, shichen, question) {
    var now = new Date();
    var nowStr = now.getFullYear() + '' + (now.getMonth()+1) + '' + now.getDate();
    var seed = year + '-' + month + '-' + day + '-' + shichen + ':' + (question || '') + '@' + nowStr;
    var lines = [];
    for (var i = 0; i < 6; i++) {
        var h = hashStr(seed + '#' + i);
        // 映射到 6/7/8/9，概率近似三枚铜钱：7和8各3/8，9和6各1/8
        var v = h % 8;
        if (v === 0) lines.push(6);       // 老阴 1/8
        else if (v <= 3) lines.push(7);   // 少阳 3/8
        else if (v <= 6) lines.push(8);   // 少阴 3/8
        else lines.push(9);               // 老阳 1/8
    }
    return lines;
}

function getBaziInput() {
    var y = document.getElementById('baziYear').value.trim();
    var m = document.getElementById('baziMonth').value;
    var d = document.getElementById('baziDay').value.trim();
    var s = document.getElementById('baziShichen').value;
    if (!y || !m || !d || s === '') {
        alert('请填写完整的出生年月日时辰');
        return null;
    }
    var year = parseInt(y);
    if (year < 1900 || year > 2100) {
        alert('请输入有效的出生年份（1900-2100）');
        return null;
    }
    var day = parseInt(d);
    if (day < 1 || day > 31) {
        alert('请输入有效的日期（1-31）');
        return null;
    }
    // 保存生辰数据
    try {
        localStorage.setItem('tianyan_bazi', JSON.stringify({ year: year, month: parseInt(m), day: day, shichen: parseInt(s) }));
    } catch(e) {}
    return { year: year, month: parseInt(m), day: day, shichen: parseInt(s) };
}

function loadBaziInput() {
    try {
        var saved = localStorage.getItem('tianyan_bazi');
        if (!saved) return;
        var data = JSON.parse(saved);
        if (data.year) document.getElementById('baziYear').value = data.year;
        if (data.month) document.getElementById('baziMonth').value = data.month;
        if (data.day) document.getElementById('baziDay').value = data.day;
        if (data.shichen !== undefined && data.shichen !== '') document.getElementById('baziShichen').value = data.shichen;
    } catch(e) {}
}

function calculateChangeGua(hexLines, origBin) {
    const cy=[], cb=[];
    for (let i=0;i<hexLines.length;i++) {
        const l=hexLines[i];
        if(l===9){cy.push(i);cb.push('0');}
        else if(l===6){cy.push(i);cb.push('1');}
        else cb.push(l===7?'1':'0');
    }
    if(!cy.length) return {hasChange:false,changeBinary:origBin,changingYaos:[],changeGua:lookupGua(origBin)};
    const full=cb.slice(3,6).reverse().join('')+cb.slice(0,3).reverse().join('');
    return {hasChange:true,changeBinary:full,changingYaos:cy,changeGua:lookupGua(full)};
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

class BrushAnimation {
    constructor(cv) {
        this.cv = cv; this.ctx = cv.getContext('2d');
        this.yaoLines = []; this.sparks = [];
        this.running = false; this.resize();
    }
    resize() {
        const r = devicePixelRatio || 1;
        const rect = this.cv.parentElement.getBoundingClientRect();
        this.w = rect.width; this.h = 240;
        this.cv.width = this.w * r; this.cv.height = this.h * r;
        this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px';
        this.ctx.scale(r, r);
    }

    // 添加一条毛笔爻线
    addYaoLine(isYang, index) {
        const cx = this.w / 2;
        const totalH = 5 * 20; // 6线5间距
        const baseY = 30 + index * 20; // 从顶部30px开始，留底部给卦名
        const halfW = Math.min(70, this.w * 0.14);
        // 生成笔画采样点 — 模拟毛笔行笔
        const steps = 32;
        const pts = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            // 笔压曲线：落笔按→提笔轻→收笔顿
            let pressure;
            if (t < 0.08) pressure = 5 + (0.08 - t) / 0.08 * 3;        // 起笔顿
            else if (t < 0.15) pressure = 5 - (t - 0.08) / 0.07 * 1.5; // 提笔
            else if (t > 0.88) pressure = 3.5 + (t - 0.88) / 0.12 * 4; // 收笔顿
            else pressure = 3.5 + Math.sin(t * Math.PI * 0.8) * 0.5;    // 行笔平稳
            // 手写微抖
            const wobble = (Math.random() - 0.5) * 0.8;
            pts.push({ t, pressure, wobble });
        }

        if (isYang) {
            this.yaoLines.push({ isYang: true, cx, y: baseY, halfW, pts, progress: 0, opacity: 0 });
        } else {
            this.yaoLines.push({ isYang: false, cx, y: baseY, halfW, gap: 8, pts, progress: 0, opacity: 0 });
        }
    }

    addSparks(x, y, count) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 0.2 + Math.random() * 0.8;
            this.sparks.push({
                x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.2,
                life: 1, decay: 0.01 + Math.random() * 0.02,
                sz: 0.6 + Math.random() * 1.2
            });
        }
    }

    update() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.w, this.h);

        // ---- 毛笔爻线 ----
        for (const yao of this.yaoLines) {
            yao.progress = Math.min(1, yao.progress + 0.018);
            yao.opacity = Math.min(1, yao.opacity + 0.05);

            if (yao.isYang) {
                this._brushStroke(ctx, yao, -yao.halfW, yao.halfW, yao.progress, yao.opacity);
            } else {
                // 阴爻：先左段，progress 0~0.45 画左，0.5~1 画右
                if (yao.progress <= 0.5) {
                    const sub = yao.progress / 0.5;
                    this._brushStroke(ctx, yao, -yao.halfW, -yao.gap, sub, yao.opacity);
                } else {
                    this._brushStroke(ctx, yao, -yao.halfW, -yao.gap, 1, yao.opacity);
                    const sub = (yao.progress - 0.5) / 0.5;
                    this._brushStroke(ctx, yao, yao.gap, yao.halfW, sub, yao.opacity);
                }
            }
        }

        // ---- 墨点飞溅 ----
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const p = this.sparks[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.01;
            p.vx *= 0.99; p.life -= p.decay;
            if (p.life <= 0) { this.sparks.splice(i, 1); continue; }
            ctx.globalAlpha = p.life * 0.5;
            ctx.fillStyle = '#2c2c2c';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.sz * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // 核心：毛笔笔画渲染
    _brushStroke(ctx, yao, startOff, endOff, progress, opacity) {
        const pts = yao.pts;
        const drawTo = Math.floor(progress * pts.length);
        if (drawTo < 2) return;

        const totalW = endOff - startOff;
        ctx.globalAlpha = opacity;

        // 逐段画，每段宽度不同 → 产生笔触粗细变化
        for (let i = 1; i < drawTo && i < pts.length; i++) {
            const p0 = pts[i - 1], p1 = pts[i];
            const x0 = yao.cx + startOff + p0.t * totalW;
            const x1 = yao.cx + startOff + p1.t * totalW;
            const y0 = yao.y + p0.wobble;
            const y1 = yao.y + p1.wobble;
            const w = (p0.pressure + p1.pressure) / 2;

            ctx.strokeStyle = '#2c2c2c';
            ctx.lineWidth = w;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
        }

        // 起笔墨迹（厚重的落笔痕）
        if (drawTo > 3) {
            const startX = yao.cx + startOff;
            ctx.fillStyle = 'rgba(44,44,44,0.4)';
            ctx.beginPath();
            ctx.ellipse(startX + 1, yao.y, 3.5, 2.5, 0.1, 0, Math.PI * 2);
            ctx.fill();
        }

        // 收笔墨迹
        if (progress > 0.95) {
            const endX = yao.cx + endOff;
            ctx.fillStyle = 'rgba(44,44,44,0.25)';
            ctx.beginPath();
            ctx.ellipse(endX - 1, yao.y + 0.5, 3, 2, -0.1, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    }

    start() {
        this.running = true;
        const lp = () => { if (!this.running) return; this.update(); requestAnimationFrame(lp); };
        lp();
    }
    stop() {
        this.running = false;
        this.yaoLines = []; this.sparks = [];
        this.ctx.clearRect(0, 0, this.w, this.h);
    }
}

// ========== 分享工具函数 ==========

// data URL 转 Blob
function dataURLtoBlob(dataURL) {
    var parts = dataURL.split(',');
    var mime = parts[0].match(/:(.*?);/)[1];
    var raw = atob(parts[1]);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return new Blob([arr], { type: mime });
}

// 通用：绑定分享弹窗的按钮事件
function bindShareButtons(canvas, fileName) {
    var blob = null;
    var blobUrl = null;

    function getBlob() {
        if (blob) return Promise.resolve(blob);
        return new Promise(function(resolve) {
            canvas.toBlob(function(b) { blob = b; resolve(b); }, 'image/png');
        });
    }

    // 下载按钮
    document.getElementById('shareDownloadBtn').onclick = async function() {
        var b = await getBlob();
        // 优先用 Web Share API 的文件下载（兼容性最好）
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        blobUrl = URL.createObjectURL(b);
        var a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
        }, 500);
        // 安卓 fallback：如果 download 属性不生效，提示长按保存
        showShareTip('若下载无反应，请长按上方图片保存');
    };

    // 复制按钮
    document.getElementById('shareCopyBtn').onclick = async function() {
        var b = await getBlob();
        // 先尝试 Clipboard API
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
                alert('已复制到剪贴板');
                return;
            } catch(e) { /* fallback below */ }
        }
        // fallback：提示长按保存
        showShareTip('当前浏览器不支持复制图片，请长按上方图片保存');
    };

    // 原生分享按钮（Web Share API）
    var nativeBtn = document.getElementById('shareNativeBtn');
    if (navigator.share && navigator.canShare) {
        nativeBtn.style.display = '';
        nativeBtn.onclick = async function() {
            var b = await getBlob();
            var file = new File([b], fileName, { type: 'image/png' });
            var shareData = { files: [file], title: '天衍 · 周易占卜' };
            if (navigator.canShare(shareData)) {
                try {
                    await navigator.share(shareData);
                } catch(e) {
                    if (e.name !== 'AbortError') showShareTip('分享失败，请长按图片保存');
                }
            } else {
                // 不支持文件分享，退回纯文本分享
                try { await navigator.share({ title: '天衍 · 周易占卜', text: '来自天衍的卦象分享' }); } catch(e) {}
                showShareTip('当前浏览器不支持图片分享，请长按图片保存');
            }
        };
    } else {
        nativeBtn.style.display = 'none';
    }
}

function showShareTip(msg) {
    var tip = document.getElementById('shareTip');
    if (!tip) return;
    tip.textContent = msg;
    tip.style.display = '';
    setTimeout(function() { tip.style.display = 'none'; }, 5000);
}

// ========== 分享功能 ==========

function getCurrentGuaData() {
    const r = document.getElementById('resultArea');
    if (!r || !r.classList.contains('show')) return null;
    const nameEl = r.querySelector('.hex-name');
    const titleEl = r.querySelector('.hex-title');
    const symbolEl = r.querySelector('.hex-symbol');
    if (!nameEl) return null;
    const items = r.querySelectorAll('.analysis-item');
    const list = [];
    items.forEach(el => { if (el.textContent.trim()) list.push(el.textContent.trim()); });
    const changingYaoTexts = [];
    r.querySelectorAll('.yao-item.changing').forEach(el => {
        const n = el.querySelector('.yao-name');
        const t = el.querySelector('.yao-text');
        if (n && t) changingYaoTexts.push(n.textContent + '：' + t.textContent);
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
            const ps = details.querySelectorAll('p');
            ps.forEach(p => {
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
        analysisList: list, changingYaoTexts, hasChange, cgName, cgSymbol, cgExplain, changePos,
        date: new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })
    };
}

function createShareCard(d) {
    if (!d) return '';
    const analysis = d.analysisList.map(t =>
        '<div style="margin-bottom:10px;padding-left:14px;border-left:2px solid #c9a96e;font-size:14px;line-height:1.7;color:#3a3a3a;">' + t + '</div>'
    ).join('');

    // 变爻提示
    const yaoBlock = d.changingYaoTexts.length > 0 ?
        '<div style="margin-top:16px;padding:14px;background:rgba(179,58,58,0.04);border:1px solid rgba(179,58,58,0.1);border-radius:4px;">' +
            '<div style="font-size:13px;color:#b33a3a;margin-bottom:8px;font-weight:bold;">变爻提示</div>' +
            d.changingYaoTexts.map(t =>
                '<div style="font-size:13px;line-height:1.7;color:#666;margin-bottom:4px;">' + t + '</div>'
            ).join('') +
        '</div>' : '';

    // 变卦分析
    const changeBlock = d.hasChange ?
        '<div style="margin-top:16px;padding:16px;background:rgba(179,58,58,0.04);border:1px solid rgba(179,58,58,0.1);border-radius:4px;">' +
            '<div style="font-size:13px;color:#b33a3a;font-weight:bold;margin-bottom:12px;">变卦分析</div>' +
            '<div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:12px;">' +
                '<div style="text-align:center;">' +
                    '<div style="font-size:28px;color:#2c2c2c;">' + d.symbol + '</div>' +
                    '<div style="font-size:12px;color:#888;margin-top:4px;">' + d.name + '</div>' +
                '</div>' +
                '<div style="font-size:16px;color:#ccc;">→</div>' +
                '<div style="text-align:center;">' +
                    '<div style="font-size:28px;color:#b33a3a;">' + d.cgSymbol + '</div>' +
                    '<div style="font-size:12px;color:#b33a3a;margin-top:4px;">' + d.cgName + '</div>' +
                '</div>' +
            '</div>' +
            (d.changePos ? '<div style="font-size:12px;color:#888;text-align:center;margin-bottom:8px;">' + d.changePos + '</div>' : '') +
            (d.cgExplain ? '<div style="font-size:13px;line-height:1.7;color:#3a3a3a;">' + d.cgExplain + '</div>' : '') +
        '</div>' : '';

    return '<div id="shareCard" style="width:480px;background:#f5f0e8;color:#2c2c2c;padding:32px 28px;font-family:serif;position:relative;">' +
        '<div style="text-align:center;margin-bottom:6px;font-size:12px;color:#999;letter-spacing:6px;">天 衍</div>' +
        '<div style="text-align:center;padding:20px 0;">' +
            '<div style="font-size:64px;line-height:1;color:#2c2c2c;">' + d.symbol + '</div>' +
            '<div style="font-size:28px;margin-top:10px;letter-spacing:4px;">' + d.name + '</div>' +
            '<div style="font-size:16px;color:#c9a96e;margin-top:6px;">' + d.title + '</div>' +
        '</div>' +
        '<div style="height:1px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);margin:16px 0;"></div>' +
        (d.question ? '<div style="text-align:center;margin-bottom:16px;font-size:14px;color:#888;">所问：' + d.question + '</div>' : '') +
        '<div style="padding:16px;background:rgba(0,0,0,0.03);border-radius:8px;">' + analysis + '</div>' +
        yaoBlock +
        changeBlock +
        '<div style="margin-top:20px;display:flex;justify-content:space-between;font-size:11px;color:#aaa;">' +
            '<span>' + d.date + '</span><span>天衍 · 周易六十四卦</span>' +
        '</div>' +
    '</div>';
}

async function shareAsImage() {
    const container = document.getElementById('shareImageContainer');
    const preview = document.getElementById('shareImagePreview');
    const data = getCurrentGuaData();
    if (!data) { alert('请先占卜'); return; }
    preview.innerHTML = '<div style="padding:30px;text-align:center;color:#888;">生成中…</div>';
    var tip = document.getElementById('shareTip'); if (tip) tip.style.display = 'none';
    container.classList.add('show');
    try {
        const tmp = document.createElement('div');
        tmp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:540px;';
        tmp.innerHTML = createShareCard(data);
        document.body.appendChild(tmp);
        await sleep(300);
        const card = tmp.querySelector('#shareCard');
        const canvas = await html2canvas(card, { backgroundColor: null, scale: 3, logging: false });
        document.body.removeChild(tmp);
        const url = canvas.toDataURL('image/png', 1.0);
        preview.innerHTML = '<img src="' + url + '" alt="分享图" style="max-width:100%;border-radius:8px;border:1px solid #ddd;">';
        bindShareButtons(canvas, '天衍_' + Date.now() + '.png');
    } catch(e) { preview.innerHTML = '<div style="padding:20px;color:#b33a3a;">生成失败</div>'; }
}

function closeShare() {
    document.getElementById('shareImageContainer').classList.remove('show');
}


// ========== 占卜主流程 ==========
async function divine() {
    const question = document.getElementById('question').value.trim();
    const resultArea = document.getElementById('resultArea');
    const btn = document.getElementById('divineBtn');

    // 生辰模式校验
    var baziData = null;
    var hexLines;
    if (currentMode === 'bazi') {
        baziData = getBaziInput();
        if (!baziData) return;
        hexLines = generateHexagramFromBazi(baziData.year, baziData.month, baziData.day, baziData.shichen, question);
    } else {
        hexLines = generateHexagram();
    }

    btn.disabled = true; btn.textContent = '卦象演算中…';
    resultArea.innerHTML = '<div class="ink-stage"><canvas id="inkCanvas"></canvas><div class="ink-status" id="inkStatus"></div></div>';
    resultArea.classList.add('show');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const cv = document.getElementById('inkCanvas');
    const anim = new BrushAnimation(cv);
    anim.start();
    const bits = hexLines.map(n => (n === 7 || n === 9) ? '1' : '0');
    const fullBin = bits.slice(3,6).reverse().join('') + bits.slice(0,3).reverse().join('');
    const gua = lookupGua(fullBin);
    const change = calculateChangeGua(hexLines, fullBin);
    const statusEl = document.getElementById('inkStatus');
    statusEl.textContent = '卦象生成中…';
    statusEl.classList.add('show');
    await sleep(600);
    const yaoLabels = ['初爻','二爻','三爻','四爻','五爻','上爻'];
    for (let i = 0; i < 6; i++) {
        const isYang = (hexLines[i] === 7 || hexLines[i] === 9);
        statusEl.textContent = yaoLabels[i] + ' · ' + (isYang ? '阳' : '阴');
        anim.addYaoLine(isYang, i);
        anim.addSparks(anim.w / 2, 30 + i * 20, 6);
        await sleep(700);
    }
    await sleep(400);
    statusEl.textContent = gua[2] + '  ' + gua[0];
    statusEl.style.fontSize = '1.5em';
    statusEl.style.color = '#b33a3a';
    await sleep(1800);
    resultArea.style.transition = 'opacity 0.5s';
    resultArea.style.opacity = '0';
    await sleep(500);
    anim.stop();
    renderResult(gua, hexLines, change, question, fullBin);
    resultArea.style.opacity = '1';
    saveToHistory(question, gua, fullBin, hexLines, change);
    btn.disabled = false; btn.textContent = '起卦';
}
// ========== 渲染结果 ==========
function renderResult(gua, hexLines, change, question, fullBin) {
    const resultArea = document.getElementById('resultArea');
    const yaoNames = ['初九','九二','九三','九四','九五','上九','初六','六二','六三','六四','六五','上六'];

    const yaoHtml = hexLines.map((line, idx) => {
        const isYang = (line===9||line===7);
        const yaoType = line===9?'老阳':line===7?'少阳':line===8?'少阴':'老阴';
        const yaoName = isYang ? yaoNames[idx] : yaoNames[idx+6];
        const yaoText = gua[3].split('|')[idx]||'';
        const isChanging = change.changingYaos.includes(idx);
        const lineVis = isYang
            ? '<span class="yao-line yang"><span></span></span>'
            : '<span class="yao-line yin"><span></span><span></span></span>';
        const changeBadge = isChanging ? '<span class="yao-badge change">变爻</span>' : '';
        return '<div class="yao-item'+(isChanging?' changing':'')+'">' +
            '<div class="yao-header">'+lineVis+
            '<span class="yao-name">'+yaoName+'</span>'+
            '<span class="yao-badge type">'+yaoType+'</span>'+changeBadge+'</div>'+
            '<div class="yao-text">'+yaoText+'</div></div>';
    }).join('');

    const analysisHtml = gua[4].split('。').filter(s=>s.trim()).map(s=>
        '<div class="analysis-item">'+s.trim()+'。</div>'
    ).join('');

    let changeHtml = '';
    if (change.hasChange) {
        const pos = change.changingYaos.map(p=>['初','二','三','四','五','上'][p]);
        changeHtml = '<section class="card change-section"><h3>变卦分析</h3>'+
            '<div class="change-comparison">'+
            '<div class="gua-box"><div class="gua-label">本卦</div><div class="gua-symbol">'+gua[2]+'</div><div class="gua-name">'+gua[0]+'</div></div>'+
            '<div class="change-arrow">⟶</div>'+
            '<div class="gua-box changed"><div class="gua-label">变卦</div><div class="gua-symbol">'+change.changeGua[2]+'</div><div class="gua-name">'+change.changeGua[0]+'</div></div></div>'+
            '<div class="change-details"><p>变爻位置：第'+pos.join('、')+'爻</p>'+
            '<p>'+change.changeGua[4]+'</p></div></section>';
    }

    resultArea.innerHTML =
        '<section class="card result-header"><div class="hex-symbol">' + gua[2] + '</div>' +
        '<div class="hex-info"><h2 class="hex-name">' + gua[0] + '</h2><div class="hex-title">' + gua[1] + '</div></div>' +
        '<div class="fortune-tag ' + judgeFortuneLevel(gua[1]).cls + '">' + judgeFortuneLevel(gua[1]).level + '</div>' +
        (question ? '<p class="hex-question">「' + question + '」</p>' : '') +
        '<div class="share-row"><button class="btn-share" onclick="shareAsImage()">生成分享图</button></div></section>' +
        '<section class="card"><h3>六爻解读</h3><div class="yao-list">' + yaoHtml + '</div></section>' +
        '<section class="card"><h3>卦象分析</h3><div class="analysis-list">' + analysisHtml + '</div></section>' +
        changeHtml;
    resultArea.classList.add('show');

    // 逐段淡入
    const cards = resultArea.querySelectorAll('.card');
    cards.forEach((el,i)=>{
        el.style.opacity='0';el.style.transform='translateY(20px)';
        setTimeout(()=>{
            el.style.transition='opacity 0.6s ease,transform 0.6s ease';
            el.style.opacity='1';el.style.transform='translateY(0)';
        },200+i*180);
    });
}

function saveToHistory(question, gua, fullBin, hexLines, change) {
    let history = JSON.parse(localStorage.getItem('divinationHistory') || '[]');
    history.unshift({
        question: question || '心中所念',
        gua: gua[0], symbol: gua[2], title: gua[1],
        binary: fullBin, hexagramLines: hexLines,
        changeBinary: change.changeBinary,
        hasChange: change.hasChange,
        changingYaos: change.changingYaos,
        date: new Date().toLocaleString('zh-CN')
    });
    history = history.slice(0, 50);
    localStorage.setItem('divinationHistory', JSON.stringify(history));
}

function toggleHistory() {
    const panel = document.getElementById('historyPanel');
    panel.classList.toggle('show');
    if (panel.classList.contains('show')) loadHistory();
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('divinationHistory') || '[]');
    const list = document.getElementById('historyList');
    if (history.length === 0) {
        list.innerHTML = '<p class="history-empty">暂无记录</p>';
        return;
    }
    list.innerHTML = history.map((item, idx) =>
        '<div class="history-item" onclick="loadHistoryItem(' + idx + ')">' +
            '<div class="history-q">' + item.question + '</div>' +
            '<div class="history-gua">' + item.symbol + ' ' + item.gua +
                (item.hasChange ? ' <span class="history-tag">变</span>' : '') +
            '</div>' +
            '<div class="history-date">' + item.date + '</div>' +
        '</div>'
    ).join('');
}

function loadHistoryItem(index) {
    const history = JSON.parse(localStorage.getItem('divinationHistory') || '[]');
    const item = history[index];
    if (!item) return;
    // 优先通过卦象符号查找（兼容旧数据）
    const gua = GUA.find(g => g[2] === item.symbol) || (item.binary ? lookupGua(item.binary) : null) || GUA[0];
    if (!gua) return;
    if (item.hexagramLines && item.hexagramLines.length === 6) {
        // 从爻线重新计算二进制（兼容旧数据的错误binary）
        const bits = item.hexagramLines.map(n => (n === 7 || n === 9) ? '1' : '0');
        const correctBin = bits.slice(3,6).reverse().join('') + bits.slice(0,3).reverse().join('');
        const change = calculateChangeGua(item.hexagramLines, correctBin);
        renderResult(gua, item.hexagramLines, change, item.question, correctBin);
    } else {
        const resultArea = document.getElementById('resultArea');
        const analysisHtml = gua[4].split('。').filter(s=>s.trim()).map(s=>
            '<div class="analysis-item">'+s.trim()+'。</div>'
        ).join('');
        resultArea.innerHTML =
            '<section class="card result-header"><div class="hex-symbol">'+gua[2]+'</div>'+
            '<div class="hex-info"><h2 class="hex-name">'+gua[0]+'</h2><div class="hex-title">'+gua[1]+'</div></div></section>'+
            '<section class="card"><h3>卦象分析</h3><div class="analysis-list">'+analysisHtml+'</div></section>';
        resultArea.classList.add('show');
    }
    toggleHistory();
}

function clearHistory() {
    if (confirm('确定清空所有历史记录？')) {
        localStorage.removeItem('divinationHistory');
        loadHistory();
    }
}


// ========== 每日一卦 ==========

// 获取/生成用户唯一ID（首次访问随机生成，存入localStorage）
function getUserSeed() {
    let uid = localStorage.getItem('tianyan_uid');
    if (!uid) {
        uid = Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('tianyan_uid', uid);
    }
    return uid;
}

function getDailyGua() {
    const d = new Date();
    const dateStr = d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
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

const DAILY_MOTTOS = [
    '顺势而为，静待花开', '心正则事顺，行稳致远', '厚积薄发，水到渠成',
    '知止而后有定，定而后能静', '天行健，君子以自强不息', '地势坤，君子以厚德载物',
    '积善之家，必有余庆', '穷则变，变则通，通则久', '居安思危，思则有备',
    '见善则迁，有过则改', '谦谦君子，卑以自牧', '不忘初心，方得始终'
];

function renderDailyGua() {
    const el = document.getElementById('dailyGua');
    if (!el) return;
    const gua = getDailyGua();
    const motto = getDailyMotto();
    el.innerHTML =
        '<div class="daily-header">' +
            '<div class="daily-label">今日卦象</div>' +
            '<button class="daily-share-btn" id="dailyShareBtn" onclick="event.stopPropagation();shareDailyGua();">分享</button>' +
        '</div>' +
        '<div class="daily-content">' +
            '<span class="daily-symbol">' + gua[2] + '</span>' +
            '<span class="daily-name">' + gua[0] + '</span>' +
            '<span class="fortune-tag small ' + judgeFortuneLevel(gua[1]).cls + '">' + judgeFortuneLevel(gua[1]).level + '</span>' +
            '<span class="daily-divider">·</span>' +
            '<span class="daily-motto">' + motto + '</span>' +
        '</div>';
    el.onclick = function() { showGuaDetail(getDailyGua()); };
}

// 每日一卦分享卡片
function createDailyShareCard() {
    var gua = getDailyGua();
    var motto = getDailyMotto();
    var dateStr = new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' });
    var weekDay = ['日','一','二','三','四','五','六'][new Date().getDay()];

    var analysis = gua[4].split('。').filter(function(s){ return s.trim(); }).map(function(s){
        return '<div style="margin-bottom:8px;padding-left:12px;border-left:2px solid #c9a96e;font-size:13px;line-height:1.7;color:#3a3a3a;">' + s.trim() + '。</div>';
    }).join('');

    return '<div id="shareCard" style="width:480px;background:#f5f0e8;color:#2c2c2c;padding:32px 28px;font-family:serif;position:relative;">' +
        '<div style="text-align:center;margin-bottom:6px;font-size:12px;color:#999;letter-spacing:6px;">天 衍</div>' +
        '<div style="text-align:center;margin:8px 0 4px;"><span style="display:inline-block;padding:4px 18px;border:1px solid #c9a96e;color:#c9a96e;font-size:12px;letter-spacing:4px;">每 日 一 卦</span></div>' +
        '<div style="text-align:center;font-size:13px;color:#999;margin-bottom:12px;">' + dateStr + ' 星期' + weekDay + '</div>' +
        '<div style="text-align:center;padding:20px 0;">' +
            '<div style="font-size:72px;line-height:1;color:#2c2c2c;">' + gua[2] + '</div>' +
            '<div style="font-size:28px;margin-top:12px;letter-spacing:4px;">' + gua[0] + '</div>' +
            '<div style="font-size:15px;color:#c9a96e;margin-top:6px;">' + gua[1] + '</div>' +
        '</div>' +
        '<div style="text-align:center;margin:12px 0 18px;font-size:16px;color:#666;letter-spacing:2px;font-style:italic;">「' + motto + '」</div>' +
        '<div style="height:1px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);margin:0 0 16px;"></div>' +
        '<div style="padding:14px;background:rgba(0,0,0,0.03);border-radius:8px;">' + analysis + '</div>' +
        '<div style="margin-top:20px;display:flex;justify-content:space-between;font-size:11px;color:#aaa;">' +
            '<span>' + dateStr + '</span><span>天衍 · 每日一卦</span>' +
        '</div>' +
    '</div>';
}

async function shareDailyGua() {
    var container = document.getElementById('shareImageContainer');
    var preview = document.getElementById('shareImagePreview');
    preview.innerHTML = '<div style="padding:30px;text-align:center;color:#888;">生成中…</div>';
    var tip = document.getElementById('shareTip'); if (tip) tip.style.display = 'none';
    container.classList.add('show');
    try {
        var tmp = document.createElement('div');
        tmp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:540px;';
        tmp.innerHTML = createDailyShareCard();
        document.body.appendChild(tmp);
        await sleep(300);
        var card = tmp.querySelector('#shareCard');
        var canvas = await html2canvas(card, { backgroundColor: null, scale: 3, logging: false });
        document.body.removeChild(tmp);
        var url = canvas.toDataURL('image/png', 1.0);
        preview.innerHTML = '<img src="' + url + '" alt="每日一卦" style="max-width:100%;border-radius:8px;border:1px solid #ddd;">';
        bindShareButtons(canvas, '天衍_每日一卦_' + Date.now() + '.png');
    } catch(e) { preview.innerHTML = '<div style="padding:20px;color:#b33a3a;">生成失败</div>'; }
}

// ========== 卦象详解弹窗 ==========
function showGuaDetail(gua) {
    var old = document.querySelector('.detail-overlay');
    if (old) old.remove();

    var yaos = gua[3].split('|');
    var yaoHtml = yaos.map(function(y) {
        var i = y.indexOf('：');
        var pos = i > 0 ? y.substring(0, i) : '';
        var txt = i > 0 ? y.substring(i + 1) : y;
        return '<div class="detail-yao"><span class="detail-yao-name">' + pos + '</span>' + txt + '</div>';
    }).join('');

    var analysis = gua[4].split('。').filter(function(s) { return s.trim(); }).map(function(s) {
        return '<p>' + s.trim() + '。</p>';
    }).join('');

    var upper = getTrigramName(gua[2][0]);
    var lower = getTrigramName(gua[2][1]);

    var overlay = document.createElement('div');
    overlay.className = 'detail-overlay';
    overlay.innerHTML =
        '<div class="detail-box">' +
            '<div class="detail-head">' +
                '<div class="detail-symbol">' + gua[2] + '</div>' +
                '<div class="detail-info"><h2>' + gua[0] + '</h2><div class="detail-sub">' + gua[1] + '</div>' +
                '<div class="fortune-tag small ' + judgeFortuneLevel(gua[1]).cls + '">' + judgeFortuneLevel(gua[1]).level + '</div></div>' +
                '<button class="detail-close" id="detailCloseBtn">&times;</button>' +
            '</div>' +
            '<div class="detail-meta">上卦 ' + upper + ' · 下卦 ' + lower + '</div>' +
            '<div class="detail-section"><h3>爻辞</h3>' + yaoHtml + '</div>' +
            '<div class="detail-section"><h3>卦象解读</h3><div class="detail-analysis">' + analysis + '</div></div>' +
            '<div class="detail-footer"><button class="detail-share-btn" id="detailShareBtn">分享此卦</button></div>' +
        '</div>';
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    overlay.querySelector('#detailCloseBtn').addEventListener('click', function() { overlay.remove(); });
    overlay.querySelector('#detailShareBtn').addEventListener('click', function() {
        overlay.remove();
        shareGuaDetail(gua);
    });
    requestAnimationFrame(function() { overlay.classList.add('show'); });
}

// 详解弹窗分享卡片（与每日一卦分享卡片统一样式）
function createDetailShareCard(gua) {
    var dateStr = new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' });
    var weekDay = ['日','一','二','三','四','五','六'][new Date().getDay()];
    var motto = getDailyMotto();

    var analysis = gua[4].split('。').filter(function(s){ return s.trim(); }).map(function(s){
        return '<div style="margin-bottom:8px;padding-left:12px;border-left:2px solid #c9a96e;font-size:13px;line-height:1.7;color:#3a3a3a;">' + s.trim() + '。</div>';
    }).join('');

    return '<div id="shareCard" style="width:480px;background:#f5f0e8;color:#2c2c2c;padding:32px 28px;font-family:serif;position:relative;">' +
        '<div style="text-align:center;margin-bottom:6px;font-size:12px;color:#999;letter-spacing:6px;">天 衍</div>' +
        '<div style="text-align:center;margin:8px 0 4px;"><span style="display:inline-block;padding:4px 18px;border:1px solid #c9a96e;color:#c9a96e;font-size:12px;letter-spacing:4px;">每 日 一 卦</span></div>' +
        '<div style="text-align:center;font-size:13px;color:#999;margin-bottom:12px;">' + dateStr + ' 星期' + weekDay + '</div>' +
        '<div style="text-align:center;padding:20px 0;">' +
            '<div style="font-size:72px;line-height:1;color:#2c2c2c;">' + gua[2] + '</div>' +
            '<div style="font-size:28px;margin-top:12px;letter-spacing:4px;">' + gua[0] + '</div>' +
            '<div style="font-size:15px;color:#c9a96e;margin-top:6px;">' + gua[1] + '</div>' +
        '</div>' +
        '<div style="text-align:center;margin:12px 0 18px;font-size:16px;color:#666;letter-spacing:2px;font-style:italic;">「' + motto + '」</div>' +
        '<div style="height:1px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);margin:0 0 16px;"></div>' +
        '<div style="padding:14px;background:rgba(0,0,0,0.03);border-radius:8px;">' + analysis + '</div>' +
        '<div style="margin-top:20px;display:flex;justify-content:space-between;font-size:11px;color:#aaa;">' +
            '<span>' + dateStr + '</span><span>天衍 · 每日一卦</span>' +
        '</div>' +
    '</div>';
}

async function shareGuaDetail(gua) {
    var container = document.getElementById('shareImageContainer');
    var preview = document.getElementById('shareImagePreview');
    preview.innerHTML = '<div style="padding:30px;text-align:center;color:#888;">生成中…</div>';
    var tip = document.getElementById('shareTip'); if (tip) tip.style.display = 'none';
    container.classList.add('show');
    try {
        var tmp = document.createElement('div');
        tmp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:540px;text-align:center;';
        tmp.innerHTML = createDetailShareCard(gua);
        document.body.appendChild(tmp);
        await sleep(300);
        var card = tmp.querySelector('#shareCard');
        var canvas = await html2canvas(card, { backgroundColor: null, scale: 3, logging: false });
        document.body.removeChild(tmp);
        var url = canvas.toDataURL('image/png', 1.0);
        preview.innerHTML = '<img src="' + url + '" alt="卦象详解" style="max-width:100%;border-radius:8px;border:1px solid #ddd;">';
        bindShareButtons(canvas, '天衍_' + gua[0] + '_' + Date.now() + '.png');
    } catch(e) { preview.innerHTML = '<div style="padding:20px;color:#b33a3a;">生成失败</div>'; }
}

function getTrigramName(sym) {
    var map = {'☰':'乾(天)','☱':'兑(泽)','☲':'离(火)','☳':'震(雷)','☴':'巽(风)','☵':'坎(水)','☶':'艮(山)','☷':'坤(地)'};
    return map[sym] || sym;
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
    loadHistory();
    renderDailyGua();
    loadBaziInput();
    var sc = document.getElementById('shareImageContainer');
    if (sc) sc.addEventListener('click', function(e) { if (e.target === sc) closeShare(); });
    // 回车快捷键起卦
    document.getElementById('question').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !document.getElementById('divineBtn').disabled) divine();
    });
});
