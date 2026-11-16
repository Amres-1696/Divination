// track —— 访问统计：打开页面记一次访问，起完一卦记一次起卦，都发到 CloudBase 云函数存库
// 尽力而为：被拦截、断网、存储不可用都静默跳过，绝不影响起卦本身。
// 不发所问的问题、生辰、设置和密钥。数据在后台页 admin.html 看。

const TRACK_ENDPOINT = 'https://disturbing-spoonbill-d7a2d8575e1.service.tcloudbase.com/api/reading';

// 只在正式部署的地址上统计，本地调试、file:// 打开都不发
const TRACK_SITES = [
    'disturbing-spoonbill-d7a2d8575e1-1327988716.tcloudbaseapp.com',
    'divination-disturbing-spoonbill-d7a2d8575e1.webapps.tcloudbase.com',
    'amres-1696.github.io'
];
const _trackOn = typeof location !== 'undefined' && TRACK_SITES.includes(location.hostname);

// 推广来源：网址带 ?from=xxx 进来的，本次会话里一直记着
function trackSource() {
    try {
        const p = new URLSearchParams(location.search).get('from');
        if (p) sessionStorage.setItem('tianyan_from', p.slice(0, 32));
        return sessionStorage.getItem('tianyan_from') || '';
    } catch (e) {
        return '';
    }
}

function _trackSend(data) {
    try {
        data.from = trackSource();
        data.uid = typeof getUserSeed === 'function' ? getUserSeed() : '';
        const payload = JSON.stringify(data);
        // text/plain 不触发预检；sendBeacon 页面关掉也会发出去
        const blob = new Blob([payload], { type: 'text/plain' });
        if (!(navigator.sendBeacon && navigator.sendBeacon(TRACK_ENDPOINT, blob))) {
            fetch(TRACK_ENDPOINT, { method: 'POST', body: payload, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
        }
    } catch (e) { /* 统计失败不打扰用户 */ }
}

// 打开页面记一次访问。只留来路的域名，不留完整地址
if (_trackOn) {
    let ref = '';
    try {
        const r = document.referrer ? new URL(document.referrer).hostname : '';
        if (r && r !== location.hostname) ref = r;
    } catch (e) { /* 来路解析不了就当直接访问 */ }
    // getUserSeed 在 daily.js 里，等脚本都加载完再发
    window.addEventListener('load', () => _trackSend({ kind: 'visit', ref }), { once: true });
}

// 起完一卦调一次
function reportReading({ method, gua, fullBin, change }) {
    if (!_trackOn) return;
    _trackSend({
        kind: 'reading',
        method,
        bin: fullBin,
        gua: gua && gua[0],
        changing: (change && change.changingYaos) || [],
        changeBin: change && change.hasChange ? change.changeBinary : null,
        changeGua: change && change.hasChange && change.changeGua ? change.changeGua[0] : ''
    });
}
