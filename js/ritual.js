// ritual —— 起卦仪式(HexRitual)：圆图收成方图 → 六次掷钱、逐爻筛卦 → 剩下一卦
// 卦象在仪式前已经算好（铜钱随机或生辰取数），仪式负责把它一爻一爻揭出来。
// 只用 style / classList / sleep 和可选的 Cosmos，测试环境里也能跑完。

const YAO_POS_CN = ['初', '二', '三', '四', '五', '上'];
const YAO_TYPE_CN = { 6: '老阴', 7: '少阳', 8: '少阴', 9: '老阳' };
const LINE_TO_BEI = { 9: 3, 8: 2, 7: 1, 6: 0 }; // 背面朝上的铜钱数

function yaoLabel(line, i) {
    const num = (line === 7 || line === 9) ? '九' : '六';
    if (i === 0) return '初' + num;
    if (i === 5) return '上' + num;
    return num + YAO_POS_CN[i];
}

class HexRitual {
    constructor(stage, finalGua, hexLines, change, method) {
        this.stage = stage;
        this.finalGua = finalGua;
        this.hexLines = hexLines;
        this.change = change;
        this.method = method === 'bazi' ? 'bazi' : 'coin';
        this.cast = 0;
        const bits = hexLines.map(n => (n === 7 || n === 9) ? '1' : '0');
        this.value = shaoValue(bits.slice().reverse().join(''));
        this.chosenCard = null;
        this.dead = false;
        this._offKey = null;
    }
    // 跳过后停止一切后续动作，避免旧仪式继续改动图层或监听按键
    abort() {
        this.dead = true;
        if (this._offKey) this._offKey();
    }
    async run() {
        this.buildStage();
        await this.actUnfold();
        await this.actCast();
        await this.actSettle();
    }
    buildStage() {
        const rowLabels = TRIGRAM_BY_VALUE.map((n, t) => `<span data-t="${t}">${n}</span>`).join('');
        this.stage.innerHTML = `
<div class="ritual-head">
  <p class="ritual-status" id="ritualStatus" aria-live="polite"></p>
  <button type="button" class="ritual-skip" id="ritualSkip">跳过，直接看结果</button>
</div>
<div class="ritual-body">
  <div class="grid-frame">
    <div class="grid-cols" aria-hidden="true"><em>上卦</em>${rowLabels}</div>
    <div class="grid-rows" aria-hidden="true"><em>下卦</em>${rowLabels}</div>
    <div class="grid-slot" id="gridSlot"></div>
    <p class="grid-count" id="gridCount" aria-live="polite">六十四卦</p>
  </div>
  <div class="cast-panel">
    <div class="coins" id="coins">${buildCoin()}${buildCoin()}${buildCoin()}</div>
    <div class="cast-build" id="castBuild">${buildHexBars(null, [], 'hx-build')}</div>
    <div class="cast-actions" id="castActions"></div>
  </div>
</div>`;
        this.statusEl = this.stage.querySelector('#ritualStatus');
        this.countEl = this.stage.querySelector('#gridCount');
        this.coinsEl = this.stage.querySelector('#coins');
        this.buildEl = this.stage.querySelector('#castBuild');
        this.actionsEl = this.stage.querySelector('#castActions');
        if (this.stage.classList) {
            this.stage.classList.add('pre');
            if (this.method === 'bazi') this.stage.classList.add('by-birth');
        }
        const skipBtn = this.stage.querySelector('#ritualSkip');
        if (skipBtn) skipBtn.addEventListener('click', () => { if (this._onSkip) this._onSkip(); });
    }
    setStatus(main, sub) {
        this.statusEl.innerHTML = `<span class="ritual-status-main">${main}</span>` +
            (sub ? `<span class="ritual-status-sub">${sub}</span>` : '');
    }
    async actUnfold() {
        if (this.dead) return;
        this.setStatus('六十四卦', '圆图卷作方图：行是下卦，列是上卦');
        if (typeof Cosmos !== 'undefined') Cosmos.toGrid();
        await sleep(700);
        if (this.stage.classList) this.stage.classList.remove('pre');
        await sleep(1150);
    }
    async actCast() {
        if (this.method === 'bazi') {
            this.setStatus('依生辰取数', '生辰起卦不掷钱，六爻由生辰和所问推出');
            await sleep(700);
            for (let i = 0; i < 6; i++) await this.revealLine(i, false);
            return;
        }
        this.setStatus('第一爻', (window.innerWidth || 1000) > 768
            ? '点「掷钱」或按空格，自下而上掷六次' : '点「掷钱」，自下而上掷六次');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cast-btn';
        btn.textContent = '掷钱';
        this.actionsEl.appendChild(btn);
        if (btn.focus) btn.focus({ preventScroll: true });

        return new Promise(resolve => {
            let busy = false;
            const onKey = (e) => {
                if (e.key !== ' ' && e.key !== 'Enter') return;
                const tag = (e.target && e.target.tagName) || '';
                if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target !== btn && tag === 'BUTTON')) return;
                e.preventDefault();
                this._castHandler();
            };
            this._castHandler = async () => {
                if (busy || this.cast >= 6 || this.dead) return;
                busy = true;
                btn.disabled = true;
                await this.revealLine(this.cast, true);
                this.cast++;
                busy = false;
                btn.disabled = false;
                if (this.cast >= 6) {
                    btn.remove();
                    if (document.removeEventListener) document.removeEventListener('keydown', onKey);
                    resolve();
                } else {
                    this.setStatus(`第${'一二三四五六'[this.cast]}爻`, '再掷一次');
                    if (btn.focus) btn.focus({ preventScroll: true });
                }
            };
            btn.addEventListener('click', () => this._castHandler());
            document.addEventListener('keydown', onKey);
            this._offKey = () => { if (document.removeEventListener) document.removeEventListener('keydown', onKey); };
        });
    }
    tossCoins(line) {
        const bei = LINE_TO_BEI[line];
        const coins = Array.from(this.coinsEl.querySelectorAll ? this.coinsEl.querySelectorAll('.coin') : []);
        const order = [0, 1, 2].sort(() => Math.random() - 0.5);
        coins.forEach((c, k) => {
            const isBei = order.indexOf(k) < bei;
            c.classList.remove('toss-zi', 'toss-bei', 'landed');
            c.offsetHeight;
            c.style.setProperty('--dur', (560 + Math.random() * 260) + 'ms');
            c.style.setProperty('--turns', String(3 + Math.floor(Math.random() * 3)));
            c.classList.add(isBei ? 'toss-bei' : 'toss-zi');
        });
    }
    async revealLine(i, withCoins) {
        if (this.dead) return;
        const line = this.hexLines[i];
        const moving = this.change.changingYaos.includes(i);
        if (withCoins) {
            haptic(10);
            this.tossCoins(line);
            await sleep(880);
        }
        if (this.dead) return;
        const bar = this.buildEl.querySelector(`[data-i="${i}"]`);
        if (bar && bar.classList) {
            bar.classList.remove('empty');
            bar.classList.add((line === 7 || line === 9) ? 'yang' : 'yin', 'drop');
            if (moving) bar.classList.add('chg');
        }
        const typeText = YAO_TYPE_CN[line] + (moving ? '，动爻' : '');
        const bei = LINE_TO_BEI[line];
        this.setStatus(`${yaoLabel(line, i)}　${typeText}`,
            withCoins ? `${bei} 枚背面朝上` : `第${'一二三四五六'[i]}爻`);
        if (typeof Cosmos !== 'undefined') Cosmos.eliminate(i, shaoBit(this.value, i));
        // 坐标轴标签：前三爻筛下卦（行），后三爻筛上卦（列）
        const axis = i < 3 ? '.grid-rows' : '.grid-cols';
        const tri = i < 3 ? (this.value >> 3) : (this.value & 7);
        const bitPos = i < 3 ? 2 - i : 5 - i;
        const labels = this.stage.querySelectorAll ? this.stage.querySelectorAll(`${axis} span`) : [];
        Array.from(labels).forEach(el => {
            const t = Number(el.dataset.t);
            if (((t >> bitPos) & 1) !== ((tri >> bitPos) & 1)) el.classList.add('out');
        });
        const left = 64 >> (i + 1);
        this.countEl.textContent = left === 1 ? '余此一卦' : `余 ${toChineseNum(left)} 卦`;
        await sleep(withCoins ? 420 : 620);
    }
    async actSettle() {
        if (this.dead) return;
        if (typeof Cosmos !== 'undefined') Cosmos.mark(this.value);
        this.setStatus(this.finalGua[0], this.change.hasChange && this.change.changeGua
            ? `动爻 ${this.change.changingYaos.length} 处，变为${this.change.changeGua[0]}` : '六爻皆静');
        this.chosenCard = { cosmosValue: this.value };
        await sleep(1200);
        if (this.stage.classList) this.stage.classList.add('settling');
        await sleep(320);
    }
}

// 起卦前的一句开场：首页内容依次退场，句子逐字浮现在圆心
async function showInvocation() {
    document.body.classList.add('casting');
    const text = '心若不诚，卦不应人';
    const inv = document.createElement('div');
    inv.className = 'invocation';
    inv.innerHTML = '<p>' + text.split('').map((ch, i) => `<span style="--k:${i}">${ch}</span>`).join('') + '</p>';
    document.body.appendChild(inv);
    await sleep(1650);
    inv.classList.add('fade-out');
    await sleep(380);
    inv.remove();
    document.body.classList.remove('casting');
}
