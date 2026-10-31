// core —— 地基层：常量、起卦数学、节流/震动、Toast/Confirm、小工具
// 被几乎所有其它模块调用，最先加载（紧跟 data.js）


const HISTORY_MAX = 50;
const COIN_TO_LINE = { 3: 9, 2: 8, 1: 7, 0: 6 }; // 铜钱法：3阳=老阳9, 2阳=少阴8, 1阳=少阳7, 0阳=老阴6

function generateHexagram() {
    const lines = [];
    for (let i = 0; i < 6; i++) {
        const coins = (Math.random() > 0.5 ? 1 : 0) + (Math.random() > 0.5 ? 1 : 0) + (Math.random() > 0.5 ? 1 : 0);
        lines.push(COIN_TO_LINE[coins]);
    }
    return lines;
}
function calculateChangeGua(hexLines, origBin) {
    const changingYaoPositions = [];
    const changeBits = [];
    for (let i = 0; i < hexLines.length; i++) {
        const line = hexLines[i];
        if (line === 9) { changingYaoPositions.push(i); changeBits.push('0'); }
        else if (line === 6) { changingYaoPositions.push(i); changeBits.push('1'); }
        else changeBits.push(line === 7 ? '1' : '0');
    }
    if (!changingYaoPositions.length) return { hasChange: false, changeBinary: origBin, changingYaos: [], changeGua: lookupGua(origBin) };
    const fullBin = changeBits.slice().reverse().join('');
    return { hasChange: true, changeBinary: fullBin, changingYaos: changingYaoPositions, changeGua: lookupGua(fullBin) };
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function haptic(ms) { if (navigator.vibrate) navigator.vibrate(ms || 15); }

// ========== Toast / Confirm 组件 ==========
function showToast(msg, type) {
    type = type || 'info'; // 'info' | 'success' | 'error'
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '');
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('toast-out');
        el.addEventListener('animationend', () => el.remove());
    }, 2800);
}

function showConfirm(msg) {
    return new Promise(resolve => {
        const overlay = document.getElementById('confirmOverlay');
        const msgEl = document.getElementById('confirmMsg');
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');
        msgEl.textContent = msg;
        overlay.classList.add('show');
        function cleanup(result) {
            overlay.classList.remove('show');
            yesBtn.removeEventListener('click', onYes);
            noBtn.removeEventListener('click', onNo);
            overlay.removeEventListener('click', onOverlay);
            resolve(result);
        }
        function onYes() { cleanup(true); }
        function onNo() { cleanup(false); }
        function onOverlay(e) { if (e.target === overlay) cleanup(false); }
        yesBtn.addEventListener('click', onYes);
        noBtn.addEventListener('click', onNo);
        overlay.addEventListener('click', onOverlay);
    });
}

// ========== 工具 ==========
function simpleHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

function escHtml(s) {
    // 旧记录或手改过的存储里字段可能缺失，按空串处理，不让整张列表渲染中断
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// 通行本（文王）卦序，用于显示「第几卦」。GUA 数组本身按伏羲二进制排列，不能直接当卦序用。
const KING_WEN_ORDER = '乾坤屯蒙需讼师比小畜履泰否同人大有谦豫随蛊临观噬嗑贲剥复无妄大畜颐大过坎离咸恒遁大壮晋明夷家人睽蹇解损益夬姤萃升困井革鼎震艮渐归妹丰旅巽兑涣节中孚小过既济未济';
const KING_WEN_NAMES = KING_WEN_ORDER.match(/小畜|同人|大有|噬嗑|无妄|大畜|大过|大壮|明夷|家人|归妹|中孚|小过|既济|未济|./g);
function guaShortName(gua) {
    const name = Array.isArray(gua) ? gua[0] : String(gua || '');
    return name.includes('为') ? name[0] : name.slice(2);
}
function guaNumber(gua) {
    const i = KING_WEN_NAMES.indexOf(guaShortName(gua));
    return i >= 0 ? i + 1 : 0;
}
function toChineseNum(n) {
    const d = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    if (n <= 0) return '';
    if (n < 10) return d[n];
    const t = Math.floor(n / 10), o = n % 10;
    return (t === 1 ? '' : d[t]) + '十' + d[o];
}
function guaOrdinal(gua) {
    const n = guaNumber(gua);
    return n ? `第${toChineseNum(n)}卦` : '';
}
function getVerdict(gua) {
    return VERDICT_MAP[gua[0]] || 'ping';
}
function binToHexLines(bin) {
    const hex = [];
    for (let i = 0; i < 6; i++) hex.push(bin[5-i] === '1' ? 7 : 8);
    return hex;
}
