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
        document.body.classList.toggle('scrolled', window.scrollY > 4);
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
