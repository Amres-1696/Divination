// history —— 牌册：localStorage 读写、列表渲染、回看、删除、清空

// 历史
function readHistorySafe() {
    try {
        const raw = localStorage.getItem('divinationHistory');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function saveToHistory(question, gua, fullBin, hexLines, change) {
    try {
        const history = readHistorySafe();
        history.unshift({
            question: question || '心中所念',
            gua: gua[0], symbol: gua[2], title: gua[1],
            binary: fullBin, hexagramLines: hexLines,
            changeBinary: change.changeBinary,
            hasChange: change.hasChange,
            changingYaos: change.changingYaos,
            date: new Date().toLocaleString('zh-CN')
        });
        localStorage.setItem('divinationHistory', JSON.stringify(history.slice(0, HISTORY_MAX)));
    } catch (e) {
        showToast('牌册已满，无法记录本次占卜', 'error');
    }
}

function toggleHistory() {
    const panel = document.getElementById('historyPanel');
    const overlay = document.getElementById('historyOverlay');
    panel.classList.toggle('show');
    overlay.classList.toggle('show');
    if (panel.classList.contains('show')) loadHistory();
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
    list.innerHTML = history.map((item, idx) => {
        const guaEntry = item.binary ? lookupGua(item.binary) : null;
        const roman = guaEntry ? toRoman(guaIndex(guaEntry)) : '';
        const verdict = guaEntry ? getVerdict(guaEntry) : 'ping';
        const hexLines = (item.hexagramLines && item.hexagramLines.length === 6)
            ? item.hexagramLines
            : binToHexLines(item.binary || '000000');
        const thumb = buildYaoArtSvg(hexLines, item.changingYaos || []);
        const upper = guaEntry ? guaEntry[2][0] : '';
        const lower = guaEntry ? guaEntry[2][1] : '';
        return `<div class="history-item history-verdict-${verdict}" data-idx="${idx}">
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
<button class="history-del" data-idx="${idx}" aria-label="删除">×</button>
</div>`;
    }).join('');
    list.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.history-del')) return;
            loadHistoryItem(parseInt(el.dataset.idx));
        });
    });
    list.querySelectorAll('.history-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteHistoryItem(parseInt(btn.dataset.idx));
        });
    });
}

function loadHistoryItem(index) {
    const history = readHistorySafe();
    const item = history[index];
    if (!item) return;
    const gua = item.binary ? lookupGua(item.binary) : (GUA.find(g => g[2] === item.symbol) || GUA[0]);
    if (!gua) return;
    const change = {
        hasChange: item.hasChange,
        changeBinary: item.changeBinary,
        changingYaos: item.changingYaos || [],
        changeGua: item.changeBinary ? lookupGua(item.changeBinary) : null
    };
    if (item.hexagramLines && item.hexagramLines.length === 6) {
        renderResult(gua, item.hexagramLines, change, item.question, item.binary, null, item.aiReading);
    } else {
        const hex = binToHexLines(item.binary || '000000');
        renderResult(gua, hex, change, item.question, item.binary || '000000', null, item.aiReading);
    }
    toggleHistory();
}

function deleteHistoryItem(index) {
    const history = readHistorySafe();
    if (index < 0 || index >= history.length) return;
    const item = history[index];
    const el = document.querySelector(`.history-item[data-idx="${index}"]`);
    if (el) {
        el.style.transition = 'transform 0.35s ease, opacity 0.35s ease, max-height 0.3s ease 0.1s';
        el.style.transform = 'translateX(-100%)';
        el.style.opacity = '0';
        el.style.maxHeight = el.offsetHeight + 'px';
        el.offsetHeight;
        el.style.maxHeight = '0';
        el.style.marginBottom = '0';
        el.style.paddingTop = '0';
        el.style.paddingBottom = '0';
        el.addEventListener('transitionend', () => {
            const fresh = readHistorySafe();
            if (index < fresh.length) fresh.splice(index, 1);
            try { localStorage.setItem('divinationHistory', JSON.stringify(fresh)); } catch (e) {}
            loadHistory();
        }, { once: true });
    } else {
        history.splice(index, 1);
        try { localStorage.setItem('divinationHistory', JSON.stringify(history)); } catch (e) {}
        loadHistory();
    }
}

async function clearHistory() {
    const yes = await showConfirm('确定清空牌册？');
    if (yes) {
        try { localStorage.removeItem('divinationHistory'); } catch (e) {}
        loadHistory();
    }
}
