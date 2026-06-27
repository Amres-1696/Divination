// divination —— 占卜主流程 divine()、主断取爻 getMainReading、
// 结果页渲染 renderResult、八字起卦 generateHexagramBazi

let _divineRunning = false;
async function divine() {
    if (_divineRunning) return;
    _divineRunning = true;
    const question = document.getElementById('question').value.trim();
    const resultArea = document.getElementById('resultArea');
    const btn = document.getElementById('divineBtn');
    const btnText = btn.querySelector('.btn-text');
    const originalText = btnText ? btnText.textContent : '起卦';

    const settings = loadSettings();

    // 八字起卦需要检查八字数据
    if (settings.method === 'bazi' && !settings.bazi) {
        showToast('请先在设置中填写并保存生辰八字', 'error');
        _divineRunning = false;
        return;
    }

    btn.disabled = true;
    if (btnText) btnText.textContent = '演卦';

    try {
        triggerIgnitionChain();
        // 心若不诚 · 卦不应人（章节 5.2）
        await showInvocation();

        resultArea.innerHTML = '<div class="ritual-stage" id="ritualStage"></div>';

        const stage = document.getElementById('ritualStage');
        stage.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const hexLines = settings.method === 'bazi'
            ? generateHexagramBazi(settings.bazi, question)
            : generateHexagram();

        const bits = hexLines.map(n => (n === 7 || n === 9) ? '1' : '0');
        const fullBin = bits.slice().reverse().join('');
        const gua = lookupGua(fullBin);
        const change = calculateChangeGua(hexLines, fullBin);

        // prefers-reduced-motion：跳过六幕仪式直接渲染（章节 4.5）
        const prefersReducedMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let chosenCard = null;
        if (!prefersReducedMotion) {
            const ritual = new ArcanaRitual(stage, gua, hexLines, change);
            // 仪式与「跳过」信号竞速：点跳过即直奔结果，不触碰内部动画时序
            let skipped = false;
            const skipPromise = new Promise(res => { ritual._onSkip = () => { skipped = true; res(); }; });
            await Promise.race([ritual.run(), skipPromise]);
            chosenCard = skipped ? null : ritual.chosenCard;
        }

        renderResult(gua, hexLines, change, question, fullBin, chosenCard);
        saveToHistory(question, gua, fullBin, hexLines, change);
    } finally {
        btn.disabled = false;
        if (btnText) btnText.textContent = originalText;
        _divineRunning = false;
    }
}


// 主断：依朱熹《易学启蒙》变爻取辞法，明确「该以哪一条为主断」
// changingYaos 为升序（0=初爻 … 5=上爻）
function getMainReading(gua, change) {
    const yaoArr = gua[3].split('|');
    const changing = change.changingYaos;
    const n = changing.length;
    const benName = gua[0];
    const zhi = change.changeGua;
    const posCN = ['初', '二', '三', '四', '五', '上'];
    const all = [0, 1, 2, 3, 4, 5];

    if (n === 0)
        return { rule: '静卦无变', text: `以本卦《${benName}》卦辞为主断：「${gua[1]}」` };
    if (n === 1)
        return { rule: '一爻动', text: `以本卦《${benName}》${posCN[changing[0]]}爻为主断 —— ${yaoArr[changing[0]] || ''}` };
    if (n === 2)
        return { rule: '二爻动', text: `二爻变，以上动爻为主 —— ${yaoArr[changing[1]] || ''}` };
    if (n === 3)
        return { rule: '三爻动', text: `三爻变，本卦《${benName}》与之卦《${zhi[0]}》卦辞并参 —— 本卦「${gua[1]}」，之卦「${zhi[1]}」。` };
    if (n === 4) {
        const low = all.filter(i => !changing.includes(i))[0];
        return { rule: '四爻动', text: `四爻变，看之卦《${zhi[0]}》中二不变爻，以下爻为主 —— ${zhi[3].split('|')[low] || ''}` };
    }
    if (n === 5) {
        const only = all.filter(i => !changing.includes(i))[0];
        return { rule: '五爻动', text: `五爻变，以之卦《${zhi[0]}》唯一不变之爻为主 —— ${zhi[3].split('|')[only] || ''}` };
    }
    if (benName === '乾为天')
        return { rule: '六爻全变·用九', text: '乾卦六爻全变，用九：「见群龙无首，吉。」' };
    if (benName === '坤为地')
        return { rule: '六爻全变·用六', text: '坤卦六爻全变，用六：「利永贞。」' };
    return { rule: '六爻全变', text: `六爻全变，以之卦《${zhi[0]}》卦辞为主断：「${zhi[1]}」` };
}

function renderResult(gua, hexLines, change, question, fullBin, sourceCard, savedAi) {
    const resultArea = document.getElementById('resultArea');
    const yaoNames = ['初九','九二','九三','九四','九五','上九','初六','六二','六三','六四','六五','上六'];
    const roman = toRoman(guaIndex(gua));
    const verdict = getVerdict(gua);
    const verdictText = { ji:'吉', xiong:'凶', ping:'平' };
    const mainReading = getMainReading(gua, change);
    let firstRect = null;
    if (sourceCard && sourceCard.parentNode) {
        firstRect = sourceCard.getBoundingClientRect();
        sourceCard.remove();
    }

    const yaoHtml = hexLines.map((line, i) => {
        const isYang = (line === 9 || line === 7);
        const yaoType = line===9?'老阳':line===7?'少阳':line===8?'少阴':'老阴';
        const yaoName = isYang ? yaoNames[i] : yaoNames[i+6];
        const yaoText = gua[3].split('|')[i] || '';
        const isChanging = change.changingYaos.includes(i);
        const lineVis = isYang
            ? '<span class="yao-line yang"><span></span></span>'
            : '<span class="yao-line yin"><span></span><span></span></span>';
        const changeBadge = isChanging ? '<span class="yao-badge change">变</span>' : '';
        return `<div class="yao-item${isChanging?' changing':''}">
<div class="yao-header yao-toggle">${lineVis}<span class="yao-name">${yaoName}</span><span class="yao-badge type">${yaoType}</span>${changeBadge}<span class="yao-chevron">›</span></div>
<div class="yao-text">${yaoText}</div></div>`;
    }).join('');

    const analysisHtml = gua[4].split('。').filter(s=>s.trim()).map(s =>
        `<div class="analysis-item">${s.trim()}。</div>`
    ).join('');

    let changeHtml = '';
    if (change.hasChange && change.changeGua) {
        const pos = change.changingYaos.map(p => ['初','二','三','四','五','上'][p]);
        changeHtml = `<section class="card card-drama change-section"><h3>变·卦·演化 <span class="hex-tag">天机易转</span></h3>
<div class="change-comparison">
<div class="gua-box"><div class="gua-label">BEN · 本</div><div class="gua-symbol">${gua[2]}</div><div class="gua-name">${gua[0]}</div></div>
<div class="change-arrow">⟶</div>
<div class="gua-box changed"><div class="gua-label">BIAN · 变</div><div class="gua-symbol">${change.changeGua[2]}</div><div class="gua-name">${change.changeGua[0]}</div></div>
</div>
<div class="change-details"><p>变爻位置：第 ${pos.join('、')} 爻</p><p>${change.changeGua[4]}</p></div></section>`;
    }

    const aiSettings = loadSettings().ai || {};
    const showAiCard = !!savedAi || aiSettings.enabled;
    const aiHtml = showAiCard
        ? `<section class="card card-ai" id="aiReadingCard"><h3>天机 · AI 详解 <span class="hex-tag">灵犀一点</span></h3><div class="ai-reading-body" id="aiReadingBody"></div></section>`
        : '';

    resultArea.innerHTML = `
<section class="card result-header">
    <div class="chosen-card-wrap" id="chosenCardWrap"></div>
    <div class="hex-roman">${roman}</div>
    <h2 class="hex-name hex-name-art">${gua[0]}</h2>
    <div class="hex-title">${gua[1]}</div>
    <div class="hex-symbol" style="display:none;">${gua[2]}</div>
    ${question ? `<p class="hex-question">「${escHtml(question)}」</p>` : ''}
    <div class="verdict-seal ${verdict}">${verdictText[verdict]}</div>
    <div class="share-row"><button class="btn-share" id="shareBtn">✦ 生成分享图</button></div>
</section>
<section class="card card-primary main-reading"><h3>主 · 断 <span class="hex-tag">${mainReading.rule}</span></h3><div class="analysis-list"><div class="analysis-item">${mainReading.text}</div></div></section>
<section class="card card-primary"><h3>卦象奥义</h3><div class="analysis-list">${analysisHtml}</div></section>
<section class="card card-secondary"><h3>六爻之辞</h3><div class="yao-list">${yaoHtml}</div></section>
${changeHtml}
${aiHtml}
<section class="result-actions">
    <button class="btn-action btn-action-secondary" id="newDivineBtn">
        <span class="btn-rune">↺</span><span>再问一卦</span>
    </button>
    <button class="btn-action btn-action-tertiary" id="viewHistoryBtn">
        <span class="btn-rune">◱</span><span>翻阅牌册</span>
    </button>
    <p class="result-warning">占而再三 · 神不告之</p>
</section>`;

    resultArea.querySelector('#shareBtn').addEventListener('click', shareAsImage);
    const newBtn = resultArea.querySelector('#newDivineBtn');
    if (newBtn) newBtn.addEventListener('click', () => {
        const qEl = document.getElementById('question');
        if (qEl) { qEl.value = ''; qEl.focus(); }
        document.body.classList.remove('mood-ji', 'mood-xiong', 'mood-ping');
        resultArea.innerHTML = '';
        const target = document.querySelector('.question-area');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const viewBtn = resultArea.querySelector('#viewHistoryBtn');
    if (viewBtn) viewBtn.addEventListener('click', toggleHistory);

    const aiBody = resultArea.querySelector('#aiReadingBody');
    if (aiBody) {
        const runAi = () => {
            requestAiReading(gua, change, question, aiBody).then(text => {
                if (text) persistAiReading(text, gua, change, question);
            });
        };
        if (savedAi) {
            aiBody.innerHTML = '<div class="ai-reading-text"></div>';
            aiBody.querySelector('.ai-reading-text').textContent = savedAi;
        } else if (aiSettings.autoRun) {
            runAi();
        } else {
            aiBody.innerHTML = '<button class="btn-ai-run" id="aiRunBtn"><span class="btn-rune">✧</span> 请神解卦 <span class="btn-rune">✧</span></button>';
            aiBody.querySelector('#aiRunBtn').addEventListener('click', runAi);
        }
    }

    const wrap = resultArea.querySelector('#chosenCardWrap');
    let bigCard;
    if (sourceCard) {
        sourceCard.style.cssText = '';
        sourceCard.classList.remove('active', 'peak');
        wrap.appendChild(sourceCard);
        bigCard = sourceCard;
    } else {
        bigCard = makeArcanaCard(gua, {
            large: true,
            hexLines,
            changingYaos: change.changingYaos,
            rare: isRareGua(fullBin)
        });
        bigCard.classList.add('flipped');
        bigCard.classList.add('yao-animate');
        wrap.appendChild(bigCard);
    }

    if (firstRect) {
        wrap.style.animation = 'none';
        const lastRect = bigCard.getBoundingClientRect();
        const dx = (firstRect.left + firstRect.width/2) - (lastRect.left + lastRect.width/2);
        const dy = (firstRect.top + firstRect.height/2) - (lastRect.top + lastRect.height/2);
        const scale = lastRect.width > 0 ? firstRect.width / lastRect.width : 1;

        bigCard.style.transformOrigin = 'center center';
        bigCard.style.transition = 'none';
        bigCard.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
        bigCard.offsetHeight; 

        requestAnimationFrame(() => {
            bigCard.style.transition = 'transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)';
            bigCard.style.transform = '';
        });


        setTimeout(() => {
            bigCard.style.transition = '';
            bigCard.style.transform = '';
            bigCard.style.transformOrigin = '';
            wrap.style.animation = '';
        }, 1250);
    }


    const header = resultArea.querySelector('.result-header');
    if (header) {
        const headerKids = Array.from(header.children).filter(el => !el.matches('.chosen-card-wrap, .hex-symbol, .hex-name-art, .verdict-seal'));
        headerKids.forEach((el, i) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(8px)';
            setTimeout(() => {
                el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
                el.style.opacity = '1';
                el.style.transform = '';
            }, 350 + i * 80);
        });


        const nameEl = header.querySelector('.hex-name-art');
        if (nameEl) {
            const txt = nameEl.textContent;
            nameEl.innerHTML = txt.split('').map((ch, idx) =>
                `<span class="hex-char" style="animation-delay:${600 + idx * 220}ms">${ch === ' ' ? '&nbsp;' : ch}</span>`
            ).join('');
        }


        const seal = header.querySelector('.verdict-seal');
        if (seal) {
            seal.style.opacity = '0';
            setTimeout(() => {
                seal.style.opacity = '';
                seal.classList.add('stamp-in');
            }, 1400);
        }
    }


    const otherCards = resultArea.querySelectorAll('.card:not(.result-header)');
    otherCards.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
            el.style.opacity = '1';
            el.style.transform = '';
            const yaoList = el.querySelector('.yao-list');
            if (yaoList) yaoList.classList.add('scroll-open');
            const analysisList = el.querySelector('.analysis-list');
            if (analysisList) analysisList.classList.add('stagger-in');
        }, 700 + i * 180);
    });

    // 移动端爻辞折叠/展开
    resultArea.querySelectorAll('.yao-toggle').forEach(header => {
        header.addEventListener('click', () => {
            header.closest('.yao-item').classList.toggle('yao-expanded');
        });
    });

    document.body.classList.remove('mood-ji', 'mood-xiong', 'mood-ping');
    document.body.classList.add('mood-' + verdict);

    if (isRareGua(fullBin) && bigCard) {
        setTimeout(() => spawnGoldSparkles(bigCard, 16), 1500);
        setTimeout(() => spawnGoldSparkles(bigCard, 10), 5500);
        setTimeout(() => spawnGoldSparkles(bigCard, 10), 9500);
    }

    setTimeout(() => {
        const target = resultArea.querySelector('.result-header') || resultArea;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 1300);
}

// 归一化问题：去空白、去标点符号、全角转半角、统一小写
// 让「同一个问题」在语义上恒定，不因末尾空格 / 标点差异而改变卦象
function normalizeQuestion(q) {
    if (!q) return '';
    return q
        .normalize('NFKC')               // 全角数字 / 字母 / 符号归一为半角
        .replace(/\s+/g, '')             // 去除所有空白
        .replace(/[\p{P}\p{S}]/gu, '')   // 去除标点与符号
        .toLowerCase();
}

// 八字起卦（纯宿命版）：卦象 = f(八字, 归一化问题)，不掺入当前时间
// 同一人 + 同一问题 → 永远同一卦。再三问亦不改，暗合蒙卦「初筮告，再三渎，渎则不告」。
function generateHexagramBazi(bazi, question) {
    const qn = normalizeQuestion(question);
    const qNum = qn ? simpleHash(qn) : 0;        // 稳定非负整数，同问题恒定

    const yearNum = bazi.year % 100 || 100;
    // 梅花易数：以八字「年月日」起上卦，「年月日时」起下卦——八字即先天之命
    const baseUpper = yearNum + bazi.month + bazi.day;
    const baseLower = baseUpper + (bazi.hour + 1);

    // 融入所问之事（确定性：同一问题恒定，不同问题分散；取质数模以打散分布）
    const sumUpper = baseUpper + (qNum % 97);
    const sumLower = baseLower + (Math.floor(qNum / 97) % 89);
    const sumYao   = sumUpper + sumLower;        // 动爻＝上下卦总数 mod 6（梅花传统）

    const upperIdx = ((sumUpper - 1) % 8 + 8) % 8;
    const lowerIdx = ((sumLower - 1) % 8 + 8) % 8;
    const changingYao = ((sumYao - 1) % 6 + 6) % 6;

    const xiantianOrder = ['☰','☱','☲','☳','☴','☵','☶','☷'];
    const upperBin = TRIGRAM_TO_BINARY[xiantianOrder[upperIdx]];
    const lowerBin = TRIGRAM_TO_BINARY[xiantianOrder[lowerIdx]];

    const lines = [];
    for (let i = 0; i < 3; i++) lines.push(lowerBin[2 - i] === '1' ? 7 : 8);
    for (let i = 0; i < 3; i++) lines.push(upperBin[2 - i] === '1' ? 7 : 8);

    if (lines[changingYao] === 7) lines[changingYao] = 9;
    else lines[changingYao] = 6;

    return lines;
}
