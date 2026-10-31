// theme —— 页面视图切换（首页 / 仪式 / 结果）与转场，起卦方式切换控件

let _viewBusy = false;

function setPageView(view) {
    document.body.classList.toggle('view-home', view === 'home');
    document.body.classList.toggle('view-result', view === 'result');
    document.body.classList.toggle('view-ritual', view === 'ritual');
    const home = document.getElementById('homeView');
    if (home) home.hidden = view !== 'home';
}

// 首页内容依次进场（标题、说明、表单、今日一卦）
function playHomeEnter(delay) {
    const home = document.getElementById('homeView');
    if (!home) return;
    home.style.setProperty('--enter-delay', (delay || 0) + 'ms');
    home.classList.remove('entering');
    home.offsetHeight;
    home.classList.add('entering');
    clearTimeout(playHomeEnter._t);
    playHomeEnter._t = setTimeout(() => home.classList.remove('entering'), 1800 + (delay || 0));
}

// 结果页 → 首页：卦画从结果页飞回圆图原位，其余卦沿圆周亮起，首页内容随后进场
async function returnToInquiry(opts) {
    opts = opts || {};
    if (_divineRunning) { showToast('请先掷完六爻，或跳过仪式'); return; }
    if (_viewBusy) return;
    _viewBusy = true;
    const resultArea = document.getElementById('resultArea');
    const page = resultArea.querySelector('.result');
    const glyph = resultArea.querySelector('#resultGlyph');
    let lifted = false;
    if (page) {
        // 之卦视图先切回本卦，飞回圆图的是本卦
        const zb = resultArea.querySelector('#benBtn');
        if (zb && resultArea.querySelector('.result-header.as-zhi')) zb.click();
        if (glyph && typeof Cosmos !== 'undefined') {
            const rect = glyph.getBoundingClientRect();
            lifted = Cosmos.lift(Number(glyph.dataset.v), rect);
            if (lifted) glyph.style.visibility = 'hidden';
        }
        page.classList.add('leaving');
        await sleep(340);
    }
    window.scrollTo({ top: 0 });
    resultArea.innerHTML = '';
    setPageView('home');
    if (typeof Cosmos !== 'undefined') Cosmos.toCircle();
    playHomeEnter(lifted ? 650 : 150);
    const q = document.getElementById('question');
    if (q) {
        if (opts.clear) { q.value = ''; q.dispatchEvent(new Event('input')); }
        q.focus({ preventScroll: true });
    }
    _viewBusy = false;
}

// ---------- 挂签 → 页面：签条先往下拉长成一根竖条，再向两边铺开成整页；关闭时原路收回签条 ----------
const PANEL_TAG = { historyPanel: 'historyBtn', settingsPanel: 'settingsGear' };
function morphPanelFromTag(panel, open) {
    const tag = document.getElementById(PANEL_TAG[panel.id]);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!tag || !panel.animate || reduce) return;
    if (panel.id === 'historyPanel') return archiveFlight(panel, tag, open);
    // 打断上一次还没放完的开合
    [panel, ...panel.children].forEach(el => el.getAnimations().forEach(a => a.cancel()));
    // morphing 期间面板固定在展开位置、可见、不走 CSS 过渡，形状全由 clip-path 决定
    panel.classList.add('morphing');
    const p = panel.getBoundingClientRect(), t = tag.getBoundingClientRect();
    const top = t.top - p.top, left = t.left - p.left, right = p.right - t.right, bottom = p.bottom - t.bottom;
    const atTag = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
    const strip = `inset(${top}px ${right}px 0px ${left}px)`;
    const full = 'inset(0px 0px 0px 0px)';
    const shape = [{ clipPath: atTag }, { clipPath: strip, offset: .42 }, { clipPath: full }];
    const ease = 'cubic-bezier(.65, 0, .25, 1)';
    const kids = Array.from(panel.children);
    let anim;
    if (open) {
        anim = panel.animate(shape, { duration: 720, easing: ease });
        kids.forEach(el => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: 420, easing: 'ease', fill: 'backwards' }));
    } else {
        kids.forEach(el => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease', fill: 'forwards' }));
        anim = panel.animate(shape.slice().reverse().map((k, i) => ({ ...k, offset: [0, .58, 1][i] })),
            { duration: 600, delay: 120, easing: ease, fill: 'forwards' });
    }
    // 收尾时关掉 CSS 过渡再撤 morphing：否则收回签条之后面板还会再滑走 / 淡出一遍
    const settle = () => {
        panel.style.transition = 'none';
        panel.classList.remove('morphing');
        panel.offsetHeight;
        panel.style.transition = '';
    };
    anim.onfinish = () => {
        settle();
        if (!open) [panel, ...kids].forEach(el => el.getAnimations().forEach(a => a.cancel()));
    };
    anim.oncancel = settle;
}

// ---------- 牌册：抽到过的卦飞进方图 ----------
// 点「牌册」时挂签被往下一拽；只有亮着的（抽到过的）卦飞：在首页时从圆图上各自的位置飞进牌册的
// 8×8 方图，其他页面没有圆图，就从挂签里散出来落进格子。没抽到过的淡格子原地不动。关闭时原路飞回。
// 飞行的是克隆，亮格子里的真卦画在落定前先藏起来（.flying）
function archiveFlight(panel, tag, open) {
    if (panel._flyers) panel._flyers.remove();
    clearTimeout(panel._flightTimer);
    [panel, ...panel.children].forEach(el => el.getAnimations().forEach(a => a.cancel()));
    panel.classList.add('morphing', 'flying');
    // 卦是飞进格子亮起来的，落定后不再让亮格子另放一遍逐个点亮的动画
    panel.classList.toggle('flown', open);
    tag.animate([{ height: getComputedStyle(tag).height }, { height: `calc(${getComputedStyle(tag).height} + 20px)`, offset: .4 },
        { height: getComputedStyle(tag).height }], { duration: 520, easing: 'cubic-bezier(.3, 1.4, .5, 1)' });

    // 目标：方图里亮着的格子；还没有记录时没有卦要飞，只剩面板本身的浮现
    const targets = Array.from(panel.querySelectorAll('.am-cell.lit'))
        .map(c => ({ v: Number(c.dataset.v), el: c.querySelector('.hx') }));
    // 起点：首页圆图上同一卦的位置（带着它在圆周上的朝向）；否则是挂签
    const ringOn = document.body.classList.contains('view-home') && typeof Cosmos !== 'undefined' && Cosmos.state === 'circle';
    const ring = ringOn ? document.querySelectorAll('.cosmos-ring .cg') : null;
    const hv = document.getElementById('homeView').getBoundingClientRect();
    const hcx = hv.left + hv.width / 2, hcy = hv.top + hv.height / 2;
    const tr = tag.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.className = 'archive-flyers';
    const flights = [];
    targets.forEach(({ v, el }) => {
        if (!el) return;
        const t = el.getBoundingClientRect();
        if (!t.width) return;
        let sx, sy, size, rot, op;
        const cg = ring && ring[63 - v];
        if (cg) {
            const r = cg.getBoundingClientRect();
            sx = r.left + r.width / 2; sy = r.top + r.height / 2;
            size = r.width * .72;
            rot = Math.atan2(sx - hcx, hcy - sy) * 180 / Math.PI;
            op = .46;
        } else {
            sx = tr.left + tr.width / 2; sy = tr.top + tr.height * .6;
            size = 6; rot = 0; op = 0;
        }
        const f = document.createElement('div');
        f.className = 'archive-flyer';
        f.innerHTML = buildHexBars(linesFromShao(v));
        f.style.cssText = `left:${t.left}px;top:${t.top}px;width:${t.width}px;height:${t.height}px;`;
        layer.appendChild(f);
        // 落地时正好是这一格的亮度（抽到次数越多越亮）
        const endOp = Number(getComputedStyle(el).opacity) || 1;
        const from = `translate(${sx - (t.left + t.width / 2)}px, ${sy - (t.top + t.height / 2)}px) rotate(${rot.toFixed(1)}deg) scale(${(size / t.width).toFixed(3)})`;
        const order = (v >> 3) + (v & 7);
        flights.push({ f, from, op, endOp, order });
    });
    document.body.appendChild(layer);
    panel._flyers = layer;
    const ease = 'cubic-bezier(.5, 0, .2, 1)';
    let longest = 0;
    // 按方图上从左上到右下的次序一个接一个飞；卦少时间隔大一些，卦多时总共也不超过约 0.7 秒
    flights.sort((a, b) => a.order - b.order);
    const step = flights.length > 1 ? Math.min(90, 700 / (flights.length - 1)) : 0;
    flights.forEach(({ f, from, op, endOp }, rank) => {
        const delay = open ? rank * step : (flights.length - 1 - rank) * step * .6;
        const dur = open ? 760 : 520;
        longest = Math.max(longest, delay + dur);
        // 从挂签散出来的卦起点太小，先隐着，飞出一小段再显出来；
        // 飞行中途亮起来看得清，落地时正好是这一格的亮度
        const frames = op
            ? [{ transform: from, opacity: op }, { opacity: .95, offset: .45 }, { transform: 'none', opacity: endOp }]
            : [{ transform: from, opacity: 0 }, { opacity: .95, offset: .25 }, { transform: 'none', opacity: endOp }];
        const back = frames.slice().reverse().map((k, i, a) => ({ ...k, offset: k.offset != null ? 1 - k.offset : i / (a.length - 1) }));
        f.animate(open ? frames : back, { duration: dur, delay, easing: ease, fill: 'both' });
    });
    // 面板本身：打开时稍晚一点从模糊里浮出，关闭时先淡去
    if (open) panel.animate([{ opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)' }],
        { duration: 520, delay: 80, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'backwards' });
    else panel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in', fill: 'forwards' });

    panel._flightTimer = setTimeout(() => {
        layer.remove();
        if (panel._flyers === layer) panel._flyers = null;
        // 收尾时关掉 CSS 过渡再撤状态，免得面板再淡一遍；撤掉 flying 后抽到过的格子依次亮起
        panel.style.transition = 'none';
        panel.classList.remove('morphing', 'flying');
        panel.offsetHeight;
        panel.style.transition = '';
        if (!open) panel.getAnimations().forEach(a => a.cancel());
    }, longest + 30);
}

// ---------- 起卦方式：两段式切换（保留原生 select 作为数据源） ----------
const methodPickers = [];
const METHOD_SHORT = { coin: '铜钱', bazi: '生辰' };
function syncMethodPickers() {
    methodPickers.forEach(picker => picker.sync());
}
function enhanceMethodSelect(select) {
    if (!select) return;
    const root = document.createElement('div');
    root.className = 'seg';
    root.setAttribute('role', 'radiogroup');
    root.setAttribute('aria-label', '起卦方式');
    const mark = document.createElement('span');
    mark.className = 'seg-mark';
    mark.setAttribute('aria-hidden', 'true');
    const opts = Array.from(select.options);
    const buttons = opts.map((option, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'seg-opt';
        b.setAttribute('role', 'radio');
        b.dataset.value = option.value;
        b.textContent = METHOD_SHORT[option.value] || option.textContent;
        b.title = option.textContent;
        b.addEventListener('click', () => choose(i));
        return b;
    });
    function choose(i) {
        const value = opts[i].value;
        if (select.value === value) return;
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        syncMethodPickers();
    }
    function sync() {
        const idx = Math.max(0, select.selectedIndex);
        root.style.setProperty('--idx', idx);
        root.style.setProperty('--n', opts.length);
        buttons.forEach((b, i) => {
            b.setAttribute('aria-checked', String(i === idx));
            b.tabIndex = i === idx ? 0 : -1;
        });
    }
    root.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const step = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 1;
        const next = (select.selectedIndex + step + opts.length) % opts.length;
        choose(next);
        buttons[next].focus();
    });
    root.append(mark, ...buttons);
    select.after(root);
    select.hidden = true;
    select.addEventListener('change', sync);
    methodPickers.push({ sync, close() {} });
    sync();
}

// ---------- 图框右边线兼做页面滚动条 ----------
function initFrameScroll() {
    const track = document.getElementById('frameScroll');
    if (!track) return;
    const thumb = track.querySelector('i');
    const doc = document.documentElement;
    let raf = 0, drag = null;
    const metrics = () => {
        const vh = window.innerHeight, sh = doc.scrollHeight, th = track.clientHeight;
        const h = Math.max(36, th * vh / sh);
        return { vh, sh, th, h, max: th - h, range: sh - vh };
    };
    const update = () => {
        raf = 0;
        const m = metrics();
        if (m.range <= 2 || document.body.classList.contains('dialog-open')) { track.classList.remove('on'); return; }
        track.classList.add('on');
        thumb.style.height = m.h + 'px';
        thumb.style.transform = `translateY(${(m.max * Math.min(1, window.scrollY / m.range)).toFixed(1)}px)`;
    };
    const req = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', req);
    if (window.ResizeObserver) new ResizeObserver(req).observe(document.body);
    new MutationObserver(req).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    thumb.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        thumb.setPointerCapture(e.pointerId);
        drag = { y: e.clientY, s: window.scrollY };
        track.classList.add('drag');
    });
    thumb.addEventListener('pointermove', e => {
        if (!drag) return;
        const m = metrics();
        window.scrollTo(0, drag.s + (e.clientY - drag.y) * (m.range / Math.max(1, m.max)));
    });
    const end = () => { drag = null; track.classList.remove('drag'); };
    thumb.addEventListener('pointerup', end);
    thumb.addEventListener('pointercancel', end);
    // 点在线上别处：滚到对应位置
    track.addEventListener('pointerdown', e => {
        if (e.target !== track) return;
        const r = track.getBoundingClientRect(), m = metrics();
        const frac = Math.min(1, Math.max(0, (e.clientY - r.top - m.h / 2) / Math.max(1, m.max)));
        window.scrollTo({ top: frac * m.range, behavior: 'smooth' });
    });
    update();
}

document.addEventListener('DOMContentLoaded', () => {
    setPageView('home');
    initFrameScroll();
    if (typeof Cosmos !== 'undefined') { Cosmos.init(); Cosmos.intro(); }
    playHomeEnter(500);
    // 顶栏挂签的入场动画播完就撤掉 intro，之后记录数变化不再重播
    setTimeout(() => document.body.classList.remove('intro'), 2200);
    document.getElementById('homeBtn').addEventListener('click', () => returnToInquiry());
    document.getElementById('questionForm').addEventListener('submit', e => { e.preventDefault(); divine(); });
    const method = document.getElementById('homeMethod');
    method.addEventListener('change', () => {
        if (!saveSetting('method', method.value)) { method.value = loadSettings().method; return; }
        if (method.value === 'bazi' && !loadSettings().bazi) {
            toggleSettings(true);
            document.getElementById('baziYear').focus({ preventScroll: true });
            showToast('请先填写并保存公历生辰');
        }
    });
    const daily = document.getElementById('dailyGua');
    daily.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); daily.click(); } });
    enhanceMethodSelect(method);
    enhanceMethodSelect(document.getElementById('settingMethod'));

    // 问题输入框右下角的字数刻度
    const q = document.getElementById('question');
    const count = document.getElementById('questionCount');
    if (q && count) {
        const upd = () => { count.textContent = `${q.value.length} / ${q.maxLength}`; };
        q.addEventListener('input', upd);
        upd();
    }
});
