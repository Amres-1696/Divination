// cards —— 卡面构建：曼陀罗牌背、六爻立牌 SVG、塔罗卡 DOM 节点


function buildMandalaSvg() {
    const petals = [];
    for (let i = 0; i < 8; i++) {
        petals.push(`<path transform="rotate(${i*45})" d="M 0 -40 Q 8 -22 0 -6 Q -8 -22 0 -40 Z" />`);
    }
    return `<svg class="card-back-mandala" viewBox="-50 -50 100 100" xmlns="http://www.w3.org/2000/svg">
<g fill="none" stroke="#c9a96e" stroke-width="0.6" opacity="0.9">
<circle r="42"/><circle r="30"/><circle r="18"/>
<g opacity="0.75">${petals.join('')}</g>
<polygon points="0,-16 14,8 -14,8" opacity="0.55"/>
<polygon points="0,16 -14,-8 14,-8" opacity="0.55"/>
<circle r="2.5" fill="#c9a96e"/>
</g></svg>`;
}

function buildYaoArtSvg(hexLines, changingYaos) {
    changingYaos = changingYaos || [];
    const w = 60, h = 80, lineH = 2.4, gap = 8;
    const rowH = lineH + gap;
    const startY = (h - (6*rowH - gap)) / 2;
    const cx = w/2, halfW = 22;
    const parts = [];
    for (let i = 0; i < 6; i++) {
        const drawIdx = 5 - i;
        const y = startY + drawIdx * rowH + lineH/2;
        const line = hexLines[i];
        const isYang = (line === 7 || line === 9);
        const isChanging = changingYaos.includes(i);
        const cls = 'yao-svg-line' + (isChanging ? ' changing' : '');
        const drawDelay = i * 120;
        const styleAttr = isChanging
            ? ` style="animation-delay:${drawDelay}ms,${drawDelay + 800}ms"`
            : ` style="animation-delay:${drawDelay}ms"`;
        if (isYang) {
            parts.push(`<line class="${cls}"${styleAttr} x1="${cx-halfW}" y1="${y}" x2="${cx+halfW}" y2="${y}" />`);
        } else {
            parts.push(`<line class="${cls}"${styleAttr} x1="${cx-halfW}" y1="${y}" x2="${cx-5}" y2="${y}" />`);
            parts.push(`<line class="${cls}"${styleAttr} x1="${cx+5}" y1="${y}" x2="${cx+halfW}" y2="${y}" />`);
        }
    }
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
}

function makeArcanaCard(gua, opts) {
    opts = opts || {};
    const large = !!opts.large;
    const rare = !!opts.rare;
    const hexLines = opts.hexLines || binToHexLines(TRIGRAM_TO_BINARY[gua[2][0]] + TRIGRAM_TO_BINARY[gua[2][1]]);
    const changingYaos = opts.changingYaos || [];
    const idx = guaIndex(gua);
    const roman = toRoman(idx);
    const upper = gua[2][0], lower = gua[2][1];

    const card = document.createElement('div');
    card.className = 'arcana-card' + (large ? ' large' : '') + (rare ? ' rare-gilded' : '');
    card.innerHTML = `
<div class="card-face back">
    <div class="card-back-art">${buildMandalaSvg()}</div>
    <div class="card-gold-band"></div>
</div>
<div class="card-face front">
    <div class="card-frame-deco"></div>
    <div class="card-roman">${roman}</div>
    <div class="card-trigram-watermark"><span>${upper}</span><span>${lower}</span></div>
    <div class="card-art">${buildYaoArtSvg(hexLines, changingYaos)}</div>
    <div class="card-name-strip">${gua[0]}</div>
    <div class="card-gold-band"></div>
</div>`;
    return card;
}
