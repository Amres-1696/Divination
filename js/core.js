// core —— 地基层：常量、起卦数学、节流/震动、Toast/Confirm、小工具
// 被几乎所有其它模块调用，最先加载（紧跟 data.js）


const HISTORY_MAX = 50;

// 爻位、爻类、爻题（如「九二」「上六」）
const YAO_POS_CN = ['初', '二', '三', '四', '五', '上'];
const YAO_TYPE_CN = { 6: '老阴', 7: '少阳', 8: '少阴', 9: '老阳' };
const LINE_TO_BEI = { 9: 3, 8: 2, 7: 1, 6: 0 }; // 背面朝上的铜钱数
const COIN_FACE_CN = ['三枚都是正面', '一枚背面朝上', '两枚背面朝上', '三枚都是背面']; // 按背面数取

function yaoLabel(line, i) {
    const num = (line === 7 || line === 9) ? '九' : '六';
    if (i === 0) return '初' + num;
    if (i === 5) return '上' + num;
    return num + YAO_POS_CN[i];
}

const COIN_TO_LINE = { 3: 9, 2: 8, 1: 7, 0: 6 }; // 铜钱法：3阳=老阳9, 2阳=少阴8, 1阳=少阳7, 0阳=老阴6

// ---------- 起卦方式 ----------
// 五种起法的名字、一句话做法（首页和设置列表里用）、注解（设置里选中时显示）、给 AI 的说明。
// coin 是随机掷钱；其余四种都按梅花易数取数，只出一根动爻，过程是「推演」不是「掷钱」
const METHOD_ORDER = ['coin', 'time', 'number', 'bazi', 'natal'];
const METHODS = {
    coin: {
        name: '铜钱起卦', short: '铜钱',
        lead: '三枚铜钱掷六次，从下往上定六爻',
        note: '三枚铜钱掷六次，从下往上定六爻。出自「火珠林」法，最常用，适合问眼下的一件事。',
        ai: '铜钱起卦（三枚铜钱掷六次）'
    },
    time: {
        name: '占时起卦', short: '占时',
        lead: '用此刻的农历年月日时取数，什么都不用填',
        brief: '取此刻的年月日时，不用填写',
        note: '取此刻的农历年月日时起卦，不用填写。出自梅花易数「观梅占」，同一个时辰里起的都是同一卦。',
        ai: '占时起卦（梅花易数：取起卦时刻的农历年月日时）'
    },
    number: {
        name: '报数起卦', short: '报数',
        lead: '心里想两个数，第一个定上卦，第二个定下卦',
        brief: '先写问题，点起卦后再报两个数',
        note: '心里想两个数，第一个定上卦，第二个定下卦，再加时辰定动爻。出自梅花易数，数要凭直觉报，别挑。',
        ai: '报数起卦（梅花易数：问卦人报两个数，加起卦时辰定动爻）'
    },
    bazi: {
        name: '生辰起卦', short: '生辰',
        lead: '用生辰加上所问的事取数',
        note: '用生辰按梅花易数取数，再混入所问的事。混入问题是本站的做法，同一件事问几次都是同一卦。',
        ai: '生辰起卦（公历生辰换算农历，按梅花易数取数，并混入问题文字）'
    },
    natal: {
        name: '本命卦', short: '本命',
        lead: '只用生辰取数，一生只有这一卦',
        note: '只用生辰取数，一生只有这一卦。民间叫「终身卦」，看一生大势，不占具体的事。',
        ai: '本命卦（只用生辰按梅花易数取数，看一生大势，不针对所问）'
    }
};
const methodName = m => (METHODS[m] && METHODS[m].name) || '';
const needsBirth = m => m === 'bazi' || m === 'natal';

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
    // 报错用 alert 立刻读出；普通、成功的提示由容器的 aria-live 排队读
    if (type === 'error') el.setAttribute('role', 'alert');
    container.appendChild(el);
    // 停留时间按字数算：短句 2.8 秒，长句每多一个字多留一点，最长 7 秒
    const stay = Math.min(7000, Math.max(2800, 1200 + String(msg).length * 110));
    setTimeout(() => {
        el.classList.add('toast-out');
        el.addEventListener('animationend', () => el.remove());
    }, stay);
}

// 确认框：yesLabel 写动作本身（「清空」「删除」），不写「确定」。
// 打开时焦点落在「取消」上，Tab 只在两个按钮之间转；关掉后焦点回到原来的按钮
function showConfirm(msg, yesLabel) {
    return new Promise(resolve => {
        const overlay = document.getElementById('confirmOverlay');
        const msgEl = document.getElementById('confirmMsg');
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');
        const opener = document.activeElement;
        msgEl.textContent = msg;
        yesBtn.textContent = yesLabel || '确定';
        overlay.classList.add('show');
        setTimeout(() => noBtn.focus({ preventScroll: true }), 30);
        function cleanup(result) {
            overlay.classList.remove('show');
            yesBtn.removeEventListener('click', onYes);
            noBtn.removeEventListener('click', onNo);
            overlay.removeEventListener('click', onOverlay);
            overlay.removeEventListener('keydown', onKey);
            if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
            resolve(result);
        }
        function onYes() { cleanup(true); }
        function onNo() { cleanup(false); }
        function onOverlay(e) { if (e.target === overlay) cleanup(false); }
        function onKey(e) {
            if (e.key !== 'Tab') return;
            e.preventDefault();
            (document.activeElement === noBtn ? yesBtn : noBtn).focus();
        }
        yesBtn.addEventListener('click', onYes);
        noBtn.addEventListener('click', onNo);
        overlay.addEventListener('click', onOverlay);
        overlay.addEventListener('keydown', onKey);
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
