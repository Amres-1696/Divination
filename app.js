// ========== 核心算法（保留，不得修改逻辑）==========
function generateHexagram() {
    const lines = [];
    for (let i = 0; i < 6; i++) {
        const s = (Math.random()>0.5?1:0)+(Math.random()>0.5?1:0)+(Math.random()>0.5?1:0);
        lines.push(s===3?9:s===2?8:s===1?7:6);
    }
    return lines;
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
    const full=cb.slice(3,6).join('')+cb.slice(0,3).join('');
    return {hasChange:true,changeBinary:full,changingYaos:cy,changeGua:lookupGua(full)};
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// ========== 工具 ==========
function toRoman(n) {
    const ones = ['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
    const tens = ['','Ⅹ','ⅩⅩ','ⅩⅩⅩ','ⅩⅬ','Ⅼ','ⅬⅩ','ⅬⅩⅩ','ⅬⅩⅩⅩ','ⅩⅭ'];
    return tens[Math.floor(n/10)] + ones[n%10];
}
function guaIndex(gua) {
    const i = GUA.indexOf(gua);
    return i >= 0 ? i + 1 : 1;
}
function isRareGua(bin) {
    return bin === '111111' || bin === '000000';
}
function getVerdict(gua) {
    const full = gua[1] + '|' + gua[4];
    const hasXiong = /凶|困顿|艰难|险陷|剥落|闭塞|衰退|不利|受阻|背离|极端/.test(full);
    const hasJi = /元亨|大吉|大有|元吉|亨利|收获|光明|顺利|喜悦|上升|丰盛|大壮/.test(full);
    if (hasXiong && !hasJi) return 'xiong';
    if (hasJi && !hasXiong) return 'ji';
    return 'ping';
}
function binToHexLines(bin) {
    const hex = [];
    for (let i = 0; i < 6; i++) hex.push(bin[5-i] === '1' ? 7 : 8);
    return hex;
}

// ========== 卡牌工厂 ==========
function buildMandalaSvg() {
    const petals = [];
    for (let i = 0; i < 8; i++) {
        petals.push(`<path transform="rotate(${i*45})" d="M 0 -40 Q 8 -22 0 -6 Q -8 -22 0 -40 Z" />`);
    }
    return `<svg class="card-back-mandala" viewBox="-50 -50 100 100" xmlns="http://www.w3.org/2000/svg">
<g fill="none" stroke="#c9a96e" stroke-width="0.6" opacity="0.9">
<circle r="42"/><circle r="30"/><circle r="18"/>
<g opacity="0.75">${petals.join('')}</g>
<polygon points="0,-16 14,8 -14,8" opacity="0.55"/>
<polygon points="0,16 -14,-8 14,-8" opacity="0.55"/>
<circle r="2.5" fill="#c9a96e"/>
</g></svg>`;
}

function buildYaoArtSvg(hexLines, changingYaos) {
    changingYaos = changingYaos || [];
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
        const cls = 'yao-svg-line' + (isChanging ? ' changing' : '');
        if (isYang) {
            parts.push(`<line class="${cls}" x1="${cx-halfW}" y1="${y}" x2="${cx+halfW}" y2="${y}" />`);
        } else {
            parts.push(`<line class="${cls}" x1="${cx-halfW}" y1="${y}" x2="${cx-5}" y2="${y}" />`);
            parts.push(`<line class="${cls}" x1="${cx+5}" y1="${y}" x2="${cx+halfW}" y2="${y}" />`);
        }
    }
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
}

function makeArcanaCard(gua, opts) {
    opts = opts || {};
    const large = !!opts.large;
    const rare = !!opts.rare;
    const hexLines = opts.hexLines || binToHexLines(TRIGRAM_TO_BINARY[gua[2][0]] + TRIGRAM_TO_BINARY[gua[2][1]]);
    const changingYaos = opts.changingYaos || [];
    const idx = guaIndex(gua);
    const roman = toRoman(idx);
    const upper = gua[2][0], lower = gua[2][1];

    const card = document.createElement('div');
    card.className = 'arcana-card' + (large ? ' large' : '') + (rare ? ' rare-gilded' : '');
    card.innerHTML = `
<div class="card-face back">
    <div class="card-back-art">${buildMandalaSvg()}</div>
    <div class="card-gold-band"></div>
</div>
<div class="card-face front">
    <div class="card-frame-deco"></div>
    <div class="card-roman">${roman}</div>
    <div class="card-trigram-watermark"><span>${upper}</span><span>${lower}</span></div>
    <div class="card-art">${buildYaoArtSvg(hexLines, changingYaos)}</div>
    <div class="card-name-strip">${gua[0]}</div>
    <div class="card-gold-band"></div>
</div>`;
    return card;
}

// ========== 浮尘粒子 ==========
class DustParticles {
    constructor(canvas) {
        this.cv = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.running = false;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    resize() {
        const r = window.devicePixelRatio || 1;
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.cv.width = this.w * r;
        this.cv.height = this.h * r;
        this.cv.style.width = this.w + 'px';
        this.cv.style.height = this.h + 'px';
        this.ctx.setTransform(1,0,0,1,0,0);
        this.ctx.scale(r, r);
    }
    spawn(n) {
        for (let i = 0; i < n; i++) {
            this.particles.push({
                x: Math.random() * this.w,
                y: this.h + Math.random() * 40,
                vx: (Math.random()-0.5) * 0.15,
                vy: -0.15 - Math.random() * 0.35,
                r: 0.6 + Math.random() * 1.6,
                life: 1,
                decay: 0.0006 + Math.random() * 0.0014,
                hue: 38 + Math.random() * 18
            });
        }
    }
    tick() {
        if (!this.running) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.w, this.h);
        if (this.particles.length < 10 && Math.random() < 0.06) this.spawn(1);
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx += (Math.random() - 0.5) * 0.02;
            p.life -= p.decay;
            if (p.life <= 0 || p.y < -30) { this.particles.splice(i, 1); continue; }
            ctx.globalAlpha = p.life * 0.55;
            ctx.fillStyle = `hsl(${p.hue}, 65%, 76%)`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        requestAnimationFrame(() => this.tick());
    }
    start() {
        if (this.running) return;
        this.running = true;
        this.spawn(8);
        this.tick();
    }
    stop() { this.running = false; }
}

// ========== 仪式控制器（六乐章） ==========
class ArcanaRitual {
    constructor(stage, finalGua, hexLines, change) {
        this.stage = stage;
        this.finalGua = finalGua;
        this.hexLines = hexLines;
        this.change = change;
        this.cards = [];
    }
    async run() {
        this.buildStage();
        await this.actAwaken();
        await this.actRiffle();
        await this.actFan();
        await this.actRise();
        await this.actFlip();
        await this.actProclaim();
    }
    buildStage() {
        this.stage.innerHTML = `
<div class="ritual-status" id="ritualStatus"></div>
<div class="deck-area" id="deckArea"></div>`;
        this.statusEl = this.stage.querySelector('#ritualStatus');
        this.deckEl = this.stage.querySelector('#deckArea');
    }
    setStatus(roman, cn) {
        this.statusEl.innerHTML = `${roman}<span class="ritual-status-sub">${cn}</span>`;
        this.statusEl.classList.add('show');
    }
    async actAwaken() {
        this.setStatus('Ⅰ · AWAKENING', '展 台 燃 烛');
        await sleep(900);
    }
    async actRiffle() {
        this.setStatus('Ⅱ · RIFFLE', '洗 牌');
        const pool = this.pickDeckPool(16);
        for (let i = 0; i < 16; i++) {
            const card = makeArcanaCard(pool[i], { large: false });
            card.style.transform = `translate3d(${(Math.random()-0.5)*6}px, ${(Math.random()-0.5)*6}px, ${-i*0.5}px) rotate(${(Math.random()-0.5)*4}deg)`;
            card.style.zIndex = String(i);
            this.deckEl.appendChild(card);
            this.cards.push(card);
        }
        await sleep(200);
        this.cards.forEach((c, i) => {
            setTimeout(() => {
                const side = i % 2 === 0 ? -1 : 1;
                c.style.transition = 'transform 0.45s cubic-bezier(0.4,0,0.2,1)';
                c.style.transform = `translate3d(${side*42}px, ${(Math.random()-0.5)*10}px, ${i*1.5}px) rotate(${side*5}deg)`;
            }, i * 22);
        });
        await sleep(560);
        this.cards.forEach((c, i) => {
            setTimeout(() => {
                c.style.transform = `translate3d(${(Math.random()-0.5)*4}px, ${(Math.random()-0.5)*4}px, ${-i*0.4}px) rotate(${(Math.random()-0.5)*3}deg)`;
            }, i * 12);
        });
        await sleep(450);
    }
    async actFan() {
        this.setStatus('Ⅲ · FAN', '扇 形 摊 开');
        const n = this.cards.length;
        const radius = 200;
        const arc = 150;
        this.cards.forEach((c, i) => {
            const t = n === 1 ? 0.5 : i / (n - 1);
            const angle = -arc/2 + t * arc;
            const rad = angle * Math.PI / 180;
            const x = Math.sin(rad) * radius;
            const y = -Math.cos(rad) * radius * 0.2 + 30;
            setTimeout(() => {
                c.style.transition = 'transform 0.85s cubic-bezier(0.4,0,0.2,1), opacity 0.6s ease, filter 0.6s ease';
                c.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle*0.6}deg)`;
                c.classList.add('awake');
            }, i * 48);
        });
        await sleep(1300);
    }
    async actRise() {
        this.setStatus('Ⅳ · ASCENSION', '浮 升 抽 牌');
        const mid = Math.floor(this.cards.length / 2);
        const chosen = this.cards[mid];
        this.cards.forEach((c, i) => {
            if (i === mid) return;
            c.style.transition = 'transform 1s ease, opacity 1s ease, filter 0.8s ease';
            c.style.opacity = '0.22';
            c.classList.remove('awake');
        });
        await sleep(350);
        const bin = TRIGRAM_TO_BINARY[this.finalGua[2][0]] + TRIGRAM_TO_BINARY[this.finalGua[2][1]];
        const finalCard = makeArcanaCard(this.finalGua, {
            large: true,
            hexLines: this.hexLines,
            changingYaos: this.change.changingYaos,
            rare: isRareGua(bin)
        });
        chosen.innerHTML = finalCard.innerHTML;
        chosen.className = finalCard.className + ' active';
        chosen.style.transition = 'transform 1.1s cubic-bezier(0.3, 0, 0.2, 1), filter 0.8s ease, width 0.6s ease, height 0.6s ease';
        chosen.style.width = '110px';
        chosen.style.height = '188px';
        chosen.style.marginLeft = '-55px';
        chosen.style.marginTop = '-94px';
        chosen.style.transform = 'translate3d(0, -20px, 60px) rotate(0deg) scale(1.15)';
        chosen.style.zIndex = '50';
        this.chosenCard = chosen;
        await sleep(800);
    }
    async actFlip() {
        this.setStatus('Ⅴ · REVELATION', '翻 开 显 影');
        this.chosenCard.classList.add('flipped');
        this.chosenCard.classList.remove('active');
        this.chosenCard.classList.add('peak');
        await sleep(1300);
    }
    async actProclaim() {
        this.setStatus('Ⅵ · PROCLAMATION', '昭 示 归 寂');
        await sleep(600);
        this.cards.forEach((c, i) => {
            if (c === this.chosenCard) return;
            c.style.transition = 'transform 0.8s ease, opacity 0.8s ease';
            c.style.opacity = '0';
            c.style.transform = `translate3d(${(Math.random()-0.5)*40}px, 60px, -200px) rotate(${(Math.random()-0.5)*20}deg)`;
        });
        await sleep(500);
        this.chosenCard.style.transition = 'transform 0.7s ease, opacity 0.7s ease';
        this.chosenCard.style.opacity = '0';
        this.chosenCard.style.transform = 'translate3d(0, -60px, 200px) scale(1.3)';
        this.statusEl.style.transition = 'opacity 0.6s ease';
        this.statusEl.style.opacity = '0';
        await sleep(700);
    }
    pickDeckPool(n) {
        const pool = [];
        const used = new Set();
        for (let i = 0; i < n; i++) {
            let idx, tries = 0;
            do {
                idx = Math.floor(Math.random() * 64);
                tries++;
            } while (used.has(idx) && tries < 24);
            used.add(idx);
            pool.push(GUA[idx]);
        }
        return pool;
    }
}

// ========== 占卜主流程 ==========
async function divine() {
    const question = document.getElementById('question').value.trim();
    const resultArea = document.getElementById('resultArea');
    const btn = document.getElementById('divineBtn');
    const btnText = btn.querySelector('.btn-text');
    const originalText = btnText ? btnText.textContent : '起 卦';

    const settings = loadSettings();

    // 八字起卦需要检查八字数据
    if (settings.method === 'bazi') {
        if (!settings.bazi) {
            alert('请先在设置中填写并保存生辰八字');
            return;
        }
    }

    btn.disabled = true;
    if (btnText) btnText.textContent = '演 卦';

    resultArea.innerHTML = '<div class="ritual-stage" id="ritualStage"></div>';

    const stage = document.getElementById('ritualStage');
    stage.scrollIntoView({ behavior: 'smooth', block: 'center' });

    let hexLines;
    if (settings.method === 'bazi') {
        hexLines = generateHexagramBazi(settings.bazi);
    } else {
        hexLines = generateHexagram();
    }

    const bits = hexLines.map(n => (n === 7 || n === 9) ? '1' : '0');
    const fullBin = bits.slice(3, 6).join('') + bits.slice(0, 3).join('');
    const gua = lookupGua(fullBin);
    const change = calculateChangeGua(hexLines, fullBin);

    const ritual = new ArcanaRitual(stage, gua, hexLines, change);
    await ritual.run();

    renderResult(gua, hexLines, change, question, fullBin);
    saveToHistory(question, gua, fullBin, hexLines, change);

    btn.disabled = false;
    if (btnText) btnText.textContent = originalText;
}

// ========== 结果渲染 ==========
function renderResult(gua, hexLines, change, question, fullBin) {
    const resultArea = document.getElementById('resultArea');
    const yaoNames = ['初九','九二','九三','九四','九五','上九','初六','六二','六三','六四','六五','上六'];
    const roman = toRoman(guaIndex(gua));
    const verdict = getVerdict(gua);
    const verdictText = { ji:'吉', xiong:'凶', ping:'平' };

    const yaoHtml = hexLines.map((line, i) => {
        const isYang = (line === 9 || line === 7);
        const yaoType = line===9?'老阳':line===7?'少阳':line===8?'少阴':'老阴';
        const yaoName = isYang ? yaoNames[i] : yaoNames[i+6];
        const yaoText = gua[3].split('|')[i] || '';
        const isChanging = change.changingYaos.includes(i);
        const lineVis = isYang
            ? '<span class="yao-line yang"><span></span></span>'
            : '<span class="yao-line yin"><span></span><span></span></span>';
        const changeBadge = isChanging ? '<span class="yao-badge change">变</span>' : '';
        return `<div class="yao-item${isChanging?' changing':''}">
<div class="yao-header">${lineVis}<span class="yao-name">${yaoName}</span><span class="yao-badge type">${yaoType}</span>${changeBadge}</div>
<div class="yao-text">${yaoText}</div></div>`;
    }).join('');

    const analysisHtml = gua[4].split('。').filter(s=>s.trim()).map(s =>
        `<div class="analysis-item">${s.trim()}。</div>`
    ).join('');

    let changeHtml = '';
    if (change.hasChange) {
        const pos = change.changingYaos.map(p => ['初','二','三','四','五','上'][p]);
        changeHtml = `<section class="card change-section"><h3>变 · 卦 · 演 化</h3>
<div class="change-comparison">
<div class="gua-box"><div class="gua-label">BEN · 本</div><div class="gua-symbol">${gua[2]}</div><div class="gua-name">${gua[0]}</div></div>
<div class="change-arrow">⟶</div>
<div class="gua-box changed"><div class="gua-label">BIAN · 变</div><div class="gua-symbol">${change.changeGua[2]}</div><div class="gua-name">${change.changeGua[0]}</div></div>
</div>
<div class="change-details"><p>变爻位置：第 ${pos.join('、')} 爻</p><p>${change.changeGua[4]}</p></div></section>`;
    }

    resultArea.innerHTML = `
<section class="card result-header">
    <div class="chosen-card-wrap" id="chosenCardWrap"></div>
    <div class="hex-roman">${roman}</div>
    <h2 class="hex-name hex-name-art">${gua[0]}</h2>
    <div class="hex-title">${gua[1]}</div>
    <div class="hex-symbol" style="display:none;">${gua[2]}</div>
    ${question ? `<p class="hex-question">「${question}」</p>` : ''}
    <div class="verdict-seal ${verdict}">${verdictText[verdict]}</div>
    <div class="share-row"><button class="btn-share" onclick="shareAsImage()">✦ 生 成 分 享 图</button></div>
</section>
<section class="card"><h3>六 爻 之 辞</h3><div class="yao-list">${yaoHtml}</div></section>
<section class="card"><h3>卦 象 奥 义</h3><div class="analysis-list">${analysisHtml}</div></section>
${changeHtml}`;

    const wrap = resultArea.querySelector('#chosenCardWrap');
    const bigCard = makeArcanaCard(gua, {
        large: true,
        hexLines,
        changingYaos: change.changingYaos,
        rare: isRareGua(fullBin)
    });
    bigCard.classList.add('flipped');
    wrap.appendChild(bigCard);

    const cards = resultArea.querySelectorAll('.card');
    cards.forEach((el, i) => {
        el.style.opacity='0'; el.style.transform='translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
            el.style.opacity='1'; el.style.transform='translateY(0)';
        }, 200 + i*180);
    });
    setTimeout(() => {
        resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
}

// ========== 分享卡 ==========
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
    r.querySelectorAll('.yao-item.changing').forEach(el => {
        const n = el.querySelector('.yao-name');
        const t = el.querySelector('.yao-text');
        if (n && t) changingYaoTexts.push(n.textContent + '：' + t.textContent);
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
        analysisList: list, changingYaoTexts, hasChange, cgName, cgSymbol, cgExplain, changePos,
        date: new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })
    };
}

function createShareCard(d) {
    if (!d) return '';
    const guaEntry = GUA.find(g => g[0] === d.name);
    const roman = guaEntry ? toRoman(guaIndex(guaEntry)) : '';

    const analysis = d.analysisList.map(t =>
        '<div style="margin-bottom:10px;padding-left:14px;border-left:2px solid #c9a96e;font-size:14px;line-height:1.8;color:#1a1412;font-family:serif;">' + t + '</div>'
    ).join('');

    const yaoBlock = d.changingYaoTexts.length > 0 ?
        '<div style="margin-top:16px;padding:14px;background:rgba(168,72,72,0.06);border:1px solid rgba(168,72,72,0.2);border-radius:4px;">' +
            '<div style="font-size:12px;color:#a84848;margin-bottom:8px;font-weight:bold;letter-spacing:3px;">变 爻 提 示</div>' +
            d.changingYaoTexts.map(t =>
                '<div style="font-size:13px;line-height:1.7;color:#1a1412;margin-bottom:4px;">' + t + '</div>'
            ).join('') +
        '</div>' : '';

    const changeBlock = d.hasChange ?
        '<div style="margin-top:16px;padding:18px;background:rgba(168,72,72,0.06);border:1px solid rgba(168,72,72,0.2);border-radius:4px;">' +
            '<div style="font-size:12px;color:#a84848;font-weight:bold;margin-bottom:12px;letter-spacing:3px;text-align:center;">变 卦 演 化</div>' +
            '<div style="display:flex;align-items:center;justify-content:center;gap:20px;margin-bottom:12px;">' +
                '<div style="text-align:center;padding:10px 14px;border:1px solid #8a6d3a;border-radius:3px;">' +
                    '<div style="font-size:28px;color:#1a1412;">' + d.symbol + '</div>' +
                    '<div style="font-size:12px;color:#8a6d3a;margin-top:4px;letter-spacing:2px;">' + d.name + '</div>' +
                '</div>' +
                '<div style="font-size:18px;color:#8a6d3a;">⟶</div>' +
                '<div style="text-align:center;padding:10px 14px;border:1px solid #a84848;border-radius:3px;background:rgba(168,72,72,0.06);">' +
                    '<div style="font-size:28px;color:#a84848;">' + d.cgSymbol + '</div>' +
                    '<div style="font-size:12px;color:#a84848;margin-top:4px;letter-spacing:2px;">' + d.cgName + '</div>' +
                '</div>' +
            '</div>' +
            (d.changePos ? '<div style="font-size:12px;color:#8a6d3a;text-align:center;margin-bottom:8px;letter-spacing:2px;">' + d.changePos + '</div>' : '') +
            (d.cgExplain ? '<div style="font-size:13px;line-height:1.8;color:#1a1412;">' + d.cgExplain + '</div>' : '') +
        '</div>' : '';

    return '<div id="shareCard" style="width:500px;background:linear-gradient(180deg,#e8dcc0 0%,#d9c99f 100%);color:#1a1412;padding:36px 32px;font-family:\'Noto Serif SC\',serif;position:relative;border:1px solid #c9a96e;box-shadow:inset 0 0 0 6px rgba(232,220,192,0.4),inset 0 0 0 7px rgba(201,169,110,0.35);">' +
        '<div style="position:absolute;inset:12px;border:1px solid rgba(138,109,58,0.25);pointer-events:none;"></div>' +
        '<div style="text-align:center;font-family:\'Cinzel\',serif;font-size:11px;color:#8a6d3a;letter-spacing:6px;margin-bottom:4px;">EASTERN · ARCANA</div>' +
        '<div style="text-align:center;font-size:14px;color:#8a6d3a;letter-spacing:10px;padding-left:10px;">天 衍</div>' +
        '<div style="height:1px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);margin:16px 0;"></div>' +
        '<div style="text-align:center;padding:16px 0;">' +
            (roman ? '<div style="font-family:\'Cinzel\',serif;font-size:16px;color:#8a6d3a;letter-spacing:6px;margin-bottom:8px;">' + roman + '</div>' : '') +
            '<div style="font-size:56px;line-height:1;color:#1a1412;letter-spacing:4px;">' + d.symbol + '</div>' +
            '<div style="font-size:26px;margin-top:14px;letter-spacing:8px;color:#1a1412;padding-left:8px;">' + d.name + '</div>' +
            '<div style="font-size:15px;color:#8a6d3a;margin-top:8px;letter-spacing:3px;">' + d.title + '</div>' +
        '</div>' +
        '<div style="height:1px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);margin:12px 0 18px;"></div>' +
        (d.question ? '<div style="text-align:center;margin-bottom:16px;font-size:14px;color:#4a1628;letter-spacing:2px;padding:8px 12px;border-top:1px dashed rgba(138,109,58,0.3);border-bottom:1px dashed rgba(138,109,58,0.3);">所 问 · ' + d.question + '</div>' : '') +
        '<div style="padding:16px 18px;background:rgba(255,255,255,0.3);border-radius:3px;">' + analysis + '</div>' +
        yaoBlock +
        changeBlock +
        '<div style="margin-top:24px;padding-top:14px;border-top:1px solid rgba(138,109,58,0.3);display:flex;justify-content:space-between;font-size:11px;color:#8a6d3a;letter-spacing:1px;">' +
            '<span>' + d.date + '</span><span>天 衍 · EASTERN ARCANA</span>' +
        '</div>' +
    '</div>';
}

async function shareAsImage() {
    const container = document.getElementById('shareImageContainer');
    const preview = document.getElementById('shareImagePreview');
    const data = getCurrentGuaData();
    if (!data) { alert('请先占卜'); return; }
    preview.innerHTML = '<div style="padding:30px;text-align:center;color:#8a6d3a;">生成中…</div>';
    container.classList.add('show');
    try {
        const tmp = document.createElement('div');
        tmp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:560px;';
        tmp.innerHTML = createShareCard(data);
        document.body.appendChild(tmp);
        await sleep(300);
        const card = tmp.querySelector('#shareCard');
        const canvas = await html2canvas(card, { backgroundColor: null, scale: 3, logging: false });
        document.body.removeChild(tmp);
        const url = canvas.toDataURL('image/png', 1.0);
        preview.innerHTML = '<img src="' + url + '" alt="分享图" style="max-width:100%;border-radius:4px;border:1px solid #c9a96e;box-shadow:0 8px 24px rgba(0,0,0,0.3);">';
        document.getElementById('shareDownloadBtn').onclick = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = '天衍_Arcana_' + Date.now() + '.png';
            a.click();
        };
        document.getElementById('shareCopyBtn').onclick = () => {
            try {
                canvas.toBlob(async blob => {
                    await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
                    alert('已复制到剪贴板');
                });
            } catch(e) { alert('复制失败，请下载图片'); }
        };
    } catch(e) {
        preview.innerHTML = '<div style="padding:20px;color:#a84848;">生成失败</div>';
    }
}

function closeShare() {
    document.getElementById('shareImageContainer').classList.remove('show');
}

// ========== 历史（牌册） ==========
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
    const overlay = document.getElementById('historyOverlay');
    panel.classList.toggle('show');
    overlay.classList.toggle('show');
    if (panel.classList.contains('show')) loadHistory();
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('divinationHistory') || '[]');
    const list = document.getElementById('historyList');
    if (history.length === 0) {
        list.innerHTML = '<p class="history-empty">尚 无 记 录</p>';
        return;
    }
    list.innerHTML = history.map((item, idx) => {
        const guaEntry = item.binary ? lookupGua(item.binary) : null;
        const roman = guaEntry ? toRoman(guaIndex(guaEntry)) : '';
        return `<div class="history-item" onclick="loadHistoryItem(${idx})">
<div class="history-q">${item.question}</div>
<div class="history-gua">${roman ? `<span style="font-family:'Cinzel',serif;margin-right:6px;">${roman}</span>` : ''}${item.symbol} ${item.gua}${item.hasChange ? ' <span class="history-tag">变</span>' : ''}</div>
<div class="history-date">${item.date}</div>
</div>`;
    }).join('');
}

function loadHistoryItem(index) {
    const history = JSON.parse(localStorage.getItem('divinationHistory') || '[]');
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

function clearHistory() {
    if (confirm('确 定 清 空 牌 册？')) {
        localStorage.removeItem('divinationHistory');
        loadHistory();
    }
}

// ========== 每日一卦 ==========
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
    const roman = toRoman(guaIndex(gua));
    el.innerHTML = `
<div class="daily-label">DAILY · ARCANUM · 今 日 启 示</div>
<div class="daily-content">
    <span class="daily-roman">${roman}</span>
    <span class="daily-symbol">${gua[2]}</span>
    <span class="daily-name">${gua[0]}</span>
    <span class="daily-divider">·</span>
    <span class="daily-motto">${motto}</span>
</div>`;
    el.onclick = () => showGuaDetail(getDailyGua());
}

// ========== 卦象详解 ==========
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
            <div style="font-family:'Cinzel',serif;color:#8a6d3a;font-size:0.85rem;letter-spacing:0.4em;margin-bottom:2px;">${roman}</div>
            <h2>${gua[0]}</h2>
            <div class="detail-sub">${gua[1]}</div>
        </div>
        <button class="detail-close" id="detailCloseBtn">×</button>
    </div>
    <div class="detail-meta">上卦 ${upper} · 下卦 ${lower}</div>
    <div class="detail-section"><h3>爻 辞</h3>${yaoHtml}</div>
    <div class="detail-section"><h3>卦 象 解 读</h3><div class="detail-analysis">${analysis}</div></div>
</div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    overlay.querySelector('#detailCloseBtn').addEventListener('click', () => overlay.remove());
    requestAnimationFrame(() => overlay.classList.add('show'));
}

function getTrigramName(sym) {
    const map = {'☰':'乾(天)','☱':'兑(泽)','☲':'离(火)','☳':'震(雷)','☴':'巽(风)','☵':'坎(水)','☶':'艮(山)','☷':'坤(地)'};
    return map[sym] || sym;
}

// ========== 时辰彩蛋 ==========
function applyHourTheme() {
    const h = new Date().getHours();
    document.body.classList.remove('hour-zi', 'hour-wu');
    if (h >= 23 || h < 1) document.body.classList.add('hour-zi');
    else if (h >= 11 && h < 13) document.body.classList.add('hour-wu');
}

// ========== 设置系统 ==========
const DEFAULT_SETTINGS = {
    method: 'coin',
    showDaily: true,
    showCandle: true,
    bazi: null // { year, month, day, hour }
};

function loadSettings() {
    try {
        const raw = localStorage.getItem('tianyan_settings');
        if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch(e) {}
    return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
    localStorage.setItem('tianyan_settings', JSON.stringify(settings));
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
        status.textContent = '年份范围：1900-2100';
        status.className = 'bazi-status error';
        return;
    }
    if (day < 1 || day > 31) {
        status.textContent = '日期范围：1-31';
        status.className = 'bazi-status error';
        return;
    }

    const bazi = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour) };
    const settings = loadSettings();
    settings.bazi = bazi;
    saveSettings(settings);

    const shiChen = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    status.textContent = `已保存：${year}年${month}月${day}日 ${shiChen[hour]}时`;
    status.className = 'bazi-status success';
}

function applySettings(settings) {
    // 每日启示
    const dailyEl = document.getElementById('dailyGua');
    if (dailyEl) dailyEl.style.display = settings.showDaily ? '' : 'none';

    // 蜡烛
    document.querySelectorAll('.candle').forEach(c => {
        c.style.display = settings.showCandle ? '' : 'none';
    });
}

function restoreSettingsUI() {
    const settings = loadSettings();

    const methodEl = document.getElementById('settingMethod');
    if (methodEl) methodEl.value = settings.method;

    const dailyEl = document.getElementById('settingDaily');
    if (dailyEl) dailyEl.checked = settings.showDaily;

    const candleEl = document.getElementById('settingCandle');
    if (candleEl) candleEl.checked = settings.showCandle;

    // 恢复八字
    if (settings.bazi) {
        const b = settings.bazi;
        document.getElementById('baziYear').value = b.year || '';
        document.getElementById('baziMonth').value = b.month || '';
        document.getElementById('baziDay').value = b.day || '';
        document.getElementById('baziHour').value = b.hour !== undefined ? b.hour : '';
        const shiChen = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
        const status = document.getElementById('baziStatus');
        if (status) {
            status.textContent = `当前：${b.year}年${b.month}月${b.day}日 ${shiChen[b.hour]}时`;
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

// ========== 八字起卦算法 ==========
function generateHexagramBazi(bazi) {
    // 梅花易数·八字起卦法
    // 结合生辰八字 + 当前时间，使每次占卜结果不同
    const now = new Date();
    const nowDay = now.getDate();
    const nowHour = Math.floor(((now.getHours() + 1) % 24) / 2); // 当前时辰 0-11
    const nowMin = now.getMinutes();

    // 上卦 = (出生年尾数 + 出生月 + 出生日 + 当前日) % 8
    // 下卦 = (上卦数 + 出生时辰 + 当前时辰) % 8
    // 动爻 = (出生年尾数 + 出生月 + 出生日 + 出生时辰 + 当前时分总和) % 6
    const yearNum = bazi.year % 100 || 100;
    const sumUpper = yearNum + bazi.month + bazi.day + nowDay;
    const sumLower = sumUpper + (bazi.hour + 1) + (nowHour + 1);
    const sumYao = yearNum + bazi.month + bazi.day + (bazi.hour + 1) + nowHour + nowMin;

    const upperIdx = ((sumUpper - 1) % 8 + 8) % 8; // 0-7
    const lowerIdx = ((sumLower - 1) % 8 + 8) % 8;
    const changingYao = ((sumYao - 1) % 6 + 6) % 6; // 0-5 动爻位置

    // 先天八卦数：乾1兑2离3震4巽5坎6艮7坤8
    const xiantianOrder = ['☰','☱','☲','☳','☴','☵','☶','☷'];
    const upperTri = xiantianOrder[upperIdx];
    const lowerTri = xiantianOrder[lowerIdx];

    // 构建六爻，动爻位置设为老阳(9)或老阴(6)
    const upperBin = TRIGRAM_TO_BINARY[upperTri];
    const lowerBin = TRIGRAM_TO_BINARY[lowerTri];

    const lines = [];
    for (let i = 0; i < 3; i++) {
        lines.push(lowerBin[2-i] === '1' ? 7 : 8);
    }
    for (let i = 0; i < 3; i++) {
        lines.push(upperBin[2-i] === '1' ? 7 : 8);
    }

    // 动爻变化
    if (lines[changingYao] === 7) lines[changingYao] = 9;
    else lines[changingYao] = 6;

    return lines;
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    applyHourTheme();
    const dustCanvas = document.querySelector('.dust-layer');
    if (dustCanvas) {
        const dust = new DustParticles(dustCanvas);
        dust.start();
    }
    loadHistory();
    renderDailyGua();
    restoreSettingsUI();
    const sc = document.getElementById('shareImageContainer');
    if (sc) sc.addEventListener('click', e => { if (e.target === sc) closeShare(); });

    // 每小时检查时辰彩蛋
    setInterval(applyHourTheme, 60 * 1000);
});
