// main —— DOMContentLoaded 入口：初始化背景、绑定全部事件、键盘快捷键
// 必须最后加载

document.addEventListener('DOMContentLoaded', () => {
    // 入场动画区分新老用户（章节 3.2）
    const hasVisited = localStorage.getItem('tianyan_visited');
    if (hasVisited) {
        document.body.classList.add('intro-fast');
    } else {
        try { localStorage.setItem('tianyan_visited', '1'); } catch (e) {}
    }
    document.body.classList.add('intro-start');
    const introDur = hasVisited ? 1800 : 3500;
    setTimeout(() => document.body.classList.remove('intro-start'), introDur);

    applyHourTheme();
    const dustCanvas = document.querySelector('.dust-layer');
    let dust = null;
    if (dustCanvas) {
        dust = new DustParticles(dustCanvas);
        dust.start();
    }
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (dust) dust.pause();
            // 暂停所有 CSS 动画，节省后台 GPU
            document.documentElement.style.setProperty('--anim-state', 'paused');
        } else {
            if (dust) dust.resume();
            document.documentElement.style.setProperty('--anim-state', 'running');
        }
    });

    loadHistory();
    renderDailyGua();
    restoreSettingsUI();
    initParallax();
    scheduleGoldStreak();
    const sc = document.getElementById('shareImageContainer');
    if (sc) sc.addEventListener('click', e => { if (e.target === sc) closeShare(); });

    document.getElementById('settingsGear').addEventListener('click', toggleSettings);
    document.getElementById('settingsOverlay').addEventListener('click', toggleSettings);
    document.getElementById('settingsCloseBtn').addEventListener('click', toggleSettings);
    document.getElementById('divineBtn').addEventListener('click', divine);
    document.getElementById('historyBtn').addEventListener('click', toggleHistory);
    document.getElementById('historyOverlay').addEventListener('click', toggleHistory);
    document.getElementById('historyCloseBtn').addEventListener('click', toggleHistory);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
    document.getElementById('saveBaziBtn').addEventListener('click', saveBazi);
    document.getElementById('closeShareBtn').addEventListener('click', closeShare);
    document.getElementById('settingMethod').addEventListener('change', function() {
        saveSetting('method', this.value);
        // 选八字起卦但尚未填八字：就地提示并高亮表单，避免回到主页起卦时才报错
        if (this.value === 'bazi' && !loadSettings().bazi) {
            showToast('八字起卦需先填写并保存生辰八字', 'error');
            const seals = document.querySelector('.bazi-seals');
            if (seals) {
                seals.scrollIntoView({ behavior: 'smooth', block: 'center' });
                seals.classList.add('hint-flash');
                setTimeout(() => seals.classList.remove('hint-flash'), 1600);
            }
        }
    });
    document.getElementById('settingDaily').addEventListener('change', function() { saveSetting('showDaily', this.checked); });

    // AI 解卦设置
    const aiEnabledEl = document.getElementById('settingAiEnabled');
    if (aiEnabledEl) aiEnabledEl.addEventListener('change', function() {
        setAiField('enabled', this.checked);
        const cfg = document.getElementById('aiConfig');
        if (cfg) cfg.style.display = this.checked ? '' : 'none';
    });
    const aiAutoEl = document.getElementById('settingAiAuto');
    if (aiAutoEl) aiAutoEl.addEventListener('change', function() { setAiField('autoRun', this.checked); });
    const saveAiBtn = document.getElementById('saveAiBtn');
    if (saveAiBtn) saveAiBtn.addEventListener('click', saveAiConfig);
    const testAiBtn = document.getElementById('testAiBtn');
    if (testAiBtn) testAiBtn.addEventListener('click', testAiConnection);

    // 多配置档案：切换 / 新建 / 删除
    const aiProfileSel = document.getElementById('aiProfileSelect');
    if (aiProfileSel) aiProfileSel.addEventListener('change', function() { switchAiProfile(this.value); });
    const aiProfileNewBtn = document.getElementById('aiProfileNew');
    if (aiProfileNewBtn) aiProfileNewBtn.addEventListener('click', newAiProfile);
    const aiProfileDelBtn = document.getElementById('aiProfileDelete');
    if (aiProfileDelBtn) aiProfileDelBtn.addEventListener('click', deleteAiProfile);
    // 改名即时反映到下拉
    const aiProfileNameEl = document.getElementById('aiProfileName');
    if (aiProfileNameEl) aiProfileNameEl.addEventListener('input', function() {
        const opt = aiProfileSel && aiProfileSel.selectedOptions[0];
        if (opt) opt.textContent = this.value.trim() || ('配置 ' + (aiProfileSel.selectedIndex + 1));
    });
    const resetPromptBtn = document.getElementById('resetPromptBtn');
    if (resetPromptBtn) resetPromptBtn.addEventListener('click', function() {
        const el = document.getElementById('aiPrompt');
        if (el) el.value = DEFAULT_AI_PROMPT;
    });

    // Esc 关闭当前打开的弹层（按层级优先级，从最上层往下）
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const detail = document.querySelector('.detail-overlay.show');
        if (detail) { detail.remove(); return; }
        const confirmO = document.getElementById('confirmOverlay');
        if (confirmO && confirmO.classList.contains('show')) { document.getElementById('confirmNo').click(); return; }
        const share = document.getElementById('shareImageContainer');
        if (share && share.classList.contains('show')) { closeShare(); return; }
        const settingsO = document.getElementById('settingsOverlay');
        if (settingsO && settingsO.classList.contains('show')) { toggleSettings(); return; }
        const historyO = document.getElementById('historyOverlay');
        if (historyO && historyO.classList.contains('show')) { toggleHistory(); return; }
    });
    const questionInput = document.getElementById('question');
    const divineButton = document.getElementById('divineBtn');
    questionInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); divine(); }
    });
    questionInput.addEventListener('input', () => {
        divineButton.classList.toggle('charged', questionInput.value.trim().length > 0);
    });

    // 回到顶部按钮
    const bttBtn = document.getElementById('backToTop');
    if (bttBtn) {
        let scrollTicking = false;
        window.addEventListener('scroll', () => {
            if (!scrollTicking) {
                scrollTicking = true;
                requestAnimationFrame(() => {
                    bttBtn.classList.toggle('visible', window.scrollY > window.innerHeight);
                    scrollTicking = false;
                });
            }
        }, { passive: true });
        bttBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // 每分钟检查一次时辰(到点切换子时/午时主题)
    setInterval(applyHourTheme, 60 * 1000);
});
