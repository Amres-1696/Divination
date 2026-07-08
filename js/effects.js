// effects —— 氛围引擎：尘埃/萤火粒子(DustParticles)、点火链、金色火花、
// 视差、流光、时辰主题

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
