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
        showToast('牌册已满，无法记录本次占卜', 'error');
        return null;
    }
}

function toggleHistory(force) {
    const panel = document.getElementById('historyPanel');
    const shouldOpen = typeof force === 'boolean' ? force : !panel.classList.contains('show');
    if (setFloatingPanelState('historyPanel', 'historyOverlay', shouldOpen)) loadHistory();
}

function loadHistory() {
    const history = readHistorySafe();
    const list = document.getElementById('historyList');
    if (history.length === 0) {
        list.innerHTML = `<div class="history-empty">
<svg class="history-empty-card" viewBox="0 0 60 90" fill="none" stroke="currentColor" stroke-width="1">
    <rect x="2" y="2" width="56" height="86" rx="3" opacity="0.3"/>
    <rect x="8" y="8" width="44" height="74" rx="1" opacity="0.15" stroke-dasharray="3 3"/>
    <line x1="20" y1="36" x2="40" y2="36" opacity="0.25"/>
    <line x1="20" y1="44" x2="28" y2="44" opacity="0.25"/><line x1="32" y1="44" x2="40" y2="44" opacity="0.25"/>
    <line x1="20" y1="52" x2="40" y2="52" opacity="0.25"/>
</svg>
<p>尚无记录</p>
<p class="history-empty-hint">请先卜一卦</p>
</div>`;
        return;
    }
    list.innerHTML = history.map((item) => {
        const guaEntry = item.binary ? lookupGua(item.binary) : null;
        const roman = guaEntry ? toRoman(guaIndex(guaEntry)) : '';
        const verdict = guaEntry ? getVerdict(guaEntry) : 'ping';
        const hexLines = (item.hexagramLines && item.hexagramLines.length === 6)
            ? item.hexagramLines
            : binToHexLines(item.binary || '000000');
        const thumb = buildYaoArtSvg(hexLines, item.changingYaos || []);
        const upper = guaEntry ? guaEntry[2][0] : '';
        const lower = guaEntry ? guaEntry[2][1] : '';
        return `<div class="history-item history-verdict-${verdict}" data-id="${item.id || ''}">
<div class="history-card-thumb">
    <div class="hcard-frame"></div>
    ${roman ? `<div class="hcard-roman">${roman}</div>` : ''}
    <div class="hcard-watermark"><span>${upper}</span><span>${lower}</span></div>
    <div class="hcard-art">${thumb}</div>
    <div class="hcard-name">${item.gua || ''}</div>
    <div class="hcard-band"></div>
</div>
<div class="history-info">
<div class="history-q">${escHtml(item.question)}</div>
<div class="history-gua"><span class="history-dot history-dot-${verdict}"></span>${roman ? `<span style="font-family:'Cinzel',serif;margin-right:6px;">${roman}</span>` : ''}${item.symbol} ${item.gua}${item.hasChange ? ' <span class="history-tag">变</span>' : ''}</div>
<div class="history-date">${item.date}</div>
</div>
<button class="history-del" data-id="${item.id || ''}" aria-label="删除">×</button>
</div>`;
    }).join('');
    list.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.history-del')) return;
            loadHistoryItem(el.dataset.id);
        });
    });
    list.querySelectorAll('.history-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteHistoryItem(btn.dataset.id);
        });
    });
}

function loadHistoryItem(id) {
    // 结果渲染会移除选牌节点；仪式未结束时不能切走，否则选牌 Promise 永远无法完成。
    if (_divineRunning) {
        showToast('正在起卦，请先完成选牌或跳过仪式，再回看牌册');
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
    if (item.hexagramLines && item.hexagramLines.length === 6) {
        renderResult(gua, item.hexagramLines, change, item.question, item.binary, null, item.aiReading, readingContext);
    } else {
        const hex = binToHexLines(item.binary || '000000');
        renderResult(gua, hex, change, item.question, item.binary || '000000', null, item.aiReading, readingContext);
    }
    toggleHistory();
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
    el.style.transition = 'transform 0.35s ease, opacity 0.35s ease, max-height 0.3s ease 0.1s';
    el.style.transform = 'translateX(-100%)';
    el.style.opacity = '0';
    el.style.maxHeight = el.offsetHeight + 'px';
    el.offsetHeight;
    el.style.maxHeight = '0';
    el.style.marginBottom = '0';
    el.style.paddingTop = '0';
    el.style.paddingBottom = '0';
    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        el.remove();
        if (!document.querySelector('.history-item')) loadHistory();
    };
    // 只认 .history-item 自身的过渡结束：子元素/伪元素（删除按钮、装饰条）的
    // transitionend 会冒泡上来提前触发收尾，截断退场动画
    const onEnd = (e) => {
        if (e.target !== el) return;
        el.removeEventListener('transitionend', onEnd);
        finish();
    };
    el.addEventListener('transitionend', onEnd);
    // 兜底：transitionend 未触发（如系统开启减少动态效果）时也能收尾
    setTimeout(() => { if (el.isConnected) finish(); }, 800);
}

async function clearHistory() {
    const yes = await showConfirm('确定清空牌册？');
    if (yes) {
        try { localStorage.removeItem('divinationHistory'); } catch (e) {}
        loadHistory();
    }
}
