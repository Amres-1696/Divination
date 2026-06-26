
const DECK_POOL_SIZE_DESKTOP = 13;
const DECK_POOL_SIZE_MOBILE = 9;
const DECK_POOL_SIZE = (window.innerWidth <= 768) ? DECK_POOL_SIZE_MOBILE : DECK_POOL_SIZE_DESKTOP;
const HISTORY_MAX = 50;
const COIN_TO_LINE = { 3: 9, 2: 8, 1: 7, 0: 6 }; // 铜钱法：3阳=老阳9, 2阳=少阴8, 1阳=少阳7, 0阳=老阴6

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
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function haptic(ms) { if (navigator.vibrate) navigator.vibrate(ms || 15); }

// ========== Toast / Confirm 组件 ==========
function showToast(msg, type) {
    type = type || 'info'; // 'info' | 'success' | 'error'
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

// ========== 工具 ==========
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

    return VERDICT_MAP[gua[0]] || 'ping';
}
function binToHexLines(bin) {
    const hex = [];
    for (let i = 0; i < 6; i++) hex.push(bin[5-i] === '1' ? 7 : 8);
    return hex;
}


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
        const drawDelay = i * 120;
        const styleAttr = isChanging
            ? ` style="animation-delay:${drawDelay}ms,${drawDelay + 800}ms"`
            : ` style="animation-delay:${drawDelay}ms"`;
        if (isYang) {
            parts.push(`<line class="${cls}"${styleAttr} x1="${cx-halfW}" y1="${y}" x2="${cx+halfW}" y2="${y}" />`);
        } else {
            parts.push(`<line class="${cls}"${styleAttr} x1="${cx-halfW}" y1="${y}" x2="${cx-5}" y2="${y}" />`);
            parts.push(`<line class="${cls}"${styleAttr} x1="${cx+5}" y1="${y}" x2="${cx+halfW}" y2="${y}" />`);
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

class DustParticles {
    constructor(canvas) {
        this.cv = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.running = false;
        this.fireflyTimer = null;
        this._rafId = null;
        this._resizeTimer = null;
        this.resize();
        window.addEventListener('resize', () => {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => this.resize(), 200);
        });
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
    spawnFirefly() {
        this.particles.push({
            x: Math.random() * this.w,
            y: this.h * (0.45 + Math.random() * 0.5), // 下半屏出生
            vx: (Math.random() - 0.5) * 0.15,
            vy: -0.04 - Math.random() * 0.08,        
            r: 1.6 + Math.random() * 1.3,
            life: 1,
            decay: 0.00012 + Math.random() * 0.00018, // 6–10s 寿命
            hue: 40 + Math.random() * 10,
            pulsePhase: Math.random() * Math.PI * 2,
            pulseSpeed: 0.025 + Math.random() * 0.02,
            isFirefly: true
        });
    }
    scheduleFirefly() {
        if (!this.running) return;
        const delay = 9000 + Math.random() * 11000; // 9–20s
        this.fireflyTimer = setTimeout(() => {
            if (this.running) {
                this.spawnFirefly();
                this.scheduleFirefly();
            }
        }, delay);
    }
    tick() {
        if (!this.running) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.w, this.h);
        let dustCount = 0;
        for (let k = 0; k < this.particles.length; k++) if (!this.particles[k].isFirefly) dustCount++;
        if (dustCount < 10 && Math.random() < 0.06) this.spawn(1);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx += (Math.random() - 0.5) * (p.isFirefly ? 0.008 : 0.02);
            p.life -= p.decay;
            if (p.life <= 0 || p.y < -30) {
                this.particles[i] = this.particles[this.particles.length - 1];
                this.particles.pop();
                continue;
            }

            if (p.isFirefly) {
                p.pulsePhase += p.pulseSpeed;
                const pulse = 0.55 + 0.45 * Math.sin(p.pulsePhase);
                const fade = p.life > 0.75 ? (1 - p.life) / 0.25 : Math.min(1, p.life / 0.25);
                const a = pulse * fade;
                const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
                g.addColorStop(0,    `hsla(${p.hue}, 95%, 88%, ${a * 0.9})`);
                g.addColorStop(0.3,  `hsla(${p.hue}, 90%, 72%, ${a * 0.45})`);
                g.addColorStop(1,    `hsla(${p.hue}, 80%, 60%, 0)`);
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = a;
                ctx.fillStyle = `hsl(${p.hue}, 98%, 90%)`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.globalAlpha = p.life * 0.55;
                ctx.fillStyle = `hsl(${p.hue}, 65%, 76%)`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
        // 用 setTimeout 30fps 限帧，避免空跑 rAF 回调
        this._rafId = setTimeout(() => requestAnimationFrame(() => this.tick()), 33);
    }
    start() {
        if (this.running) return;
        this.running = true;
        this.spawn(8);
        this.tick();
        setTimeout(() => { if (this.running) this.spawnFirefly(); }, 4000);
        this.scheduleFirefly();
    }
    stop() {
        this.running = false;
        if (this._rafId) { clearTimeout(this._rafId); this._rafId = null; }
        if (this.fireflyTimer) { clearTimeout(this.fireflyTimer); this.fireflyTimer = null; }
    }
    pause() {
        this.running = false;
        if (this._rafId) { clearTimeout(this._rafId); this._rafId = null; }
        if (this.fireflyTimer) { clearTimeout(this.fireflyTimer); this.fireflyTimer = null; }
    }
    resume() {
        if (this.running) return;
        this.running = true;
        this.tick();
        this.scheduleFirefly();
    }
}


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
        await this.actChoose();
        await this.actRise();
        await this.actFlip();
        await this.actProclaim();
    }
    buildStage() {
        this.stage.innerHTML = `
<div class="ritual-status" id="ritualStatus"></div>
<div class="deck-area" id="deckArea"></div>
<button type="button" class="ritual-skip" id="ritualSkip">跳过仪式 ›</button>`;
        this.statusEl = this.stage.querySelector('#ritualStatus');
        this.deckEl = this.stage.querySelector('#deckArea');
        const skipBtn = this.stage.querySelector('#ritualSkip');
        if (skipBtn) skipBtn.addEventListener('click', () => { if (this._onSkip) this._onSkip(); });
    }
    setStatus(roman, cn) {
        this.statusEl.innerHTML = `${roman}<span class="ritual-status-sub">${cn}</span>`;
        this.statusEl.classList.add('show');
    }
    async actAwaken() {
        this.setStatus('Ⅰ · AWAKENING', '展台燃烛');
        await sleep(1200);
    }
    async actRiffle() {
        this.setStatus('Ⅱ · RIFFLE', '洗牌');
        const pool = this.pickDeckPool(DECK_POOL_SIZE);
        for (let i = 0; i < DECK_POOL_SIZE; i++) {
            const card = makeArcanaCard(pool[i], { large: false });
            card.style.transform = `translate3d(${(Math.random()-0.5)*6}px, ${(Math.random()-0.5)*6}px, ${-i*0.5}px) rotate(${(Math.random()-0.5)*4}deg)`;
            card.style.zIndex = String(i);
            this.deckEl.appendChild(card);
            this.cards.push(card);
        }
        await sleep(280);
        this.cards.forEach((c, i) => {
            setTimeout(() => {
                const side = i % 2 === 0 ? -1 : 1;
                c.style.transition = 'transform 0.6s cubic-bezier(0.4,0,0.2,1)';
                c.style.transform = `translate3d(${side*42}px, ${(Math.random()-0.5)*10}px, ${i*1.5}px) rotate(${side*5}deg)`;
            }, i * 28);
        });
        await sleep(750);
        this.cards.forEach((c, i) => {
            setTimeout(() => {
                c.style.transform = `translate3d(${(Math.random()-0.5)*4}px, ${(Math.random()-0.5)*4}px, ${-i*0.4}px) rotate(${(Math.random()-0.5)*3}deg)`;
            }, i * 16);
        });
        await sleep(600);
    }
    async actFan() {
        this.setStatus('Ⅲ · FAN', '扇形摊开');
        const n = this.cards.length;
        const isMob = window.innerWidth <= 768;
        const radius = isMob ? 180 : 240;
        const arc = isMob ? 140 : 110;     // 移动端加大弧度，牌间距更明显
        const rotMul = isMob ? 0.5 : 0.4;
        const center = (n - 1) / 2;
        this.cards.forEach((c, i) => {
            const t = n === 1 ? 0.5 : i / (n - 1);
            const angle = -arc/2 + t * arc;
            const rad = angle * Math.PI / 180;
            const x = Math.sin(rad) * radius;
            const y = -Math.cos(rad) * radius * 0.18 + 20;
            const rot = angle * rotMul;
            // z-index 围绕中心层叠：中央卡顶层、向两侧渐次后退
            const z = 40 - Math.round(Math.abs(i - center));
            // 存储扇形位置供选牌阶段使用
            c._fanX = x;
            c._fanY = y;
            c._fanRot = rot;
            c._fanZ = z;
            setTimeout(() => {
                c.style.transition = 'transform 1.05s cubic-bezier(0.4,0,0.2,1), opacity 0.8s ease, filter 0.8s ease';
                c.style.setProperty('--fan-x', x + 'px');
                c.style.setProperty('--fan-y', y + 'px');
                c.style.setProperty('--fan-rot', rot + 'deg');
                c.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`;
                c.style.zIndex = String(z);
                c.classList.add('awake');
            }, i * 45);
        });
        await sleep(1700);
    }
    async actChoose() {
        this.setStatus('CHOOSE · 心选一卦', '凝神择牌 · 轻触预览');
        const randomIdx = () => Math.floor(Math.random() * this.cards.length);

        // 「由天意定之」：从容的出口，不读秒、不催促
        const fateBtn = document.createElement('button');
        fateBtn.type = 'button';
        fateBtn.className = 'choose-fate-btn';
        fateBtn.textContent = '由天意定之';
        this.deckEl.appendChild(fateBtn);

        return new Promise(resolve => {
            let resolved = false;
            let candidateIndex = -1;

            const liftCard = (card) => {
                card.style.zIndex = '100';
                card.style.transition = 'transform 0.22s ease, filter 0.22s ease';
                card.style.transform = `translate3d(${card._fanX}px, ${card._fanY - 20}px, 0) rotate(${card._fanRot}deg) scale(1.08)`;
                card.style.filter = 'drop-shadow(0 8px 20px rgba(201,169,110,0.5))';
                card.classList.add('candidate');
            };
            const dropCard = (card) => {
                card.style.zIndex = String(card._fanZ);
                card.style.transition = 'transform 0.22s ease, filter 0.22s ease';
                card.style.transform = `translate3d(${card._fanX}px, ${card._fanY}px, 0) rotate(${card._fanRot}deg)`;
                card.style.filter = '';
                card.classList.remove('candidate');
            };

            const cleanup = () => {
                fateBtn.remove();
                this.cards.forEach(c => {
                    c.classList.remove('selectable', 'candidate');
                    c.style.cursor = '';
                    if (c._chooseHandler) {
                        c.removeEventListener('click', c._chooseHandler);
                        delete c._chooseHandler;
                    }
                });
            };
            const settle = (idx) => {
                if (resolved) return;
                resolved = true;
                this.chosenIndex = idx;
                cleanup();
                resolve();
            };

            // 两段式（桌面 / 移动一致）：点击成为候选（上浮预览），再次点击同一张落定
            // 避免桌面端「悬停即选、误触即定终身」
            this.cards.forEach((c, i) => {
                c.classList.add('selectable');
                c.style.cursor = 'pointer';
                const handler = () => {
                    if (candidateIndex === i) {
                        haptic(15);
                        settle(i);
                    } else {
                        if (candidateIndex >= 0 && this.cards[candidateIndex]) dropCard(this.cards[candidateIndex]);
                        haptic(8);
                        candidateIndex = i;
                        liftCard(c);
                        this.setStatus('CHOOSE · 心选一卦', '再触此卦 · 落定');
                    }
                };
                c._chooseHandler = handler;
                c.addEventListener('click', handler);
            });

            fateBtn.addEventListener('click', () => { haptic(12); settle(randomIdx()); });
        });
    }
    async actRise() {
        this.setStatus('Ⅳ · ASCENSION', '浮升抽牌');
        const mid = (typeof this.chosenIndex === 'number')
            ? this.chosenIndex
            : Math.floor(this.cards.length / 2);
        const chosen = this.cards[mid];
        this.cards.forEach((c, i) => {
            if (i === mid) return;
            c.style.transition = 'transform 1.3s ease, opacity 1.3s ease, filter 1s ease';
            c.style.opacity = '0.22';
            c.classList.remove('awake');
        });
        await sleep(450);
        const bin = TRIGRAM_TO_BINARY[this.finalGua[2][0]] + TRIGRAM_TO_BINARY[this.finalGua[2][1]];
        const finalCard = makeArcanaCard(this.finalGua, {
            large: true,
            hexLines: this.hexLines,
            changingYaos: this.change.changingYaos,
            rare: isRareGua(bin)
        });
        chosen.innerHTML = finalCard.innerHTML;
        chosen.className = finalCard.className + ' active';
        chosen.style.transition = 'transform 1.4s cubic-bezier(0.3, 0, 0.2, 1), filter 1s ease, width 0.8s ease, height 0.8s ease';
        chosen.style.width = '110px';
        chosen.style.height = '188px';
        chosen.style.marginLeft = '-55px';
        chosen.style.marginTop = '-94px';
        chosen.style.transform = 'translate3d(0, -20px, 60px) rotate(0deg) scale(1.15)';
        chosen.style.zIndex = '50';
        this.chosenCard = chosen;
        await sleep(1050);
    }
    async actFlip() {
        this.setStatus('Ⅴ · REVELATION', '翻开显影');
        // 屏息时刻：暴风雨前的宁静（章节 2.5.1）
        const flames = document.querySelectorAll('.candle .flame, .candle .flame-inner, .candle .flame-halo');
        this.chosenCard.style.transition = 'transform 0.65s ease, filter 0.65s ease';
        this.chosenCard.style.transform = 'translate3d(0, -10px, 60px) rotate(0deg) scale(1.10)';
        this.chosenCard.style.filter = 'drop-shadow(0 0 6px rgba(244,196,122,0.4))';
        flames.forEach(f => {
            f._origTransform = f.style.transform;
            f.style.transition = 'transform 0.65s ease, opacity 0.65s ease';
            f.style.transform = 'scale(0.7)';
            f.style.opacity = '0.6';
        });
        await sleep(800);
        flames.forEach(f => {
            f.style.transform = f._origTransform || '';
            f.style.opacity = '';
            // 让原 keyframe 动画接管
            setTimeout(() => { f.style.transition = ''; }, 700);
        });
        this.chosenCard.style.transform = 'translate3d(0, -20px, 60px) rotate(0deg) scale(1.15)';
        this.chosenCard.style.filter = '';
        haptic(25);
        this.chosenCard.classList.add('flipped');
        this.chosenCard.classList.remove('active');
        this.chosenCard.classList.add('peak');
        await sleep(800);
        this.chosenCard.classList.add('yao-animate');
        await sleep(900);
    }
    async actProclaim() {
        this.setStatus('Ⅵ · PROCLAMATION', '昭示归寂');
        await sleep(800);
        this.cards.forEach((c, i) => {
            if (c === this.chosenCard) return;
            c.style.transition = 'transform 1s ease, opacity 1s ease';
            c.style.opacity = '0';
            c.style.transform = `translate3d(${(Math.random()-0.5)*40}px, 60px, -200px) rotate(${(Math.random()-0.5)*20}deg)`;
        });
        await sleep(700);
        this.statusEl.style.transition = 'opacity 0.8s ease';
        this.statusEl.style.opacity = '0';
        await sleep(550);
    }
    pickDeckPool(n) {
        const indices = Array.from({ length: 64 }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        return indices.slice(0, n).map(idx => GUA[idx]);
    }
}

// 占卜主流程 
async function showInvocation() {
    const inv = document.createElement('div');
    inv.className = 'invocation';
    inv.innerHTML = '<span>心若不诚 · 卦不应人</span>';
    document.body.appendChild(inv);
    await sleep(1500);
    inv.classList.add('fade-out');
    await sleep(400);
    inv.remove();
}

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

    // 八字起卦需要检查八字数据
    if (settings.method === 'bazi' && !settings.bazi) {
        showToast('请先在设置中填写并保存生辰八字', 'error');
        _divineRunning = false;
        return;
    }

    btn.disabled = true;
    if (btnText) btnText.textContent = '演卦';

    try {
        triggerIgnitionChain();
        // 心若不诚 · 卦不应人（章节 5.2）
        await showInvocation();

        resultArea.innerHTML = '<div class="ritual-stage" id="ritualStage"></div>';

        const stage = document.getElementById('ritualStage');
        stage.scrollIntoView({ behavior: 'smooth', block: 'center' });

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
            const ritual = new ArcanaRitual(stage, gua, hexLines, change);
            // 仪式与「跳过」信号竞速：点跳过即直奔结果，不触碰内部动画时序
            let skipped = false;
            const skipPromise = new Promise(res => { ritual._onSkip = () => { skipped = true; res(); }; });
            await Promise.race([ritual.run(), skipPromise]);
            chosenCard = skipped ? null : ritual.chosenCard;
        }

        renderResult(gua, hexLines, change, question, fullBin, chosenCard);
        saveToHistory(question, gua, fullBin, hexLines, change);
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

/* ============ AI 解卦 ============ */
const AI_METHOD_LABEL = { coin: '铜钱法（三枚铜钱）', bazi: '八字起卦（生辰八字）' };

function buildAiContext(gua, change, question) {
    const posCN = ['初', '二', '三', '四', '五', '上'];
    const settings = loadSettings();
    const changing = change.changingYaos || [];
    const changePos = changing.length
        ? changing.map(p => posCN[p]).join('、') + ' 爻动'
        : '静卦无变';
    // 主断之爻：复用既有取爻规则，只给 AI 主断指向的那一爻，而非六爻全丢
    const main = getMainReading(gua, change);
    const bianGua = (change.hasChange && change.changeGua)
        ? `${change.changeGua[0]}（${change.changeGua[1]}）`
        : '无（静卦）';
    return {
        question: (question && question.trim()) ? question.trim() : '未具问，泛问吉凶',
        time: new Date().toLocaleString('zh-CN'),
        method: AI_METHOD_LABEL[settings.method] || settings.method,
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

// 解读完成后写回最近一条匹配的牌册记录（按卦名+变卦+所问匹配，避免误写他条）
function persistAiReading(reading, gua, change, question) {
    const settings = loadSettings();
    if (!settings.ai || !settings.ai.saveToHistory) return;
    try {
        const history = readHistorySafe();
        const q = question || '心中所念';
        const idx = history.findIndex(h =>
            h.gua === gua[0] &&
            (h.changeBinary || '') === (change.changeBinary || '') &&
            (h.question || '心中所念') === q
        );
        if (idx !== -1) {
            history[idx].aiReading = reading;
            localStorage.setItem('divinationHistory', JSON.stringify(history.slice(0, HISTORY_MAX)));
        }
    } catch (e) {}
}

async function requestAiReading(gua, change, question, bodyEl) {
    const ai = loadSettings().ai || {};
    if (!ai.baseUrl || !ai.apiKey || !ai.model) {
        bodyEl.innerHTML = '<div class="ai-error">请先在「设置 · AI 解卦」中填写完整配置（接口地址 / API Key / 模型）。</div>';
        return;
    }

    const prompt = fillPrompt(ai.prompt || DEFAULT_AI_PROMPT, buildAiContext(gua, change, question));
    bodyEl.innerHTML = '<div class="ai-loading"><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span><span class="ai-loading-text">正在叩问天机…</span></div>';

    const url = ai.baseUrl.replace(/\/+$/, '') + '/chat/completions';
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
        bodyEl.innerHTML = `<div class="ai-error">${escHtml(msg)}</div><button class="btn-ai-run" id="aiRetryBtn"><span class="btn-rune">↺</span> 重试</button>`;
        const rb = bodyEl.querySelector('#aiRetryBtn');
        if (rb) rb.addEventListener('click', () => {
            requestAiReading(gua, change, question, bodyEl).then(t => { if (t) persistAiReading(t, gua, change, question); });
        });
    };

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ai.apiKey },
            body: JSON.stringify({
                model: ai.model,
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
            acc = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '（接口未返回内容）';
            paint(acc);
            return acc;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n');
            buffer = parts.pop();
            for (const raw of parts) {
                const line = raw.trim();
                if (!line || !line.startsWith('data:')) continue;
                const payload = line.slice(5).trim();
                if (payload === '[DONE]') continue;
                try {
                    const json = JSON.parse(payload);
                    const delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
                    if (delta) { acc += delta; paint(acc); }
                } catch (e) { /* 分片不完整，留待下一轮拼接 */ }
            }
        }
        paint(acc || '（接口未返回内容）');
        return acc;
    } catch (err) {
        fail('请求失败：' + (err && err.message ? err.message : String(err)) + '。可能是网络问题或接口被跨域(CORS)拦截。');
    }
}

function setAiField(key, value) {
    const settings = loadSettings();
    settings.ai = { ...settings.ai, [key]: value };
    saveSettings(settings);
}

function setAiStatus(txt, cls) {
    const status = document.getElementById('aiStatus');
    if (status) { status.textContent = txt; status.className = 'bazi-status' + (cls ? ' ' + cls : ''); }
}

// 读表单 → 写入当前激活档案（不落盘、不提示），并镜像到 ai 顶层
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
    mirrorActiveProfile(ai);
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
    saveSettings(settings);
    renderAiProfileSelect(settings.ai);
    setAiStatus('已保存「' + (settings.ai.profiles[settings.ai.activeProfile].name) + '」', 'success');
}

function switchAiProfile(index) {
    const settings = loadSettings();
    const ai = settings.ai;
    writeFormToActiveProfile(ai); // 切走前先把当前编辑留在原档案
    index = parseInt(index, 10);
    if (isNaN(index) || index < 0 || index >= ai.profiles.length) index = 0;
    ai.activeProfile = index;
    mirrorActiveProfile(ai);
    saveSettings(settings);
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
    mirrorActiveProfile(ai);
    saveSettings(settings);
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
        mirrorActiveProfile(fAi);
        saveSettings(fresh);
        loadActiveProfileToForm(fAi);
        renderAiProfileSelect(fAi);
        setAiStatus('已删除', 'success');
    });
}

async function testAiConnection() {
    saveAiConfig();
    const ai = loadSettings().ai || {};
    const status = document.getElementById('aiStatus');
    const setStatus = (txt, cls) => { if (status) { status.textContent = txt; status.className = 'bazi-status' + (cls ? ' ' + cls : ''); } };
    if (!ai.baseUrl || !ai.apiKey || !ai.model) { setStatus('请先填写完整的接口配置', 'error'); return; }
    setStatus('测试中…', '');
    try {
        const resp = await fetch(ai.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ai.apiKey },
            body: JSON.stringify({ model: ai.model, stream: false, max_tokens: 8, messages: [{ role: 'user', content: '回复一个字：通' }] })
        });
        if (resp.ok) { setStatus('连接成功 ✓', 'success'); }
        else { let t = ''; try { t = (await resp.text()).slice(0, 160); } catch (e) {} setStatus(`失败 ${resp.status}：${t}`, 'error'); }
    } catch (e) {
        setStatus('连接失败：' + (e && e.message ? e.message : String(e)) + '（或被跨域拦截）', 'error');
    }
}

function renderResult(gua, hexLines, change, question, fullBin, sourceCard, savedAi) {
    const resultArea = document.getElementById('resultArea');
    const yaoNames = ['初九','九二','九三','九四','九五','上九','初六','六二','六三','六四','六五','上六'];
    const roman = toRoman(guaIndex(gua));
    const verdict = getVerdict(gua);
    const verdictText = { ji:'吉', xiong:'凶', ping:'平' };
    const mainReading = getMainReading(gua, change);
    let firstRect = null;
    if (sourceCard && sourceCard.parentNode) {
        firstRect = sourceCard.getBoundingClientRect();
        sourceCard.remove();
    }

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
<div class="yao-header yao-toggle">${lineVis}<span class="yao-name">${yaoName}</span><span class="yao-badge type">${yaoType}</span>${changeBadge}<span class="yao-chevron">›</span></div>
<div class="yao-text">${yaoText}</div></div>`;
    }).join('');

    const analysisHtml = gua[4].split('。').filter(s=>s.trim()).map(s =>
        `<div class="analysis-item">${s.trim()}。</div>`
    ).join('');

    let changeHtml = '';
    if (change.hasChange && change.changeGua) {
        const pos = change.changingYaos.map(p => ['初','二','三','四','五','上'][p]);
        changeHtml = `<section class="card card-drama change-section"><h3>变·卦·演化 <span class="hex-tag">天机易转</span></h3>
<div class="change-comparison">
<div class="gua-box"><div class="gua-label">BEN · 本</div><div class="gua-symbol">${gua[2]}</div><div class="gua-name">${gua[0]}</div></div>
<div class="change-arrow">⟶</div>
<div class="gua-box changed"><div class="gua-label">BIAN · 变</div><div class="gua-symbol">${change.changeGua[2]}</div><div class="gua-name">${change.changeGua[0]}</div></div>
</div>
<div class="change-details"><p>变爻位置：第 ${pos.join('、')} 爻</p><p>${change.changeGua[4]}</p></div></section>`;
    }

    const aiSettings = loadSettings().ai || {};
    const showAiCard = !!savedAi || aiSettings.enabled;
    const aiHtml = showAiCard
        ? `<section class="card card-ai" id="aiReadingCard"><h3>天机 · AI 详解 <span class="hex-tag">灵犀一点</span></h3><div class="ai-reading-body" id="aiReadingBody"></div></section>`
        : '';

    resultArea.innerHTML = `
<section class="card result-header">
    <div class="chosen-card-wrap" id="chosenCardWrap"></div>
    <div class="hex-roman">${roman}</div>
    <h2 class="hex-name hex-name-art">${gua[0]}</h2>
    <div class="hex-title">${gua[1]}</div>
    <div class="hex-symbol" style="display:none;">${gua[2]}</div>
    ${question ? `<p class="hex-question">「${escHtml(question)}」</p>` : ''}
    <div class="verdict-seal ${verdict}">${verdictText[verdict]}</div>
    <div class="share-row"><button class="btn-share" id="shareBtn">✦ 生成分享图</button></div>
</section>
<section class="card card-primary main-reading"><h3>主 · 断 <span class="hex-tag">${mainReading.rule}</span></h3><div class="analysis-list"><div class="analysis-item">${mainReading.text}</div></div></section>
<section class="card card-primary"><h3>卦象奥义</h3><div class="analysis-list">${analysisHtml}</div></section>
<section class="card card-secondary"><h3>六爻之辞</h3><div class="yao-list">${yaoHtml}</div></section>
${changeHtml}
${aiHtml}
<section class="result-actions">
    <button class="btn-action btn-action-secondary" id="newDivineBtn">
        <span class="btn-rune">↺</span><span>再问一卦</span>
    </button>
    <button class="btn-action btn-action-tertiary" id="viewHistoryBtn">
        <span class="btn-rune">◱</span><span>翻阅牌册</span>
    </button>
    <p class="result-warning">占而再三 · 神不告之</p>
</section>`;

    resultArea.querySelector('#shareBtn').addEventListener('click', shareAsImage);
    const newBtn = resultArea.querySelector('#newDivineBtn');
    if (newBtn) newBtn.addEventListener('click', () => {
        const qEl = document.getElementById('question');
        if (qEl) { qEl.value = ''; qEl.focus(); }
        document.body.classList.remove('mood-ji', 'mood-xiong', 'mood-ping');
        resultArea.innerHTML = '';
        const target = document.querySelector('.question-area');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const viewBtn = resultArea.querySelector('#viewHistoryBtn');
    if (viewBtn) viewBtn.addEventListener('click', toggleHistory);

    const aiBody = resultArea.querySelector('#aiReadingBody');
    if (aiBody) {
        const runAi = () => {
            requestAiReading(gua, change, question, aiBody).then(text => {
                if (text) persistAiReading(text, gua, change, question);
            });
        };
        if (savedAi) {
            aiBody.innerHTML = '<div class="ai-reading-text"></div>';
            aiBody.querySelector('.ai-reading-text').textContent = savedAi;
        } else if (aiSettings.autoRun) {
            runAi();
        } else {
            aiBody.innerHTML = '<button class="btn-ai-run" id="aiRunBtn"><span class="btn-rune">✧</span> 请神解卦 <span class="btn-rune">✧</span></button>';
            aiBody.querySelector('#aiRunBtn').addEventListener('click', runAi);
        }
    }

    const wrap = resultArea.querySelector('#chosenCardWrap');
    let bigCard;
    if (sourceCard) {
        sourceCard.style.cssText = '';
        sourceCard.classList.remove('active', 'peak');
        wrap.appendChild(sourceCard);
        bigCard = sourceCard;
    } else {
        bigCard = makeArcanaCard(gua, {
            large: true,
            hexLines,
            changingYaos: change.changingYaos,
            rare: isRareGua(fullBin)
        });
        bigCard.classList.add('flipped');
        bigCard.classList.add('yao-animate');
        wrap.appendChild(bigCard);
    }

    if (firstRect) {
        wrap.style.animation = 'none';
        const lastRect = bigCard.getBoundingClientRect();
        const dx = (firstRect.left + firstRect.width/2) - (lastRect.left + lastRect.width/2);
        const dy = (firstRect.top + firstRect.height/2) - (lastRect.top + lastRect.height/2);
        const scale = lastRect.width > 0 ? firstRect.width / lastRect.width : 1;

        bigCard.style.transformOrigin = 'center center';
        bigCard.style.transition = 'none';
        bigCard.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
        bigCard.offsetHeight; 

        requestAnimationFrame(() => {
            bigCard.style.transition = 'transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)';
            bigCard.style.transform = '';
        });


        setTimeout(() => {
            bigCard.style.transition = '';
            bigCard.style.transform = '';
            bigCard.style.transformOrigin = '';
            wrap.style.animation = '';
        }, 1250);
    }


    const header = resultArea.querySelector('.result-header');
    if (header) {
        const headerKids = Array.from(header.children).filter(el => !el.matches('.chosen-card-wrap, .hex-symbol, .hex-name-art, .verdict-seal'));
        headerKids.forEach((el, i) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(8px)';
            setTimeout(() => {
                el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
                el.style.opacity = '1';
                el.style.transform = '';
            }, 350 + i * 80);
        });


        const nameEl = header.querySelector('.hex-name-art');
        if (nameEl) {
            const txt = nameEl.textContent;
            nameEl.innerHTML = txt.split('').map((ch, idx) =>
                `<span class="hex-char" style="animation-delay:${600 + idx * 220}ms">${ch === ' ' ? '&nbsp;' : ch}</span>`
            ).join('');
        }


        const seal = header.querySelector('.verdict-seal');
        if (seal) {
            seal.style.opacity = '0';
            setTimeout(() => {
                seal.style.opacity = '';
                seal.classList.add('stamp-in');
            }, 1400);
        }
    }


    const otherCards = resultArea.querySelectorAll('.card:not(.result-header)');
    otherCards.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
            el.style.opacity = '1';
            el.style.transform = '';
            const yaoList = el.querySelector('.yao-list');
            if (yaoList) yaoList.classList.add('scroll-open');
            const analysisList = el.querySelector('.analysis-list');
            if (analysisList) analysisList.classList.add('stagger-in');
        }, 700 + i * 180);
    });

    // 移动端爻辞折叠/展开
    resultArea.querySelectorAll('.yao-toggle').forEach(header => {
        header.addEventListener('click', () => {
            header.closest('.yao-item').classList.toggle('yao-expanded');
        });
    });

    document.body.classList.remove('mood-ji', 'mood-xiong', 'mood-ping');
    document.body.classList.add('mood-' + verdict);

    if (isRareGua(fullBin) && bigCard) {
        setTimeout(() => spawnGoldSparkles(bigCard, 16), 1500);
        setTimeout(() => spawnGoldSparkles(bigCard, 10), 5500);
        setTimeout(() => spawnGoldSparkles(bigCard, 10), 9500);
    }

    setTimeout(() => {
        const target = resultArea.querySelector('.result-header') || resultArea;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 1300);
}

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

// 历史
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
        showToast('牌册已满，无法记录本次占卜', 'error');
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
<svg class="history-empty-card" viewBox="0 0 60 90" fill="none" stroke="currentColor" stroke-width="1">
    <rect x="2" y="2" width="56" height="86" rx="3" opacity="0.3"/>
    <rect x="8" y="8" width="44" height="74" rx="1" opacity="0.15" stroke-dasharray="3 3"/>
    <line x1="20" y1="36" x2="40" y2="36" opacity="0.25"/>
    <line x1="20" y1="44" x2="28" y2="44" opacity="0.25"/><line x1="32" y1="44" x2="40" y2="44" opacity="0.25"/>
    <line x1="20" y1="52" x2="40" y2="52" opacity="0.25"/>
</svg>
<p>尚无记录</p>
<p class="history-empty-hint">请先卜一卦</p>
</div>`;
        return;
    }
    list.innerHTML = history.map((item, idx) => {
        const guaEntry = item.binary ? lookupGua(item.binary) : null;
        const roman = guaEntry ? toRoman(guaIndex(guaEntry)) : '';
        const verdict = guaEntry ? getVerdict(guaEntry) : 'ping';
        const hexLines = (item.hexagramLines && item.hexagramLines.length === 6)
            ? item.hexagramLines
            : binToHexLines(item.binary || '000000');
        const thumb = buildYaoArtSvg(hexLines, item.changingYaos || []);
        const upper = guaEntry ? guaEntry[2][0] : '';
        const lower = guaEntry ? guaEntry[2][1] : '';
        return `<div class="history-item history-verdict-${verdict}" data-idx="${idx}">
<div class="history-card-thumb">
    <div class="hcard-frame"></div>
    ${roman ? `<div class="hcard-roman">${roman}</div>` : ''}
    <div class="hcard-watermark"><span>${upper}</span><span>${lower}</span></div>
    <div class="hcard-art">${thumb}</div>
    <div class="hcard-name">${item.gua || ''}</div>
    <div class="hcard-band"></div>
</div>
<div class="history-info">
<div class="history-q">${escHtml(item.question)}</div>
<div class="history-gua"><span class="history-dot history-dot-${verdict}"></span>${roman ? `<span style="font-family:'Cinzel',serif;margin-right:6px;">${roman}</span>` : ''}${item.symbol} ${item.gua}${item.hasChange ? ' <span class="history-tag">变</span>' : ''}</div>
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
        renderResult(gua, item.hexagramLines, change, item.question, item.binary, null, item.aiReading);
    } else {
        const hex = binToHexLines(item.binary || '000000');
        renderResult(gua, hex, change, item.question, item.binary || '000000', null, item.aiReading);
    }
    toggleHistory();
}

function deleteHistoryItem(index) {
    const history = readHistorySafe();
    if (index < 0 || index >= history.length) return;
    const item = history[index];
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
    const yes = await showConfirm('确定清空牌册？');
    if (yes) {
        try { localStorage.removeItem('divinationHistory'); } catch (e) {}
        loadHistory();
    }
}

// 每日一卦 
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
    const dateStr = d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
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
        const xiantianOrder = ['☰','☱','☲','☳','☴','☵','☶','☷'];
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
    const roman = toRoman(guaIndex(gua));
    el.innerHTML = `
<span class="daily-today-seal">今日</span>
<div class="daily-label">DAILY · ARCANUM · 今日启示</div>
<div class="daily-content">
    <span class="daily-roman">${roman}</span>
    <span class="daily-symbol">${gua[2]}</span>
    <span class="daily-name">${gua[0]}</span>
    <span class="daily-divider">◆</span>
    <span class="daily-motto">${motto}</span>
</div>`;
    el.onclick = () => showGuaDetail(getDailyGua());
}

// 卦象详解 
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

function triggerIgnitionChain() {
    const btn = document.getElementById('divineBtn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const ring = document.createElement('div');
    ring.className = 'ignition-ring';
    ring.style.left = cx + 'px';
    ring.style.top = cy + 'px';
    const rays = [];
    for (let i = 0; i < 8; i++) {
        const angle = i * 45;
        const len = i % 2 === 0 ? 48 : 28; 
        const w = i % 2 === 0 ? 2 : 1.3;
        const rad = angle * Math.PI / 180;
        const x2 = Math.cos(rad) * len;
        const y2 = Math.sin(rad) * len;
        rays.push(`<line class="star-ray" x1="0" y1="0" x2="${x2}" y2="${y2}" stroke-width="${w}"/>`);
    }
    ring.innerHTML = `<svg viewBox="-50 -50 100 100" xmlns="http://www.w3.org/2000/svg"><g>${rays.join('')}</g></svg>`;
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 1200);

    setTimeout(() => {
        document.querySelectorAll('.candle').forEach(c => {
            c.classList.remove('flare');
            void c.offsetWidth;
            c.classList.add('flare');
            setTimeout(() => c.classList.remove('flare'), 2000);
        });
    }, 320);

    const layers = ['.mat-l1', '.mat-l2', '.mat-l3', '.mat-l4', '.mat-l5'];
    layers.forEach((sel, i) => {
        setTimeout(() => {
            const el = document.querySelector('.embroidery-mat ' + sel);
            if (!el) return;
            el.classList.remove('mat-ignite');
            void el.getBoundingClientRect(); 
            el.classList.add('mat-ignite');
            setTimeout(() => el.classList.remove('mat-ignite'), 1200);
        }, 200 + i * 130);
    });
}

function spawnGoldSparkles(anchorEl, count) {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
        const sp = document.createElement('div');
        sp.className = 'gold-sparkle';
        sp.style.left = (rect.left + rect.width * (0.1 + Math.random() * 0.8)) + 'px';
        sp.style.top = (rect.top + rect.height * (0.55 + Math.random() * 0.4)) + 'px';
        sp.style.setProperty('--dx', ((Math.random() - 0.5) * 40) + 'px');
        sp.style.animationDelay = (i * 90) + 'ms';
        sp.style.animationDuration = (1800 + Math.random() * 1000) + 'ms';
        document.body.appendChild(sp);
        setTimeout(() => sp.remove(), 3200 + i * 90);
    }
}

function initParallax() {
    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    let raf = null;

    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;

    window.addEventListener('mousemove', (e) => {
        targetX = (e.clientX / window.innerWidth - 0.5) * 12;  // -6 ~ 6 px
        targetY = (e.clientY / window.innerHeight - 0.5) * 12;
        if (raf == null) raf = requestAnimationFrame(tick);
    });

    function tick() {
        currentX += (targetX - currentX) * 0.08;
        currentY += (targetY - currentY) * 0.08;
        document.documentElement.style.setProperty('--par-x', currentX.toFixed(2) + 'px');
        document.documentElement.style.setProperty('--par-y', currentY.toFixed(2) + 'px');
        if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
            raf = requestAnimationFrame(tick);
        } else {
            raf = null;
        }
    }
}

function spawnGoldStreak() {
    const horizontal = Math.random() < 0.6;
    const jitter = -35 + Math.random() * 70;
    const angle = horizontal ? jitter : 90 + jitter;

    const container = document.createElement('div');
    container.className = 'gold-streak-container';
    container.style.setProperty('--angle', angle.toFixed(1) + 'deg');

    const beam = document.createElement('div');
    beam.className = 'gold-streak-beam';
    container.appendChild(beam);

    document.body.appendChild(container);
    setTimeout(() => container.remove(), 1800);
}

let _goldStreakTimer = null;
function scheduleGoldStreak() {
    if (_goldStreakTimer) clearTimeout(_goldStreakTimer);
    const delay = 35000 + Math.random() * 30000; // 35–65s
    _goldStreakTimer = setTimeout(() => {
        if (!document.hidden) spawnGoldStreak();
        scheduleGoldStreak();
    }, delay);
}

// 时间彩蛋
function applyHourTheme() {
    const h = new Date().getHours();
    document.body.classList.remove('hour-zi', 'hour-wu');
    if (h >= 23 || h < 1) document.body.classList.add('hour-zi');
    else if (h >= 11 && h < 13) document.body.classList.add('hour-wu');
}

// 设置
const DEFAULT_AI_PROMPT = `你是一位精通《周易》象数与义理的解卦师，既懂卦象推演，也善于把卦理落到问卦者的现实处境上。请依据下列卦象，为问卦者写一份诚恳、具体、能用得上的解读。

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
- 每段约 2 至 4 句，【箴言】一句收束；全文约 400 至 700 字，语气古雅而通俗，如对坐谈心。`;

const DEFAULT_AI = {
    enabled: false,
    baseUrl: '',
    apiKey: '',
    model: '',
    temperature: 0.8,
    autoRun: false,
    saveToHistory: true,
    prompt: DEFAULT_AI_PROMPT
};

// 一套配置最多保存数量
const AI_PROFILE_MAX = 5;
// 仅档案私有的连接字段（全局偏好如 enabled/autoRun/temperature 不入档案）
const AI_PROFILE_FIELDS = ['baseUrl', 'apiKey', 'model', 'prompt'];

function makeAiProfile(name, src) {
    src = src || {};
    return {
        id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name || '新配置',
        baseUrl: src.baseUrl || '',
        apiKey: src.apiKey || '',
        model: src.model || '',
        prompt: src.prompt || DEFAULT_AI_PROMPT
    };
}

// 把激活档案的连接字段镜像回 ai 顶层，让下游解卦/测试逻辑零改动
function mirrorActiveProfile(ai) {
    const p = ai.profiles[ai.activeProfile] || ai.profiles[0];
    if (!p) return;
    AI_PROFILE_FIELDS.forEach(k => { ai[k] = p[k]; });
}

// 迁移 + 校正：老的单套配置自动包成「配置 1」；越界回正；同步镜像
function ensureAiProfiles(ai) {
    if (!Array.isArray(ai.profiles) || ai.profiles.length === 0) {
        ai.profiles = [ makeAiProfile('配置 1', ai) ];
        ai.activeProfile = 0;
    }
    if (ai.profiles.length > AI_PROFILE_MAX) ai.profiles = ai.profiles.slice(0, AI_PROFILE_MAX);
    if (typeof ai.activeProfile !== 'number' || ai.activeProfile < 0 || ai.activeProfile >= ai.profiles.length) {
        ai.activeProfile = 0;
    }
    mirrorActiveProfile(ai);
    return ai;
}

const DEFAULT_SETTINGS = {
    method: 'coin',
    showDaily: true,
    showCandle: true,
    bazi: null,
    ai: DEFAULT_AI
};

function loadSettings() {
    try {
        const raw = localStorage.getItem('tianyan_settings');
        if (raw) {
            const parsed = JSON.parse(raw);
            const merged = { ...DEFAULT_SETTINGS, ...parsed };
            // ai 子对象深合并：老配置缺字段时用默认补齐，避免 undefined
            merged.ai = { ...DEFAULT_AI, ...(parsed.ai || {}) };
            ensureAiProfiles(merged.ai);
            return merged;
        }
    } catch(e) {}
    return { ...DEFAULT_SETTINGS, ai: ensureAiProfiles({ ...DEFAULT_AI }) };
}

function saveSettings(settings) {
    try {
        localStorage.setItem('tianyan_settings', JSON.stringify(settings));
    } catch (e) {
    }
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
    const maxDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    if (day < 1 || day > maxDay) {
        status.textContent = `${month}月最多${maxDay}天，请检查日期`;
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

    // AI 解卦回填
    const ai = settings.ai || {};
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
    setChk('settingAiEnabled', ai.enabled);
    if (ai.profiles) {
        renderAiProfileSelect(ai);
        loadActiveProfileToForm(ai);
    } else {
        setVal('aiBaseUrl', ai.baseUrl || '');
        setVal('aiApiKey', ai.apiKey || '');
        setVal('aiModel', ai.model || '');
        setVal('aiPrompt', ai.prompt || DEFAULT_AI_PROMPT);
    }
    setChk('settingAiAuto', ai.autoRun);
    const aiConfig = document.getElementById('aiConfig');
    if (aiConfig) aiConfig.style.display = ai.enabled ? '' : 'none';

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

    // 时辰印章双层显示（章节 2.9）：把 hour select 选中项的 data-range 同步到父级
    syncHourSealRange();
    const hourEl = document.getElementById('baziHour');
    if (hourEl && !hourEl._hourSealHooked) {
        hourEl.addEventListener('change', syncHourSealRange);
        hourEl._hourSealHooked = true;
    }

    applySettings(settings);
}

function syncHourSealRange() {
    const sel = document.getElementById('baziHour');
    if (!sel) return;
    const seal = sel.closest('.bazi-seal-hour');
    if (!seal) return;
    const opt = sel.options[sel.selectedIndex];
    seal.dataset.range = (opt && opt.dataset && opt.dataset.range) || '';
}

function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    const overlay = document.getElementById('settingsOverlay');
    panel.classList.toggle('show');
    overlay.classList.toggle('show');
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

    const yearNum = bazi.year % 100 || 100;
    // 梅花易数：以八字「年月日」起上卦，「年月日时」起下卦——八字即先天之命
    const baseUpper = yearNum + bazi.month + bazi.day;
    const baseLower = baseUpper + (bazi.hour + 1);

    // 融入所问之事（确定性：同一问题恒定，不同问题分散；取质数模以打散分布）
    const sumUpper = baseUpper + (qNum % 97);
    const sumLower = baseLower + (Math.floor(qNum / 97) % 89);
    const sumYao   = sumUpper + sumLower;        // 动爻＝上下卦总数 mod 6（梅花传统）

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

document.addEventListener('DOMContentLoaded', () => {
    // 入场动画区分新老用户（章节 3.2）
    const hasVisited = localStorage.getItem('tianyan_visited');
    if (hasVisited) {
        document.body.classList.add('intro-fast');
    } else {
        try { localStorage.setItem('tianyan_visited', '1'); } catch (e) {}
    }
    document.body.classList.add('intro-start');
    const introDur = hasVisited ? 1800 : 3500;
    setTimeout(() => document.body.classList.remove('intro-start'), introDur);

    applyHourTheme();
    const dustCanvas = document.querySelector('.dust-layer');
    let dust = null;
    if (dustCanvas) {
        dust = new DustParticles(dustCanvas);
        dust.start();
    }
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (dust) dust.pause();
            // 暂停所有 CSS 动画，节省后台 GPU
            document.documentElement.style.setProperty('--anim-state', 'paused');
        } else {
            if (dust) dust.resume();
            document.documentElement.style.setProperty('--anim-state', 'running');
        }
    });

    // Intersection Observer：暂停不可见元素的动画
    if ('IntersectionObserver' in window) {
        // 烛台：不可见时暂停 CSS 动画
        const candleObserver = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                e.target.style.animationPlayState = e.isIntersecting ? 'running' : 'paused';
                const flames = e.target.querySelectorAll('.flame, .flame-inner, .flame-halo');
                flames.forEach(f => f.style.animationPlayState = e.isIntersecting ? 'running' : 'paused');
            });
        }, { threshold: 0 });
        document.querySelectorAll('.candle').forEach(c => candleObserver.observe(c));

        // 牌垫：不可见时暂停呼吸动画
        const mat = document.querySelector('.embroidery-mat');
        if (mat) {
            const matObserver = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    e.target.style.animationPlayState = e.isIntersecting ? 'running' : 'paused';
                });
            }, { threshold: 0 });
            matObserver.observe(mat);
        }
    }
    loadHistory();
    renderDailyGua();
    restoreSettingsUI();
    initParallax();
    scheduleGoldStreak();
    const sc = document.getElementById('shareImageContainer');
    if (sc) sc.addEventListener('click', e => { if (e.target === sc) closeShare(); });

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
    document.getElementById('settingMethod').addEventListener('change', function() {
        saveSetting('method', this.value);
        // 选八字起卦但尚未填八字：就地提示并高亮表单，避免回到主页起卦时才报错
        if (this.value === 'bazi' && !loadSettings().bazi) {
            showToast('八字起卦需先填写并保存生辰八字', 'error');
            const seals = document.querySelector('.bazi-seals');
            if (seals) {
                seals.scrollIntoView({ behavior: 'smooth', block: 'center' });
                seals.classList.add('hint-flash');
                setTimeout(() => seals.classList.remove('hint-flash'), 1600);
            }
        }
    });
    document.getElementById('settingDaily').addEventListener('change', function() { saveSetting('showDaily', this.checked); });
    document.getElementById('settingCandle').addEventListener('change', function() { saveSetting('showCandle', this.checked); });

    // AI 解卦设置
    const aiEnabledEl = document.getElementById('settingAiEnabled');
    if (aiEnabledEl) aiEnabledEl.addEventListener('change', function() {
        setAiField('enabled', this.checked);
        const cfg = document.getElementById('aiConfig');
        if (cfg) cfg.style.display = this.checked ? '' : 'none';
    });
    const aiAutoEl = document.getElementById('settingAiAuto');
    if (aiAutoEl) aiAutoEl.addEventListener('change', function() { setAiField('autoRun', this.checked); });
    const saveAiBtn = document.getElementById('saveAiBtn');
    if (saveAiBtn) saveAiBtn.addEventListener('click', saveAiConfig);
    const testAiBtn = document.getElementById('testAiBtn');
    if (testAiBtn) testAiBtn.addEventListener('click', testAiConnection);

    // 多配置档案：切换 / 新建 / 删除
    const aiProfileSel = document.getElementById('aiProfileSelect');
    if (aiProfileSel) aiProfileSel.addEventListener('change', function() { switchAiProfile(this.value); });
    const aiProfileNewBtn = document.getElementById('aiProfileNew');
    if (aiProfileNewBtn) aiProfileNewBtn.addEventListener('click', newAiProfile);
    const aiProfileDelBtn = document.getElementById('aiProfileDelete');
    if (aiProfileDelBtn) aiProfileDelBtn.addEventListener('click', deleteAiProfile);
    // 改名即时反映到下拉
    const aiProfileNameEl = document.getElementById('aiProfileName');
    if (aiProfileNameEl) aiProfileNameEl.addEventListener('input', function() {
        const opt = aiProfileSel && aiProfileSel.selectedOptions[0];
        if (opt) opt.textContent = this.value.trim() || ('配置 ' + (aiProfileSel.selectedIndex + 1));
    });
    const resetPromptBtn = document.getElementById('resetPromptBtn');
    if (resetPromptBtn) resetPromptBtn.addEventListener('click', function() {
        const el = document.getElementById('aiPrompt');
        if (el) el.value = DEFAULT_AI_PROMPT;
    });

    // Esc 关闭当前打开的弹层（按层级优先级，从最上层往下）
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

    // 回到顶部按钮
    const bttBtn = document.getElementById('backToTop');
    if (bttBtn) {
        let scrollTicking = false;
        window.addEventListener('scroll', () => {
            if (!scrollTicking) {
                scrollTicking = true;
                requestAnimationFrame(() => {
                    bttBtn.classList.toggle('visible', window.scrollY > window.innerHeight);
                    scrollTicking = false;
                });
            }
        }, { passive: true });
        bttBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // 每分钟检查一次时辰(到点切换子时/午时主题)
    setInterval(applyHourTheme, 60 * 1000);
});
