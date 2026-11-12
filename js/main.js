// main —— DOMContentLoaded 入口：绑定全部事件、键盘快捷键
// 必须最后加载

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshDailyGuaIfNeeded();
    });

    loadHistory();
    renderDailyGua();
    restoreSettingsUI();
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
    // 年、月日、时辰任一改动后，刷新保存按钮是「已保存」还是「保存改动」
    document.getElementById('baziSettings').addEventListener('change', updateBaziSaveState);
    document.getElementById('closeShareBtn').addEventListener('click', closeShare);
    document.getElementById('settingMethod').addEventListener('change', function() {
        if (!saveSetting('method', this.value)) {
            this.value = loadSettings().method;
            return;
        }
        // 选了生辰起卦但还没存生辰：就地引到生辰那一组，免得回首页起卦时才发现
        if (this.value === 'bazi' && !loadSettings().bazi) promptForBirth();
    });
    document.getElementById('settingRitual').addEventListener('change', function() {
        if (!saveSetting('ritual', this.value)) this.value = loadSettings().ritual || 'full';
    });
    document.getElementById('settingRitualBazi').addEventListener('change', function() {
        if (!saveSetting('ritualBazi', this.value)) this.value = loadSettings().ritualBazi || 'full';
    });
    // 不清楚出生时辰：按子时算
    document.getElementById('baziHourUnknown').addEventListener('click', () => {
        const hour = document.getElementById('baziHour');
        hour.value = '0';
        hour.dispatchEvent(new Event('change', { bubbles: true }));
    });
    document.getElementById('settingDaily').addEventListener('change', function() {
        if (!saveSetting('showDaily', this.checked)) this.checked = loadSettings().showDaily;
    });

    // AI 解卦设置
    const aiEnabledEl = document.getElementById('settingAiEnabled');
    if (aiEnabledEl) aiEnabledEl.addEventListener('change', function() {
        if (!setAiField('enabled', this.checked)) {
            this.checked = loadSettings().ai.enabled;
            return;
        }
        const cfg = document.getElementById('aiConfig');
        if (cfg) cfg.style.display = this.checked ? '' : 'none';
    });
    const aiAutoEl = document.getElementById('settingAiAuto');
    if (aiAutoEl) aiAutoEl.addEventListener('change', function() {
        if (!setAiField('autoRun', this.checked)) this.checked = loadSettings().ai.autoRun;
    });
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
        if (detail) { closeGuaDetail(detail); return; }
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
    questionInput.addEventListener('keydown', e => {
        // 输入法选字时的回车只是上屏，不起卦（Safari 上屏后还会补发一次 keyCode 229 的 Enter）
        if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        divine();
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

    // 同步时辰与跨日启示；后台恢复时另做即时检查。
    setInterval(() => {
        refreshDailyGuaIfNeeded();
    }, 60 * 1000);
});
