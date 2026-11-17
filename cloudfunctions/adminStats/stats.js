// 后台页的汇总：把一段时间里的访问和起卦记录算成 admin.html 要的样子。
// 纯函数，不碰数据库，方便在本地拿假数据测。按北京时间（UTC+8，没有夏令时）分天、分钟点。
// 以前这段写在 PostgreSQL 的 admin_stats 函数里，换成文档数据库后搬到这里，输出格式不变。

const DAY = 86400000;
const TZ = 8 * 3600000;

const pad = n => String(n).padStart(2, '0');
// 记录里的时间可能是 Date，也可能是 { $date } 或字符串，统一成毫秒
const ms = v => (v instanceof Date ? v.getTime() : new Date(v && v.$date !== undefined ? v.$date : v).getTime());
// 北京时间的「这一天 0 点」，返回 UTC 毫秒
const dayStart = t => Math.floor((t + TZ) / DAY) * DAY - TZ;
const ymd = t => { const d = new Date(t + TZ); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const hourOf = t => new Date(t + TZ).getUTCHours();
const mdhm = t => { const d = new Date(t + TZ); return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const distinct = rows => new Set(rows.map(r => r.uid || '')).size;
const MOBILE = /(iphone|android|mobile|harmonyos)/i;

// 往前看几天、从哪天算起、上一段从哪到哪；查库和汇总都用它，保证两边口径一样
function windowOf(days, now) {
    const n = Math.max(1, Math.min(365, days | 0 || 30));
    const today = dayStart(now);
    const start = today - (n - 1) * DAY;
    const span = n * DAY;
    return { n, today, start, prevStart: start - span, prevEnd: now - span };
}

// visits / readings：created_at 不早于 windowOf().prevStart 的记录（多给了也没关系，这里会再筛）
// allTime：两张表的总条数，由调用方另外数好传进来
function buildStats({ visits, readings, days, now = Date.now(), allTime }) {
    const w = windowOf(days, now);
    const withT = rows => rows.map(r => ({ ...r, t: ms(r.created_at) }));
    const allV = withT(visits), allR = withT(readings);
    const v = allV.filter(r => r.t >= w.start);
    const r = allR.filter(x => x.t >= w.start);
    const pv = allV.filter(x => x.t >= w.prevStart && x.t < w.prevEnd);
    const pr = allR.filter(x => x.t >= w.prevStart && x.t < w.prevEnd);

    const daily = [];
    for (let d = w.start; d <= w.today; d += DAY) {
        const dv = v.filter(x => dayStart(x.t) === d), dr = r.filter(x => dayStart(x.t) === d);
        daily.push({ date: ymd(d), visits: dv.length, visitors: distinct(dv), readings: dr.length, readers: distinct(dr) });
    }
    const last = daily[daily.length - 1];

    const countBy = (rows, key) => {
        const m = new Map();
        rows.forEach(x => { const k = key(x); m.set(k, (m.get(k) || 0) + 1); });
        return m;
    };

    const hexagrams = [...countBy(r, x => x.gua || '')]
        .map(([gua, count]) => ({ gua, count }))
        .sort((a, b) => b.count - a.count || byText(a.gua, b.gua));
    const methods = [...countBy(r, x => x.method || 'coin')]
        .map(([method, count]) => ({ method, count }))
        .sort((a, b) => b.count - a.count || byText(a.method, b.method));
    const changing = [...countBy(r, x => (Array.isArray(x.changing) ? x.changing.length : 0))]
        .map(([n, count]) => ({ n, count }))
        .sort((a, b) => a.n - b.n);

    // 来源：访问按 ?from= 记，没有就看来路域名；起卦只记带 ?from= 的
    const src = new Map();
    const slot = k => { if (!src.has(k)) src.set(k, { source: k, visits: 0, uids: new Set(), readings: 0 }); return src.get(k); };
    v.forEach(x => {
        const k = x.source || (x.ref ? 'ref:' + x.ref : '');
        const s = slot(k); s.visits++; s.uids.add(x.uid || '');
    });
    r.forEach(x => { if (x.source) slot(x.source).readings++; });
    const sources = [...src.values()]
        .map(s => ({ source: s.source, visits: s.visits, visitors: s.uids.size, readings: s.readings }))
        .sort((a, b) => b.visits - a.visits || b.readings - a.readings || byText(a.source, b.source));

    const hours = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        visits: v.filter(x => hourOf(x.t) === hour).length,
        readings: r.filter(x => hourOf(x.t) === hour).length
    }));

    const devices = [...countBy(v, x => (MOBILE.test(x.ua || '') ? 'mobile' : 'desktop'))]
        .map(([device, count]) => ({ device, count }))
        .sort((a, b) => b.count - a.count || byText(a.device, b.device));

    const recent = [...r].sort((a, b) => b.t - a.t).slice(0, 15).map(x => ({
        at: mdhm(x.t),
        gua: x.gua || '',
        changeGua: x.change_gua || '',
        changing: Array.isArray(x.changing) ? x.changing.length : 0,
        method: x.method || 'coin',
        source: x.source || ''
    }));

    return {
        generatedAt: new Date(now).toISOString(),
        days: daily.length,
        today: { visits: last.visits, visitors: last.visitors, readings: last.readings, readers: last.readers },
        total: { visits: v.length, visitors: distinct(v), readings: r.length, readers: distinct(r) },
        prev: { visits: pv.length, visitors: distinct(pv), readings: pr.length, readers: distinct(pr) },
        allTime: { visits: allTime ? allTime.visits : allV.length, readings: allTime ? allTime.readings : allR.length },
        daily, hexagrams, methods, changing, sources, hours, devices, recent
    };
}

module.exports = { buildStats, windowOf };
