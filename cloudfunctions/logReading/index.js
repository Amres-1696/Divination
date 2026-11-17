// logReading —— 收访问和起卦记录，分别存进文档数据库的 visits 和 readings 集合
// 前端起完卦用 sendBeacon 发过来（text/plain 的 JSON），这里只做校验和入库，不回任何数据。
// 两个集合的权限都是「仅管理端可读写」，网页端读写不了，只有云函数能碰。
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

// 只认这几个来源的请求，别的站点拿去刷数据就直接丢掉
const ALLOWED_ORIGINS = [
    'https://guashen.xyz',
    'https://www.guashen.xyz',
    'https://divination-ty-169609-d6g6rgkbq099d5815.webapps.tcloudbase.com',
    'https://ty-169609-d6g6rgkbq099d5815-1327988716.tcloudbaseapp.com',
    'https://amres-1696.github.io'
];

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function reply(statusCode, origin) {
    const headers = { 'Cache-Control': 'no-store' };
    if (ALLOWED_ORIGINS.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type';
        headers['Vary'] = 'Origin';
    }
    return { statusCode, headers, body: '' };
}

exports.main = async (event) => {
    const h = event.headers || {};
    const origin = h.origin || h.Origin || '';
    if (event.httpMethod === 'OPTIONS') return reply(204, origin);
    if (event.httpMethod !== 'POST') return reply(405, origin);
    if (!ALLOWED_ORIGINS.includes(origin)) return reply(403, origin);

    let data;
    try {
        const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
        if (raw.length > 4096) return reply(413, origin);
        data = JSON.parse(raw);
    } catch (e) {
        return reply(400, origin);
    }

    const common = {
        source: str(data.from, 32),      // 推广来源，网址里的 ?from=
        uid: str(data.uid, 40),          // 浏览器里随机生成的匿名 ID，用来数大概有多少人
        site: origin,
        ua: str(h['user-agent'] || h['User-Agent'], 200)
    };

    let table, row;
    if (data.kind === 'visit') {
        // 打开页面：只记来路域名
        table = 'visits';
        row = { ...common, ref: str(data.ref, 100) };
    } else {
        // 起卦：卦用六位二进制表示（自下而上读完后反转，和前端 fullBin 一致）
        const bin = str(data.bin, 6);
        if (!/^[01]{6}$/.test(bin)) return reply(400, origin);
        const changeBin = /^[01]{6}$/.test(data.changeBin || '') ? data.changeBin : null;
        const changing = Array.isArray(data.changing)
            ? data.changing.filter(n => Number.isInteger(n) && n >= 0 && n <= 5).slice(0, 6)
            : [];
        table = 'readings';
        row = {
            ...common,
            bin,
            gua: str(data.gua, 8),
            changing,
            change_bin: changeBin,
            change_gua: str(data.changeGua, 8),
            method: data.method === 'bazi' ? 'bazi' : 'coin'
        };
    }

    try {
        await db.collection(table).add({ ...row, created_at: db.serverDate() });
    } catch (error) {
        console.error('insert failed', table, error);
        return reply(500, origin);
    }
    return reply(204, origin);
};
