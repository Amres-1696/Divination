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
    root.addEventListener('wheel', e => {
        e.preventDefault();
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
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

// ---------- 月、日：带农历的小月历 ----------
function makeBirthCalendar(yearInput, monthSel, dayInput) {
    const root = document.createElement('div');
    root.className = 'cal';
    root.innerHTML = `
<div class="cal-head">
  <button type="button" class="cal-nav" data-d="-1" aria-label="上个月"></button>
  <span class="cal-title" aria-live="polite"></span>
  <button type="button" class="cal-nav next" data-d="1" aria-label="下个月"></button>
</div>
<div class="cal-week" aria-hidden="true"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
<div class="cal-grid" role="grid" aria-label="出生日期"></div>
<p class="cal-lunar"></p>`;
    const title = root.querySelector('.cal-title');
    const grid = root.querySelector('.cal-grid');
    const lunarLine = root.querySelector('.cal-lunar');
    const setMonthRaw = hookValue(monthSel, () => render(0));
    const setDayRaw = hookValue(dayInput, () => render(0));
    let viewYear = 1990, viewMonth = 1;

    function readYear() { const y = parseInt(yearInput.value, 10); return y >= 1900 && y <= 2100 ? y : 1990; }
    function render(dir) {
        viewYear = readYear();
        const m = parseInt(monthSel.value, 10);
        if (m >= 1 && m <= 12) viewMonth = m;
        const days = new Date(viewYear, viewMonth, 0).getDate();
        const first = new Date(viewYear, viewMonth - 1, 1).getDay();
        let d = parseInt(dayInput.value, 10);
        if (d > days) { d = days; setDayRaw(String(d)); }
        title.innerHTML = `<b>${viewYear}</b> 年 <b>${viewMonth}</b> 月`;
        const cells = [];
        for (let k = 0; k < first; k++) cells.push('<span class="cal-blank"></span>');
        for (let day = 1; day <= days; day++) {
            const lu = solarToLunar(viewYear, viewMonth, day);
            const lname = lu ? (lu.day === 1 ? lunarMonthName(lu.month, lu.isLeap) : lunarDayName(lu.day)) : '';
            const sel = day === d && monthSel.value !== '';
            cells.push(`<button type="button" class="cal-day${sel ? ' on' : ''}${lu && lu.day === 1 ? ' new-moon' : ''}" data-day="${day}" aria-pressed="${sel}" aria-label="${viewMonth}月${day}日">${day}<small>${lname}</small></button>`);
        }
        grid.innerHTML = cells.join('');
        if (dir) {
            grid.classList.remove('slide-l', 'slide-r');
            grid.offsetHeight;
            grid.classList.add(dir > 0 ? 'slide-l' : 'slide-r');
        }
        const hasDate = d >= 1 && monthSel.value !== '';
        const lu = hasDate ? solarToLunar(viewYear, viewMonth, d) : null;
        lunarLine.textContent = hasDate ? (lu ? formatLunar(lu) : '') : '点选出生那天，下面会显示农历';
        lunarLine.classList.toggle('muted', !hasDate);
    }
    root.querySelectorAll('.cal-nav').forEach(b => b.addEventListener('click', () => {
        let m = viewMonth + Number(b.dataset.d);
        let y = readYear();
        if (m < 1) { m = 12; if (y > 1900) yearInput.value = String(y - 1); }
        if (m > 12) { m = 1; if (y < 2100) yearInput.value = String(y + 1); }
        setMonthRaw(String(m));
        render(Number(b.dataset.d));
    }));
    grid.addEventListener('click', e => {
        const b = e.target.closest('.cal-day');
        if (!b) return;
        setMonthRaw(String(viewMonth));
        setDayRaw(b.dataset.day);
        render(0);
    });
    root._refresh = () => render(0);
    render(0);
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
        cal = makeBirthCalendar(year, month, day);
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
