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
    } catch (e) {
    }
}

function saveSetting(key, value) {
    const settings = loadSettings();
    settings[key] = value;
    saveSettings(settings);
    applySettings(settings);
}

function saveBazi() {
    const year = document.getElementById('baziYear').value;
    const month = document.getElementById('baziMonth').value;
    const day = document.getElementById('baziDay').value;
    const hour = document.getElementById('baziHour').value;
    const status = document.getElementById('baziStatus');

    if (!year || !month || !day || hour === '') {
        status.textContent = '请填写完整的生辰八字信息';
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
    saveSettings(settings);

    const shiChen = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    status.textContent = `已保存：${year}年${month}月${day}日 ${shiChen[hour]}时`;
    status.className = 'bazi-status success';
}

function applySettings(settings) {
    // 每日启示
    const dailyEl = document.getElementById('dailyGua');
    if (dailyEl) dailyEl.style.display = settings.showDaily ? '' : 'none';
}

function restoreSettingsUI() {
    const settings = loadSettings();

    const methodEl = document.getElementById('settingMethod');
    if (methodEl) methodEl.value = settings.method;

    const dailyEl = document.getElementById('settingDaily');
    if (dailyEl) dailyEl.checked = settings.showDaily;

    // AI 解卦回填
    const ai = settings.ai || {};
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
    setChk('settingAiEnabled', ai.enabled);
    if (ai.profiles) {
        renderAiProfileSelect(ai);
        loadActiveProfileToForm(ai);
    } else {
        setVal('aiBaseUrl', ai.baseUrl || '');
        setVal('aiApiKey', ai.apiKey || '');
        setVal('aiModel', ai.model || '');
        setVal('aiPrompt', ai.prompt || DEFAULT_AI_PROMPT);
    }
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
            status.textContent = `当前：${b.year}年${b.month}月${b.day}日 ${shiChen[b.hour]}时`;
            status.className = 'bazi-status success';
        }
    }

    // 时辰印章双层显示（章节 2.9）：把 hour select 选中项的 data-range 同步到父级
    syncHourSealRange();
    const hourEl = document.getElementById('baziHour');
    if (hourEl && !hourEl._hourSealHooked) {
        hourEl.addEventListener('change', syncHourSealRange);
        hourEl._hourSealHooked = true;
    }

    applySettings(settings);
}

function syncHourSealRange() {
    const sel = document.getElementById('baziHour');
    if (!sel) return;
    const seal = sel.closest('.bazi-seal-hour');
    if (!seal) return;
    const opt = sel.options[sel.selectedIndex];
    seal.dataset.range = (opt && opt.dataset && opt.dataset.range) || '';
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
