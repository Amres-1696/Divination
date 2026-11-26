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
    if (_divineRunning) { showToast('卦还没起完，等它起完，或者点「跳过」'); return; }
    if (_viewBusy) return;
    _viewBusy = true;
    if (typeof clearShareParams === 'function') clearShareParams();
    // 还在往标题上落的问题不跟回首页
    dropQuestionCarry();
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
    flipToNumbers(false, { quiet: true });
    const q = document.getElementById('question');
    if (q) {
        if (opts.clear) { q.value = ''; q.dispatchEvent(new Event('input')); }
        // 只在有鼠标的设备上自动聚焦：触屏上一聚焦就弹出键盘，把刚落回来的圆图挡住
        if (window.matchMedia && window.matchMedia('(hover: hover)').matches) q.focus({ preventScroll: true });
    }
    _viewBusy = false;
}

// ---------- 所问：问题从输入框升到顶栏正中，仪式期间一直挂着，结果出来时落成「所问」大标题 ----------
// 飞的是 .q-carry（「所问」小字 + 问题），输入框里的字在起飞时藏起来；没写问题、减少动态效果时不飞
function carryQuestion(question) {
    const input = document.getElementById('question');
    const head = document.querySelector('.masthead');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    dropQuestionCarry();
    if (!question || !input || !head || !document.body.animate || reduce) return;
    const carry = document.createElement('p');
    carry.className = 'q-carry';
    carry.innerHTML = '<i>所问</i><b></b>';
    const text = carry.querySelector('b');
    text.textContent = question;
    document.body.appendChild(carry);
    // 停在顶栏正中
    const hr = head.getBoundingClientRect(), cr = carry.getBoundingClientRect();
    const L = hr.left + (hr.width - cr.width) / 2, T = hr.top + (hr.height - cr.height) / 2;
    carry.style.left = `${L}px`;
    carry.style.top = `${T}px`;
    // 起点：输入框里那行字（居中、21px）
    const ir = input.getBoundingClientRect(), br = text.getBoundingClientRect();
    const s = parseFloat(getComputedStyle(input).fontSize) / parseFloat(getComputedStyle(text).fontSize);
    const bx = br.left + br.width / 2 - L, by = br.top + br.height / 2 - T;
    const tx = ir.left + ir.width / 2 - L - s * bx, ty = ir.top + ir.height / 2 - T - s * by;
    input.style.color = 'transparent';
    carry.animate([{ transform: `translate(${tx}px, ${ty}px) scale(${s.toFixed(3)})` }, { transform: 'none' }],
        { duration: 980, delay: 60, easing: 'cubic-bezier(.6, 0, .2, 1)', fill: 'backwards' });
    carry.querySelector('i').animate([{ opacity: 0, transform: 'translateX(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 500, delay: 820, easing: 'ease-out', fill: 'backwards' });
}

// 撤掉一张飞着的问题：连它身上的动画一起停掉，免得它的收尾回调再去动别的；最后一张撤掉时输入框里的字才露回来
function dropCarry(carry) {
    // 正落着就被撤掉：页面上藏着等它的标题直接露出来
    if (carry.classList.contains('landing')) document.querySelectorAll('.result-question.carried').forEach(box => box.classList.remove('carried'));
    carry.getAnimations({ subtree: true }).forEach(a => a.cancel());
    carry.remove();
    const input = document.getElementById('question');
    if (input && input.style && !document.querySelector('.q-carry')) input.style.color = '';
}
function dropQuestionCarry() {
    document.querySelectorAll('.q-carry').forEach(dropCarry);
}

// 结果页渲染后调用：顶栏里挂着的问题飞到「所问」大标题的位置，换成页面上的标题
// 每张问题只落一次、只落在它自己那一卦上：已经在落的（上一卦的）直接撤掉；从牌册打开的记录没有挂着的问题，标题照常显示
function landQuestion(box) {
    document.querySelectorAll('.q-carry.landing').forEach(dropCarry);
    const carry = document.querySelector('.q-carry');
    const h1 = box && box.querySelector('h1');
    if (!carry || !h1) { dropQuestionCarry(); return; }
    carry.classList.add('landing');
    // 升到顶栏那一段要是还没飞完（仪式很快被跳过），先让它落定再量
    carry.getAnimations({ subtree: true }).forEach(a => a.finish());
    box.classList.add('carried');
    const text = carry.querySelector('b');
    const s = parseFloat(getComputedStyle(h1).fontSize) / parseFloat(getComputedStyle(text).fontSize);
    const hr = h1.getBoundingClientRect();
    // 按标题的宽度折行（同一字体、按比例缩放），落地时和页面上的标题一行对一行
    text.classList.add('wrap');
    text.style.width = `${hr.width / s}px`;
    const cr = carry.getBoundingClientRect(), br = text.getBoundingClientRect();
    const tx = hr.left - cr.left - s * (br.left - cr.left), ty = hr.top - cr.top - s * (br.top - cr.top);
    carry.querySelector('i').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in', fill: 'forwards' });
    const fly = carry.animate([{ transform: 'none' }, { transform: `translate(${tx}px, ${ty}px) scale(${s.toFixed(3)})` }],
        { duration: 820, delay: 120, easing: 'cubic-bezier(.5, 0, .2, 1)', fill: 'forwards' });
    fly.onfinish = () => {
        box.classList.remove('carried');
        carry.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).onfinish = () => dropCarry(carry);
    };
}

// ---------- 挂签 → 页面：牌册是抽到的卦飞进方图；设置是挂签当轴头，放下一张图纸 ----------
const PANEL_TAG = { historyPanel: 'historyBtn', settingsPanel: 'settingsGear' };
// 只撤掉脚本自己放的动画；.show 带起来的 CSS 入场动画 / 过渡不动
const cancelScripted = el => el.getAnimations().forEach(a => { if (a.constructor === Animation) a.cancel(); });
function morphPanelFromTag(panel, open) {
    const tag = document.getElementById(PANEL_TAG[panel.id]);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!tag || !panel.animate || reduce) return;
    if (panel.id === 'historyPanel') return archiveFlight(panel, tag, open);
    unrollSettings(panel, tag, open);
}

// ---------- 设置：像挂轴一样放下 ----------
// 挂签就是卷着的图纸：打开时挂签处的轴先向两边撑到整页宽，再往下走，图纸跟着一路露出来；
// 轴经过哪一组设置，那一组的字墨才浮上来，走过它底边时再用尺子画出分隔的虚线。关闭时轴原路卷回挂签。
// 轴的位置和图纸露出的边缘用同一组关键帧、同一段段缓动，所以始终贴在一起
const ROD_OPEN = { ms: 980, spread: .26, easeSpread: 'cubic-bezier(.5, 0, .3, 1)', easeDrop: 'cubic-bezier(.42, 0, .22, 1)' };
const ROD_CLOSE = { ms: 720, climb: .7, easeClimb: 'cubic-bezier(.55, 0, .45, 1)', easeGather: 'cubic-bezier(.6, 0, .3, 1)' };
// cubic-bezier 缓动的反函数：进度 → 时间比例（用来算轴走到某一组时是第几毫秒）
function bezierTimeAt(x1, y1, x2, y2, progress) {
    const at = (a, b, u) => 3 * a * u * (1 - u) * (1 - u) + 3 * b * u * u * (1 - u) + u * u * u;
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (at(y1, y2, m) < progress) lo = m; else hi = m; }
    return at(x1, x2, (lo + hi) / 2);
}
function unrollSettings(panel, tag, open) {
    if (panel._rod) panel._rod.remove();
    panel.classList.add('morphing', 'unrolling');
    const groups = Array.from(panel.querySelectorAll('.settings-group')).filter(g => !g.hidden);
    [panel, ...panel.children, ...groups].forEach(cancelScripted);
    tugTag(tag, 16);
    const p = panel.getBoundingClientRect(), t = tag.getBoundingClientRect();
    const H = p.height;
    // 轴：一根细杆，两头各有一个轴头
    const rod = document.createElement('div');
    rod.className = 'scroll-rod';
    document.body.appendChild(rod);
    panel._rod = rod;
    // 三个位置：卷在挂签底下（挂签那么宽）→ 撑开到整页宽 → 走到页底
    const y0 = Math.max(p.top, t.bottom), y1 = y0, y2 = p.bottom;
    const at = (x, w, y) => ({ left: x + 'px', width: w + 'px', top: y + 'px' });
    const clip = (l, r, y) => ({ clipPath: 'inset(0px ' + r + 'px ' + Math.max(0, p.bottom - y) + 'px ' + l + 'px)' });
    const tl = Math.max(0, t.left - p.left), tr = Math.max(0, p.right - t.right);
    const rodAt = [at(p.left + tl, p.width - tl - tr, y0), at(p.left, p.width, y1), at(p.left, p.width, y2)];
    const paperAt = [clip(tl, tr, y0), clip(0, 0, y1), clip(0, 0, y2)];
    const frames = (list, offsets, eases) => list.map((k, i) => ({ ...k, offset: offsets[i], easing: eases[i] || 'linear' }));
    let paper;
    if (open) {
        const o = [0, ROD_OPEN.spread, 1], e = [ROD_OPEN.easeSpread, ROD_OPEN.easeDrop];
        paper = panel.animate(frames(paperAt, o, e), { duration: ROD_OPEN.ms, fill: 'backwards' });
        rod.animate(frames(rodAt, o, e), { duration: ROD_OPEN.ms, fill: 'forwards' });
        rod.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, fill: 'backwards' });
        // 每一组：轴走到它顶上时字墨浮起，走过它底边时画分隔线
        const tA = ROD_OPEN.ms * ROD_OPEN.spread, tB = ROD_OPEN.ms - tA;
        const [bx1, by1, bx2, by2] = ROD_OPEN.easeDrop.match(/[\d.]+/g).map(Number);
        const when = y => {
            const prog = (y - y1) / Math.max(1, y2 - y1);
            return prog <= 0 ? tA : prog >= 1 ? ROD_OPEN.ms : tA + tB * bezierTimeAt(bx1, by1, bx2, by2, prog);
        };
        groups.forEach(g => {
            const r = g.getBoundingClientRect();
            g.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
                { duration: 420, delay: when(r.top + 14) + 30, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'backwards' });
            try {
                g.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
                    { duration: 380, delay: when(r.bottom), easing: 'cubic-bezier(.5, 0, .2, 1)', fill: 'backwards', pseudoElement: '::after' });
            } catch (err) { /* 不支持给伪元素放动画的浏览器：线随图纸一起露出来 */ }
        });
    } else {
        // 先收起字墨，轴从页底往上卷，卷到挂签底下再收拢成挂签那么宽
        groups.forEach(g => g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease', fill: 'forwards' }));
        const o = [0, ROD_CLOSE.climb, 1], e = [ROD_CLOSE.easeClimb, ROD_CLOSE.easeGather];
        paper = panel.animate(frames(paperAt.slice().reverse(), o, e), { duration: ROD_CLOSE.ms, delay: 80, fill: 'forwards' });
        rod.animate(frames(rodAt.slice().reverse(), o, e), { duration: ROD_CLOSE.ms, delay: 80, fill: 'both' });
        rod.animate([{ opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: 1, offset: .86 }, { opacity: 0 }],
            { duration: ROD_CLOSE.ms + 80, fill: 'forwards' });
    }
    // 收尾时关掉 CSS 过渡再撤 morphing：否则收回签条之后面板还会再滑走 / 淡出一遍
    const settle = () => {
        if (panel._rod !== rod) return;
        panel._rod = null;
        panel.style.transition = 'none';
        panel.classList.remove('morphing', 'unrolling');
        panel.classList.toggle('unrolled', open);
        panel.offsetHeight;
        panel.style.transition = '';
        if (open) rod.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out', fill: 'forwards' }).onfinish = () => rod.remove();
        else {
            rod.remove();
            [panel, ...panel.children, ...groups].forEach(el => el.getAnimations().forEach(a => a.cancel()));
        }
    };
    paper.onfinish = settle;
    paper.oncancel = () => { if (panel._rod === rod) { rod.remove(); panel._rod = null; panel.classList.remove('unrolling'); } };
}

// ---------- 牌册：抽到过的卦飞进方图 ----------
// 点「牌册」时挂签被往下一拽；只有亮着的（抽到过的）卦飞：在首页时从圆图上各自的位置飞进牌册的
// 8×8 方图，其他页面没有圆图，就从挂签里散出来落进格子。在结果页打开时，正看着的这一卦从结果页的
// 卦画直接飞进自己那一格，像把它归档。没抽到过的淡格子原地不动。关闭时原路飞回。
// 飞行的是克隆，亮格子里的真卦画在落定前先藏起来（.flying）；圆图上飞走的那几卦、结果页上飞走的卦画
// 留出空位，牌册开着时一直空着，关上后卦飞回原位才重新出现
const RING_SPIN_DEG_PER_MS = 360 / 520000;   // 与 CSS cosmos-spin 的 520s 一圈一致
// 挂签被往下一拽再弹回
// 拉长的是签条的两层底（::before 描边、::after 签面，从顶边往下 scaleY），签角的小印跟着往下走；
// 签上的字不动。不改 height，免得每一帧都重新排版
function tugTag(tag, px) {
    const opt = { duration: 520, easing: 'cubic-bezier(.3, 1.4, .5, 1)' };
    const h = tag.offsetHeight;
    try {
        if (!h) throw 0;
        const k = ((h + px) / h).toFixed(4);
        const stretch = [{ transform: 'none' }, { transform: `scaleY(${k})`, offset: .4 }, { transform: 'none' }];
        tag.animate(stretch, { ...opt, pseudoElement: '::before' });
        tag.animate(stretch, { ...opt, pseudoElement: '::after' });
        const seal = tag.querySelector('sup');
        if (seal) seal.animate([{ translate: '0 0' }, { translate: `0 ${px}px`, offset: .4 }, { translate: '0 0' }], opt);
    } catch (e) {
        const hh = getComputedStyle(tag).height;
        tag.animate([{ height: hh }, { height: `calc(${hh} + ${px}px)`, offset: .4 }, { height: hh }], opt);
    }
}
function archiveFlight(panel, tag, open) {
    if (panel._flyers) panel._flyers.remove();
    clearTimeout(panel._flightTimer);
    // 空位按卦记着：关闭时每一卦落回原位的那一刻就各自还原，不等最后一卦。
    // 卦多时前面的卦落得早，要是一起等到最后，它们会定在原地看着圆图转走，换回时再跳一下
    const showSlots = v => {
        panel._slots = (panel._slots || []).filter(s => {
            if (v != null && s.v !== v) return true;
            s.back();
            return false;
        });
    };
    const leaveSlot = (v, back) => (panel._slots = panel._slots || []).push({ v, back });
    if (open) showSlots();
    const toItem = !open && panel._toItem;
    panel._toItem = false;
    panel.classList.add('morphing', 'flying');
    // 卦是飞进格子亮起来的，落定后不再让亮格子另放一遍逐个点亮的动画
    panel.classList.toggle('flown', open);
    [panel, ...panel.children].forEach(cancelScripted);
    // 从牌册打开某一卦：要去结果页了，卦不飞回原处，空位立刻还原，亮着的卦收回牌册挂签里
    if (toItem) showSlots();
    tugTag(tag, 20);

    // 目标：方图里亮着的格子；还没有记录时没有卦要飞，只剩面板本身的浮现
    const targets = Array.from(panel.querySelectorAll('.am-cell.lit'))
        .map(c => ({ v: Number(c.dataset.v), el: c.querySelector('.hx'), cell: c }));
    // 只飞落点整个看得见的格子：方图下半截常在牌册的滚动区外面（屏幕矮、记录多时），
    // 飞过去的替身没有被滚动区裁掉，会落在「清空牌册」那一栏上、甚至面板外面，收尾时才突然消失。
    // 看不全的格子不飞，真卦画直接留在格子里（.am-still），由滚动区自己裁
    panel.querySelectorAll('.am-still').forEach(c => c.classList.remove('am-still'));
    const scroller = (() => {
        const c = targets[0] && targets[0].cell;
        for (let p = c && c.parentElement; p && p !== panel.parentElement; p = p.parentElement) {
            const o = getComputedStyle(p).overflowY;
            if (o === 'auto' || o === 'scroll') return p;
        }
        return null;
    })();
    const sr = scroller ? scroller.getBoundingClientRect() : null;
    const view = {
        top: Math.max(0, sr ? sr.top : 0), bottom: Math.min(window.innerHeight, sr ? sr.bottom : window.innerHeight),
        left: Math.max(0, sr ? sr.left : 0), right: Math.min(window.innerWidth, sr ? sr.right : window.innerWidth)
    };
    const seen = r => r.width && r.top >= view.top - 1 && r.bottom <= view.bottom + 1 && r.left >= view.left - 1 && r.right <= view.right + 1;
    // 起点：首页圆图上同一卦的位置（带着它在圆周上的朝向）；结果页上正看着的那一卦；否则是挂签
    const ringOn = !toItem && document.body.classList.contains('view-home') && typeof Cosmos !== 'undefined' && Cosmos.state === 'circle';
    const ring = ringOn ? document.querySelectorAll('.cosmos-ring .cg') : null;
    // 圆图此刻整体转过的角度：每一卦的朝向 = 自己的旋转 + 圆图的旋转
    let ringSpin = 0;
    if (ringOn) {
        const m = getComputedStyle(document.querySelector('.cosmos-ring')).transform;
        if (m && m !== 'none') {
            const [a, b] = m.slice(m.indexOf('(') + 1, -1).split(',').map(Number);
            ringSpin = Math.atan2(b, a) * 180 / Math.PI;
        }
    }
    let glyph = !toItem && document.body.classList.contains('view-result') ? document.getElementById('resultGlyph') : null;
    let gr = null;
    if (glyph) {
        gr = glyph.getBoundingClientRect();
        // 卦画滚出视口了就不从它起飞
        if (!gr.width || gr.bottom < 0 || gr.top > window.innerHeight) glyph = null;
    }
    const glyphV = glyph ? Number(glyph.dataset.v) : -1;
    const hv = document.getElementById('homeView').getBoundingClientRect();
    const hcx = hv.left + hv.width / 2, hcy = hv.top + hv.height / 2;
    const tr = tag.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.className = 'archive-flyers';
    const flights = [];
    // 先把要量的全量完（位置、亮度），再统一改样式：边量边改会让每一卦都触发一次重新排版
    const plan = targets.map(({ v, el, cell }) => {
        if (!el) return null;
        const t = el.getBoundingClientRect();
        if (!seen(cell.getBoundingClientRect())) { cell.classList.add('am-still'); return null; }
        const cg = ring && ring[63 - v];
        return { v, el, t, cg, cr: cg ? cg.getBoundingClientRect() : null, cw: cg ? cg.offsetWidth : 0, endOp: Number(getComputedStyle(el).opacity) || 1 };
    }).filter(Boolean);
    plan.forEach(({ v, t, cg, cr, cw, endOp }) => {
        let sx, sy, scale, rot, op;
        if (cg) {
            sx = cr.left + cr.width / 2; sy = cr.top + cr.height / 2;
            // 大小和朝向照圆图上这一卦实际的缩放、旋转来：外接框会随朝向变大变小，拿它估大小，起飞时卦会先缩一下、拧一下
            // 圆图写在独立的 rotate / scale 上；不支持的浏览器写在 transform 里
            const tf = /rotate\((-?[\d.]+)deg\).*scale\(([\d.]+)\)/.exec(cg.style.transform);
            const ownRot = parseFloat(cg.style.rotate || (tf && tf[1])), ownScale = parseFloat(cg.style.scale || (tf && tf[2]));
            const own = !isNaN(ownRot) && !isNaN(ownScale);
            scale = own ? (cw * ownScale / t.width).toFixed(4) : (cr.width * .72 / t.width).toFixed(3);
            rot = own ? ownRot + ringSpin : Math.atan2(sx - hcx, hcy - sy) * 180 / Math.PI;
            op = .46;
            if (open) {
                cg.style.visibility = 'hidden';
                leaveSlot(v, () => { cg.style.visibility = ''; });
            }
        } else if (v === glyphV) {
            rot = 0; op = 1;
            if (open) {
                // 之卦视图先切回本卦：归档的是本卦。卦画飞走时动爻的朱色和引线一起收起，飞回落定后再引出
                const header = glyph.closest('.result-header');
                if (header && header.classList.contains('as-zhi')) { const ben = document.getElementById('benBtn'); if (ben) ben.click(); }
                glyph.style.visibility = 'hidden';
                if (header) header.classList.remove('landed');
                leaveSlot(v, () => { glyph.style.visibility = ''; if (header) header.classList.add('landed'); });
            }
        } else {
            sx = tr.left + tr.width / 2; sy = tr.top + tr.height * .6;
            scale = (6 / t.width).toFixed(3); rot = 0; op = 0;
        }
        const f = document.createElement('div');
        f.className = 'archive-flyer';
        f.innerHTML = buildHexBars(linesFromShao(v));
        // 结果页那一卦的替身按大卦画的尺寸画，缩小着飞进格子：要是拿格子里的小卦画放大着飞，
        // 爻线的像素取整被放大好几倍，粗细间距都走样，落定换回真卦画时会跳一下
        const box = v === glyphV ? gr : t;
        f.style.cssText = `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;`;
        layer.appendChild(f);
        // 落地时正好是这一格的亮度（抽到次数越多越亮）
        const order = (v >> 3) + (v & 7);
        flights.push({ f, v, t, sx, sy, scale, rot, op, endOp, order, onRing: !!cg, hero: v === glyphV });
    });
    document.body.appendChild(layer);
    panel._flyers = layer;
    const ease = 'cubic-bezier(.5, 0, .2, 1)';
    let longest = 0;
    const anims = [];
    // 按方图上从左上到右下的次序一个接一个飞；卦少时间隔大一些，卦多时总共也不超过约 0.7 秒。
    // 结果页上的那一卦不排队：打开时最先起飞，关闭时最先回到卦画上
    flights.sort((a, b) => a.order - b.order);
    const queue = flights.filter(x => !x.hero);
    const step = queue.length > 1 ? Math.min(90, 700 / (queue.length - 1)) : 0;
    const lead = queue.length < flights.length ? 1 : 0;
    flights.forEach(fl => {
        let { f, v, t, sx, sy, scale, rot, op, endOp, onRing, hero } = fl;
        const rank = queue.indexOf(fl);
        const delay = hero ? 0 : open ? (rank + lead) * step : (queue.length - 1 - rank) * step * .6;
        const dur = hero ? (open ? 820 : 600) : open ? 760 : 520;
        longest = Math.max(longest, delay + dur);
        // 飞回圆图时圆图还在慢慢转：按落地那一刻转过的角度修正落点，正好落回自己的空位
        if (!open && onRing) {
            const d = RING_SPIN_DEG_PER_MS * (delay + dur), a = d * Math.PI / 180;
            const ox = sx - hcx, oy = sy - hcy;
            sx = hcx + ox * Math.cos(a) - oy * Math.sin(a);
            sy = hcy + ox * Math.sin(a) + oy * Math.cos(a);
            rot += d;
        }
        // 起点和终点：一般的替身摆在格子上，从起点飞回原处；结果页那一卦的替身摆在卦画上，从原处飞到格子
        const [from, to] = hero
            ? ['none', `translate(${t.left + t.width / 2 - (gr.left + gr.width / 2)}px, ${t.top + t.height / 2 - (gr.top + gr.height / 2)}px) scale(${(t.width / gr.width).toFixed(4)}, ${(t.height / gr.height).toFixed(4)})`]
            : [`translate(${sx - (t.left + t.width / 2)}px, ${sy - (t.top + t.height / 2)}px) rotate(${rot.toFixed(1)}deg) scale(${scale})`, 'none'];
        // 从挂签散出来的卦起点太小，先隐着，飞出一小段再显出来；
        // 飞行中途亮起来看得清，落地时正好是这一格的亮度
        const frames = op
            ? [{ transform: from, opacity: op }, { opacity: .95, offset: .45 }, { transform: to, opacity: endOp }]
            : [{ transform: from, opacity: 0 }, { opacity: .95, offset: .25 }, { transform: to, opacity: endOp }];
        const back = frames.slice().reverse().map((k, i, a) => ({ ...k, offset: k.offset != null ? 1 - k.offset : i / (a.length - 1) }));
        const anim = f.animate(open ? frames : back, { duration: dur, delay, easing: ease, fill: 'both' });
        anims.push(anim);
        // 落回原位：替身撤下，真卦当场接上（期间又打开了牌册就不管了，那边会重新安排空位）
        if (!open) anim.onfinish = () => {
            if (panel._flyers !== layer) return;
            showSlots(v);
            f.remove();
        };
    });
    // 面板本身：打开时稍晚一点浮上来，关闭时先淡去。
    // （整页模糊再变清晰在手机上太吃显卡，只用透明度和一点位移）
    anims.push(open
        ? panel.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
            { duration: 520, delay: 80, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'backwards' })
        : panel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in', fill: 'forwards' }));

    // 等每一卦真的飞完再收尾，不按预定时长掐：打开时第一帧要排版整本牌册，慢的机器上这一帧就要几百毫秒，
    // 动画跟着晚开始，按时长掐会把还在半路的卦直接撤掉，真格子突然出现，像跳了一大下。
    // 定时器只兜底：标签页在后台时动画不走，不能一直不收尾
    const settle = () => {
        if (panel._flightTimer !== timer) return;
        clearTimeout(timer);
        panel._flightTimer = null;
        layer.remove();
        if (panel._flyers === layer) panel._flyers = null;
        // 收尾时关掉 CSS 过渡再撤状态，免得面板再淡一遍；撤掉 flying 后抽到过的格子依次亮起
        panel.style.transition = 'none';
        panel.classList.remove('morphing', 'flying');
        panel.offsetHeight;
        panel.style.transition = '';
        panel.querySelectorAll('.am-still').forEach(c => c.classList.remove('am-still'));
        if (!open) {
            panel.getAnimations().forEach(a => a.cancel());
            showSlots();
        }
    };
    const timer = panel._flightTimer = setTimeout(settle, longest + 2000);
    Promise.all(anims.map(a => a.finished)).then(settle, settle);
}

// ---------- 起卦方式：一列单选，每行只写名字，右边一个「?」浮出做法和出处（保留原生 select 作为数据源） ----------
function enhanceMethodList(select) {
    if (!select) return;
    const root = document.createElement('div');
    root.className = 'method-list';
    root.setAttribute('role', 'radiogroup');
    root.setAttribute('aria-label', select.getAttribute('aria-label') || '');
    const opts = Array.from(select.options);
    const rows = [];
    const buttons = opts.map((option, i) => {
        const row = document.createElement('div');
        row.className = 'ml-row';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ml-opt';
        b.setAttribute('role', 'radio');
        b.dataset.value = option.value;
        const m = METHODS[option.value];
        b.innerHTML = `<b>${escHtml(m ? m.name : option.textContent)}</b>`;
        b.addEventListener('click', () => choose(i));
        row.appendChild(b);
        // 「?」借用术语浮窗：悬停、聚焦或点一下浮出注解，和首页「怎么问 ?」同一套；点它不会选中这一行
        if (m && m.note) {
            const help = document.createElement('button');
            help.type = 'button';
            help.className = 'ml-help term';
            help.dataset.tipTitle = m.name;
            help.dataset.tip = m.note;
            help.setAttribute('aria-label', m.name + '的出处和做法');
            help.textContent = '?';
            row.appendChild(help);
        }
        rows.push(row);
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
    root.append(...rows);
    select.after(root);
    select.hidden = true;
    select.addEventListener('change', sync);
    methodPickers.push({ sync, close() {} });
    sync();
}

// ---------- 过程快慢：分段切换（保留原生 select 作为数据源） ----------
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
    root.setAttribute('aria-label', select.getAttribute('aria-label') || '');
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

// ---------- 图框上的天干地支：上边亮出今天的日干，左边亮出此刻的时辰 ----------
function markFrameNow(now) {
    const [stem, hour] = frameNow(now || new Date());
    const mark = (sel, k) => document.querySelectorAll(sel).forEach((el, i) => el.classList.toggle('now', i === k));
    mark('.frame-top span', stem);
    mark('.frame-left span', hour);
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

// ---------- 术语：虚线下划的词，悬停、聚焦或点一下，浮出解释 ----------
// 词由 divination.js 的 term(text, tip) 生成：浮窗标题就是词本身，解释在 data-tip 里（按这一卦算好）
function initTermTips() {
    const tip = document.createElement('div');
    tip.className = 'term-tip';
    tip.id = 'termTip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    let cur = null, pressed = 0, wasOpen = false;
    const show = el => {
        const body = el.dataset.tip;
        if (!body) return;
        cur = el;
        tip.innerHTML = '<b></b>';
        tip.firstChild.textContent = el.dataset.tipTitle || el.textContent.trim();
        tip.appendChild(document.createTextNode(body));
        el.setAttribute('aria-describedby', 'termTip');
        // 摆在词的上方居中，贴边就往里收；上面放不下就放到下面。
        // 先挪回左上角再量：留在上次的位置（比如贴着右边）量，宽度会被右边挤窄
        tip.style.left = '0px';
        tip.style.top = '0px';
        const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
        const left = Math.min(Math.max(16, r.left + r.width / 2 - w / 2), window.innerWidth - w - 16);
        const top = r.top - h - 10 < 12 ? r.bottom + 10 : r.top - h - 10;
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
        tip.classList.add('on');
    };
    const hide = () => {
        if (!cur) return;
        cur.removeAttribute('aria-describedby');
        cur = null;
        tip.classList.remove('on');
    };
    const termOf = e => e.target && e.target.closest ? e.target.closest('.term') : null;
    // 鼠标：移上去就出，移开就收
    document.addEventListener('pointerover', e => { if (e.pointerType === 'mouse' && termOf(e)) show(termOf(e)); });
    document.addEventListener('pointerout', e => {
        if (e.pointerType === 'mouse' && cur && termOf(e) === cur && !cur.contains(e.relatedTarget)) hide();
    });
    // 键盘：Tab 到词上就出；手指点按时也会聚焦，那由下面的点按来管
    document.addEventListener('pointerdown', e => { pressed = Date.now(); wasOpen = !!cur && termOf(e) === cur; });
    document.addEventListener('focusin', e => { if (termOf(e) && Date.now() - pressed > 400) show(termOf(e)); });
    document.addEventListener('focusout', e => { if (termOf(e) === cur) hide(); });
    // 点按：点词开 / 再点收，点别处收；鼠标点一下不收（本来就是移上去显示的）。
    // 「再点」看的是按下那一刻浮窗开没开：点按时聚焦可能已经先把它打开了
    document.addEventListener('click', e => {
        const el = termOf(e);
        if (!el) { hide(); return; }
        if (wasOpen && e.pointerType !== 'mouse') hide(); else show(el);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
    window.addEventListener('scroll', hide, { passive: true });
    document.addEventListener('scroll', hide, { passive: true, capture: true });
}

document.addEventListener('DOMContentLoaded', () => {
    setPageView('home');
    initTermTips();
    initFrameScroll();
    markFrameNow();
    setInterval(() => markFrameNow(), 60 * 1000);
    if (typeof Cosmos !== 'undefined') { Cosmos.init(); Cosmos.intro(); }
    playHomeEnter(500);
    // 顶栏挂签的入场动画播完就撤掉 intro，之后记录数变化不再重播
    setTimeout(() => document.body.classList.remove('intro'), 2200);
    document.getElementById('homeBtn').addEventListener('click', () => returnToInquiry());
    document.getElementById('questionForm').addEventListener('submit', e => { e.preventDefault(); divine(); });
    // 报数那两格：回车起卦，Esc 翻回问题（不让 Esc 冒到外面去关别的弹层）。
    // 问题框自己的回车在 main.js 里接（那里还处理了输入法上屏），这里不重复接
    ['numA', 'numB'].forEach(id => document.getElementById(id).addEventListener('keydown', e => {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); flipToNumbers(false); return; }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        divine();
    }));
    document.getElementById('numReturn').addEventListener('click', () => flipToNumbers(false));
    const method = document.getElementById('homeMethod');
    method.addEventListener('change', () => {
        if (!saveSetting('method', method.value)) { method.value = loadSettings().method; return; }
        if (needsBirth(method.value) && !loadSettings().bazi) promptForBirth();
    });
    // 首页起卦方式那一行：点已存的生辰或「还没有保存」去设置里填写；点行尾的「换一种」去设置里挑起法
    document.getElementById('methodHint').addEventListener('click', e => {
        if (e.target.closest('.mh-edit')) { openBaziSettings(); return; }
        if (e.target.closest('.mh-switch')) openMethodSettings();
    });
    const daily = document.getElementById('dailyGua');
    daily.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); daily.click(); } });
    // 首页的起卦方式只留 methodHint 那一行文字，分段切换控件放在设置里
    enhanceMethodList(document.getElementById('settingMethod'));
    enhanceMethodSelect(document.getElementById('settingRitual'));
    enhanceMethodSelect(document.getElementById('settingRitualBazi'));

    // 问题输入框右下角的字数刻度：平时不显示，快写满了才出现
    const q = document.getElementById('question');
    const count = document.getElementById('questionCount');
    if (q && count) {
        const upd = () => {
            count.textContent = `${q.value.length} / ${q.maxLength}`;
            count.classList.toggle('show', q.value.length >= q.maxLength - 20);
        };
        q.addEventListener('input', upd);
        upd();
    }
});
