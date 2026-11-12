// cosmos —— 伏羲六十四卦图层
// 首页是先天圆图。起卦时圆图留在原地当作一只刻度盘：先天圆图本来就按二进制排，
// 每掷一爻，剩下的卦正好是圆上连续的一段弧（半圈、四分之一圈……直到一卦）。
// 刻度盘把这段弧转到正上方，用两条半径线和一道弧标出来；最后剩下的一卦飞到结果页。
// 返回首页时，这一卦从结果页飞回圆图上的原位，其余六十三卦沿圆周依次亮起。
//
// 所有动画都交给浏览器的合成线程（Web Animations，只动 translate / rotate / scale / opacity）：
// 主线程在渲染结果页、建牌册的时候忙一阵，圆图照样转得动。JS 只在开头算一次起止值，不逐帧写样式。
// 中途被打断时，按动画自己的时钟算出当前值，从那里接着往下走。
// 刻度盘的转动是转整个卦环，不是逐个挪六十四卦；标线是几根绕圆心转的线和两段可以伸缩的弧。

const Cosmos = (() => {
    const B = 100;   // 卦画基准尺寸，用 scale 缩放
    const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    // 同一条缓动的两种写法：JS 版用来算中途的当前值，CSS 版交给浏览器
    const ease = {
        inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
        out: t => 1 - Math.pow(1 - t, 3),
        outBack: t => { const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
        in: t => t * t * t
    };
    const CSS_EASE = {
        inOut: 'cubic-bezier(.65, 0, .35, 1)',
        out: 'cubic-bezier(.33, 1, .68, 1)',
        outBack: 'cubic-bezier(.34, 1.5, .64, 1)',
        in: 'cubic-bezier(.32, 0, .67, 0)'
    };
    // translate / rotate / scale 三个独立属性：位置和缩放可以分开动，互不打断
    const INDIV = !!(window.CSS && CSS.supports && CSS.supports('translate', '1px 1px') && CSS.supports('rotate', '1deg'));
    const ALL = ['x', 'y', 'rot', 'sc', 'op'];

    let root = null, ring = null, deco = null, marks = null;
    let items = [];
    let state = 'idle';
    let geo = null;          // 当前圆图几何
    let dial = null;         // 起卦时的刻度盘状态
    let resizeTimer = null, anchorRaf = 0;
    const tweens = new Map();

    // ---------- 单个卦：it.s 是落定后的值（也就是行内样式），动画期间由 tweens 里的记录给出当前值 ----------
    function frame(s, keys) {
        const f = {};
        if (INDIV) {
            if (keys.includes('x') || keys.includes('y')) f.translate = `${(s.x - B / 2).toFixed(2)}px ${(s.y - B / 2).toFixed(2)}px`;
            if (keys.includes('rot')) f.rotate = `${s.rot.toFixed(2)}deg`;
            if (keys.includes('sc')) f.scale = s.sc.toFixed(4);
        } else {
            f.transform = `translate(${(s.x - B / 2).toFixed(2)}px, ${(s.y - B / 2).toFixed(2)}px) rotate(${s.rot.toFixed(2)}deg) scale(${s.sc.toFixed(4)})`;
        }
        if (keys.includes('op')) f.opacity = s.op.toFixed(3);
        return f;
    }
    function write(it, keys) { Object.assign(it.el.style, frame(it.s, keys || ALL)); }

    // 补间记录在某一刻的值；动画还没开始（排队或在 delay 里）时就是起点
    function sample(rec) {
        if (!rec.anim) return rec.end;
        const ct = rec.anim.currentTime;
        if (ct == null || rec.anim.playState === 'finished') return rec.end;
        const local = ct - rec.delay;
        if (local <= 0) return rec.from;
        const e = rec.ease(Math.min(1, local / rec.dur));
        if (rec.path) return { ...rec.from, ...rec.path(e, rec.from, rec.target) };
        const o = { ...rec.from };
        for (const k in rec.target) o[k] = rec.from[k] + (rec.target[k] - rec.from[k]) * e;
        return o;
    }
    function cur(it) {
        const rec = tweens.get(it);
        return rec ? sample(rec) : it.s;
    }
    // 停在当前这一刻：把当前值写成行内样式，再撤掉动画（画面不跳）
    function halt(it) {
        const rec = tweens.get(it);
        if (!rec) return;
        tweens.delete(it);
        it.s = { ...sample(rec) };
        write(it);
        if (rec.anim) rec.anim.cancel();
    }
    function set(it, st) {
        const rec = tweens.get(it);
        const keys = Object.keys(st);
        // 只挪位置、不碰正在放的缩放 / 透明度时，让那段动画接着放
        if (rec && INDIV && !rec.path && keys.every(k => !(k in rec.target))) {
            Object.assign(it.s, st);
            Object.assign(rec.from, st);
            Object.assign(rec.end, st);
            write(it, keys);
            return;
        }
        halt(it);
        Object.assign(it.s, st);
        write(it);
    }
    function tween(it, target, o = {}) {
        halt(it);
        const rm = reduce();
        const dur = rm ? 0 : (o.dur || 800);
        const delay = rm ? 0 : (o.delay || 0);
        const from = { ...it.s };
        const easeName = o.ease || 'inOut';
        const path = o.path || null;
        const end = path ? { ...from, ...path(1, from, target) } : { ...from, ...target };
        const rec = { from, target, end, dur, delay, ease: ease[easeName], path, anim: null };
        tweens.set(it, rec);
        it.s = { ...end };
        const finish = () => {
            if (tweens.get(it) !== rec) return;
            tweens.delete(it);
            if (o.done) o.done();
        };
        if (!dur || !it.el.animate) {
            write(it);
            if (delay + dur) setTimeout(finish, delay + dur); else requestAnimationFrame(finish);
            return;
        }
        const keys = path ? ALL : Object.keys(target);
        let frames;
        if (path) {
            // 弧线飞行：按缓动后的进度采样成关键帧，帧间线性
            const n = Math.max(12, Math.round(dur / 33));
            frames = [];
            for (let k = 0; k <= n; k++) frames.push({ ...frame({ ...from, ...path(rec.ease(k / n), from, target) }, keys), offset: k / n });
        } else {
            frames = [frame(from, keys), frame(end, keys)];
        }
        // 行内样式先写成终点，动画只负责从起点走过去；放完后自然停在终点，不用再回写
        write(it);
        rec.anim = it.el.animate(frames, { duration: dur, delay, easing: path ? 'linear' : CSS_EASE[easeName], fill: 'backwards' });
        rec.anim.onfinish = finish;
    }

    // ---------- 整层的属性（卦环转角、刻度盘滑入、标线张角）：同一个值同时驱动几个元素 ----------
    function channel(v) { return { v, rec: null, targets: [] }; }
    function chanNow(ch) {
        const r = ch.rec;
        if (!r) return ch.v;
        const ct = r.anims[0].currentTime;
        if (ct == null || r.anims[0].playState === 'finished') return ch.v;
        return r.v0 + (r.v1 - r.v0) * r.ease(Math.min(1, Math.max(0, ct) / r.dur));
    }
    function chanStop(ch) {
        if (!ch.rec) return;
        ch.rec.anims.forEach(a => a.cancel());
        ch.rec = null;
    }
    function chanWrite(ch) { ch.targets.forEach(([el, prop, map]) => { el.style[prop] = map(ch.v); }); }
    function chanSet(ch, v) {
        const now = chanNow(ch);
        chanStop(ch);
        ch.v = v == null ? now : v;
        if (INDIV) chanWrite(ch); else writeFallback();
    }
    function chanTo(ch, v1, dur, easeName) {
        const v0 = chanNow(ch);
        chanStop(ch);
        ch.v = v1;
        if (!INDIV) { writeFallback(); return; }
        chanWrite(ch);
        if (!dur || reduce() || v0 === v1) return;
        const anims = ch.targets.filter(([el]) => el.animate).map(([el, prop, map]) =>
            el.animate([{ [prop]: map(v0) }, { [prop]: map(v1) }], { duration: dur, easing: CSS_EASE[easeName || 'inOut'] }));
        if (anims.length) ch.rec = { v0, v1, dur, ease: ease[easeName || 'inOut'], anims };
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
        return {
            cx, cy, R, sc: glyph / B,
            // 先天圆图：乾在正上，乾→复沿左半圈向下，姤→坤沿右半圈向下；初爻朝圆心
            angle: circleAngle,
            spot(v) {
                const deg = this.angle(v), rad = deg * Math.PI / 180;
                return { x: cx + R * Math.sin(rad), y: cy - R * Math.cos(rad), rot: deg };
            },
            // 自乾起，沿两侧向下的次序（入场、回场时用）
            order: v => v >= 32 ? 63 - v : 31 - v
        };
    }

    // ---------- 刻度盘（起卦） ----------
    const STEP = 180 / 32;
    // 圆心取自仪式页中央那块内容的位置，半径和首页圆图一样
    function dialAnchor() {
        const el = document.getElementById('dialCenter');
        if (!el || !el.getBoundingClientRect) return null;
        const r = el.getBoundingClientRect();
        const g = circleGeo();
        return {
            cx: r.left + r.width / 2, cy: r.top + r.height / 2, R: g.R, sc: g.sc,
            angle: g.angle, order: g.order,
            inside: window.innerWidth <= 768,   // 手机上圆比屏幕大，标线和读数画在圆环里侧
            key: `${(r.left + r.width / 2).toFixed(1)},${(r.top + r.height / 2).toFixed(1)},${g.R.toFixed(1)}`
        };
    }
    // 刻度盘上每一卦在卦环里的位置（卦环本身再整体转 theta）
    function dialSpot(c, v) {
        const deg = c.angle(v), rad = deg * Math.PI / 180;
        return { x: c.cx + c.R * Math.sin(rad), y: c.cy - c.R * Math.cos(rad), rot: deg };
    }
    const fx = v => v.toFixed(1);
    // 标线：两条半径线（边界）各是一根绕圆心转的线；两边界之间的弧拆成左右两半，
    // 每半是一个只露出半边的圆环，转多少度就露出多长的一段弧。张角变化只是这几样东西在转
    function buildMarks() {
        const c = dial.c, R = c.R, band = c.sc * B * 0.9, rIn = R - band, rOut = R + band;
        const rArc = c.inside ? rIn - 20 : rOut + 22;
        const rA = c.inside ? rIn - 28 : rIn - 8, rB = c.inside ? rOut + 8 : rOut + 30;
        const rRay = R * (c.inside ? .74 : .58);
        const p = 2, w = rArc + p, h2 = 2 * w;
        const circle = left => `<i class="m-circle" style="left:${fx(left)}px;top:${p}px;width:${fx(2 * rArc)}px;height:${fx(2 * rArc)}px"></i>`;
        const spoke = () => `<div class="m-spoke" style="left:${fx(c.cx)}px;top:${fx(c.cy)}px">` +
            `<i class="m-ray" style="top:${fx(-Math.max(rRay, rA))}px;height:${fx(Math.abs(rA - rRay))}px"></i>` +
            `<i class="m-edge" style="top:${fx(-rB)}px;height:${fx(rB - rA)}px"></i></div>`;
        const [lx, ly] = [c.cx, c.cy - (c.inside ? rIn - 46 : rIn - 30)];
        marks.innerHTML =
            `<div class="m-half" style="left:${fx(c.cx)}px;top:${fx(c.cy - w)}px;width:${fx(w)}px;height:${fx(h2)}px">` +
            `<div class="m-sweep" style="left:${fx(-w)}px;width:${fx(w)}px;height:${fx(h2)}px;transform-origin:100% 50%">${circle(p)}</div></div>` +
            `<div class="m-half" style="left:${fx(c.cx - w)}px;top:${fx(c.cy - w)}px;width:${fx(w)}px;height:${fx(h2)}px">` +
            `<div class="m-sweep" style="left:${fx(w)}px;width:${fx(w)}px;height:${fx(h2)}px;transform-origin:0 50%">${circle(-rArc)}</div></div>` +
            spoke() + spoke() +
            `<svg width="100%" height="100%"><text x="${fx(lx)}" y="${fx(ly)}" class="m-label"></text></svg>`;
        const [sweepR, sweepL] = marks.querySelectorAll('.m-sweep');
        const [spokeL, spokeR] = marks.querySelectorAll('.m-spoke');
        const deg = s => v => `${(s * v).toFixed(2)}deg`;
        dial.half.targets = [[sweepR, 'rotate', deg(1)], [sweepL, 'rotate', deg(-1)], [spokeL, 'rotate', deg(-1)], [spokeR, 'rotate', deg(1)]];
        dial.labelEl = marks.querySelector('.m-label');
        dial.labelEl.textContent = dial.label;
        marks.classList.toggle('armed', !!dial.arc);
        chanSet(dial.half, dial.half.v);
    }
    // 之前切掉的边界：虚线，画在装饰层里，跟着卦环一起转
    function drawCuts() {
        const svg = deco.querySelector('.d-cuts');
        if (!svg || !dial) return;
        const c = dial.c, band = c.sc * B * 0.9, r0 = c.R - band - 12, r1 = c.R + band + 12;
        svg.innerHTML = dial.cuts.map(a => {
            const rad = a * Math.PI / 180, s = Math.sin(rad), k = Math.cos(rad);
            return `<line x1="${fx(c.cx + r0 * s)}" y1="${fx(c.cy - r0 * k)}" x2="${fx(c.cx + r1 * s)}" y2="${fx(c.cy - r1 * k)}" class="m-cut"/>`;
        }).join('');
    }
    // 卦环、装饰、标线按刻度盘圆心摆好（进入刻度盘、圆心挪了的时候）
    function placeDial() {
        const c = dial.c, origin = `${c.cx}px ${c.cy}px`;
        ring.style.transformOrigin = origin;
        deco.style.transformOrigin = origin;
        items.forEach(it => set(it, dialSpot(c, it.v)));
        drawDeco(c);
        drawCuts();
        buildMarks();
    }
    // 仪式页排版变了、窗口尺寸变了：圆心跟过去
    function reanchor() {
        if (state !== 'dial' || !dial) return;
        const a = dialAnchor();
        if (!a || a.key === dial.c.key) return;
        dial.c = a;
        // 还没滑到位、还没转完的直接放到终点，再按新圆心重摆
        chanSet(dial.slide, 0);
        chanSet(dial.theta, dial.theta.v);
        chanSet(dial.half, dial.half.v);
        placeDial();
    }
    // 不支持独立 transform 属性的老浏览器：刻度盘不做动画，直接摆到位
    function writeFallback() {
        if (!dial) return;
        const p = dial.slide.v, t = `translate(${dial.dx * p}px, ${dial.dy * p}px)`;
        ring.style.transform = deco.style.transform = `${t} rotate(${dial.theta.v}deg)`;
        marks.style.transform = t;
        dial.half.targets.forEach(([el, , map]) => { el.style.transform = `rotate(${map(dial.half.v)})`; });
    }
    // 离开刻度盘：卦环当前的转角、偏移折进每一卦自己的坐标，卦环回正（画面不跳）
    function endDial() {
        if (!dial) return;
        const th = chanNow(dial.theta), p = chanNow(dial.slide);
        const ox = dial.dx * p, oy = dial.dy * p, c = dial.c;
        [dial.theta, dial.slide, dial.half].forEach(ch => chanSet(ch, null));
        const rad = th * Math.PI / 180, k = Math.cos(rad), s = Math.sin(rad);
        items.forEach(it => {
            const q = cur(it), dx = q.x - c.cx, dy = q.y - c.cy;
            set(it, { x: c.cx + dx * k - dy * s + ox, y: c.cy + dx * s + dy * k + oy, rot: q.rot + th });
        });
        ring.style.translate = ring.style.rotate = '';
        if (!INDIV) ring.style.transform = 'none';
        dial = null;
        if (root) root.classList.remove('is-dial');
        const m = marks;
        setTimeout(() => { if (!dial && m) { m.innerHTML = ''; m.classList.remove('armed'); m.style.translate = ''; m.style.transform = ''; } }, 420);
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
        deco.innerHTML = `<svg width="100%" height="100%">${parts.join('')}</svg><svg class="d-cuts" width="100%" height="100%"></svg>`;
    }

    // 两层（卦环、装饰）用同一个 CSS 动画慢转；重新开始时同时重启，保证同步
    function restartSpin() {
        [ring, deco].forEach(el => {
            el.style.animation = 'none';
            el.style.transform = '';
            el.style.translate = el.style.rotate = '';
        });
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
    function stopSpin() {
        ring.style.animation = 'none';
        ring.style.transform = 'none';
        deco.style.animation = 'none';
    }
    // 把卦环当前的旋转角折进每个卦自己的坐标，然后停转（视觉上不跳）
    function foldSpin() {
        if (!geo) return;
        const s0 = unshift();
        const spin = currentSpin();
        const rad = spin * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
        items.forEach(it => {
            const q = cur(it), dx = q.x - geo.cx, dy = q.y - geo.cy;
            set(it, { x: geo.cx + dx * c - dy * s, y: geo.cy + dx * s + dy * c, rot: q.rot + spin });
        });
        stopSpin();
        deco.style.transform = `translate3d(0, ${s0}px, 0) rotate(${spin}deg)`;
    }

    const shortest = d => ((d % 360) + 540) % 360 - 180;

    // 圆图状态下图层改成跟着文档走（.scrolling 是 position: absolute），滚动交给浏览器，
    // 不用每次滚动再拿 JS 挪一遍；其余状态图层固定在视口
    function applyShift() {
        root.classList.toggle('scrolling', state === 'circle');
    }
    // 离开圆图前，把滚动偏移折进每个卦的坐标，换回视口坐标；返回偏移量
    function unshift() {
        if (!root.classList.contains('scrolling')) return 0;
        const sh = -window.scrollY;
        root.classList.remove('scrolling');
        if (!sh) return 0;
        items.forEach(it => set(it, { y: cur(it).y + sh }));
        if (geo) geo = { ...geo, cy: geo.cy + sh };
        return sh;
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
            marks = document.createElement('div');
            marks.className = 'cosmos-marks';
            root.append(deco, ring, marks);
            for (let v = 63; v >= 0; v--) {
                const el = document.createElement('div');
                el.className = 'cg';
                el.innerHTML = buildHexBars(linesFromShao(v));
                ring.appendChild(el);
                items.push({ v, el, s: { x: 0, y: 0, rot: 0, sc: 0, op: 0 }, out: false });
            }
            window.addEventListener('resize', () => {
                if (state === 'dial' && !anchorRaf) anchorRaf = requestAnimationFrame(() => { anchorRaf = 0; reanchor(); });
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => this.relayout(), 120);
            });
        },

        // 首次进入：圆图自乾起，沿两侧向下依次亮起
        intro() {
            if (!root) return;
            endDial();
            state = 'circle';
            geo = circleGeo();
            drawDeco(geo);
            restartSpin();
            root.classList.remove('away');
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
            }
        },

        // 起卦：圆图停转，变成刻度盘，六十四卦一起亮起来
        toDial() {
            if (!root) return;
            const a = dialAnchor();
            if (!a) return;
            let spin = 0, from = null;
            if (state === 'circle' && geo) {
                unshift();
                spin = currentSpin();
                from = { cx: geo.cx, cy: geo.cy };
            }
            endDial();
            stopSpin();
            state = 'dial';
            root.classList.remove('away');
            root.classList.add('show-deco', 'is-dial');
            dial = {
                c: a, dx: from ? from.cx - a.cx : 0, dy: from ? from.cy - a.cy : 0,
                theta: channel(spin), half: channel(180), slide: channel(from ? 1 : 0),
                cuts: [], arc: null, label: '', labelEl: null
            };
            const tr = p => `${(dial.dx * p).toFixed(2)}px ${(dial.dy * p).toFixed(2)}px`;
            const rt = v => `${v.toFixed(2)}deg`;
            dial.theta.targets = [[ring, 'rotate', rt], [deco, 'rotate', rt]];
            dial.slide.targets = [[ring, 'translate', tr], [deco, 'translate', tr], [marks, 'translate', tr]];
            // 各卦摆到刻度盘上的位置；卦环先带着停转时的角度、停在首页圆图那里，再滑到仪式页中央
            placeDial();
            chanSet(dial.theta, spin);
            chanSet(dial.slide, dial.slide.v);
            chanTo(dial.slide, 0, 700, 'inOut');
            items.forEach(it => {
                it.out = false;
                tween(it, { sc: a.sc, op: .9 }, { dur: 700, delay: a.order(it.v) * 10, ease: 'out' });
            });
        },

        // 第 i 爻落定：与之不符的一半暗下去，剩下的那段弧转到正上方，标线跟着收窄
        // dur：圆图转到位用多少毫秒
        narrow(lineIndex, bit, label, dur) {
            dur = dur || 900;
            const fast = dur < 500;
            if (!dial) return;
            reanchor();
            const c = dial.c;
            let lo = Infinity, hi = -Infinity;
            items.forEach(it => {
                if (it.out) return;
                if (shaoBit(it.v, lineIndex) !== bit) { it.out = true; return; }
                const a = c.angle(it.v);
                if (a < lo) lo = a;
                if (a > hi) hi = a;
            });
            if (lo === Infinity) return;
            const arc = [lo - STEP / 2, hi + STEP / 2], mid = (arc[0] + arc[1]) / 2;
            // 剩下的卦随着弧段收窄一点点放大，越到后面越看得清
            const grow = Math.min(1.7, 1 + (lineIndex + 1) * .12);
            items.forEach(it => {
                if (!it.out) { tween(it, { sc: c.sc * grow, op: 1 }, { dur: fast ? 320 : 600, ease: 'out' }); return; }
                if (cur(it).op < .2) return;
                tween(it, { sc: c.sc * .82, op: .12 }, { dur: fast ? 320 : 520, delay: Math.min(260, Math.abs(shortest(c.angle(it.v) - mid)) * 1.4), ease: 'out' });
            });
            // 上一段弧的两条边里，不再是新边界的那条留作虚线
            if (dial.arc) dial.arc.forEach(e => { if (Math.abs(e - arc[0]) > .01 && Math.abs(e - arc[1]) > .01) dial.cuts.push(e); });
            dial.arc = arc;
            dial.label = label || '';
            drawCuts();
            if (dial.labelEl) dial.labelEl.textContent = dial.label;
            marks.classList.add('armed');
            const th = chanNow(dial.theta);
            const d = reduce() ? 0 : dur;
            chanTo(dial.theta, th + shortest(-mid - th), d, 'inOut');
            chanTo(dial.half, (arc[1] - arc[0]) / 2, d, 'inOut');
        },

        // 六爻掷完：剩下的那一卦放大
        settle(v, label) {
            const it = items.find(x => x.v === v);
            if (!it || !dial) return;
            reanchor();
            dial.label = label || dial.label;
            if (dial.labelEl) dial.labelEl.textContent = dial.label;
            tween(it, { sc: dial.c.sc * 2.3, op: 1 }, { dur: 600, ease: 'outBack' });
        },

        // 剩下的一卦飞到结果页卦画的位置；from 可以是牌册里缩略图的位置
        toResult(v, target, opts = {}) {
            const it = items.find(x => x.v === v);
            if (!root || !it || !target) { this.hide(); if (opts.done) opts.done(); return; }
            if (state === 'circle') foldSpin();
            endDial();
            root.classList.remove('away', 'show-deco');
            state = 'result';
            if (opts.fromRect) {
                const f = opts.fromRect;
                set(it, { x: f.left + f.width / 2, y: f.top + f.height / 2, rot: 0, sc: f.width / B, op: 1 });
            }
            items.forEach(x => {
                if (x === it) return;
                tween(x, { sc: cur(x).sc * .5, op: 0 }, { dur: 420, delay: Math.random() * 180, ease: 'out' });
            });
            const r = target.getBoundingClientRect();
            const to = { x: r.left + r.width / 2, y: r.top + r.height / 2, rot: 0, sc: r.width / B, op: 1 };
            const from = cur(it);
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
            endDial();
            root.classList.remove('scrolling');
            items.forEach(x => { if (x !== it) set(x, { op: 0 }); });
            set(it, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rot: 0, sc: rect.width / B, op: 1 });
            root.classList.add('instant-show');
            root.classList.remove('away', 'show-deco');
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
            endDial();
            geo = circleGeo();
            drawDeco(geo);
            restartSpin();
            state = 'circle';
            applyShift();
            root.classList.remove('away');
            root.classList.add('show-deco');
            items.forEach(it => { it.out = false; });
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
            if (prev === 'dial') {
                // 起卦中途退回首页：各卦回到自己在圆周上的位置
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
            unshift();
            endDial();
            state = 'hidden';
            root.classList.add('away');
        }
    };
})();
