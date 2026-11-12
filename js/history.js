// history —— 牌册：localStorage 读写、列表渲染、回看、删除、清空

// 历史
function makeHistoryId() {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function readHistorySafe() {
    try {
        const raw = localStorage.getItem('divinationHistory');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        // 一次性迁移：给旧记录补 id。按记录内容确定性生成——即便迁移落库失败
        // （配额满/隐私模式），下次读取也会得到相同 id，删除/回看按 id 定位依然有效
        if (parsed.some(h => h && !h.id)) {
            parsed.forEach((h, i) => { if (h && !h.id) h.id = 'm' + i + '_' + simpleHash(JSON.stringify(h)); });
            try { localStorage.setItem('divinationHistory', JSON.stringify(parsed)); } catch (e) {}
        }
        return parsed;
    } catch (e) {
        return [];
    }
}

function saveToHistory(question, gua, fullBin, hexLines, change, readingContext = {}) {
    try {
        const history = readHistorySafe();
        const id = makeHistoryId();
        history.unshift({
            id,
            question: question || '心中所念',
            gua: gua[0], symbol: gua[2], title: gua[1],
            binary: fullBin, hexagramLines: hexLines,
            changeBinary: change.changeBinary,
            hasChange: change.hasChange,
            changingYaos: change.changingYaos,
            date: readingContext.date || new Date().toLocaleString('zh-CN'),
            createdAt: readingContext.createdAt || null,
            method: readingContext.method || null
        });
        localStorage.setItem('divinationHistory', JSON.stringify(history.slice(0, HISTORY_MAX)));
        return id;
    } catch (e) {
        // 牌册满 50 条会自动挤掉最旧的，走到这里是浏览器不让写存储（空间满了、隐私模式等）
        showToast('浏览器不让保存记录，这一卦没能记进牌册', 'error');
        return null;
    }
}

function toggleHistory(force) {
    const panel = document.getElementById('historyPanel');
    const shouldOpen = typeof force === 'boolean' ? force : !panel.classList.contains('show');
    if (shouldOpen) { _archiveFilter = null; loadHistory(); }
    setFloatingPanelState('historyPanel', 'historyOverlay', shouldOpen);
}

function updateHistoryCount(n) {
    const badge = document.getElementById('historyCount');
    if (badge) badge.textContent = n ? String(n) : '';
    const meta = document.getElementById('historyMeta');
    if (meta) meta.textContent = n ? `共 ${n} 卦` : '';
}

// 新的一卦收进牌册：挂签被往下一拽，签角的朱印抬起来换成新的数，再重新盖下去
function stampHistoryCount(n) {
    const badge = document.getElementById('historyCount');
    const tag = document.getElementById('historyBtn');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!badge || !tag || !badge.animate || reduce || badge.textContent === String(n)) { updateHistoryCount(n); return; }
    if (typeof tugTag === 'function') tugTag(tag, 12);
    badge.getAnimations().forEach(a => a.cancel());
    const stamp = () => {
        badge.getAnimations().forEach(a => a.cancel());
        updateHistoryCount(n);
        badge.animate([
            { transform: 'translateY(-10px) rotate(-22deg) scale(1.9)', opacity: 0 },
            { transform: 'rotate(-10deg) scale(.88)', opacity: 1, offset: .62 },
            { transform: 'rotate(-10deg) scale(1)', opacity: 1 }
        ], { duration: 460, easing: 'cubic-bezier(.3, 1.3, .5, 1)' });
    };
    if (!badge.textContent) { setTimeout(stamp, 160); return; }
    badge.animate([{ transform: 'rotate(-10deg)', opacity: 1 }, { transform: 'translateY(-10px) rotate(-22deg) scale(1.3)', opacity: 0 }],
        { duration: 220, delay: 120, easing: 'ease-in', fill: 'forwards' }).onfinish = stamp;
}

// ---------- 图册：左边是先天方图总览，右边是按日期分组的时间线 ----------
let _archiveFilter = null;     // 只看某一卦（邵雍序数），null 为全部
const VERDICT_CN = { ji: '吉', xiong: '凶', ping: '平' };

function historyValue(item) {
    return shaoValue(item.binary || '000000');
}
function historyTime(item) {
    const t = item.createdAt ? Date.parse(item.createdAt) : Date.parse(String(item.date || '').replace(/-/g, '/'));
    return isNaN(t) ? null : new Date(t);
}
function historyGroup(d, now) {
    if (!d) return '更早';
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86400000);
    if (diff <= 0) return '今天';
    if (diff === 1) return '昨天';
    if (diff < 7) return '这一周';
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return '这个月';
    if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1} 月`;
    return `${d.getFullYear()} 年`;
}
function pad2(n) { return String(n).padStart(2, '0'); }

function renderArchiveMap(history) {
    const map = document.getElementById('historyMap');
    if (!map) return;
    const counts = new Array(64).fill(0);
    const tally = { ji: 0, ping: 0, xiong: 0 };
    history.forEach(h => {
        const v = historyValue(h);
        counts[v]++;
        const g = h.binary ? lookupGua(h.binary) : null;
        tally[g ? getVerdict(g) : 'ping']++;
    });
    const max = Math.max(1, ...counts);
    const lit = counts.filter(c => c > 0).length;
    const top = counts.indexOf(max);
    const topGua = history.length ? lookupGua(linesFromShao(top).map(x => x % 2 ? '1' : '0').reverse().join('')) : null;
    const labels = TRIGRAM_BY_VALUE.map(n => `<span>${n}</span>`).join('');
    let cells = '';
    for (let v = 0; v < 64; v++) {
        const c = counts[v];
        const g = lookupGua(linesFromShao(v).map(x => x % 2 ? '1' : '0').reverse().join(''));
        cells += `<button type="button" class="am-cell${c ? ' lit' : ''}${_archiveFilter === v ? ' sel' : ''}" data-v="${v}" style="--w:${(c / max).toFixed(3)};--o:${(v >> 3) + (v & 7)}" ${c ? '' : 'tabindex="-1" disabled'} aria-label="${g ? g[0] : ''}${c ? `，${c} 次` : '，未抽到'}">${buildHexBars(linesFromShao(v))}${c > 1 ? `<em>${c}</em>` : ''}</button>`;
    }
    const filtered = _archiveFilter != null
        ? lookupGua(linesFromShao(_archiveFilter).map(x => x % 2 ? '1' : '0').reverse().join(''))
        : null;
    map.innerHTML = history.length ? `
<div class="am-stats">
  <p class="am-big"><b>${history.length}</b> 卦，落在 <b>${lit}</b> 格</p>
  <div class="am-bar" aria-hidden="true"><i class="ji" style="flex:${tally.ji}"></i><i class="ping" style="flex:${tally.ping}"></i><i class="xiong" style="flex:${tally.xiong}"></i></div>
  <p class="am-legend"><span class="am-legend-k">本卦底色</span><span class="ji">吉 ${tally.ji}</span><span class="ping">平 ${tally.ping}</span><span class="xiong">凶 ${tally.xiong}</span>${topGua && max > 1 ? `<span class="am-top">最常见 ${topGua[0]} ×${max}</span>` : ''}</p>
</div>
<div class="am-frame">
  <div class="am-cols" aria-hidden="true">${labels}</div>
  <div class="am-rows" aria-hidden="true">${labels}</div>
  <div class="am-grid" role="group" aria-label="先天方图：点亮的是抽到过的卦">${cells}</div>
</div>
<p class="am-caption" id="amCaption">${filtered
        ? `只看 <b>${filtered[0]}</b> · ${counts[_archiveFilter]} 次 <button type="button" class="am-clear" id="amClear">显示全部</button>`
        : '亮着的格子是抽到过的卦，越亮次数越多。点一格，只看这一卦。'}</p>` : '';

    map.querySelectorAll('.am-cell.lit').forEach(cell => {
        cell.addEventListener('click', () => {
            const v = Number(cell.dataset.v);
            _archiveFilter = _archiveFilter === v ? null : v;
            loadHistory({ quiet: true });
        });
        cell.addEventListener('mouseenter', () => {
            const g = lookupGua(linesFromShao(Number(cell.dataset.v)).map(x => x % 2 ? '1' : '0').reverse().join(''));
            const cap = document.getElementById('amCaption');
            if (cap && _archiveFilter == null && g) cap.innerHTML = `<b>${g[0]}</b> · ${counts[Number(cell.dataset.v)]} 次 · ${guaOrdinal(g)}`;
        });
        cell.addEventListener('mouseleave', () => {
            const cap = document.getElementById('amCaption');
            if (cap && _archiveFilter == null) cap.textContent = '亮着的格子是抽到过的卦，越亮次数越多。点一格，只看这一卦。';
        });
    });
    const clr = map.querySelector('#amClear');
    if (clr) clr.addEventListener('click', () => { _archiveFilter = null; loadHistory({ quiet: true }); });
}

function renderArchiveList(history) {
    const list = document.getElementById('historyList');
    if (history.length === 0) {
        let cells = '';
        for (let k = 0; k < 64; k++) cells += '<i></i>';
        list.innerHTML = `<div class="history-empty">
<span class="minimap big" aria-hidden="true">${cells}</span>
<p>还没有起过卦</p>
<p class="history-empty-hint">每起一卦，方图上就会亮起一格，记录按日期排在这里，最多 ${HISTORY_MAX} 条。</p>
</div>`;
        return;
    }
    const shown = _archiveFilter != null ? history.filter(h => historyValue(h) === _archiveFilter) : history;
    const now = new Date();
    const groups = [];
    shown.forEach(item => {
        const d = historyTime(item);
        const label = historyGroup(d, now);
        let g = groups[groups.length - 1];
        if (!g || g.label !== label) { g = { label, items: [] }; groups.push(g); }
        g.items.push({ item, d });
    });
    let k = 0;
    list.innerHTML = groups.map(g => `
<section class="tl-group">
  <h4><span>${g.label}</span><em>${g.items.length}</em></h4>
  <ol>${g.items.map(({ item, d }) => {
        const guaEntry = item.binary ? lookupGua(item.binary) : null;
        const verdict = guaEntry ? getVerdict(guaEntry) : 'ping';
        const hexLines = (item.hexagramLines && item.hexagramLines.length === 6) ? item.hexagramLines : binToHexLines(item.binary || '000000');
        const zhi = item.hasChange && item.changeBinary ? lookupGua(item.changeBinary) : null;
        const time = d ? (g.label === '今天' || g.label === '昨天' ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : `${d.getMonth() + 1}/${d.getDate()}`) : '';
        const blank = !item.question || item.question === '心中所念';
        return `<li class="history-item tl-row" data-id="${item.id || ''}" data-v="${historyValue(item)}" tabindex="0" role="button" aria-label="回看：${escHtml(item.question)}" style="--k:${Math.min(k++, 14)}">
<span class="tl-time">${time}</span>
<span class="history-thumb">${buildHexBars(hexLines, item.changingYaos || [])}</span>
<span class="tl-main">
  <span class="history-q${blank ? ' blank' : ''}">${blank ? '未写问题' : escHtml(item.question)}</span>
  <span class="history-gua"><b>${item.gua || ''}</b>${zhi ? `<span class="history-change">→ ${zhi[0]}</span>` : ''}<span class="history-verdict v-${verdict}">${VERDICT_CN[verdict]}</span></span>
</span>
<button class="history-del" data-id="${item.id || ''}" aria-label="删除这条记录"></button>
</li>`;
    }).join('')}</ol>
</section>`).join('');

    const open = (el) => {
        const thumb = el.querySelector('.history-thumb');
        const rect = thumb && thumb.getBoundingClientRect ? thumb.getBoundingClientRect() : null;
        loadHistoryItem(el.dataset.id, rect);
    };
    const mapCell = v => document.querySelector(`.am-cell[data-v="${v}"]`);
    list.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.history-del')) return;
            open(el);
        });
        el.addEventListener('keydown', (e) => {
            if (e.target !== el || (e.key !== 'Enter' && e.key !== ' ')) return;
            e.preventDefault();
            open(el);
        });
        // 指到哪一条，方图上对应的格子就亮出来
        el.addEventListener('mouseenter', () => { const c = mapCell(el.dataset.v); if (c) c.classList.add('hover'); });
        el.addEventListener('mouseleave', () => { const c = mapCell(el.dataset.v); if (c) c.classList.remove('hover'); });
    });
    list.querySelectorAll('.history-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteHistoryItem(btn.dataset.id);
        });
    });
}

function loadHistory(opts) {
    opts = opts || {};
    const history = readHistorySafe();
    if (_archiveFilter != null && !history.some(h => historyValue(h) === _archiveFilter)) _archiveFilter = null;
    updateHistoryCount(history.length);
    const panel = document.getElementById('historyPanel');
    if (panel && panel.classList) panel.classList.toggle('quiet', !!opts.quiet);
    renderArchiveMap(history);
    renderArchiveList(history);
}

function loadHistoryItem(id, fromRect) {
    // 起卦途中不能切去别的结果：仪式那一页会被换掉，起卦流程就停在半路了
    if (_divineRunning) {
        showToast('正在起卦，掷完六爻或点跳过之后再回看');
        return;
    }
    const history = readHistorySafe();
    const item = history.find(h => h.id === id);
    if (!item) return;
    const gua = item.binary ? lookupGua(item.binary) : (GUA.find(g => g[2] === item.symbol) || GUA[0]);
    if (!gua) return;
    const change = {
        hasChange: item.hasChange,
        changeBinary: item.changeBinary,
        changingYaos: item.changingYaos || [],
        changeGua: item.changeBinary ? lookupGua(item.changeBinary) : null
    };
    const readingContext = {
        historyId: item.id,
        date: item.date,
        createdAt: item.createdAt,
        method: item.method
    };
    const bin = item.binary || guaBinary(gua);
    // 从牌册缩略图的位置飞到结果页
    const source = fromRect ? { cosmosValue: shaoValue(bin), fromRect } : null;
    // 打开某一卦：牌册关闭时卦不飞回圆图，收回牌册挂签，这一卦自己飞向结果页
    const panel = document.getElementById('historyPanel');
    if (panel) panel._toItem = true;
    toggleHistory(false);
    if (panel) panel._toItem = false;   // 没走过渡（如减少动态效果）时也不留到下一次关闭
    if (item.hexagramLines && item.hexagramLines.length === 6) {
        renderResult(gua, item.hexagramLines, change, item.question, bin, source, item.aiReading, readingContext);
    } else {
        renderResult(gua, binToHexLines(bin), change, item.question, bin, source, item.aiReading, readingContext);
    }
}

// 方图格子熄灭 / 暗一档：像灯芯最后亮一下，再落到新的亮度（没记录了就暗回淡格子）
function douseCell(hx, to, delay) {
    return hx.animate([
        { opacity: getComputedStyle(hx).opacity, transform: 'none' },
        { opacity: 1, transform: 'scale(1.18)', offset: .28 },
        { opacity: to, transform: to < .1 ? 'scale(.9)' : 'none' }
    ], { duration: 560, delay: delay || 0, easing: 'ease-out', fill: 'forwards' });
}

function deleteHistoryItem(id) {
    const el = document.querySelector('.history-item[data-id="' + id + '"]');
    if (el && el.classList.contains('deleting')) return;

    // 先同步落库，再做纯视觉退场：动画期间再删其它条目也不会索引错位
    const history = readHistorySafe();
    const idx = history.findIndex(h => h.id === id);
    if (idx !== -1) {
        history.splice(idx, 1);
        try { localStorage.setItem('divinationHistory', JSON.stringify(history)); } catch (e) {}
    }
    if (!el) { loadHistory(); return; }

    el.classList.add('deleting');
    updateHistoryCount(history.length);
    // 方图上这一卦的格子跟着暗一档，删到一条不剩就熄灭；格角的次数一起改
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const v = Number(el.dataset.v);
    const cell = document.querySelector(`.am-cell[data-v="${v}"]`);
    const hx = cell && cell.querySelector('.hx');
    let cellAnim = null;
    if (hx && hx.animate && !reduce) {
        const counts = new Array(64).fill(0);
        history.forEach(h => counts[historyValue(h)]++);
        const left = counts[v], max = Math.max(1, ...counts);
        cellAnim = douseCell(hx, left ? .38 + left / max * .62 : .09);
        const em = cell.querySelector('em');
        if (em) { if (left > 1) em.textContent = String(left); else em.remove(); }
    }
    let pending = cellAnim ? 2 : 1;
    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        el.remove();
        loadHistory({ quiet: true });
    };
    const done = () => { if (--pending <= 0) finish(); };
    if (cellAnim) cellAnim.onfinish = done;
    // 只认 .history-item 自身的过渡结束：子元素/伪元素（删除按钮、装饰条）的
    // transitionend 会冒泡上来提前触发收尾，截断退场动画
    const onEnd = (e) => {
        if (e.target !== el) return;
        el.removeEventListener('animationend', onEnd);
        done();
    };
    el.addEventListener('animationend', onEnd);
    // 兜底：transitionend 未触发（如系统开启减少动态效果）时也能收尾
    setTimeout(() => { if (el.isConnected) finish(); }, 900);
}

async function clearHistory() {
    const yes = await showConfirm('清空后所有记录都会删除，方图也会全部熄灭。确定清空牌册？');
    if (yes) {
        try { localStorage.removeItem('divinationHistory'); } catch (e) {}
        _archiveFilter = null;
        // 方图从右下到左上逐格熄灭（和打开牌册时点亮的次序相反），时间线和统计同时收起，熄完再换成空牌册
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const cells = Array.from(document.querySelectorAll('#historyMap .am-cell.lit'));
        if (!reduce && cells.length && cells[0].animate) {
            const panel = document.getElementById('historyPanel');
            if (panel) panel.classList.add('dousing');
            let longest = 0;
            cells.forEach(cell => {
                const hx = cell.querySelector('.hx');
                const em = cell.querySelector('em');
                if (em) em.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
                if (!hx) return;
                const delay = (14 - Number(cell.style.getPropertyValue('--o') || 0)) * 45;
                longest = Math.max(longest, delay + 560);
                douseCell(hx, .09, delay);
            });
            const fold = [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px)' }];
            document.querySelectorAll('#historyList .tl-group, #historyMap .am-stats, #historyMap .am-caption').forEach((g, i) =>
                g.animate(fold, { duration: 320, delay: i * 50, easing: 'ease-in', fill: 'forwards' }));
            await sleep(longest + 80);
            if (panel) panel.classList.remove('dousing');
        }
        loadHistory();
    }
}
