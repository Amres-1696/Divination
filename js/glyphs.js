// glyphs —— 卦画：SVG 静态卦画、可动画的 DOM 卦画、铜钱

// 邵雍先天序数：初爻为最高位，上爻为最低位。乾=63，坤=0。
// fullBin 是自上而下的字符串（上爻在前），这里倒过来读。
function shaoValue(fullBin) {
    return parseInt(String(fullBin).split('').reverse().join(''), 2);
}
function shaoBit(v, lineIndex) {
    return (v >> (5 - lineIndex)) & 1;
}
function linesFromShao(v) {
    return [0, 1, 2, 3, 4, 5].map(i => shaoBit(v, i) ? 7 : 8);
}
function guaBinary(gua) {
    return TRIGRAM_TO_BINARY[gua[2][0]] + TRIGRAM_TO_BINARY[gua[2][1]];
}
const TRIGRAM_BY_VALUE = ['坤', '艮', '坎', '巽', '震', '离', '兑', '乾'];

// 静态卦画（牌册、每日一卦、变卦缩略）。颜色取 currentColor，动爻取 --zhu。
function buildYaoArtSvg(hexLines, changingYaos) {
    changingYaos = changingYaos || [];
    const size = 100, bar = 10, gap = 8;
    const top = (size - (6 * bar + 5 * gap)) / 2;
    const mid = size / 2, split = 12;
    const parts = [];
    for (let i = 0; i < 6; i++) {
        const y = top + (5 - i) * (bar + gap) + bar / 2;
        const isYang = hexLines[i] === 7 || hexLines[i] === 9;
        const cls = 'yao-svg-line' + (changingYaos.includes(i) ? ' changing' : '');
        const d = isYang ? `M0 ${y}H${size}` : `M0 ${y}H${mid - split / 2}M${mid + split / 2} ${y}H${size}`;
        parts.push(`<path class="${cls}" stroke-width="${bar}" d="${d}"/>`);
    }
    return `<svg class="yao-art" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${parts.join('')}</svg>`;
}

// 可动画的卦画：六根爻条，缺口宽度由 CSS 变量控制，阴阳互变时缺口会开合。
// DOM 顺序自上而下（上爻在前），data-i 记录爻位（0=初爻）。
function buildHexBars(hexLines, changingYaos, extraClass) {
    changingYaos = changingYaos || [];
    const bars = [];
    for (let i = 5; i >= 0; i--) {
        const line = hexLines ? hexLines[i] : null;
        let cls = 'bar';
        if (line != null) cls += (line === 7 || line === 9) ? ' yang' : ' yin';
        else cls += ' empty';
        if (changingYaos.includes(i)) cls += ' chg';
        bars.push(`<i class="${cls}" data-i="${i}"></i>`);
    }
    return `<div class="hx${extraClass ? ' ' + extraClass : ''}" aria-hidden="true">${bars.join('')}</div>`;
}

// 铜钱：字面「天衍通宝」（上下右左读），背面素面。
function buildCoin() {
    const rim = '<circle cx="50" cy="50" r="47"/><circle cx="50" cy="50" r="40" stroke-width="1"/><rect x="40" y="40" width="20" height="20"/>';
    const zi = `<svg viewBox="0 0 100 100">${rim}<g class="coin-chars"><text x="50" y="31">天</text><text x="50" y="81">衍</text><text x="76" y="56">通</text><text x="24" y="56">宝</text></g></svg>`;
    const bei = `<svg viewBox="0 0 100 100">${rim}<path d="M50 14v12M50 74v12" stroke-width="1.4"/></svg>`;
    return `<div class="coin"><div class="coin-inner"><div class="coin-face zi">${zi}</div><div class="coin-face bei">${bei}</div></div></div>`;
}
