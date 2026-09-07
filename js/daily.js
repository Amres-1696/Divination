// daily —— 每日一卦与箴言（按用户种子+日期或八字推定）、卦象详解弹层

// 每日一卦 
function getUserSeed() {
    try {
        let uid = localStorage.getItem('tianyan_uid');
        if (!uid) {
            uid = Math.random().toString(36).substring(2) + Date.now().toString(36);
            localStorage.setItem('tianyan_uid', uid);
        }
        return uid;
    } catch (e) {

        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
}

function getDailyGua(d = new Date()) {
    const dateStr = d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
    const settings = loadSettings();

    if (settings.bazi) {
        const b = settings.bazi;
        // 与八字起卦同规：生辰与今日皆换算农历（年取地支数），换算失败退回公历数值
        const lunarBazi = solarToLunar(b.year, b.month, b.day);
        const yearNum = lunarBazi ? lunarYearBranch(lunarBazi.year) : (b.year % 100 || 100);
        const bMonth = lunarBazi ? lunarBazi.month : b.month;
        const bDay = lunarBazi ? lunarBazi.day : b.day;
        const nowLunar = solarToLunar(d.getFullYear(), d.getMonth() + 1, d.getDate());
        const nowDay = nowLunar ? nowLunar.day : d.getDate();
        const nowMonth = nowLunar ? nowLunar.month : (d.getMonth() + 1);
        const sumUpper = yearNum + bMonth + bDay + nowDay;
        const sumLower = sumUpper + (b.hour + 1) + nowMonth;
        const upperIdx = ((sumUpper - 1) % 8 + 8) % 8;
        const lowerIdx = ((sumLower - 1) % 8 + 8) % 8;
        const xiantianOrder = ['☰','☱','☲','☳','☴','☵','☶','☷'];
        const upperBin = TRIGRAM_TO_BINARY[xiantianOrder[upperIdx]];
        const lowerBin = TRIGRAM_TO_BINARY[xiantianOrder[lowerIdx]];
        return lookupGua(upperBin + lowerBin);
    }

    const uid = getUserSeed();
    const combined = dateStr + ':' + uid;
    let seed = 0;
    for (let i = 0; i < combined.length; i++) seed = ((seed << 5) - seed + combined.charCodeAt(i)) | 0;
    return GUA[Math.abs(seed) % 64];
}

function getDailyMotto(d = new Date()) {
    const uid = getUserSeed();
    const str = d.getDate() + uid;
    let seed = 0;
    for (let i = 0; i < str.length; i++) seed = ((seed << 5) - seed + str.charCodeAt(i)) | 0;
    return DAILY_MOTTOS[Math.abs(seed) % DAILY_MOTTOS.length];
}

let _dailyDateKey = '';
function dailyDateKey(d) {
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function refreshDailyGuaIfNeeded() {
    const now = new Date();
    if (_dailyDateKey !== dailyDateKey(now)) renderDailyGua(now);
}

function renderDailyGua(now = new Date()) {
    const el = document.getElementById('dailyGua');
    if (!el) return;
    const gua = getDailyGua(now);
    const motto = getDailyMotto(now);
    const roman = toRoman(guaIndex(gua));
    el.innerHTML = `
<span class="daily-today-seal">今日</span>
<div class="daily-label">DAILY · ARCANUM · 今日启示</div>
<div class="daily-content">
    <span class="daily-roman">${roman}</span>
    <span class="daily-symbol">${gua[2]}</span>
    <span class="daily-name">${gua[0]}</span>
    <span class="daily-divider">◆</span>
    <span class="daily-motto">${motto}</span>
</div>`;
    _dailyDateKey = dailyDateKey(now);
    // 详情与可见卡片共用快照，避免跨日/设置变化时点击到另一卦。
    el.onclick = () => showGuaDetail(gua);
}

// 卦象详解 
function showGuaDetail(gua) {
    const old = document.querySelector('.detail-overlay');
    if (old) old.remove();

    const yaos = gua[3].split('|');
    const yaoHtml = yaos.map(y => {
        const i = y.indexOf('：');
        const pos = i > 0 ? y.substring(0, i) : '';
        const txt = i > 0 ? y.substring(i + 1) : y;
        return `<div class="detail-yao"><span class="detail-yao-name">${pos}</span>${txt}</div>`;
    }).join('');

    const analysis = gua[4].split('。').filter(s => s.trim()).map(s =>
        `<p>${s.trim()}。</p>`
    ).join('');

    const upper = getTrigramName(gua[2][0]);
    const lower = getTrigramName(gua[2][1]);
    const roman = toRoman(guaIndex(gua));

    const overlay = document.createElement('div');
    overlay.className = 'detail-overlay';
    overlay.innerHTML = `
<div class="detail-box">
    <div class="detail-head">
        <div class="detail-symbol">${gua[2]}</div>
        <div class="detail-info">
            <div style="font-family:'Cinzel',serif;color:#8a6d3a;font-size:0.85rem;letter-spacing:0.4em;margin-bottom:2px;">${roman}</div>
            <h2>${gua[0]}</h2>
            <div class="detail-sub">${gua[1]}</div>
        </div>
        <button class="detail-close" id="detailCloseBtn">×</button>
    </div>
    <div class="detail-meta">上卦 ${upper} · 下卦 ${lower}</div>
    <div class="detail-section"><h3>爻 辞</h3>${yaoHtml}</div>
    <div class="detail-section"><h3>卦 象 解 读</h3><div class="detail-analysis">${analysis}</div></div>
</div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    overlay.querySelector('#detailCloseBtn').addEventListener('click', () => overlay.remove());
    requestAnimationFrame(() => overlay.classList.add('show'));
}

function getTrigramName(sym) {
    const map = {'☰':'乾(天)','☱':'兑(泽)','☲':'离(火)','☳':'震(雷)','☴':'巽(风)','☵':'坎(水)','☶':'艮(山)','☷':'坤(地)'};
    return map[sym] || sym;
}
