// settings —— 设置读写、八字保存、设置面板 UI 回填与开合

// 设置

const DEFAULT_SETTINGS = {
    method: 'coin',
    showDaily: true,
    bazi: null,
    ai: DEFAULT_AI
};

function loadSettings() {
    try {
        const raw = localStorage.getItem('tianyan_settings');
        if (raw) {
            const parsed = JSON.parse(raw);
            const merged = { ...DEFAULT_SETTINGS, ...parsed };
            // ai 子对象深合并：老配置缺字段时用默认补齐，避免 undefined
            merged.ai = { ...DEFAULT_AI, ...(parsed.ai || {}) };
            ensureAiProfiles(merged.ai);
            return merged;
        }
    } catch(e) {}
    return { ...DEFAULT_SETTINGS, ai: ensureAiProfiles({ ...DEFAULT_AI }) };
}

function saveSettings(settings) {
    try {
        localStorage.setItem('tianyan_settings', JSON.stringify(settings));
        return true;
    } catch (e) {
        showToast('设置保存失败：浏览器存储空间不足或禁止写入，请检查后重试', 'error');
        return false;
    }
}

function saveSetting(key, value) {
    const settings = loadSettings();
    settings[key] = value;
    if (!saveSettings(settings)) return false;
    applySettings(settings);
    return true;
}

function saveBazi() {
    const year = document.getElementById('baziYear').value;
    const month = document.getElementById('baziMonth').value;
    const day = document.getElementById('baziDay').value;
    const hour = document.getElementById('baziHour').value;
    const status = document.getElementById('baziStatus');

    if (!year || !month || !day || hour === '') {
        status.textContent = '请填写完整的公历生辰';
        status.className = 'bazi-status error';
        return;
    }
    if (year < 1900 || year > 2100) {
        status.textContent = '年份范围：1900-2100';
        status.className = 'bazi-status error';
        return;
    }
    const maxDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    if (day < 1 || day > maxDay) {
        status.textContent = `${month}月最多${maxDay}天，请检查日期`;
        status.className = 'bazi-status error';
        return;
    }

    const bazi = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour) };
    const settings = loadSettings();
    settings.bazi = bazi;
    if (!saveSettings(settings)) {
        status.textContent = '保存失败，生辰内容已保留，请检查浏览器存储后重试';
        status.className = 'bazi-status error';
        return;
    }
    renderDailyGua();

    const shiChen = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    const lunar = solarToLunar(bazi.year, bazi.month, bazi.day);
    status.textContent = `已保存：${year}年${month}月${day}日 ${shiChen[hour]}时` + (lunar ? ` · ${formatLunar(lunar)}` : '');
    status.className = 'bazi-status success';
    renderMethodHint(settings);
    updateBaziSaveState();
}

const SHI_CHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
// 生辰的一句话说法：农历年月日 + 时辰；早于农历历表时用公历
function baziSummary(b) {
    const lu = solarToLunar(b.year, b.month, b.day);
    return (lu ? formatLunar(lu) : `公历${b.year}年${b.month}月${b.day}日`) + ` ${SHI_CHEN[b.hour]}时`;
}

// 首页起卦方式下面的一行：铜钱和生辰各说各的起法；生辰模式直接亮出已存的生辰，没存就引导去填
function renderMethodHint(settings) {
    const el = document.getElementById('methodHint');
    if (!el) return;
    const bazi = settings.method === 'bazi';
    const coins = '<svg class="mh-ico" viewBox="0 0 30 12" aria-hidden="true"><circle cx="6" cy="6" r="5"/><rect x="4.4" y="4.4" width="3.2" height="3.2"/><circle cx="15" cy="6" r="5"/><rect x="13.4" y="4.4" width="3.2" height="3.2"/><circle cx="24" cy="6" r="5"/><rect x="22.4" y="4.4" width="3.2" height="3.2"/></svg>';
    const moon = '<svg class="mh-ico" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5"/><path class="lit" d="M6 1A5 5 0 0 1 6 11A2.6 5 0 0 0 6 1Z"/></svg>';
    let html;
    if (!bazi) html = `${coins}<b>铜钱起卦</b><span>三枚铜钱，自下而上掷六次</span>`;
    else if (settings.bazi) html = `${moon}<b>依生辰起卦</b><button type="button" class="mh-edit" title="去设置里修改生辰">${baziSummary(settings.bazi)}</button>`;
    else html = `${moon}<b>依生辰起卦</b><button type="button" class="mh-edit need">还没有保存生辰，点这里填写</button>`;
    if (el.innerHTML === html) return;
    el.innerHTML = html;
    // 换一种起法时整行淡入一次
    if (el.classList) {
        el.classList.toggle('is-bazi', bazi);
        el.classList.remove('swap');
        el.offsetWidth;
        el.classList.add('swap');
    }
}

// 设置里生辰的保存状态：表单和已存的一致时按钮常亮为「已保存」，改了没存就提示还没保存
function updateBaziSaveState() {
    const btn = document.getElementById('saveBaziBtn');
    const status = document.getElementById('baziStatus');
    if (!btn || !status) return;
    const read = id => document.getElementById(id).value;
    const cur = { year: parseInt(read('baziYear'), 10), month: parseInt(read('baziMonth'), 10), day: parseInt(read('baziDay'), 10), hour: parseInt(read('baziHour'), 10) };
    const saved = loadSettings().bazi;
    const same = saved && ['year', 'month', 'day', 'hour'].every(k => saved[k] === cur[k]);
    btn.classList.toggle('is-saved', !!same);
    btn.classList.toggle('is-dirty', !!saved && !same);
    btn.textContent = same ? '生辰已保存' : saved ? '保存改动' : '保存生辰';
    if (same) {
        status.textContent = `已保存 · ${baziSummary(saved)}`;
        status.className = 'bazi-status success';
    } else if (saved) {
        status.textContent = `有改动，还没保存（现存的是 ${baziSummary(saved)}）`;
        status.className = 'bazi-status dirty';
    }
}

function applySettings(settings) {
    const homeMethod = document.getElementById('homeMethod');
    if (homeMethod) homeMethod.value = settings.method;
    const settingMethod = document.getElementById('settingMethod');
    if (settingMethod) settingMethod.value = settings.method;
    if (typeof syncMethodPickers === 'function') syncMethodPickers();
    const birthGroup = document.getElementById('baziSettings');
    if (birthGroup) birthGroup.hidden = settings.method !== 'bazi';
    // 每日启示
    const dailyEl = document.getElementById('dailyGua');
    if (dailyEl) dailyEl.style.display = settings.showDaily ? '' : 'none';
    renderMethodHint(settings);
}

function restoreSettingsUI() {
    const settings = loadSettings();

    const methodEl = document.getElementById('settingMethod');
    if (methodEl) methodEl.value = settings.method;

    const dailyEl = document.getElementById('settingDaily');
    if (dailyEl) dailyEl.checked = settings.showDaily;

    // AI 解卦回填
    const ai = settings.ai || {};
    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
    setChk('settingAiEnabled', ai.enabled);
    renderAiProfileSelect(ai);
    loadActiveProfileToForm(ai);
    setChk('settingAiAuto', ai.autoRun);
    const aiConfig = document.getElementById('aiConfig');
    if (aiConfig) aiConfig.style.display = ai.enabled ? '' : 'none';

    // 恢复八字
    if (settings.bazi) {
        const b = settings.bazi;
        document.getElementById('baziYear').value = b.year || '';
        document.getElementById('baziMonth').value = b.month || '';
        document.getElementById('baziDay').value = b.day || '';
        document.getElementById('baziHour').value = b.hour !== undefined ? b.hour : '';
        const shiChen = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
        const status = document.getElementById('baziStatus');
        if (status) {
            const lunar = solarToLunar(b.year, b.month, b.day);
            status.textContent = `当前：${b.year}年${b.month}月${b.day}日 ${shiChen[b.hour]}时` + (lunar ? ` · ${formatLunar(lunar)}` : '');
            status.className = 'bazi-status success';
        }
    }

    applySettings(settings);
    updateBaziSaveState();
}

function setFloatingPanelState(panelId, overlayId, shouldOpen) {
    const panel = document.getElementById(panelId);
    const overlay = document.getElementById(overlayId);
    if (!panel || !overlay) return false;

    if (shouldOpen) {
        const peerPanelId = panelId === 'settingsPanel' ? 'historyPanel' : 'settingsPanel';
        const peerOverlayId = overlayId === 'settingsOverlay' ? 'historyOverlay' : 'settingsOverlay';
        const peerPanel = document.getElementById(peerPanelId);
        const peerOverlay = document.getElementById(peerOverlayId);
        if (peerPanel) {
            peerPanel.classList.remove('show');
            peerPanel.setAttribute('aria-hidden', 'true');
        }
        if (peerOverlay) {
            peerOverlay.classList.remove('show');
            peerOverlay.setAttribute('aria-hidden', 'true');
        }
    }

    // 页面从顶栏挂签里展开、收回（theme.js 提供；没有它时照旧直接开合）
    if (typeof morphPanelFromTag === 'function' && panel.classList.contains('show') !== shouldOpen) {
        morphPanelFromTag(panel, shouldOpen);
    }
    panel.classList.toggle('show', shouldOpen);
    overlay.classList.toggle('show', shouldOpen);
    panel.setAttribute('aria-hidden', String(!shouldOpen));
    overlay.setAttribute('aria-hidden', String(!shouldOpen));
    document.body.classList.toggle('dialog-open', Boolean(document.querySelector('.history-panel.show')));

    if (shouldOpen) {
        window.setTimeout(() => panel.querySelector('.btn-close')?.focus({ preventScroll: true }), 180);
    }
    return shouldOpen;
}

function toggleSettings(force) {
    const panel = document.getElementById('settingsPanel');
    const shouldOpen = typeof force === 'boolean' ? force : !panel.classList.contains('show');
    return setFloatingPanelState('settingsPanel', 'settingsOverlay', shouldOpen);
}
