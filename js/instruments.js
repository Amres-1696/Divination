// instruments —— 生辰与配置的输入器具
// 年份是一列竖向的年轮，月日是一条可拖动的月相带，时辰是一面十二时辰钟（拖指针选）。
// 原生 input / select 仍是数据源（settings.js 照常读写），显示在最上面，敲数字是主要的填法；
// 下面一张「生辰签」写出换算后的农历年、月日、时辰，点签上哪一段，就展开那一件器具来拨（平时都收着）。
// 这里只负责画和同步：敲了数字器具和生辰签跟着变，拨了器具输入框跟着变。

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

// ---------- 年：年轮 ----------
// 竖向滚轮：一列年份上下滚，停在中间读数框里的就是出生年份。每一行写出年份和这一年的干支、生肖，
// 中间一行最大最亮，越往上下越小越淡。拖动带惯性、松手吸附到整年；滚轮、点某一行、上下键也都能选。
// 方向是竖的，和下面横向拖动的月相带、圆形的时辰钟区分开。
const YEAR_ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

function makeYearWheel(input, onChange) {
    const MIN = 1900, MAX = 2100, ROW = 40, DEFAULT = 1990;
    const root = document.createElement('div');
    root.className = 'yw';
    const rows = [];
    for (let y = MIN; y <= MAX; y++) {
        rows.push(`<div class="yw-row" data-y="${y}"><b>${y}</b><span>${ganZhiYear(y)} · ${YEAR_ZODIAC[lunarYearBranch(y) - 1]}</span></div>`);
    }
    root.innerHTML = `
<div class="yw-window" tabindex="0" role="slider" aria-label="出生年份（公历）" aria-valuemin="${MIN}" aria-valuemax="${MAX}">
  <div class="yw-list">${rows.join('')}</div>
  <i class="yw-frame" aria-hidden="true"></i>
</div>
<p class="yw-note" aria-live="polite"></p>`;
    const win = root.querySelector('.yw-window');
    const list = root.querySelector('.yw-list');
    const rowEls = Array.from(list.children);
    const note = root.querySelector('.yw-note');
    const setRaw = hookValue(input, () => fromInput(true));
    // 直接在输入框里敲年份时，年轮跟着转过去（input 事件只在用户输入时触发，不会和 commit 互相触发）
    input.addEventListener('input', () => fromInput(true));
    let pos = DEFAULT - MIN, has = false, anim = 0, drag = null, drawn = [];

    // 这一年正月初一落在公历哪天
    function newYearDay(y) {
        for (let d = new Date(y, 0, 15); d.getMonth() < 3; d.setDate(d.getDate() + 1)) {
            const lu = solarToLunar(y, d.getMonth() + 1, d.getDate());
            if (lu && lu.month === 1 && lu.day === 1 && !lu.isLeap) return `${d.getMonth() + 1}月${d.getDate()}日`;
        }
        return '';
    }
    const clamp = v => Math.min(MAX - MIN, Math.max(0, v));
    function draw() {
        const mid = win.clientHeight / 2;
        list.style.transform = `translate3d(0,${(mid - (pos * ROW + ROW / 2)).toFixed(1)}px,0)`;
        // 只给中间附近几行算大小和亮度：离中间越远越小越淡；上一次画过、这次不在范围里的行先复位
        const c = Math.round(pos);
        const near = [];
        for (let i = Math.max(0, c - 4); i <= Math.min(rowEls.length - 1, c + 4); i++) near.push(i);
        drawn.forEach(i => { if (!near.includes(i)) { rowEls[i].style.setProperty('--k', 0); rowEls[i].classList.remove('on'); } });
        near.forEach(i => {
            const dist = Math.min(3, Math.abs(i - pos));
            rowEls[i].style.setProperty('--k', (1 - dist / 3).toFixed(3));
            rowEls[i].classList.toggle('on', i === c);
        });
        drawn = near;
        const y = MIN + c, shown = has || !!drag;
        root.classList.toggle('empty', !shown);
        if (shown) {
            const ny = newYearDay(y);
            // 只说规则，不替人下结论：是不是春节前出生要看月日，生辰签上会写明
            note.textContent = ny ? `${y} 年的春节在 ${ny}，这天之前出生的，农历算上一年（${ganZhiYear(y - 1)}年）` : '';
        } else {
            note.textContent = '上下滑动年轮，选出生年份';
        }
        win.setAttribute('aria-valuenow', y);
        win.setAttribute('aria-valuetext', has ? `${y} 年，${ganZhiYear(y)}年，属${YEAR_ZODIAC[lunarYearBranch(y) - 1]}` : '未选择');
    }
    function commit(i) {
        has = true;
        setRaw(String(MIN + i));
        draw();
        if (onChange) onChange(MIN + i);
        // 告诉设置面板生辰有变化（判断「已保存 / 有改动」）
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function animateTo(target, doCommit) {
        cancelAnimationFrame(anim);
        target = clamp(Math.round(target));
        const from = pos, t0 = performance.now();
        const dur = _reduceMotion() ? 0 : Math.min(800, 260 + Math.abs(target - from) * 12);
        const stepFn = now => {
            const t = dur ? Math.min(1, (now - t0) / dur) : 1;
            pos = from + (target - from) * (1 - Math.pow(1 - t, 3));
            draw();
            if (t < 1) anim = requestAnimationFrame(stepFn);
            else if (doCommit) commit(target);
        };
        anim = requestAnimationFrame(stepFn);
    }
    // 生辰这一组展开时，年轮从二十几年前顺势转过来，停在所选（或默认）的那一年
    root.spinIn = () => {
        if (_reduceMotion() || drag) return;
        // 终点按已选的年份算，不按此刻的位置（上一次还没转完时会停在半路）
        const v = parseInt(input.value, 10);
        const target = v >= MIN && v <= MAX ? v - MIN : DEFAULT - MIN;
        pos = clamp(target - 24 < 0 ? target + 24 : target - 24);   // 靠近 1900 年时从另一头转过来
        draw();
        animateTo(target, false);
    };
    function fromInput(animated) {
        const v = parseInt(input.value, 10);
        if (v >= MIN && v <= MAX) {
            has = true;
            if (animated && root.isConnected && root.offsetParent) animateTo(v - MIN, false);
            else { pos = v - MIN; draw(); }
        } else { has = false; pos = DEFAULT - MIN; draw(); }
        if (onChange) onChange(has ? v : null);
    }

    // 上下拖动：松手带一点惯性再吸附到整年；轻点某一行就滚到那一年
    win.addEventListener('pointerdown', e => {
        cancelAnimationFrame(anim);
        win.setPointerCapture(e.pointerId);
        drag = { y: e.clientY, pos, lastY: e.clientY, lastT: performance.now(), v: 0, moved: false };
        root.classList.add('dragging');
    });
    win.addEventListener('pointermove', e => {
        if (!drag) return;
        const now = performance.now(), dy = e.clientY - drag.y;
        if (Math.abs(dy) > 3) drag.moved = true;
        pos = clamp(drag.pos - dy / ROW);
        drag.v = (e.clientY - drag.lastY) / Math.max(1, now - drag.lastT);
        drag.lastY = e.clientY; drag.lastT = now;
        draw();
    });
    const end = e => {
        if (!drag) return;
        root.classList.remove('dragging');
        const r = win.getBoundingClientRect();
        const target = drag.moved ? pos - drag.v * 220 / ROW : pos + (e.clientY - (r.top + r.height / 2)) / ROW;
        drag = null;
        animateTo(target, true);
    };
    win.addEventListener('pointerup', end);
    win.addEventListener('pointercancel', end);
    // 滚轮转年轮：鼠标停在年轮上时才接管，滚一格走一年
    win.addEventListener('wheel', e => {
        if (!e.deltaY) return;
        e.preventDefault();
        animateTo(Math.round(pos) + Math.sign(e.deltaY) * (Math.abs(e.deltaY) > 90 ? 2 : 1), true);
    }, { passive: false });
    win.addEventListener('keydown', e => {
        const i = Math.round(pos);
        const map = { ArrowUp: -1, ArrowDown: 1, PageUp: -10, PageDown: 10 };
        let target = map[e.key] !== undefined ? i + map[e.key] : e.key === 'Home' ? 0 : e.key === 'End' ? MAX - MIN : null;
        if (target == null) return;
        e.preventDefault();
        animateTo(target, true);
    });
    if (window.ResizeObserver) new ResizeObserver(draw).observe(win);
    fromInput(false);
    return root;
}

// ---------- 月、日：月相带 ----------
// 一整年的月相排成一条胶片（按农历日：初一朔、十五望，上半月右亮、下半月左亮），
// 左右拖动，让出生那天停在中间的指针下；上方一排月份做粗调，点哪个月胶片就滑过去。
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
    monthSel.addEventListener('input', () => fromInputs(true));
    dayInput.addEventListener('input', () => fromInputs(true));
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
            lunarLine.textContent = x.lu ? `${formatLunar(x.lu)} · ${moonPhaseName(x.lu.day)}` : '早于 1900 年春节，查不到农历，按公历日期起卦';
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
        dayInput.dispatchEvent(new Event('change', { bubbles: true }));
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
    // 生辰这一组展开时，月相带跟着年轮一起从一个多月前滑过来，停在所选（或默认）的那一天
    root.spinIn = () => {
        if (_reduceMotion() || drag) return;
        // 终点按已选的月日算，不按此刻的位置（上一次还没滑完时会停在半路）
        if (readYear() !== year) build();
        const m = parseInt(monthSel.value, 10), d = parseInt(dayInput.value, 10);
        const target = m >= 1 && m <= 12 && d >= 1 ? indexOf(m, d) : indexOf(6, 15);
        pos = clamp(target - 40 < 0 ? target + 40 : target - 40);   // 年初的日子从另一头滑过来
        draw();
        animateTo(target, false);
    };
    build();
    fromInputs(false);
    return root;
}

// ---------- 时辰：十二时辰钟，拖指针选 ----------
function makeHourDial(sel) {
    const NAMES = DI_ZHI;
    // 子时以 0 点为界分成两半：0–1 点是当天的早子时（0），23–24 点是晚子时（12），按「子初换日」算第二天
    const RANGE = ['0–1', '1–3', '3–5', '5–7', '7–9', '9–11', '11–13', '13–15', '15–17', '17–19', '19–21', '21–23', '23–24'];
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
    root.setAttribute('aria-valuemax', 12);
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
    sel.addEventListener('input', () => fromSel());
    let angle = 0, has = false;   // angle 是累计角度，避免从亥转到子时绕一大圈

    function setHand(deg, smooth) {
        hand.style.transition = smooth && !_reduceMotion() ? 'transform .45s cubic-bezier(.3,1.4,.5,1)' : 'none';
        hand.style.transform = `rotate(${deg}deg)`;
    }
    // 指针落在子时格里 0 点刻度左边（23–24 点）就是晚子时
    function nearest(deg) { const i = ((Math.round(deg / 30) % 12) + 12) % 12; return i === 0 && deg > 180 ? 12 : i; }
    function show(i) {
        const z = i % 12, note = i === 12 ? '，算作次日' : '';
        selG.style.transform = `rotate(${z * 30}deg)`;
        root.querySelectorAll('.hd-name').forEach(t => t.classList.toggle('on', Number(t.dataset.i) === z));
        read.innerHTML = `<b>${NAMES[z]}时</b><span>${RANGE[i]} 点${note}</span>`;
        root.setAttribute('aria-valuenow', i);
        root.setAttribute('aria-valuetext', `${NAMES[z]}时，${RANGE[i]} 点${note}`);
    }
    function turnTo(i, smooth) {
        // 子时的指针停在所选那半格的正中，看得出是 0 点前还是 0 点后
        const target = i === 12 ? -7.5 : i === 0 ? 7.5 : i * 30;
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
        if (i >= 0 && i <= 12) { has = true; root.classList.remove('empty'); turnTo(i, root.isConnected); }
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
        // 顺着一天走：早子 → 丑 … 亥 → 晚子 → 早子
        if (map[e.key] !== undefined) { e.preventDefault(); commit(((cur < 0 ? 0 : cur + map[e.key]) + 13) % 13); }
    });
    // 生辰这一组展开时，指针和选中的时辰格一起顺时针转一整圈回到原位
    root.spinIn = () => {
        if (_reduceMotion() || dragging || !hand.animate) return;
        const sweep = { duration: 1000, easing: 'cubic-bezier(.25, .7, .3, 1)' };
        hand.animate([{ transform: `rotate(${angle - 360}deg)` }, { transform: `rotate(${angle}deg)` }], sweep);
        const selDeg = parseFloat((selG.style.transform.match(/-?[\d.]+/) || [0])[0]) || 0;
        selG.animate([{ transform: `rotate(${selDeg - 360}deg)` }, { transform: `rotate(${selDeg}deg)` }], sweep);
    };
    fromSel();
    return root;
}

// ---------- 生辰签 ----------
// 把输入框里的公历生辰换成起卦实际用的农历：年写干支和生肖，月日配当天的月相，时辰配一个小钟面。
// 春节前出生、23 点后出生（算作次日）这两种容易弄错的情况，在签下面单独说一句。
// 签上三段各是一个按钮：点开下面对应的器具，再点一下收起；开一件时另外两件自动收起。
const HOUR_RANGE = ['0–1', '1–3', '3–5', '5–7', '7–9', '9–11', '11–13', '13–15', '15–17', '17–19', '19–21', '21–23', '23–24'];
function birthSlipData(y, m, d, h) {
    const okDate = y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= new Date(y, m, 0).getDate();
    const okHour = h >= 0 && h <= 12;
    let lu = null, ny = '';
    if (okDate) {
        // 23 点后（晚子时）按次日算，和 birthNumbers 一致
        const used = okHour && h === 12 ? new Date(y, m - 1, d + 1) : new Date(y, m - 1, d);
        lu = solarToLunar(used.getFullYear(), used.getMonth() + 1, used.getDate());
        if (lu && lu.year < used.getFullYear()) {
            for (let t = new Date(used.getFullYear(), 0, 15); t.getMonth() < 3; t.setDate(t.getDate() + 1)) {
                const x = solarToLunar(t.getFullYear(), t.getMonth() + 1, t.getDate());
                if (x && x.month === 1 && x.day === 1 && !x.isLeap) { ny = `${t.getMonth() + 1} 月 ${t.getDate()} 日`; break; }
            }
        }
    }
    const notes = [];
    if (ny) notes.push(`那年春节在 ${ny}，你在春节前出生，农历算${ganZhiYear(lu.year)}年`);
    if (okDate && okHour && h === 12) notes.push(`23 点后出生算作次日，月日按${lunarMonthName(lu ? lu.month : m, lu && lu.isLeap)}${lu ? lunarDayName(lu.day) : ''}算`);
    if (okDate && !lu) notes.push('早于 1900 年春节，查不到农历，按公历日期起卦');
    return { okDate, okHour, lu, h, note: notes.join('；') };
}
function initBirthSlip(year, month, day, hour) {
    const slip = document.getElementById('birthSlip');
    const note = document.getElementById('slipNote');
    if (!slip) return;
    const parts = {};
    slip.querySelectorAll('.slip-part').forEach(b => { parts[b.dataset.tool] = b; });
    const tools = {};
    document.querySelectorAll('.birth-tool').forEach(t => { tools[t.dataset.tool] = t; });
    const set = (part, main, sub, ico) => {
        part.classList.toggle('empty', !main);
        part.querySelector('b').textContent = main || '未填';
        part.querySelector('small').textContent = sub || '点这里拨';
        const i = part.querySelector('.slip-ico');
        if (i) i.innerHTML = ico || '';
    };
    function render() {
        const x = birthSlipData(parseInt(year.value, 10), parseInt(month.value, 10), parseInt(day.value, 10), parseInt(hour.value, 10));
        const y = parseInt(year.value, 10);
        const ly = x.lu ? x.lu.year : (y >= 1900 && y <= 2100 ? y : 0);
        if (ly) {
            const br = lunarYearBranch(ly) - 1;
            set(parts.year, `${ganZhiYear(ly)}年`, `属${YEAR_ZODIAC[br]}`, typeof ZODIAC_SVG !== 'undefined' ? ZODIAC_SVG[br] : '');
        } else set(parts.year, '', '');
        if (x.lu) {
            const r = 9, lit = moonLitPath(x.lu.day, r);
            set(parts.cal, `${lunarMonthName(x.lu.month, x.lu.isLeap)}${lunarDayName(x.lu.day)}`, moonPhaseName(x.lu.day),
                `<svg viewBox="-11 -11 22 22"><circle class="m-dark" r="${r}"/>${lit ? `<path class="m-lit" d="${lit}"/>` : ''}</svg>`);
        } else if (x.okDate) set(parts.cal, `${parseInt(month.value, 10)}月${parseInt(day.value, 10)}日`, '公历');
        else set(parts.cal, '', '');
        if (x.okHour) {
            const z = x.h % 12, deg = x.h === 12 ? -7.5 : x.h === 0 ? 7.5 : x.h * 30, a = deg * Math.PI / 180;
            set(parts.dial, `${DI_ZHI[z]}时`, `${HOUR_RANGE[x.h]} 点`,
                `<svg viewBox="-11 -11 22 22"><circle class="c-ring" r="9.5"/>${[0, 90, 180, 270].map(t => `<line class="c-tick" x1="0" y1="-9.5" x2="0" y2="-7.5" transform="rotate(${t})"/>`).join('')}<line class="c-hand" x1="0" y1="0" x2="${(6.5 * Math.sin(a)).toFixed(2)}" y2="${(-6.5 * Math.cos(a)).toFixed(2)}"/><circle class="c-dot" r="1.5"/></svg>`);
        } else set(parts.dial, '', '');
        if (note) note.textContent = x.note;
    }
    function open(name) {
        Object.keys(tools).forEach(k => {
            const on = k === name;
            tools[k].classList.toggle('open', on);
            tools[k].inert = !on;
            parts[k].setAttribute('aria-expanded', String(on));
        });
        const inst = name && tools[name].querySelector('.yw, .band, .dial');
        if (inst && inst.spinIn) setTimeout(() => inst.spinIn(), 60);
    }
    slip.addEventListener('click', e => {
        const b = e.target.closest('.slip-part');
        if (!b) return;
        open(b.getAttribute('aria-expanded') === 'true' ? null : b.dataset.tool);
    });
    // 输入框的值有三种来路：手敲（input）、器具拨完（change）、程序写入（恢复设置时直接赋 value）。
    // 第三种不发事件，所以在器具挂上的 value 写入钩子外面再包一层（不能用 hookValue，会把器具的钩子覆盖掉）
    [year, month, day, hour].forEach(el => {
        el.addEventListener('input', render);
        el.addEventListener('change', render);
        const own = Object.getOwnPropertyDescriptor(el, 'value');
        if (own && own.set) Object.defineProperty(el, 'value', {
            configurable: true,
            get() { return own.get.call(this); },
            set(v) { own.set.call(this, v); render(); }
        });
    });
    render();
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
        year: document.getElementById('yearSlot'),
        cal: document.getElementById('calSlot'),
        dial: document.getElementById('dialSlot')
    };
    if (year && month && day && hour && slots.year) {
        let cal = null;
        slots.year.appendChild(makeYearWheel(year, () => { if (cal) cal._refresh(); }));
        cal = makeMoonBand(year, month, day);
        slots.cal.appendChild(cal);
        slots.dial.appendChild(makeHourDial(hour));
        initBirthSlip(year, month, day, hour);
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
