// daily —— 每日一卦与箴言（按用户种子+日期或生辰推定）、卦象详解弹层

// 每日一卦
let _volatileUid = null;
function getUserSeed() {
    try {
        let uid = localStorage.getItem('tianyan_uid');
        if (!uid) {
            uid = Math.random().toString(36).substring(2) + Date.now().toString(36);
            localStorage.setItem('tianyan_uid', uid);
        }
        return uid;
    } catch (e) {
        // 存储不可用（隐私模式等）：本次打开页面内保持同一个种子，卦和箴言不会每次重算都变
        if (!_volatileUid) _volatileUid = Math.random().toString(36).substring(2) + Date.now().toString(36);
        return _volatileUid;
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
    // 用完整日期：只用「几号」的话，每个月同一天的箴言都一样
    const str = dailyDateKey(d) + uid;
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
    // 卦画居中，左边「今日一卦」和卦名，右边箴言
    el.innerHTML = `
<span class="daily-side left"><span class="daily-eyebrow">今日一卦</span><span class="daily-name">${gua[0]}</span></span>
<span class="daily-symbol" aria-hidden="true">${buildYaoArtSvg(binToHexLines(guaBinary(gua)), [])}</span>
<span class="daily-side right"><span class="daily-motto">${motto}</span></span>`;
    _dailyDateKey = dailyDateKey(now);
    // 详情与可见卡片共用快照，避免跨日/设置变化时点击到另一卦。
    el.onclick = () => showGuaDetail(gua);
}

// 卦象详解 
function showGuaDetail(gua, when) {
    const old = document.querySelector('.detail-overlay');
    if (old) old.remove();

    const d = when || new Date();
    const bin = guaBinary(gua);
    const v = shaoValue(bin);
    const lines = binToHexLines(bin);
    const verdict = getVerdict(gua);
    const verdictText = { ji: '吉', xiong: '凶', ping: '平' }[verdict];

    // 爻辞直接标注在卦画每一爻的右边，自上而下
    const yaos = gua[3].split('|');
    const callouts = [];
    for (let i = 5; i >= 0; i--) {
        const y = yaos[i] || '';
        const cut = y.indexOf('：');
        const pos = cut > 0 ? y.substring(0, cut) : yaoLabel(lines[i], i);
        const txt = cut > 0 ? y.substring(cut + 1) : y;
        callouts.push(`<li style="--r:${5 - i}"><span class="gs-pos">${pos}</span><span class="gs-text">${txt}</span></li>`);
    }

    const analysis = gua[4].split('。').filter(s => s.trim()).map(s =>
        `<p>${s.trim()}。</p>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.className = 'detail-overlay';
    overlay.innerHTML = `
<div class="detail-box gua-sheet" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
    <button class="detail-close btn-close" id="detailCloseBtn" aria-label="关闭"></button>
    <header class="gs-head">
        <p class="gs-eyebrow">今日一卦　${d.getMonth() + 1} 月 ${d.getDate()} 日</p>
        <div class="gs-name-row"><h2 id="detailTitle">${gua[0]}</h2><span class="verdict-seal ${verdict}" aria-label="${verdictText}"><span>${verdictText}</span></span></div>
        <p class="gs-sub">${gua[1]}</p>
    </header>
    <figure class="gs-figure">
        <div class="gs-glyph">${buildHexBars(lines)}</div>
        <ol class="gs-yao" aria-label="爻辞">${callouts.join('')}</ol>
    </figure>
    <div class="detail-section"><h3>卦象</h3><div class="detail-analysis">${analysis}</div></div>
    <dl class="title-block gs-tb">
        <div><dt>卦序</dt><dd>${guaOrdinal(gua)}</dd></div>
        <div><dt>上下</dt><dd>上${TRIGRAM_BY_VALUE[v & 7]} 下${TRIGRAM_BY_VALUE[v >> 3]}</dd></div>
        <div><dt>方图</dt><dd>${typeof buildMiniMap === 'function' ? buildMiniMap(v) : ''}</dd></div>
    </dl>
</div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeGuaDetail(overlay); });
    document.body.appendChild(overlay);
    overlay.querySelector('#detailCloseBtn').addEventListener('click', () => closeGuaDetail(overlay));
    requestAnimationFrame(() => overlay.classList.add('show'));
    guaSheetFlight(overlay, true);
    const closeBtn = overlay.querySelector('#detailCloseBtn');
    if (closeBtn && closeBtn.focus) closeBtn.focus({ preventScroll: true });
}

function closeGuaDetail(overlay) {
    overlay = overlay || document.querySelector('.detail-overlay');
    if (!overlay || overlay._closing) return;
    overlay._closing = true;
    // 卦画飞回首页要 0.52 秒；它在遮罩外面单独一层，遮罩可以先淡出
    const flying = guaSheetFlight(overlay, false);
    const fadeAt = flying ? 200 : 0;
    setTimeout(() => overlay.classList.remove('show'), fadeAt);
    setTimeout(() => overlay.remove(), fadeAt + 340);
}

// 首页那枚小卦画飞起、放大，落到详情页卦画的位置变成大卦画；详情页同时从模糊中清晰浮现。
// 关闭时大卦画飞回首页原位，详情页模糊淡去。飞行的是一份克隆，真卦画在落地前先藏起来
function guaSheetFlight(overlay, open) {
    const sheet = overlay.querySelector('.gua-sheet');
    const glyph = sheet && sheet.querySelector('.gs-glyph');
    const src = document.querySelector('#dailyGua .daily-symbol');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!glyph || !src || typeof sheet.animate !== 'function' || reduce) return false;
    const s = src.getBoundingClientRect();
    if (!s.width) return false;
    if (overlay._flyer) overlay._flyer.remove();
    sheet.getAnimations().forEach(a => a.cancel());
    // 详情框自带的上移缩放入场（CSS 过渡）会让落点偏下约 18px，卦画落地后整框再往上滑一下。
    // 连过渡一起关掉、立即生效后再量落点，入场交给这里的动画接管
    sheet.style.transition = 'none';
    sheet.style.transform = 'none';
    sheet.offsetWidth;
    overlay.classList.add('flown');
    const g = glyph.getBoundingClientRect();
    const flyer = document.createElement('div');
    flyer.className = 'gs-glyph gs-flyer';
    flyer.innerHTML = glyph.innerHTML;
    flyer.style.cssText = `left:${g.left}px;top:${g.top}px;width:${g.width}px;height:${g.height}px;`;
    document.body.appendChild(flyer);
    overlay._flyer = flyer;
    const dx = s.left - g.left, dy = s.top - g.top, k = s.width / g.width;
    const atSrc = `translate(${dx}px, ${dy}px) scale(${k.toFixed(3)})`;
    // 走一段向上拱起的弧线，而不是直线
    const mid = `translate(${dx * .45}px, ${dy * .45 - 46}px) scale(${((1 + k) / 2 + .12).toFixed(3)})`;
    glyph.style.visibility = 'hidden';
    src.style.visibility = 'hidden';
    const land = () => {
        glyph.style.visibility = '';
        src.style.visibility = '';
        flyer.remove();
        if (overlay._flyer === flyer) overlay._flyer = null;
    };
    if (open) {
        flyer.animate([{ transform: atSrc }, { transform: mid, offset: .5 }, { transform: 'none' }],
            { duration: 760, easing: 'cubic-bezier(.45, 0, .2, 1)' }).onfinish = land;
        sheet.animate([
            { opacity: 0, filter: 'blur(10px)', transform: 'translateY(18px)' },
            { opacity: 1, filter: 'blur(0px)', transform: 'none' }
        ], { duration: 620, delay: 160, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'backwards' });
    } else {
        flyer.animate([{ transform: 'none' }, { transform: mid, offset: .5 }, { transform: atSrc }],
            { duration: 520, easing: 'cubic-bezier(.5, 0, .25, 1)', fill: 'forwards' }).onfinish = land;
        sheet.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(8px)' }],
            { duration: 260, easing: 'ease-in', fill: 'forwards' });
    }
    return true;
}
