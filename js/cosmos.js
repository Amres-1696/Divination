// cosmos —— 伏羲六十四卦图层
// 首页是先天圆图，起卦时卷成 8×8 方图，每掷一爻熄灭一半，剩下的一卦飞到结果页；
// 返回首页时，这一卦从结果页飞回圆图上的原位，其余六十三卦沿圆周依次亮起。
//
// 所有位移都由一个 requestAnimationFrame 补间器写 transform / opacity，
// 不碰 width/height，避免逐帧排版；卦画以 100px 为基准尺寸，用 scale 缩放。

const Cosmos = (() => {
    const B = 100;
    const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const ease = {
        inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
        out: t => 1 - Math.pow(1 - t, 3),
        outBack: t => { const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
        in: t => t * t * t
    };

    let root = null, ring = null, deco = null;
    let items = [];
    let state = 'idle';
    let geo = null;          // 当前圆图几何
    let grid = null;         // 当前方图几何
    let resizeTimer = null;
    const tweens = new Map();
    let raf = 0;

    function write(it) {
        const s = it.s;
        it.el.style.transform = `translate3d(${(s.x - B / 2).toFixed(2)}px, ${(s.y - B / 2).toFixed(2)}px, 0) rotate(${s.rot.toFixed(2)}deg) scale(${s.sc.toFixed(4)})`;
        it.el.style.opacity = s.op.toFixed(3);
    }
    function set(it, st) {
        tweens.delete(it);
        Object.assign(it.s, st);
        write(it);
    }
    function tween(it, target, o = {}) {
        const dur = reduce() ? 0 : (o.dur || 800);
        const rec = {
            from: { ...it.s }, target, dur,
            start: performance.now() + (reduce() ? 0 : (o.delay || 0)),
            ease: ease[o.ease || 'inOut'], path: o.path || null, done: o.done || null
        };
        tweens.set(it, rec);
        if (!raf) raf = requestAnimationFrame(loop);
    }
    function loop(now) {
        raf = 0;
        tweens.forEach((tw, it) => {
            if (now < tw.start) return;
            const t = tw.dur ? Math.min(1, (now - tw.start) / tw.dur) : 1;
            const e = tw.ease(t);
            if (tw.path) Object.assign(it.s, tw.path(e, tw.from, tw.target));
            else for (const k in tw.target) it.s[k] = tw.from[k] + (tw.target[k] - tw.from[k]) * e;
            write(it);
            if (t >= 1) {
                tweens.delete(it);
                if (tw.done) tw.done();
            }
        });
        if (tweens.size) raf = requestAnimationFrame(loop);
    }

    // ---------- 几何 ----------
    function circleGeo() {
        const vw = window.innerWidth, vh = window.innerHeight;
        const mobile = vw <= 768;
        const head = mobile ? 56 : 72;
        const R = mobile ? Math.max(vw * 0.86, 280) : Math.min((vh - head) * 0.43, vw * 0.36, 440);
        let cx = vw / 2;
        let cy = head + (vh - head) * (mobile ? 0.47 : 0.5);
        // 以首页内容的中心为圆心（文档坐标），圆图随页面一起滚动，不会和文字错位
        const hv = document.getElementById('homeView');
        if (hv && !hv.hidden) {
            const r = hv.getBoundingClientRect();
            if (r.height) { cx = r.left + r.width / 2; cy = r.top + window.scrollY + r.height / 2; }
        }
        const glyph = (2 * Math.PI * R / 64) * 0.5;
        const step = 180 / 32;
        return {
            cx, cy, R, sc: glyph / B,
            // 先天圆图：乾在正上，乾→复沿左半圈向下，姤→坤沿右半圈向下；初爻朝圆心
            angle: v => v >= 32 ? -((63 - v) + 0.5) * step : ((31 - v) + 0.5) * step,
            spot(v) {
                const deg = this.angle(v), rad = deg * Math.PI / 180;
                return { x: cx + R * Math.sin(rad), y: cy - R * Math.cos(rad), rot: deg };
            },
            // 自乾起，沿两侧向下的次序（入场、回场时用）
            order: v => v >= 32 ? 63 - v : 31 - v
        };
    }
    function gridGeo() {
        const slot = document.getElementById('gridSlot');
        if (!slot) return null;
        const r = slot.getBoundingClientRect();
        const cell = r.width / 8;
        return {
            cx: r.left + r.width / 2, cy: r.top + r.height / 2, sc: cell * 0.54 / B,
            // 先天方图：坤在左上、乾在右下；行看下卦，列看上卦
            spot: v => ({ x: r.left + ((v & 7) + 0.5) * cell, y: r.top + ((v >> 3) + 0.5) * cell, rot: 0 })
        };
    }

    // ---------- 圆图装饰（刻度、八卦分区），与卦环同速旋转 ----------
    function drawDeco(g) {
        const names = ['坤', '艮', '坎', '巽', '震', '离', '兑', '乾'];
        const parts = [];
        const rIn = g.R - g.sc * B * 0.9, rOut = g.R + g.sc * B * 0.9;
        parts.push(`<circle cx="${g.cx}" cy="${g.cy}" r="${rIn}" class="d-ring"/>`);
        parts.push(`<circle cx="${g.cx}" cy="${g.cy}" r="${rOut}" class="d-ring"/>`);
        parts.push(`<circle cx="${g.cx}" cy="${g.cy}" r="${rOut + 30}" class="d-ring faint"/>`);
        for (let k = 0; k < 64; k++) {
            const deg = k * 5.625, rad = deg * Math.PI / 180;
            const major = k % 8 === 0;
            const r1 = rOut, r2 = rOut + (major ? 30 : 6);
            parts.push(`<line x1="${g.cx + r1 * Math.sin(rad)}" y1="${g.cy - r1 * Math.cos(rad)}" x2="${g.cx + r2 * Math.sin(rad)}" y2="${g.cy - r2 * Math.cos(rad)}" class="${major ? 'd-major' : 'd-tick'}"/>`);
        }
        // 每一扇区是同一个下卦的八个卦
        for (let t = 0; t < 8; t++) {
            const deg = t >= 4 ? -((7 - t) * 45 + 22.5) : ((3 - t) * 45 + 22.5);
            const rad = deg * Math.PI / 180, rr = rOut + 17;
            const x = g.cx + rr * Math.sin(rad), y = g.cy - rr * Math.cos(rad);
            parts.push(`<text x="${x}" y="${y}" transform="rotate(${deg} ${x} ${y})" class="d-label">${names[t]}</text>`);
        }
        deco.innerHTML = `<svg width="100%" height="100%">${parts.join('')}</svg>`;
    }

    // 两层（卦环、装饰）用同一个 CSS 动画慢转；重新开始时同时重启，保证同步
    function restartSpin() {
        [ring, deco].forEach(el => { el.style.animation = 'none'; el.style.transform = ''; });
        root.offsetHeight;
        [ring, deco].forEach(el => {
            el.style.transformOrigin = `${geo.cx}px ${geo.cy}px`;
            el.style.animation = '';
        });
    }
    function currentSpin() {
        try {
            const m = getComputedStyle(ring).transform;
            if (!m || m === 'none') return 0;
            const [a, b] = m.slice(m.indexOf('(') + 1, -1).split(',').map(Number);
            return Math.atan2(b, a) * 180 / Math.PI;
        } catch (e) { return 0; }
    }
    // 把卦环当前的旋转角折进每个卦自己的坐标，然后停转（视觉上不跳）
    function foldSpin() {
        if (!geo) return;
        const s0 = shift;
        unshift();
        const spin = currentSpin();
        const rad = spin * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
        items.forEach(it => {
            const dx = it.s.x - geo.cx, dy = it.s.y - geo.cy;
            set(it, { x: geo.cx + dx * c - dy * s, y: geo.cy + dx * s + dy * c, rot: it.s.rot + spin });
        });
        ring.style.animation = 'none';
        ring.style.transform = 'none';
        deco.style.transform = `translate3d(0, ${s0}px, 0) rotate(${spin}deg)`;
        deco.style.animation = 'none';
    }

    const shortest = d => ((d % 360) + 540) % 360 - 180;

    // 圆图状态下，图层跟着页面滚动（坐标是文档坐标）；其余状态图层固定在视口
    let shift = 0;
    function applyShift() {
        shift = state === 'circle' ? -window.scrollY : 0;
        root.style.transform = shift ? `translate3d(0, ${shift}px, 0)` : '';
    }
    // 离开圆图前，把滚动偏移折进每个卦的坐标，换回视口坐标
    function unshift() {
        if (!shift) return;
        items.forEach(it => set(it, { y: it.s.y + shift }));
        if (geo) geo = { ...geo, cy: geo.cy + shift };
        shift = 0;
        root.style.transform = '';
    }

    return {
        get state() { return state; },
        init() {
            root = document.getElementById('cosmos');
            if (!root) return;
            deco = document.createElement('div');
            deco.className = 'cosmos-deco';
            ring = document.createElement('div');
            ring.className = 'cosmos-ring';
            root.append(deco, ring);
            for (let v = 63; v >= 0; v--) {
                const el = document.createElement('div');
                el.className = 'cg';
                el.innerHTML = buildHexBars(linesFromShao(v));
                ring.appendChild(el);
                items.push({ v, el, s: { x: 0, y: 0, rot: 0, sc: 0, op: 0 }, out: false });
            }
            window.addEventListener('scroll', () => { if (state === 'circle') applyShift(); }, { passive: true });
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => this.relayout(), 120);
            });
        },

        // 首次进入：圆图自乾起，沿两侧向下依次亮起
        intro() {
            if (!root) return;
            state = 'circle';
            geo = circleGeo();
            drawDeco(geo);
            restartSpin();
            root.classList.remove('away', 'is-grid');
            root.classList.add('show-deco');
            applyShift();
            items.forEach(it => {
                const p = geo.spot(it.v);
                set(it, { ...p, sc: geo.sc * 0.2, op: 0 });
                tween(it, { sc: geo.sc, op: .46 }, { dur: 700, delay: 150 + geo.order(it.v) * 26, ease: 'out' });
            });
        },

        relayout() {
            if (!root) return;
            if (state === 'circle') {
                geo = circleGeo();
                drawDeco(geo);
                restartSpin();
                applyShift();
                items.forEach(it => set(it, { ...geo.spot(it.v), sc: geo.sc, op: .46 }));
            } else if (state === 'grid') {
                grid = gridGeo();
                if (grid) items.forEach(it => set(it, {
                    ...grid.spot(it.v),
                    sc: grid.sc * (it.out ? .7 : it.hit ? 1.3 : 1),
                    op: it.out ? .1 : .95
                }));
            }
        },

        // 圆图卷入方图：每个卦绕方图中心同向旋进，同时转正、放大
        toGrid() {
            if (!root) return;
            grid = gridGeo();
            if (!grid) return;
            if (state === 'circle') foldSpin();
            state = 'grid';
            root.classList.remove('away', 'show-deco');
            root.classList.add('is-grid');
            const gx = grid.cx, gy = grid.cy;
            items.forEach(it => {
                it.out = false; it.hit = false;
                it.el.classList.remove('hit');
                const to = grid.spot(it.v);
                const a0 = Math.atan2(it.s.y - gy, it.s.x - gx);
                const r0 = Math.hypot(it.s.x - gx, it.s.y - gy);
                const a1 = Math.atan2(to.y - gy, to.x - gx);
                const r1 = Math.hypot(to.x - gx, to.y - gy);
                let da = a1 - a0;
                while (da > 0) da -= Math.PI * 2;   // 一律逆时针旋进，形成同一个漩涡
                if (da < -Math.PI * 1.6) da += Math.PI * 2;
                const rot0 = it.s.rot, drot = shortest(0 - rot0);
                const row = it.v >> 3, col = it.v & 7;
                tween(it, { sc: grid.sc, op: .95 }, {
                    dur: 1500,
                    delay: (row + col) * 34,
                    path: (e, f, t) => {
                        const a = a0 + da * e, r = r0 + (r1 - r0) * e;
                        return {
                            x: gx + r * Math.cos(a), y: gy + r * Math.sin(a),
                            rot: rot0 + drot * e,
                            sc: f.sc + (t.sc - f.sc) * e,
                            op: f.op + (t.op - f.op) * e
                        };
                    }
                });
            });
        },

        // 第 i 爻落定：与之不符的一半熄灭，自近及远扫过去
        eliminate(lineIndex, bit) {
            if (!grid) return;
            items.forEach(it => {
                if (it.out || shaoBit(it.v, lineIndex) === bit) return;
                it.out = true;
                const sweep = lineIndex < 3 ? (it.v & 7) : (it.v >> 3);
                tween(it, { sc: grid.sc * .7, op: .1 }, { dur: 520, delay: sweep * 28, ease: 'out' });
            });
        },

        mark(v) {
            const it = items.find(x => x.v === v);
            if (!it || !grid) return;
            it.hit = true;
            it.el.classList.add('hit');
            tween(it, { sc: grid.sc * 1.3, op: 1 }, { dur: 600, ease: 'outBack' });
        },

        // 剩下的一卦飞到结果页卦画的位置；from 可以是牌册里缩略图的位置
        toResult(v, target, opts = {}) {
            const it = items.find(x => x.v === v);
            if (!root || !it || !target) { this.hide(); if (opts.done) opts.done(); return; }
            if (state === 'circle') foldSpin();
            root.classList.remove('away', 'is-grid', 'show-deco');
            state = 'result';
            it.el.classList.remove('hit');
            if (opts.fromRect) {
                const f = opts.fromRect;
                set(it, { x: f.left + f.width / 2, y: f.top + f.height / 2, rot: 0, sc: f.width / B, op: 1 });
            }
            items.forEach(x => {
                if (x === it) return;
                tween(x, { sc: x.s.sc * .5, op: 0 }, { dur: 420, delay: Math.random() * 180, ease: 'out' });
            });
            const r = target.getBoundingClientRect();
            const to = { x: r.left + r.width / 2, y: r.top + r.height / 2, rot: 0, sc: r.width / B, op: 1 };
            const from = { ...it.s };
            // 走一段弧线，而不是直线
            const bend = Math.min(160, Math.hypot(to.x - from.x, to.y - from.y) * .22);
            tween(it, to, {
                dur: opts.fromRect ? 820 : 980,
                delay: opts.fromRect ? 0 : 120,
                path: (e, f, t) => {
                    const dx = t.x - f.x, dy = t.y - f.y, len = Math.hypot(dx, dy) || 1;
                    const off = Math.sin(Math.PI * e) * bend;
                    return {
                        x: f.x + dx * e - dy / len * off,
                        y: f.y + dy * e + dx / len * off,
                        rot: f.rot + shortest(t.rot - f.rot) * e,
                        sc: f.sc + (t.sc - f.sc) * e,
                        op: 1
                    };
                },
                done: () => {
                    if (opts.done) opts.done();
                    requestAnimationFrame(() => this.hide());
                }
            });
        },

        // 返回首页前：把结果页上的卦画“接”到图层上，其余卦先隐去
        lift(v, rect) {
            const it = items.find(x => x.v === v);
            if (!root || !it || !rect) return false;
            shift = 0;
            root.style.transform = '';
            items.forEach(x => { if (x !== it) set(x, { op: 0 }); });
            set(it, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rot: 0, sc: rect.width / B, op: 1 });
            it.el.classList.remove('hit');
            root.classList.add('instant-show');
            root.classList.remove('away', 'is-grid', 'show-deco');
            root.offsetHeight;
            root.classList.remove('instant-show');
            state = 'lifted';
            this._lifted = v;
            return true;
        },

        // 回到圆图：接住的那一卦飞回自己在圆上的位置，其余卦从它两侧沿圆周依次亮起
        toCircle() {
            if (!root) return;
            const prev = state;
            const home = this._lifted;
            this._lifted = null;
            geo = circleGeo();
            drawDeco(geo);
            restartSpin();
            state = 'circle';
            applyShift();
            root.classList.remove('away', 'is-grid');
            root.classList.add('show-deco');
            items.forEach(it => { it.out = false; it.hit = false; it.el.classList.remove('hit'); });
            if (prev === 'lifted' && home != null) {
                const hv = items.find(x => x.v === home);
                const hOrder = geo.angle(home);
                items.forEach(it => {
                    const p = geo.spot(it.v);
                    if (it === hv) {
                        tween(it, { ...p, sc: geo.sc, op: .46 }, {
                            dur: 1100,
                            path: (e, f, t) => ({
                                x: f.x + (t.x - f.x) * e, y: f.y + (t.y - f.y) * e,
                                rot: f.rot + shortest(t.rot - f.rot) * e,
                                sc: f.sc + (t.sc - f.sc) * e,
                                op: e < .7 ? 1 : 1 - (1 - .46) * ((e - .7) / .3)
                            })
                        });
                        return;
                    }
                    const dist = Math.abs(shortest(geo.angle(it.v) - hOrder)) / 5.625;
                    set(it, { ...p, sc: geo.sc * .2, op: 0 });
                    tween(it, { sc: geo.sc, op: .46 }, { dur: 600, delay: 700 + dist * 16, ease: 'out' });
                });
                return;
            }
            if (prev === 'grid') {
                // 方图（跳过之后）直接散回圆周
                items.forEach(it => {
                    const p = geo.spot(it.v);
                    tween(it, { ...p, sc: geo.sc, op: .46 }, { dur: 1100, delay: geo.order(it.v) * 12 });
                });
                return;
            }
            this.intro();
        },

        hide() {
            if (!root) return;
            state = 'hidden';
            root.classList.add('away');
        }
    };
})();
