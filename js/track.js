// track —— 访问统计：百度统计看整体流量，起卦记录发到 CloudBase 云函数存库
// 两边都是尽力而为：被拦截、断网、存储不可用都静默跳过，绝不影响起卦本身。

const TRACK_ENDPOINT = 'https://disturbing-spoonbill-d7a2d8575e1.service.tcloudbase.com/api/reading';
const BAIDU_TONGJI_ID = '';   // 百度统计的站点 ID（hm.js? 后面那串），注册后填进来，留空就不加载

// 只在正式部署的地址上统计，本地调试、file:// 打开都不发
const TRACK_SITES = [
    'disturbing-spoonbill-d7a2d8575e1-1327988716.tcloudbaseapp.com',
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

if (_trackOn) {
    trackSource();
    if (BAIDU_TONGJI_ID) {
        window._hmt = window._hmt || [];
        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://hm.baidu.com/hm.js?' + BAIDU_TONGJI_ID;
        document.head.appendChild(s);
    }
}

// 起完一卦调一次
function reportReading({ method, gua, fullBin, change }) {
    if (!_trackOn) return;
    try {
        if (window._hmt) window._hmt.push(['_trackEvent', 'divination', method || 'coin', gua && gua[0]]);

        const payload = JSON.stringify({
            method,
            bin: fullBin,
            gua: gua && gua[0],
            changing: (change && change.changingYaos) || [],
            changeBin: change && change.hasChange ? change.changeBinary : null,
            changeGua: change && change.hasChange && change.changeGua ? change.changeGua[0] : '',
            from: trackSource(),
            uid: typeof getUserSeed === 'function' ? getUserSeed() : ''
        });
        // text/plain 不触发预检；sendBeacon 页面关掉也会发出去
        const blob = new Blob([payload], { type: 'text/plain' });
        if (!(navigator.sendBeacon && navigator.sendBeacon(TRACK_ENDPOINT, blob))) {
            fetch(TRACK_ENDPOINT, { method: 'POST', body: payload, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
        }
    } catch (e) { /* 统计失败不打扰用户 */ }
}
