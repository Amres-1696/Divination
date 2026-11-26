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
    const startedAt = new Date();
    const readingContext = {
        method: settings.method,
        createdAt: startedAt.toISOString(),
        date: startedAt.toLocaleString('zh-CN')
    };

    // 生辰起卦、本命卦需要先存生辰
    if (needsBirth(settings.method) && !settings.bazi) {
        if (typeof promptForBirth === 'function') promptForBirth();
        _divineRunning = false;
        return;
    }
    // 报数起卦分两步：第一次点「起卦」只把问题框翻过去露出报数的两格；两格填好再点，才真正起卦
    let nums = null;
    if (settings.method === 'number') {
        if (!numbersShown()) {
            flipToNumbers(true);
            _divineRunning = false;
            return;
        }
        // 刚翻过去、两格还没露出来时又点了一下（连点、连按回车）：不算数，也不弹提示
        if (Date.now() - _numbersFlippedAt < NUMBER_FLIP_MS) {
            _divineRunning = false;
            return;
        }
        nums = readNumberPair();
        if (!nums) {
            showToast('两格各填一个 1 到 9999 的数，凭直觉想到什么写什么');
            const a = document.getElementById('numA'), b = document.getElementById('numB');
            const bad = a && !isValidNumber(a.value) ? a : b;
            if (bad && bad.focus) bad.focus();
            _divineRunning = false;
            return;
        }
        // 翻回问题那一面再起卦：问题从输入框升到顶栏时，起点是看得见的那一行字。
        // 两个数等这一卦出来了再清，中途出错回到首页时还在，不用重填
        flipToNumbers(false, { quiet: true });
    }

    btn.disabled = true;
    if (btnText) btnText.textContent = '演卦';

    try {
        // 问题从输入框升到顶栏挂着，结果出来时落成「所问」标题
        if (typeof carryQuestion === 'function') carryQuestion(question);
        await showInvocation();

        if (typeof setPageView === 'function') setPageView('ritual');
        resultArea.innerHTML = '<div class="ritual-stage" id="ritualStage"></div>';

        const stage = document.getElementById('ritualStage');
        if (window.scrollTo) window.scrollTo({ top: 0 });

        // 占时、报数按点「起卦」那一刻取数（和牌册记的时间一致），不是开场动画播完的那一刻
        const now = startedAt;
        const hexLines = settings.method === 'bazi' ? generateHexagramBazi(settings.bazi, question)
            : settings.method === 'natal' ? generateHexagramNatal(settings.bazi)
            : settings.method === 'time' ? generateHexagramTime(now)
            : settings.method === 'number' ? generateHexagramNumber(nums[0], nums[1], now)
            : generateHexagram();

        const bits = hexLines.map(n => (n === 7 || n === 9) ? '1' : '0');
        const fullBin = bits.slice().reverse().join('');
        const gua = lookupGua(fullBin);
        const change = calculateChangeGua(hexLines, fullBin);

        // 起卦过程：完整 / 快掷 / 直出（设置里选）。系统开了「减少动态效果」时一律直出
        const prefersReducedMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // 铜钱和生辰各有各的过程设置，互不影响
        const paceSetting = settings.method === 'coin' ? settings.ritual : settings.ritualBazi;
        const ritualMode = prefersReducedMotion ? 'none' : (paceSetting || 'full');
        let chosenCard = null;
        if (ritualMode !== 'none') {
            const ritual = new HexRitual(stage, gua, hexLines, change, settings.method, ritualMode, ritualNote(settings.method, now, nums));
            // 仪式与「跳过」信号竞速：点跳过即直奔结果，不触碰内部动画时序
            let skipped = false;
            const skipPromise = new Promise(res => { ritual._onSkip = () => { skipped = true; ritual.abort(); res(); }; });
            await Promise.race([ritual.run(), skipPromise]);
            // 跳过时也让圆图上对应的那一卦飞到结果页
            chosenCard = skipped ? { cosmosValue: ritual.value } : ritual.chosenCard;
        }

        // 先落库拿到唯一 ID，自动 AI 解读和重试都绑定本条记录。
        readingContext.historyId = saveToHistory(question, gua, fullBin, hexLines, change, readingContext);
        readingContext.fresh = !!readingContext.historyId;   // 刚收进牌册：结果页的卦落定后，牌册挂签盖上新的数
        if (typeof reportReading === 'function') reportReading({ method: settings.method, gua, fullBin, change });
        renderResult(gua, hexLines, change, question, fullBin, chosenCard, null, readingContext);
        if (nums) ['numA', 'numB'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    } catch (error) {
        if (typeof dropQuestionCarry === 'function') dropQuestionCarry();
        if (typeof setPageView === 'function') setPageView('home');
        resultArea.innerHTML = '';
        // 圆图可能还停在刻度盘上（标线、转到一半），收回首页的样子
        if (typeof Cosmos !== 'undefined') Cosmos.toCircle();
        if (typeof playHomeEnter === 'function') playHomeEnter(150);
        showToast('这一卦没起成，再试一次', 'error');
        console.error(error);
    } finally {
        btn.disabled = false;
        if (btnText) btnText.textContent = originalText;
        _divineRunning = false;
    }
}


// 主断：依朱熹《易学启蒙》变爻取辞法，明确「该以哪一条为主断」
// changingYaos 为升序（0=初爻 … 5=上爻）
// 返回：rule 规则名；text 完整一句（给 AI 和分享图）；
//       lines 主断的原文，每条 { from: 出处, text: 辞 }；
//       how 这一卦为什么取这一句，带上具体爻名（给结果页，全页只有这里讲取法）；
//       at 主断读的是哪一爻（0–5），读卦辞时为 null
function getMainReading(gua, change) {
    const yaoArr = gua[3].split('|');
    const changing = change.changingYaos;
    const n = changing.length;
    const benName = gua[0];
    const zhi = change.changeGua;
    const all = [0, 1, 2, 3, 4, 5];
    // 「上九：亢龙有悔」→ 出处「本卦《乾为天》上九」+ 辞「亢龙有悔」
    const yaoLine = (label, name, raw) => {
        const cut = String(raw || '').indexOf('：');
        return cut > 0
            ? { from: `${label}《${name}》${raw.slice(0, cut)}`, text: raw.slice(cut + 1) }
            : { from: `${label}《${name}》`, text: raw || '' };
    };
    const nameOf = raw => String(raw || '').split('：')[0];
    // 白话（data.js 的 GUA_PLAIN）：第 i 爻，或者 i 为 null 时的卦辞；没有就是空串
    const plainOf = (name, i) => {
        const p = typeof GUA_PLAIN !== 'undefined' && GUA_PLAIN[name];
        return p ? (i == null ? p.ci : p.yao[i]) || '' : '';
    };
    const yong = name => (typeof YONG_PLAIN !== 'undefined' && YONG_PLAIN[name]) || '';

    if (n === 0)
        return { rule: '静卦无变', text: `没有动爻，取本卦《${benName}》卦辞：「${gua[1]}」`, at: null,
            lines: [{ from: `本卦《${benName}》卦辞`, text: gua[1], plain: plainOf(benName) }], how: '没有动爻，读本卦的卦辞。' };
    if (n === 1)
        return { rule: '一爻动', text: `一爻动，取本卦《${benName}》这一爻：${yaoArr[changing[0]] || ''}`, at: changing[0],
            lines: [{ ...yaoLine('本卦', benName, yaoArr[changing[0]]), plain: plainOf(benName, changing[0]) }], how: `只有${nameOf(yaoArr[changing[0]])}一根动爻，读它的爻辞。` };
    if (n === 2)
        return { rule: '二爻动', text: `两爻动，取本卦《${benName}》上面那根动爻：${yaoArr[changing[1]] || ''}`, at: changing[1],
            lines: [{ ...yaoLine('本卦', benName, yaoArr[changing[1]]), plain: plainOf(benName, changing[1]) }],
            how: `有${nameOf(yaoArr[changing[0]])}、${nameOf(yaoArr[changing[1]])}两根动爻，读靠上的${nameOf(yaoArr[changing[1]])}。` };
    if (n === 3)
        return { rule: '三爻动', text: `三爻动，本卦《${benName}》和之卦《${zhi[0]}》的卦辞合看：本卦「${gua[1]}」，之卦「${zhi[1]}」`, at: null,
            lines: [{ from: `本卦《${benName}》卦辞`, text: gua[1], plain: plainOf(benName) }, { from: `之卦《${zhi[0]}》卦辞`, text: zhi[1], plain: plainOf(zhi[0]) }],
            how: '有三根动爻，本卦和之卦的卦辞要合起来读，以本卦为主。' };
    if (n === 4) {
        const low = all.filter(i => !changing.includes(i))[0];
        const raw = zhi[3].split('|')[low] || '';
        return { rule: '四爻动', text: `四爻动，取之卦《${zhi[0]}》没动的两爻里下面那一根：${raw}`, at: low,
            lines: [{ ...yaoLine('之卦', zhi[0], raw), plain: plainOf(zhi[0], low) }], how: `有四根动爻，读之卦里没动的那两爻中靠下的${nameOf(raw)}。` };
    }
    if (n === 5) {
        const only = all.filter(i => !changing.includes(i))[0];
        const raw = zhi[3].split('|')[only] || '';
        return { rule: '五爻动', text: `五爻动，取之卦《${zhi[0]}》唯一没动的那一爻：${raw}`, at: only,
            lines: [{ ...yaoLine('之卦', zhi[0], raw), plain: plainOf(zhi[0], only) }], how: `有五根动爻，读之卦里唯一没动的${nameOf(raw)}。` };
    }
    if (benName === '乾为天')
        return { rule: '六爻全变·用九', text: '乾卦六爻全动，取「用九」：「见群龙无首，吉。」', at: null,
            lines: [{ from: '本卦《乾为天》用九', text: '见群龙无首，吉。', plain: yong('乾为天') }], how: '六根全是动爻。乾卦在六条爻辞之外还多一句「用九」，这时就读它。' };
    if (benName === '坤为地')
        return { rule: '六爻全变·用六', text: '坤卦六爻全动，取「用六」：「利永贞。」', at: null,
            lines: [{ from: '本卦《坤为地》用六', text: '利永贞。', plain: yong('坤为地') }], how: '六根全是动爻。坤卦在六条爻辞之外还多一句「用六」，这时就读它。' };
    return { rule: '六爻全变', text: `六爻全动，取之卦《${zhi[0]}》卦辞：「${zhi[1]}」`, at: null,
        lines: [{ from: `之卦《${zhi[0]}》卦辞`, text: zhi[1], plain: plainOf(zhi[0]) }], how: '六根全是动爻，读之卦的卦辞。' };
}

// ---------- 术语：虚线下划的词，悬停、聚焦或点一下浮出解释（浮窗逻辑在 theme.js 的 initTermTips） ----------
// 浮窗标题就是页面上的词本身；解释在渲染时按这一卦算好，放进 data-tip。
// 写法：先一句定义，再补一条页面上没印出来的、关于这一卦的事实；取法只在主断下面那行小字里讲
function term(text, tip) {
    return `<span class="term" tabindex="0" data-tip="${escHtml(tip)}">${text}</span>`;
}
const TRIGRAM_IMAGE = { 乾: '天', 坤: '地', 震: '雷', 巽: '风', 坎: '水', 离: '火', 艮: '山', 兑: '泽' };
const TIPS = {
    seal: '这是给每一卦大致定下的吉、平、凶，算是这一卦的底色。它不看动爻，也不一定和卦辞的意思一致，回答你这一问，还是以主断为准。',
    sealDaily: '这是给每一卦大致定下的吉、平、凶，不一定和卦辞的意思一致，只作参考。',
    sealArchive: n => `这是给每一卦大致定下的吉、平、凶，不看动爻。这里统计的是你起过的 ${n} 卦各自的本卦，也就是变化之前的那一卦。`,
    zhuduan: '主断是针对你这一问要读的那一句（三根动爻时是两句），从卦辞或爻辞里挑出来。卦辞说的是整卦，爻辞说的是其中某一爻。具体挑哪一句，要看有几根动爻，用的是朱熹定下的读法。',
    dongyao: moving => moving
        ? '动爻是会变的爻，阳爻会变成阴爻，阴爻会变成阳爻。卦画旁边标着「动 →」的就是动爻，箭头后面写的是它变成的样子。'
        : '动爻是会变的爻，阳爻会变成阴爻，阴爻会变成阳爻。只有起到老阳、老阴才会有动爻，这一卦六根都是少阳、少阴，所以没有。',
    zhigua: '把动爻都翻过来，就得到之卦，用来看事情接下来往哪里走。原来那一卦叫本卦，看的是眼下。点卦画下面的「之卦」，就能看到它的卦画。',
    xiang: '这是《象传》解说这一卦的话，先讲上下卦合成的景象，再讲人该怎么做。首页「今日一卦」旁边的那句话就出自这里。',
    fangtu: '方图是把先天六十四卦排成八行八列。同一行的卦下卦相同，同一列的卦上卦相同，坤在左上角，乾在右下角。',
    liuyao(hexLines, at, fromZhi) {
        const POS = ['最下面一', '从下数第二', '从下数第三', '从下数第四', '从下数第五', '最上面一'];
        const eg = at == null
            ? `比如最上面那一根叫${yaoLabel(hexLines[5], 5)}。`
            : fromZhi
                ? `这一卦主断读的是之卦的${yaoLabel(hexLines[at], at)}，也就是${POS[at]}根；下面列的是本卦的爻辞，同一个位置上的话不一样。`
                : `主断读的是${yaoLabel(hexLines[at], at)}，也就是${POS[at]}根${hexLines[at] % 2 ? '阳' : '阴'}爻。`;
        return '一卦有六根线，每一根叫一爻。从下往上依次叫初、二、三、四、五、上，阳爻叫「九」，阴爻叫「六」。' + eg;
    },
    yaotype(line, method) {
        const base = {
            9: '老阳是会变的阳爻，算作动爻，到了之卦里会变成阴爻。不会变的阳爻叫少阳。',
            6: '老阴是会变的阴爻，算作动爻，到了之卦里会变成阳爻。不会变的阴爻叫少阴。',
            7: '少阳是不会变的阳爻。会变的阳爻叫老阳，算作动爻。',
            8: '少阴是不会变的阴爻。会变的阴爻叫老阴，算作动爻。'
        }[line];
        if (method === 'coin') return base + `掷钱时如果${COIN_FACE_CN[LINE_TO_BEI[line]]}，得到的就是${YAO_TYPE_CN[line]}。`;
        if (METHODS[method]) return base + methodName(method) + (line === 6 || line === 9 ? '只会算出一根动爻。' : '只会算出一根动爻，其余五根都是少阳或少阴。');
        return base;
    },
    guaxu(gua) {
        const n = guaNumber(gua), short = guaShortName(gua);
        const where = n === 1 ? '乾卦是第一卦，后面是坤卦。'
            : n === 64 ? '未济卦是最后一卦，前面是既济卦。'
            : n ? `${short}卦前面是${KING_WEN_NAMES[n - 2]}卦，后面是${KING_WEN_NAMES[n]}卦。` : '';
        return '卦序是通行本《周易》里六十四卦的排列次序，从乾卦开始，到未济卦结束。' + where;
    },
    shangxia(gua, v) {
        const U = TRIGRAM_BY_VALUE[v & 7], L = TRIGRAM_BY_VALUE[v >> 3];
        const why = U === L
            ? `这一卦上下都是${U}，${U}是${TRIGRAM_IMAGE[U]}，所以叫${gua[0]}。`
            : `这一卦上${U}下${L}，${U}是${TRIGRAM_IMAGE[U]}，${L}是${TRIGRAM_IMAGE[L]}，所以叫${gua[0]}。`;
        return '一卦六爻，下面三爻组成下卦，上面三爻组成上卦。' + why;
    },
    yuantu: gua => `圆图就是首页那一圈，六十四卦按先天次序围成一个环，乾在最上面，坤在最下面。小图里那根长针，指的就是${guaShortName(gua)}卦的位置。`
};
// 卦序、上下卦、圆图三格：结果页和今日一卦共用
function titleBlockCells(gua, v, before = '') {
    return `<div><dt>${term('卦序', TIPS.guaxu(gua))}</dt><dd>${guaOrdinal(gua)}</dd></div>
        <div><dt>${term('上下卦', TIPS.shangxia(gua, v))}</dt><dd>上${TRIGRAM_BY_VALUE[v & 7]} 下${TRIGRAM_BY_VALUE[v >> 3]}</dd></div>
        ${before}<div><dt>${term('圆图', TIPS.yuantu(gua))}</dt><dd>${buildMiniRing(v)}</dd></div>`;
}
// 主断用展示字放大，展示字的标点像西文的「, .」：标点换回正文字体
function softPunct(s) {
    return String(s).replace(/[，。；：、？！「」『』]/g, m => `<span class="pu${'「『'.includes(m) ? ' open' : ''}">${m}</span>`);
}

function buildCallouts(hexLines, changingYaos) {
    // 卦画右侧的标注：每一爻一条引线，动爻用朱色并注明变后的爻
    const rows = [];
    for (let i = 5; i >= 0; i--) {
        const line = hexLines[i];
        const moving = changingYaos.includes(i);
        const after = moving ? yaoLabel(line === 9 ? 8 : 7, i) : '';
        rows.push(`<li class="co${moving ? ' moving' : ''}" style="--r:${5 - i}" data-i="${i}">
<span class="co-name" data-ben="${yaoLabel(line, i)}" data-zhi="${moving ? after : yaoLabel(line, i)}">${yaoLabel(line, i)}</span>${moving ? `<span class="co-note" data-ben="动 → ${after}" data-zhi="由${yaoLabel(line, i)}变">动 → ${after}</span>` : ''}</li>`);
    }
    return `<ol class="callouts" aria-hidden="true">${rows.join('')}</ol>`;
}

// 这一卦在先天圆图上的位置：一圈六十四道刻度，它那一道加长加粗
function buildMiniRing(v) {
    const c = 20, pt = (r, deg) => { const a = deg * Math.PI / 180; return `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`; };
    let ticks = '';
    for (let k = 0; k < 64; k++) { const d = circleAngle(k); if (k !== v) ticks += `M${pt(15, d)}L${pt(18, d)}`; }
    const d = circleAngle(v);
    return `<svg class="mini-ring" viewBox="0 0 40 40" aria-hidden="true"><path d="${ticks}" class="mr-tick"/><path d="M${pt(6, d)}L${pt(19.5, d)}" class="mr-on"/></svg>`;
}

function renderResult(gua, hexLines, change, question, fullBin, sourceCard, savedAi, readingContext = {}) {
    const resultArea = document.getElementById('resultArea');
    const verdict = getVerdict(gua);
    const verdictText = { ji: '吉', xiong: '凶', ping: '平' };
    const mainReading = getMainReading(gua, change);
    const zhi = change.hasChange ? change.changeGua : null;
    const v = shaoValue(fullBin || guaBinary(gua));

    // 印章是每一卦固定的粗略标注，既不看动爻，也不等于卦辞（比如困卦标凶，卦辞却是亨）。
    // 所以它不再当结论盖在卦名旁：缩成一枚淡色小印，注明说的是本卦的底色，结论交给主断
    const sealMoving = change.changingYaos.length > 0;
    const sealHtml = `<span class="seal-wrap aside"><span class="verdict-seal ${verdict}" aria-label="本卦${verdictText[verdict]}"><span>${verdictText[verdict]}</span></span><span class="seal-note">${term('本卦吉凶', TIPS.seal)}${sealMoving ? '<br>不含动爻' : ''}</span></span>`;
    // 主断取的就是本卦卦辞时（静卦、三爻动），卦名下面那行卦辞不再重复显示
    const titleInMain = mainReading.lines.some(l => l.text === gua[1] && l.from.startsWith('本卦'));
    // 主断是这一卦对所问的回答：辞放大，出处和取法缩成两行小字。
    // 辞的长短差很多（「亢龙有悔。」到坤卦卦辞三十多字），长的字号跟着收
    const mainLen = mainReading.lines.reduce((n, l) => n + l.text.length, 0);
    const quoteCls = mainLen > 28 ? ' xl' : mainLen > 14 ? ' long' : '';
    const mainHtml = `<section class="main-reading" style="--d:3" aria-label="主断">
        <h3 class="mr-label">${term('主断', TIPS.zhuduan)}</h3>
        ${mainReading.lines.map(l => `<div class="mr-line"><q class="mr-quote${quoteCls}">${softPunct(l.text)}</q><cite class="mr-from">${l.from}</cite>${l.plain ? `<p class="mr-plain">${l.plain}</p>` : ''}</div>`).join('')}
        <p class="mr-how">${mainReading.how.replace('动爻', term('动爻', TIPS.dongyao(sealMoving)))}</p>
      </section>`;

    const yaoArr = gua[3].split('|');
    const yaoPlain = (typeof GUA_PLAIN !== 'undefined' && GUA_PLAIN[gua[0]]) ? GUA_PLAIN[gua[0]].yao : [];
    // 老阳少阴这类词只在一行加虚线：有动爻放在最上面那根动爻，没有就放第一行，免得六行全是下划线
    const typeTipAt = sealMoving ? Math.max(...change.changingYaos) : 5;
    const yaoHtml = hexLines.map((line, i) => [line, i]).reverse().map(([line, i]) => {
        const isYang = (line === 9 || line === 7);
        const raw = yaoArr[i] || '';
        const cut = raw.indexOf('：');
        const yaoName = cut > 0 ? raw.slice(0, cut) : yaoLabel(line, i);
        const yaoText = cut > 0 ? raw.slice(cut + 1) : raw;
        const isChanging = change.changingYaos.includes(i);
        // 每一行自己带着那一根爻（阴阳、动爻朱色），不再另画一个卦：左栏已经有大卦画了
        // 点一行展开这一爻的白话，再点收起（键盘回车、空格也行）；没有白话的不能点
        const plain = yaoPlain[i] || '';
        const open = plain ? ` tabindex="0" role="button" aria-expanded="false" aria-controls="yaoPlain${i}"` : '';
        return `<li class="yao-item${isChanging ? ' changing' : ''}${plain ? ' has-plain' : ''}" data-i="${i}"${open}>
<span class="yao-mark ${isYang ? 'yang' : 'yin'}" aria-hidden="true"></span><span class="yao-name">${yaoName}</span><span class="yao-text">${yaoText}</span><span class="yao-type">${i === typeTipAt ? term(YAO_TYPE_CN[line], TIPS.yaotype(line, readingContext.method)) : YAO_TYPE_CN[line]}${isChanging ? '，动' : ''}</span>${plain ? `<span class="yao-plain" id="yaoPlain${i}"><span>${plain}</span></span>` : ''}</li>`;
    }).join('');

    // 卦象、之卦两段都先贴《象传》原文，再接白话：白话就是照着这句象辞写的
    const xiangSrc = (name, label) => (typeof DA_XIANG !== 'undefined' && DA_XIANG[name])
        ? `<p class="xiang-src"><span class="xs-label">${label}</span>${DA_XIANG[name]}。</p>` : '';
    const analysisHtml = gua[4].split('。').filter(s => s.trim()).map(s =>
        `<span class="analysis-item">${s.trim()}。</span>`
    ).join('');

    const methodText = methodName(readingContext.method) || '未记录';

    let changeHtml = '';
    if (zhi) {
        changeHtml = `<section class="block change-section"><h3>${term('之卦', TIPS.zhigua)} <span class="rule-tag">${zhi[0]}</span></h3>
<div class="change-details"><p class="zhi-lead">接下来，事情会往这一卦的方向走：</p>${xiangSrc(zhi[0], '象曰')}<p>${zhi[4]}</p></div></section>`;
    }

    const aiSettings = loadSettings().ai || {};
    // AI 解读一栏总在：没开站内解读的，这里给「复制提示词」，拿去自己常用的 AI 里解
    const aiHtml = `<section class="block card-ai" id="aiReadingCard"><h3>AI 解读</h3><div class="ai-reading-body" id="aiReadingBody"></div></section>`;

    // 记录本卦所问和起卦时间，供分享卡读取（不读实时输入框和当前时间：回看历史时分享卡要对得上那一卦）
    resultArea.dataset.question = question || '';
    resultArea.dataset.createdAt = readingContext.createdAt || '';
    resultArea.dataset.date = readingContext.date || '';
    // 六爻的数（6 老阴 / 7 少阳 / 8 少阴 / 9 老阳，自初爻起）：分享图照这个画卦，不从页面元素的样子去反推
    resultArea.dataset.lines = hexLines.join('');
    resultArea.dataset.method = readingContext.method || '';
    resultArea.dataset.gua = gua[0];
    // 别人分享来的一卦：顶上注明，回首页的按钮改叫「我也问一卦」；看自己的卦时去掉地址栏里分享的参数
    const shared = !!readingContext.shared;
    if (!shared && typeof clearShareParams === 'function') clearShareParams();
    if (typeof setPageView === 'function') setPageView('result');

    resultArea.innerHTML = `
<div class="result entering">
  <div class="result-bar" style="--d:0"><button class="back-link" id="backHomeBtn"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>${shared ? '我也问一卦' : '回到起卦'}</button>${shared ? '<span class="shared-note">朋友分享的一卦</span>' : ''}</div>
  <div class="result-question" style="--d:1"><span class="rq-label">所问</span><h1>${question ? escHtml(question) : '心中所念'}</h1></div>
  <div class="reading-layout">
    <aside class="result-header">
      <figure class="glyph-figure">
        <div class="result-glyph${sourceCard ? ' awaiting' : ''}" id="resultGlyph" data-v="${v}">${buildHexBars(hexLines, change.changingYaos, 'hx-big')}</div>
        ${buildCallouts(hexLines, change.changingYaos)}
      </figure>
      ${zhi ? `<div class="ben-zhi" role="group" aria-label="切换本卦与之卦" style="--d:4">
        <button type="button" class="bz-opt" id="benBtn" aria-pressed="true">本卦<b>${gua[0]}</b></button>
        <button type="button" class="bz-opt" id="zhiBtn" aria-pressed="false">之卦<b>${zhi[0]}</b></button>
        <span class="bz-mark" aria-hidden="true"></span>
      </div>` : '<p class="zhi-none" style="--d:4">这一卦不变，没有之卦</p>'}
      <dl class="title-block tb-result" style="--d:5">
        ${titleBlockCells(gua, v, `<div><dt>起卦</dt><dd>${methodText}</dd></div>`)}
        <div class="tb-wide"><dt>时间</dt><dd>${readingContext.date ? escHtml(String(readingContext.date)) : '—'}</dd></div>
      </dl>
    </aside>
    <article class="reading" id="readingColumn">
      <header class="reading-head" style="--d:2">
        <div class="reading-name-row"><h2 class="hex-name">${gua[0]}</h2>${sealHtml}</div>
        <p class="hex-title"${titleInMain ? ' hidden' : ''}>${gua[1]}</p>
      </header>
      ${mainHtml}
      <div class="reading-sheet">
      <section class="block" style="--d:4"><h3>卦象</h3>${xiangSrc(gua[0], term('象曰', TIPS.xiang))}<p class="analysis-list">${analysisHtml}</p></section>
      ${changeHtml.replace('<section class="block change-section">', '<section class="block change-section" style="--d:5">')}
      ${aiHtml.replace('<section class="block card-ai"', '<section style="--d:5" class="block card-ai"')}
      <section class="block yao-details" style="--d:6"><h3>${term('六爻', TIPS.liuyao(hexLines, mainReading.at, /^[四五]爻动$/.test(mainReading.rule)))} <span class="rule-tag">从上往下${yaoPlain.length ? '，点一爻看白话' : ''}</span></h3>
        <ol class="yao-list">${yaoHtml}</ol>
      </section>
      </div>
      <div class="result-actions" style="--d:7">
        <button class="btn btn-primary" id="shareBtn">生成起卦签</button>
        <button class="btn" id="linkBtn" aria-expanded="false" aria-controls="linkPanel">分享链接</button>
        ${shared ? '' : '<button class="btn" id="newDivineBtn">再问一卦</button>'}
        <button class="btn btn-quiet" id="viewHistoryBtn">翻阅牌册</button>
      </div>
      <div class="link-panel" id="linkPanel" hidden>
        <div class="link-row">
          <span class="link-label">链接</span>
          <input class="link-url" id="linkUrl" readonly aria-label="这一卦的链接">
          <button type="button" class="link-act" id="linkCopy">复制</button>
          ${typeof navigator !== 'undefined' && navigator.share ? '<button type="button" class="link-act" id="linkSend">发送</button>' : ''}
        </div>
        <p class="link-foot">${question ? '<label class="link-q"><input type="checkbox" id="linkWithQ"><span class="link-box" aria-hidden="true"></span>附上所问</label>' : ''}<span>打开链接的人会看到同一卦${question ? '，所问默认不放进去' : ''}。</span></p>
      </div>
      <p class="result-warning" style="--d:7">卦只作参考，主意还得自己拿。</p>
    </article>
  </div>
</div>`;
    const backBtn = resultArea.querySelector('#backHomeBtn');
    // 朋友分享的一卦：左上「我也问一卦」是唯一的入口（底部不再重复一个），回首页时输入框是空的
    if (backBtn) backBtn.addEventListener('click', () => { if (typeof returnToInquiry === 'function') returnToInquiry(shared ? { clear: true } : undefined); });


    const shareBtn = resultArea.querySelector('#shareBtn');
    shareBtn.addEventListener('click', shareAsImage);
    // 出图要用的 html2canvas（约 200 KB）不给每个访客预取：指到、按到分享按钮时才开始取
    const warm = () => { if (typeof loadHtml2canvas === 'function') loadHtml2canvas(); };
    shareBtn.addEventListener('pointerenter', warm, { once: true });
    shareBtn.addEventListener('focus', warm, { once: true });
    shareBtn.addEventListener('touchstart', warm, { once: true, passive: true });
    if (typeof initShareLinkPanel === 'function') initShareLinkPanel(resultArea);
    const newBtn = resultArea.querySelector('#newDivineBtn');
    if (newBtn) newBtn.addEventListener('click', () => {
        if (typeof returnToInquiry === 'function') returnToInquiry({ clear: true });
    });
    const viewBtn = resultArea.querySelector('#viewHistoryBtn');
    if (viewBtn) viewBtn.addEventListener('click', toggleHistory);

    // 本卦 ⇄ 之卦：动爻在原处阴阳互变，标注同步改写
    const benBtn = resultArea.querySelector('#benBtn');
    const zhiBtn = resultArea.querySelector('#zhiBtn');
    const showZhi = (on) => {
        const glyph = resultArea.querySelector('#resultGlyph');
        const header = resultArea.querySelector('.result-header');
        const was = header && header.classList && header.classList.contains('as-zhi');
        if (!header || was === on) return;
        header.classList.toggle('as-zhi', on);
        if (glyph && glyph.querySelectorAll) glyph.querySelectorAll('.bar.chg').forEach(b => {
            b.classList.toggle('yang');
            b.classList.toggle('yin');
        });
        if (header.querySelectorAll) header.querySelectorAll('.co-name, .co-note').forEach(n => {
            n.textContent = on ? n.dataset.zhi : n.dataset.ben;
        });
        benBtn.setAttribute('aria-pressed', String(!on));
        zhiBtn.setAttribute('aria-pressed', String(on));
    };
    if (benBtn && zhiBtn && zhi) {
        benBtn.addEventListener('click', () => showZhi(false));
        zhiBtn.addEventListener('click', () => showZhi(true));
    }

    // 六爻：点一行展开这一爻的白话，再点收起。行里的「老阳」这类术语点了只出解释，不展开
    const yaoList = resultArea.querySelector('.yao-list');
    if (yaoList && yaoList.addEventListener) {
        const toggleYao = li => {
            const on = !li.classList.contains('open');
            li.classList.toggle('open', on);
            li.setAttribute('aria-expanded', String(on));
        };
        yaoList.addEventListener('click', e => {
            const li = e.target.closest('.yao-item.has-plain');
            if (li && !e.target.closest('.term')) toggleYao(li);
        });
        yaoList.addEventListener('keydown', e => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('has-plain')) { e.preventDefault(); toggleYao(e.target); }
        });
    }

    const aiBody = resultArea.querySelector('#aiReadingBody');
    if (aiBody) {
        if (savedAi) {
            aiBody.innerHTML = '<div class="ai-reading-text"></div>';
            aiBody.querySelector('.ai-reading-text').textContent = savedAi;
        } else if (!aiSettings.enabled) {
            offerAiCopy(gua, change, question, aiBody, readingContext);
        } else if (typeof aiReady === 'function' && !aiReady()) {
            // 开了 AI 解卦但还没配好：不放解读按钮，直接说缺什么、带去设置
            aiNotReady(gua, change, question, aiBody, readingContext);
        } else if (aiSettings.autoRun || (readingContext.historyId && _aiByRecord.has(readingContext.historyId))) {
            // 自动解读；或者这条记录这次已经请过（正在请 / 请到了没存进牌册），接着用那一次的
            runAiReading(gua, change, question, aiBody, readingContext);
        } else {
            offerAiReading(gua, change, question, aiBody, readingContext);
        }
    }

    if (window.scrollTo) window.scrollTo({ top: 0 });
    if (typeof landQuestion === 'function') landQuestion(resultArea.querySelector('.result-question'));
    const glyphEl = resultArea.querySelector('#resultGlyph');
    const header = resultArea.querySelector('.result-header');
    const land = () => {
        if (glyphEl) glyphEl.classList.remove('awaiting');
        if (header) header.classList.add('landed');
        if (readingContext.fresh && typeof stampHistoryCount === 'function') {
            readingContext.fresh = false;
            setTimeout(() => stampHistoryCount(readHistorySafe().length), 380);
        }
    };
    // 卦的飞行被打断（比如落定前就点了返回）时 land 不会再来，牌册挂签的数也要更新
    if (readingContext.fresh) setTimeout(() => {
        if (!readingContext.fresh) return;
        readingContext.fresh = false;
        updateHistoryCount(readHistorySafe().length);
    }, 2600);
    if (sourceCard && typeof Cosmos !== 'undefined') {
        // 圆图上（或牌册缩略图里）的那一卦飞到这里，落定后换成页面上的卦画
        requestAnimationFrame(() => Cosmos.toResult(sourceCard.cosmosValue, glyphEl, {
            fromRect: sourceCard.fromRect || null,
            done: land
        }));
    } else {
        if (typeof Cosmos !== 'undefined') Cosmos.hide();
        setTimeout(land, 250);
    }
    const page = resultArea.querySelector('.result');
    setTimeout(() => { if (page && page.classList) page.classList.remove('entering'); }, 2200);
}

// 翻到报数那一面的时刻；翻面动画（.26s 转走 + .32s 转正）走到一半以前，两格还看不见
let _numbersFlippedAt = 0;
const NUMBER_FLIP_MS = 400;
// 报数的两格是不是正翻在外面
function numbersShown() {
    const flip = document.getElementById('qFlip');
    return !!(flip && flip.classList.contains('flipped'));
}
// 问题框翻到背面（报数两格）或翻回来。quiet：只翻，不挪焦点（换起法、起卦开始时用）
function flipToNumbers(on, opts) {
    const flip = document.getElementById('qFlip');
    if (!flip || flip.classList.contains('flipped') === on) return;
    flip.classList.toggle('flipped', on);
    if (on) _numbersFlippedAt = Date.now();
    const front = document.getElementById('qFront'), back = document.getElementById('qBack');
    if (front) front.inert = on;
    if (back) { back.inert = !on; back.setAttribute('aria-hidden', String(!on)); }
    if (opts && opts.quiet) return;
    const target = document.getElementById(on ? 'numA' : 'question');
    // 等翻过一半、那一面露出来了再挪焦点（藏着的那一面拿不到焦点）
    if (target && target.focus) setTimeout(() => target.focus({ preventScroll: true }), 320);
}

// 报数起卦的两个数：都要是 1–9999 的整数，否则返回 null
// 报数的一格填得对不对：1–9999 的整数。readNumberPair 和「光标落到哪一格」共用这一条
function isValidNumber(v) {
    const s = String(v == null ? '' : v).trim();
    return /^\d{1,4}$/.test(s) && +s >= 1;
}
function readNumberPair() {
    const read = id => { const el = document.getElementById(id); return el ? String(el.value).trim() : ''; };
    const a = read('numA'), b = read('numB');
    if (!isValidNumber(a) || !isValidNumber(b)) return null;
    return [+a, +b];
}
// 推演开头那一行小字：说清这一卦是拿什么数推出来的
function ritualNote(method, now, nums) {
    if (method === 'bazi') return '生辰起卦不用掷钱，六爻由你的生辰和所问推出';
    if (method === 'natal') return '本命卦只看生辰，六爻由生辰推出';
    if (method === 'time') {
        const h = hourIndexOf(now);
        const day = h === 12 ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : now;
        const lu = solarToLunar(day.getFullYear(), day.getMonth() + 1, day.getDate());
        const when = lu ? `${ganZhiYear(lu.year)}年${lunarMonthName(lu.month, lu.isLeap)}${lunarDayName(lu.day)}` : '此刻';
        return `${when}${DI_ZHI[h % 12]}时，由年月日时推出六爻`;
    }
    if (method === 'number' && nums) return `上卦取 ${nums[0]}，下卦取 ${nums[1]}，再加上时辰定动爻`;
    return '';
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

    const base = birthNumbers(bazi);
    // 融入所问之事（确定性：同一问题恒定，不同问题分散；取质数模以打散分布）
    const sumUpper = base.upper + (qNum % 97);
    const sumLower = base.lower + (Math.floor(qNum / 97) % 89);
    // 动爻＝年月日时总数 mod 6（梅花传统，同下卦总数；问题项随下卦总数自然融入，
    // 观梅占原例：34 起兑为上、43 起离为下，动爻 43%6=1 取初爻——总数只计一次）
    return meihuaLines(sumUpper, sumLower, sumLower);
}
