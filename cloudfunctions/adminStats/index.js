// adminStats —— 后台页 admin.html 的数据接口
// 密码放在函数的环境变量 ADMIN_PASSWORD 里，不进代码仓库。密码不对一律 401，什么都不返回。
// 从文档数据库取出这段时间的记录，交给 stats.js 汇总。
const crypto = require('crypto');
const cloudbase = require('@cloudbase/node-sdk');

const { buildStats, windowOf } = require('./stats');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const _ = db.command;

// 取 created_at 不早于 since 的全部记录。服务端单次最多 1000 条，按页往下翻
async function since(name, from, fields) {
    const rows = [];
    for (let skip = 0; ; skip += 1000) {
        const { data } = await db.collection(name)
            .where({ created_at: _.gte(new Date(from)) })
            .orderBy('created_at', 'asc')
            .field(fields)
            .skip(skip)
            .limit(1000)
            .get();
        rows.push(...data);
        if (data.length < 1000) return rows;
    }
}

const ALLOWED_ORIGINS = [
    'https://guashen.xyz',
    'https://www.guashen.xyz',
    'https://divination-ty-169609-d6g6rgkbq099d5815.webapps.tcloudbase.com',
    'https://ty-169609-d6g6rgkbq099d5815-1327988716.tcloudbaseapp.com',
    'https://amres-1696.github.io'
];

function reply(statusCode, origin, body) {
    const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' };
    if (ALLOWED_ORIGINS.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type';
        headers['Vary'] = 'Origin';
    }
    return { statusCode, headers, body: JSON.stringify(body || {}) };
}

// 比较摘要而不是原文，长度不同也不会提前返回，免得按耗时猜密码
function passwordOk(given) {
    const expected = process.env.ADMIN_PASSWORD || '';
    if (!expected || typeof given !== 'string') return false;
    const a = crypto.createHash('sha256').update(given).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}

exports.main = async (event) => {
    const h = event.headers || {};
    const origin = h.origin || h.Origin || '';
    if (event.httpMethod === 'OPTIONS') return reply(204, origin);
    if (event.httpMethod !== 'POST') return reply(405, origin, { error: 'method' });

    let data;
    try {
        const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
        if (raw.length > 1024) return reply(413, origin, { error: 'too large' });
        data = JSON.parse(raw);
    } catch (e) {
        return reply(400, origin, { error: 'bad json' });
    }

    if (!passwordOk(data.password)) {
        // 拖一下再回，暴力试密码会很慢
        await new Promise(r => setTimeout(r, 800));
        return reply(401, origin, { error: 'password' });
    }

    const days = [7, 30, 90].includes(data.days) ? data.days : 30;
    try {
        const now = Date.now();
        const { prevStart } = windowOf(days, now);
        const [visits, readings, vc, rc] = await Promise.all([
            since('visits', prevStart, { created_at: true, uid: true, source: true, ref: true, ua: true }),
            since('readings', prevStart, { created_at: true, uid: true, source: true, gua: true, change_gua: true, changing: true, method: true }),
            db.collection('visits').count(),
            db.collection('readings').count()
        ]);
        const stats = buildStats({ visits, readings, days, now, allTime: { visits: vc.total, readings: rc.total } });
        return reply(200, origin, stats);
    } catch (error) {
        console.error('admin_stats failed', error);
        return reply(500, origin, { error: 'query' });
    }
};
