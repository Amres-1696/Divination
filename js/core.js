// core —— 地基层：常量、起卦数学、节流/震动、Toast/Confirm、小工具
// 被几乎所有其它模块调用，最先加载（紧跟 data.js）


const DECK_POOL_SIZE_DESKTOP = 13;
const DECK_POOL_SIZE_MOBILE = 9;
const DECK_POOL_SIZE = (window.innerWidth <= 768) ? DECK_POOL_SIZE_MOBILE : DECK_POOL_SIZE_DESKTOP;
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
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function toRoman(n) {
    const ones = ['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
    const tens = ['','Ⅹ','ⅩⅩ','ⅩⅩⅩ','ⅩⅬ','Ⅼ','ⅬⅩ','ⅬⅩⅩ','ⅬⅩⅩⅩ','ⅩⅭ'];
    return tens[Math.floor(n/10)] + ones[n%10];
}
function guaIndex(gua) {
    const i = GUA.indexOf(gua);
    return i >= 0 ? i + 1 : 1;
}
function isRareGua(bin) {
    return bin === '111111' || bin === '000000';
}
function getVerdict(gua) {

    return VERDICT_MAP[gua[0]] || 'ping';
}
function binToHexLines(bin) {
    const hex = [];
    for (let i = 0; i < 6; i++) hex.push(bin[5-i] === '1' ? 7 : 8);
    return hex;
}
