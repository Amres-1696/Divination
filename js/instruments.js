// instruments —— 生辰与配置的输入器具
// 年份是一把可拖动的刻度尺，月日是一页带农历的小月历，时辰是一面十二时辰钟（拖指针选）。
// 原生 input / select 仍是数据源（settings.js 照常读写），这里只负责画和同步。

function hookValue(el, onSet) {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    Object.defineProperty(el, 'value', {
        configurable: true,
        get() { return desc.get.call(this); },
        set(v) { desc.set.call(this, v); onSet(); }
    });
    return v => desc.set.call(el, v); // 不触发回调的原始写入
}
const _reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// ---------- 年：刻度尺 ----------
function makeYearRuler(input, onChange) {
    const MIN = 1900, MAX = 2100, STEP = 11, DEFAULT = 1990;
    const root = document.createElement('div');
    root.className = 'ruler';
    root.tabIndex = 0;
    root.setAttribute('role', 'slider');
    root.setAttribute('aria-label', '出生年份');
    root.setAttribute('aria-valuemin', MIN);
    root.setAttribute('aria-valuemax', MAX);
    const ticks = [];
    for (let y = MIN; y <= MAX; y++) {
        const x = (y - MIN) * STEP;
        const major = y % 10 === 0, mid = y % 5 === 0;
        ticks.push(`<line x1="${x}" x2="${x}" y1="0" y2="${major ? 16 : mid ? 10 : 6}" class="${major ? 'rt-major' : 'rt-minor'}"/>`);
        if (major) ticks.push(`<text x="${x}" y="30">${y}</text>`);
    }
    const width = (MAX - MIN) * STEP;
    root.innerHTML = `
<div class="ruler-read"><b class="ruler-year">—</b><span>年</span><em class="ruler-hint">左右拖动刻度尺</em></div>
<div class="ruler-window">
  <svg class="ruler-tape" width="${width}" height="36" viewBox="0 0 ${width} 36" aria-hidden="true">${ticks.join('')}</svg>
  <i class="ruler-needle" aria-hidden="true"></i>
</div>`;
    const tape = root.querySelector('.ruler-tape');
    const win = root.querySelector('.ruler-window');
    const read = root.querySelector('.ruler-year');
    let pos = DEFAULT, has = false, anim = 0;
    const setRaw = hookValue(input, () => fromInput(true));

    function draw() {
        const cx = win.clientWidth / 2;
        tape.style.transform = `translate3d(${(cx - (pos - MIN) * STEP).toFixed(1)}px,0,0)`;
        const y = Math.round(pos);
        read.textContent = has ? y : '—';
        root.classList.toggle('empty', !has);
        root.setAttribute('aria-valuenow', has ? y : DEFAULT);
        root.setAttribute('aria-valuetext', has ? `${y} 年` : '未选择');
    }
    function clamp(v) { return Math.min(MAX, Math.max(MIN, v)); }
    function animateTo(target, commit) {
        cancelAnimationFrame(anim);
        target = clamp(target);
        const from = pos, t0 = performance.now(), dur = _reduceMotion() ? 0 : 420;
        const stepFn = now => {
            const t = dur ? Math.min(1, (now - t0) / dur) : 1;
            pos = from + (target - from) * (1 - Math.pow(1 - t, 3));
            draw();
            if (t < 1) anim = requestAnimationFrame(stepFn);
            else if (commit) commitYear(Math.round(target));
        };
        anim = requestAnimationFrame(stepFn);
    }
    function commitYear(y) {
        has = true;
        setRaw(String(y));
        draw();
        if (onChange) onChange(y);
    }
    function fromInput(animated) {
        const v = parseInt(input.value, 10);
        if (v >= MIN && v <= MAX) {
            has = true;
            if (animated && root.isConnected && root.offsetParent) animateTo(v, false);
            else { pos = v; draw(); }
        } else { has = false; pos = DEFAULT; draw(); }
        if (onChange) onChange(has ? v : null);
    }

    // 拖动，松手后带一点惯性再吸附到整年
    let drag = null;
    win.addEventListener('pointerdown', e => {
        cancelAnimationFrame(anim);
        win.setPointerCapture(e.pointerId);
        drag = { x: e.clientX, pos, lastX: e.clientX, lastT: performance.now(), v: 0, moved: false };
        root.classList.add('dragging');
    });
    win.addEventListener('pointermove', e => {
        if (!drag) return;
        const now = performance.now();
        const dx = e.clientX - drag.x;
        if (Math.abs(dx) > 3) drag.moved = true;
        pos = clamp(drag.pos - dx / STEP);
        has = true;
        drag.v = (e.clientX - drag.lastX) / Math.max(1, now - drag.lastT);
        drag.lastX = e.clientX; drag.lastT = now;
        draw();
    });
    const end = e => {
        if (!drag) return;
        root.classList.remove('dragging');
        let target;
        if (!drag.moved) {
            // 点按刻度：跳到那一年
            const r = win.getBoundingClientRect();
            target = pos + (e.clientX - (r.left + r.width / 2)) / STEP;
        } else {
            target = pos - drag.v * 180 / STEP;
        }
        drag = null;
        animateTo(Math.round(clamp(target)), true);
    };
    win.addEventListener('pointerup', end);
    win.addEventListener('pointercancel', end);
    // 只认横向滚动（触控板左右划、Shift+滚轮）；竖向滚轮留给设置面板滚动，免得划过刻度尺时误改年份
    root.addEventListener('wheel', e => {
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
        if (!d) return;
        e.preventDefault();
        const base = has ? Math.round(pos) : DEFAULT;
        animateTo(base + Math.sign(d) * (Math.abs(d) > 60 ? 2 : 1), true);
    }, { passive: false });
    root.addEventListener('keydown', e => {
        const base = has ? Math.round(pos) : DEFAULT;
        const map = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
        if (map[e.key] !== undefined) { e.preventDefault(); animateTo(base + map[e.key], true); }
        else if (e.key === 'Home') { e.preventDefault(); animateTo(MIN, true); }
        else if (e.key === 'End') { e.preventDefault(); animateTo(MAX, true); }
    });
    if (window.ResizeObserver) new ResizeObserver(draw).observe(win);
    fromInput(false);
    return root;
}

// ---------- 月、日：月相带 ----------
// 一整年的月相排成一条胶片（按农历日：初一朔、十五望，上半月右亮、下半月左亮），
// 左右拖动，让出生那天停在中间的朱红指针下；上方一排月份做粗调，点哪个月胶片就滑过去。
// 手感和上面选年份的刻度尺一样：拖动带惯性，松手吸附到整天。

// 农历日 → 月相亮面的路径：外侧半圆 + 明暗交界的半椭圆；朔日没有亮面
function moonLitPath(lunarDay, r) {
    if (lunarDay <= 1) return '';
    const p = ((lunarDay - 1) % 29.53) / 29.53;
    const k = Math.cos(2 * Math.PI * p);           // 1 = 朔（全暗），-1 = 望（全亮）
    const rx = (r * Math.abs(k)).toFixed(2);
    const waxing = p < .5;
    const outer = waxing ? 1 : 0;
    const inner = waxing ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0);
    return `M0 ${-r}A${r} ${r} 0 0 ${outer} 0 ${r}A${rx} ${r} 0 0 ${inner} 0 ${-r}Z`;
}
function moonPhaseName(lunarDay) {
    if (lunarDay <= 1) return '朔';
    if (lunarDay <= 6) return '蛾眉月';
    if (lunarDay <= 8) return '上弦月';
    if (lunarDay <= 14) return '盈凸月';
    if (lunarDay <= 16) return '望';
    if (lunarDay <= 21) return '亏凸月';
    if (lunarDay <= 23) return '下弦月';
    if (lunarDay <= 29) return '残月';
    return '晦';
}
const BAND_MONTH_CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const BAND_WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

function makeMoonBand(yearInput, monthSel, dayInput) {
    const STEP = 26, H = 76, R = 7.5;
    const root = document.createElement('div');
    root.className = 'band';
    root.innerHTML = `
<div class="band-read" aria-live="polite"><b class="band-date">—</b><span class="band-lunar"></span></div>
<div class="band-months" role="group" aria-label="跳到月份">${BAND_MONTH_CN.map((n, i) => `<button type="button" data-m="${i + 1}">${n}</button>`).join('')}</div>
<div class="band-window" tabindex="0" role="slider" aria-label="出生日期">
  <div class="band-tape"></div>
  <i class="band-needle" aria-hidden="true"></i>
</div>`;
    const read = root.querySelector('.band-date');
    const lunarLine = root.querySelector('.band-lunar');
    const months = Array.from(root.querySelectorAll('.band-months button'));
    const win = root.querySelector('.band-window');
    const tape = root.querySelector('.band-tape');
    const setMonthRaw = hookValue(monthSel, () => fromInputs(true));
    const setDayRaw = hookValue(dayInput, () => fromInputs(true));
    let year = 0, days = [], groups = [], pos = 0, has = false, anim = 0, onIdx = -1, drag = null;

    function readYear() { const y = parseInt(yearInput.value, 10); return y >= 1900 && y <= 2100 ? y : 1990; }
    // 这一年的每一天：公历月日、星期、农历，以及在胶片上的位置
    function build() {
        year = readYear();
        days = [];
        for (let d = new Date(year, 0, 1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
            days.push({ m: d.getMonth() + 1, d: d.getDate(), w: d.getDay(), lu: solarToLunar(year, d.getMonth() + 1, d.getDate()) });
        }
        const parts = [];
        days.forEach((x, i) => {
            const cx = i * STEP + STEP / 2;
            if (x.d === 1) parts.push(`<line class="bt-month" x1="${i * STEP}" x2="${i * STEP}" y1="2" y2="${H - 2}"/><text class="bt-mname" x="${i * STEP + 5}" y="12">${BAND_MONTH_CN[x.m - 1]}月</text>`);
            const lit = x.lu ? moonLitPath(x.lu.day, R) : '';
            const cls = 'bt-day' + (x.lu && x.lu.day === 1 ? ' new' : '') + (x.lu && x.lu.day === 15 ? ' full' : '');
            parts.push(`<g class="${cls}" transform="translate(${cx} 38)"><circle class="bt-dark" r="${R}"/>${lit ? `<path class="bt-lit" d="${lit}"/>` : ''}<text class="bt-num" y="${R + 14}">${x.d}</text></g>`);
        });
        const width = days.length * STEP;
        tape.innerHTML = `<svg width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" aria-hidden="true">${parts.join('')}</svg>`;
        groups = Array.from(tape.querySelectorAll('.bt-day'));
        onIdx = -1;
        win.setAttribute('aria-valuemin', 1);
        win.setAttribute('aria-valuemax', days.length);
    }
    function clamp(v) { return Math.min(days.length - 1, Math.max(0, v)); }
    function indexOf(m, d) {
        const max = new Date(year, m, 0).getDate();
        return days.findIndex(x => x.m === m && x.d === Math.min(d, max));
    }
    function draw() {
        const cx = win.clientWidth / 2;
        tape.style.transform = `translate3d(${(cx - (pos * STEP + STEP / 2)).toFixed(1)}px,0,0)`;
        const i = Math.round(pos), x = days[i];
        if (onIdx !== i) {
            if (groups[onIdx]) groups[onIdx].classList.remove('on');
            if (groups[i]) groups[i].classList.add('on');
            onIdx = i;
        }
        months.forEach(b => b.classList.toggle('on', Number(b.dataset.m) === x.m));
        const shown = has || !!drag;
        if (shown) {
            read.innerHTML = `${x.m}月${x.d}日<small>周${BAND_WEEK_CN[x.w]}</small>`;
            lunarLine.textContent = x.lu ? `${formatLunar(x.lu)} · ${moonPhaseName(x.lu.day)}` : '';
        } else {
            read.textContent = '—';
            lunarLine.textContent = '左右拖动月相带，让出生那天停在指针下';
        }
        root.classList.toggle('empty', !shown);
        win.setAttribute('aria-valuenow', i + 1);
        win.setAttribute('aria-valuetext', has
            ? `${x.m}月${x.d}日` + (x.lu ? `，农历${lunarMonthName(x.lu.month, x.lu.isLeap)}${lunarDayName(x.lu.day)}` : '')
            : '未选择');
    }
    function commit(i) {
        const x = days[i];
        has = true;
        setMonthRaw(String(x.m));
        setDayRaw(String(x.d));
        draw();
    }
    function animateTo(target, doCommit) {
        cancelAnimationFrame(anim);
        target = clamp(Math.round(target));
        const from = pos, t0 = performance.now();
        // 跨得越远滑得越久，但不超过 0.9 秒
        const dur = _reduceMotion() ? 0 : Math.min(900, 280 + Math.abs(target - from) * 6);
        const stepFn = now => {
            const t = dur ? Math.min(1, (now - t0) / dur) : 1;
            pos = from + (target - from) * (1 - Math.pow(1 - t, 3));
            draw();
            if (t < 1) anim = requestAnimationFrame(stepFn);
            else if (doCommit) commit(target);
        };
        anim = requestAnimationFrame(stepFn);
    }
    function fromInputs(animated) {
        if (readYear() !== year) build();
        const m = parseInt(monthSel.value, 10), d = parseInt(dayInput.value, 10);
        if (m >= 1 && m <= 12 && d >= 1) {
            has = true;
            const i = indexOf(m, d);
            if (animated && root.isConnected && root.offsetParent) animateTo(i, false);
            else { pos = i; draw(); }
        } else {
            has = false;
            pos = indexOf(6, 15);
            draw();
        }
    }

    // 拖动：松手后带一点惯性再吸附到整天；轻点某一天直接滑过去
    win.addEventListener('pointerdown', e => {
        cancelAnimationFrame(anim);
        win.setPointerCapture(e.pointerId);
        drag = { x: e.clientX, pos, lastX: e.clientX, lastT: performance.now(), v: 0, moved: false };
        root.classList.add('dragging');
    });
    win.addEventListener('pointermove', e => {
        if (!drag) return;
        const now = performance.now(), dx = e.clientX - drag.x;
        if (Math.abs(dx) > 3) drag.moved = true;
        pos = clamp(drag.pos - dx / STEP);
        drag.v = (e.clientX - drag.lastX) / Math.max(1, now - drag.lastT);
        drag.lastX = e.clientX; drag.lastT = now;
        draw();
    });
    const end = e => {
        if (!drag) return;
        root.classList.remove('dragging');
        const r = win.getBoundingClientRect();
        const target = drag.moved ? pos - drag.v * 260 / STEP : pos + (e.clientX - (r.left + r.width / 2)) / STEP;
        drag = null;
        animateTo(target, true);
    };
    win.addEventListener('pointerup', end);
    win.addEventListener('pointercancel', end);
    // 只认横向滚动，竖向滚轮留给设置面板
    win.addEventListener('wheel', e => {
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
        if (!d) return;
        e.preventDefault();
        animateTo(Math.round(pos) + Math.sign(d) * (Math.abs(d) > 60 ? 3 : 1), true);
    }, { passive: false });
    win.addEventListener('keydown', e => {
        const i = Math.round(pos), x = days[i];
        let target = null;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') target = i - 1;
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') target = i + 1;
        else if (e.key === 'PageUp') target = indexOf(Math.max(1, x.m - 1), x.d);
        else if (e.key === 'PageDown') target = indexOf(Math.min(12, x.m + 1), x.d);
        else if (e.key === 'Home') target = 0;
        else if (e.key === 'End') target = days.length - 1;
        if (target == null) return;
        e.preventDefault();
        animateTo(target, true);
    });
    months.forEach(b => b.addEventListener('click', () => {
        const x = days[Math.round(pos)];
        animateTo(indexOf(Number(b.dataset.m), has ? x.d : 1), true);
    }));
    if (window.ResizeObserver) new ResizeObserver(draw).observe(win);
    root._refresh = () => fromInputs(false);
    build();
    fromInputs(false);
    return root;
}

// ---------- 时辰：十二时辰钟，拖指针选 ----------
function makeHourDial(sel) {
    const NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const RANGE = ['23–1', '1–3', '3–5', '5–7', '7–9', '9–11', '11–13', '13–15', '15–17', '17–19', '19–21', '21–23'];
    const pt = (r, deg) => { const a = deg * Math.PI / 180; return [(r * Math.sin(a)).toFixed(2), (-r * Math.cos(a)).toFixed(2)]; };
    const arc = (r1, r2, a1, a2) => {
        const [x1, y1] = pt(r2, a1), [x2, y2] = pt(r2, a2), [x3, y3] = pt(r1, a2), [x4, y4] = pt(r1, a1);
        const big = (a2 - a1) > 180 ? 1 : 0;
        return `M${x1} ${y1}A${r2} ${r2} 0 ${big} 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 ${big} 0 ${x4} ${y4}Z`;
    };
    const parts = [];
    // 夜半（18 点到 6 点，经过子时）深一些
    parts.push(`<path class="hd-night" d="${arc(56, 98, -90, 90)}"/>`);
    parts.push('<circle class="hd-ring" r="98"/><circle class="hd-ring" r="56"/>');
    for (let h = 0; h < 24; h++) {
        const deg = h * 15;
        const odd = h % 2 === 1;
        const [x1, y1] = pt(98, deg), [x2, y2] = pt(odd ? 86 : 92, deg);
        parts.push(`<line class="${odd ? 'hd-bound' : 'hd-tick'}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
        if (odd) { const [tx, ty] = pt(108, deg); parts.push(`<text class="hd-hour" x="${tx}" y="${ty}">${h}</text>`); }
    }
    NAMES.forEach((n, i) => { const [x, y] = pt(73, i * 30); parts.push(`<text class="hd-name" data-i="${i}" x="${x}" y="${y}">${n}</text>`); });
    const root = document.createElement('div');
    root.className = 'dial';
    root.tabIndex = 0;
    root.setAttribute('role', 'slider');
    root.setAttribute('aria-label', '出生时辰');
    root.setAttribute('aria-valuemin', 0);
    root.setAttribute('aria-valuemax', 11);
    root.innerHTML = `
<svg viewBox="-120 -120 240 240" aria-hidden="true">
  <g class="hd-face">${parts.join('')}</g>
  <g class="hd-sel"><path d="${arc(56, 98, -15, 15)}"/></g>
  <g class="hd-hand"><line x1="0" y1="-56" x2="0" y2="-90"/><circle cy="-90" r="6"/></g>
</svg>
<div class="dial-read"><b>—</b><span>拖动指针</span></div>`;
    const svg = root.querySelector('svg');
    const hand = root.querySelector('.hd-hand');
    const selG = root.querySelector('.hd-sel');
    const read = root.querySelector('.dial-read');
    const setRaw = hookValue(sel, () => fromSel());
    let angle = 0, has = false;   // angle 是累计角度，避免从亥转到子时绕一大圈

    function setHand(deg, smooth) {
        hand.style.transition = smooth && !_reduceMotion() ? 'transform .45s cubic-bezier(.3,1.4,.5,1)' : 'none';
        hand.style.transform = `rotate(${deg}deg)`;
    }
    function nearest(deg) { return ((Math.round(deg / 30) % 12) + 12) % 12; }
    function show(i) {
        selG.style.transform = `rotate(${i * 30}deg)`;
        root.querySelectorAll('.hd-name').forEach(t => t.classList.toggle('on', Number(t.dataset.i) === i));
        read.innerHTML = `<b>${NAMES[i]}时</b><span>${RANGE[i]} 点</span>`;
        root.setAttribute('aria-valuenow', i);
        root.setAttribute('aria-valuetext', `${NAMES[i]}时，${RANGE[i]} 点`);
    }
    function turnTo(i, smooth) {
        const target = i * 30;
        let d = ((target - angle) % 360 + 540) % 360 - 180;
        angle += d;
        setHand(angle, smooth);
        show(i);
    }
    function commit(i) {
        has = true;
        root.classList.remove('empty');
        if (sel.value !== String(i)) {
            setRaw(String(i));
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        turnTo(i, true);
    }
    function fromSel() {
        const i = parseInt(sel.value, 10);
        if (i >= 0 && i <= 11) { has = true; root.classList.remove('empty'); turnTo(i, root.isConnected); }
        else {
            has = false;
            root.classList.add('empty');
            selG.style.transform = 'rotate(0deg)';
            read.innerHTML = '<b>—</b><span>拖动指针</span>';
            root.querySelectorAll('.hd-name').forEach(t => t.classList.remove('on'));
        }
    }
    function pointerDeg(e) {
        const r = svg.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    }
    let dragging = false;
    svg.addEventListener('pointerdown', e => {
        dragging = true;
        svg.setPointerCapture(e.pointerId);
        root.classList.add('dragging');
        root.classList.remove('empty');
        move(e);
    });
    function move(e) {
        const deg = pointerDeg(e);
        let d = ((deg - angle) % 360 + 540) % 360 - 180;
        angle += d;
        setHand(angle, false);
        show(nearest(deg));
    }
    svg.addEventListener('pointermove', e => { if (dragging) move(e); });
    const end = e => {
        if (!dragging) return;
        dragging = false;
        root.classList.remove('dragging');
        commit(nearest(pointerDeg(e)));
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    root.addEventListener('keydown', e => {
        const cur = has ? parseInt(sel.value, 10) : -1;
        const map = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (map[e.key] !== undefined) { e.preventDefault(); commit(((cur < 0 ? 0 : cur + map[e.key]) + 12) % 12); }
    });
    fromSel();
    return root;
}

// ---------- AI 配置：图纸页签 ----------
function makeProfileTabs(sel) {
    const root = document.createElement('div');
    root.className = 'tabs';
    root.setAttribute('role', 'tablist');
    root.setAttribute('aria-label', 'AI 配置');
    const build = () => {
        root.innerHTML = Array.from(sel.options).map(o =>
            `<button type="button" role="tab" class="tab" data-value="${o.value}" aria-selected="${o.value === sel.value}">${escHtml(o.textContent)}</button>`
        ).join('');
    };
    const sync = () => root.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.value === sel.value)));
    hookValue(sel, sync);
    new MutationObserver(build).observe(sel, { childList: true, subtree: true, characterData: true });
    sel.addEventListener('change', sync);
    root.addEventListener('click', e => {
        const t = e.target.closest('.tab');
        if (!t || t.dataset.value === sel.value) return;
        sel.value = t.dataset.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
    });
    root.addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const tabs = Array.from(root.querySelectorAll('.tab'));
        const i = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        if (next) { next.click(); next.focus(); }
    });
    build();
    return root;
}

document.addEventListener('DOMContentLoaded', () => {
    const year = document.getElementById('baziYear');
    const month = document.getElementById('baziMonth');
    const day = document.getElementById('baziDay');
    const hour = document.getElementById('baziHour');
    const slots = {
        ruler: document.getElementById('rulerSlot'),
        cal: document.getElementById('calSlot'),
        dial: document.getElementById('dialSlot')
    };
    if (year && month && day && hour && slots.ruler) {
        let cal = null;
        slots.ruler.appendChild(makeYearRuler(year, () => { if (cal) cal._refresh(); }));
        cal = makeMoonBand(year, month, day);
        slots.cal.appendChild(cal);
        slots.dial.appendChild(makeHourDial(hour));
    }
    const prof = document.getElementById('aiProfileSelect');
    if (prof) {
        const tabs = makeProfileTabs(prof);
        prof.after(tabs);
        prof.classList.add('sr-native');
        prof.tabIndex = -1;
        prof.setAttribute('aria-hidden', 'true');
    }
});
