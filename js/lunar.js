// lunar —— 农历换算：公历转农历（1900-2100）、干支纪年、农历月日名
// 供八字起卦（梅花易数以农历起卦）与设置面板显示使用

// 历法表每年一条十六进制数：
//   bit16    闰月大小（1=30天，0=29天）
//   bit15-4  正月至腊月的大小月（1=30天，0=29天）
//   bit3-0   闰月月份（0=无闰月）
const LUNAR_INFO = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
    0x06566, 0x0d4a0, 0x0ea50, 0x16a95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
    0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
    0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
    0x0d520 // 2100
];

// 农历 y 年闰哪个月（0=无闰月）
function lunarLeapMonth(y) { return LUNAR_INFO[y - 1900] & 0xf; }

// 农历 y 年闰月天数
function lunarLeapDays(y) {
    return lunarLeapMonth(y) ? ((LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29) : 0;
}

// 农历 y 年 m 月（正常月）天数
function lunarMonthDays(y, m) { return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29; }

// 农历 y 年总天数
function lunarYearDays(y) {
    let sum = 348;
    for (let i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
    return sum + lunarLeapDays(y);
}

// 公历转农历：返回 { year, month, day, isLeap }，闰月时 isLeap 为 true、month 为该月数
// 早于 1900-01-31（农历1900年正月初一）返回 null
function solarToLunar(y, m, d) {
    const offset = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1900, 0, 31)) / 86400000);
    if (offset < 0) return null;
    let year = 1900;
    let rest = offset;
    while (year < 2100) {
        const days = lunarYearDays(year);
        if (rest < days) break;
        rest -= days;
        year++;
    }
    const leap = lunarLeapMonth(year);
    let month = 1, isLeap = false;
    while (month <= 12) {
        const days = isLeap ? lunarLeapDays(year) : lunarMonthDays(year, month);
        if (rest < days) break;
        rest -= days;
        if (!isLeap && leap > 0 && month === leap) {
            isLeap = true; // 闰月紧随其正常月，月数不变
        } else {
            isLeap = false;
            month++;
        }
    }
    return { year, month, day: rest + 1, isLeap };
}

const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DI_ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const YEAR_ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

// 第几个地支（0 = 子）对应的生肖线稿，js/zodiac.js 没加载时返回空串
function zodiacSvg(zhi) {
    return typeof ZODIAC_SVG !== 'undefined' ? ZODIAC_SVG[((zhi % 12) + 12) % 12] || '' : '';
}

// 干支纪年：1984 = 甲子
function ganZhiYear(lunarYear) {
    const g = ((lunarYear - 4) % 10 + 10) % 10;
    const z = ((lunarYear - 4) % 12 + 12) % 12;
    return TIAN_GAN[g] + DI_ZHI[z];
}

// 日干支在六十甲子里的序号（0 = 甲子）。1900-01-01 是甲戌日（第 10），按公历日数往后推，不分子时前后
function dayGanZhiIndex(d) {
    const days = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1900, 0, 1)) / 864e5);
    return ((days + 10) % 60 + 60) % 60;
}
function ganZhiDay(d) {
    const gz = dayGanZhiIndex(d);
    return TIAN_GAN[gz % 10] + DI_ZHI[gz % 12];
}

// 此刻在图框上的坐标：[日干序号 0–9, 时辰序号 0–11]
function frameNow(now) {
    return [dayGanZhiIndex(now) % 10, Math.floor((now.getHours() + 1) / 2) % 12];
}

// 地支序数（梅花易数年数）：子1 … 亥12
function lunarYearBranch(lunarYear) {
    return ((lunarYear - 4) % 12 + 12) % 12 + 1;
}

// 梅花易数的生辰取数：年取地支数（子1…亥12），月、日取农历月日（闰月按其月数计）。
// 上卦数＝年＋月＋日，下卦数＝上卦数＋时辰数（子1…亥12）。早于农历历表时退回公历数值，结果仍然确定。
// 时辰 0…11 是子…亥；12 是夜里 23–24 点的晚子时：按「子初换日」算到第二天，时辰数仍取子 1
function birthNumbers(bazi) {
    let { year, month, day } = bazi;
    if (bazi.hour === 12) {
        const next = new Date(year, month - 1, day + 1);
        year = next.getFullYear(); month = next.getMonth() + 1; day = next.getDate();
    }
    const lunar = solarToLunar(year, month, day);
    const yearNum = lunar ? lunarYearBranch(lunar.year) : (year % 100 || 100);
    const upper = yearNum + (lunar ? lunar.month : month) + (lunar ? lunar.day : day);
    return { upper, lower: upper + (bazi.hour % 12 + 1) };
}
// 先天八卦数取卦（乾1 兑2 离3 震4 巽5 坎6 艮7 坤8，满八循环），返回自上而下的三位二进制
function trigramOfNumber(sum) {
    return TRIGRAM_TO_BINARY['☰☱☲☳☴☵☶☷'[((sum - 1) % 8 + 8) % 8]];
}

// ---------- 梅花易数取数 ----------
// 上卦数、下卦数各按先天八卦数取卦，动爻数除以六取余（余 0 为上爻）。返回自下而上的六爻（6/7/8/9），只有一根动爻
function meihuaLines(upperSum, lowerSum, moveSum) {
    const upperBin = trigramOfNumber(upperSum), lowerBin = trigramOfNumber(lowerSum);
    const lines = [];
    for (let i = 0; i < 3; i++) lines.push(lowerBin[2 - i] === '1' ? 7 : 8);
    for (let i = 0; i < 3; i++) lines.push(upperBin[2 - i] === '1' ? 7 : 8);
    const k = ((moveSum - 1) % 6 + 6) % 6;
    lines[k] = lines[k] === 7 ? 9 : 6;
    return lines;
}
// 某一刻是哪个时辰，编号和生辰的时辰一样：0 子（0–1 点）… 11 亥，12 是 23 点后的子时（算作第二天）
function hourIndexOf(date) {
    const h = date.getHours();
    return h === 23 ? 12 : Math.floor((h + 1) / 2);
}
// 占时起卦：起卦这一刻的农历年支数 + 月 + 日定上卦，再加时辰数定下卦，总数定动爻
function timeNumbers(date) {
    return birthNumbers({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: hourIndexOf(date) });
}
function generateHexagramTime(date) {
    const n = timeNumbers(date || new Date());
    return meihuaLines(n.upper, n.lower, n.lower);
}
// 报数起卦：第一个数定上卦，第二个数定下卦，两数之和加起卦时辰数定动爻
function generateHexagramNumber(a, b, date) {
    const hourNum = hourIndexOf(date || new Date()) % 12 + 1;
    return meihuaLines(a, b, a + b + hourNum);
}
// 本命卦：只用生辰，和生辰起卦不写问题时一样
function generateHexagramNatal(bazi) {
    const n = birthNumbers(bazi);
    return meihuaLines(n.upper, n.lower, n.lower);
}

// 农历月名：正月、二月…冬月、腊月；闰月前缀「闰」
function lunarMonthName(month, isLeap) {
    const names = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
    return (isLeap ? '闰' : '') + (names[month - 1] || month) + '月';
}

// 农历日名：初一…三十
function lunarDayName(day) {
    const names = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
        '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
        '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
    return names[day - 1] || String(day);
}

// 组合显示，如「农历乙巳年闰六月初三」
function formatLunar(lunar) {
    if (!lunar) return '';
    return '农历' + ganZhiYear(lunar.year) + '年' + lunarMonthName(lunar.month, lunar.isLeap) + lunarDayName(lunar.day);
}
