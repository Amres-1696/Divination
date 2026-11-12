// ritual —— 起卦仪式(HexRitual)：圆图当刻度盘 → 六次掷钱、每爻去掉半段弧 → 剩下一卦
// 卦象在仪式前已经算好（铜钱随机或生辰取数），仪式负责把它一爻一爻揭出来。
// 只用 style / classList / sleep 和可选的 Cosmos，测试环境里也能跑完。


class HexRitual {
    // mode：'full' 一爻一爻掷；'quick' 点一次六爻连掷，各处停顿也短一些
    constructor(stage, finalGua, hexLines, change, method, mode) {
        this.stage = stage;
        this.finalGua = finalGua;
        this.hexLines = hexLines;
        this.change = change;
        this.method = method === 'bazi' ? 'bazi' : 'coin';
        this.quick = mode === 'quick';
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
        // 圆心那一块：状态、铜钱、正在长出来的卦、掷钱按钮。圆图（Cosmos）以它的中心为圆心
        this.stage.innerHTML = `
<div class="ritual-head">
  <button type="button" class="ritual-skip" id="ritualSkip">跳过，直接看结果</button>
</div>
<div class="dial-core" id="dialCenter">
  <p class="ritual-status" id="ritualStatus" aria-live="polite"></p>
  <div class="coins" id="coins">${buildCoin()}${buildCoin()}${buildCoin()}</div>
  <div class="cast-build" id="castBuild">${buildHexBars(null, [], 'hx-build')}</div>
  <div class="cast-actions" id="castActions"></div>
</div>
<p class="sr-only" id="gridCount" aria-live="polite"></p>`;
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
        const html = `<span class="ritual-status-main">${main}</span>` +
            (sub ? `<span class="ritual-status-sub">${sub}</span>` : '');
        this.statusEl.innerHTML = html;
    }
    async actUnfold() {
        if (this.dead) return;
        this.setStatus('六十四卦', '每定一爻，圆图去其半');
        if (typeof Cosmos !== 'undefined') Cosmos.toDial();
        await sleep(this.quick ? 250 : 450);
        if (this.stage.classList) this.stage.classList.remove('pre');
        await sleep(this.quick ? 500 : 900);
    }
    async actCast() {
        if (this.method === 'bazi') {
            this.setStatus('依生辰取数', '生辰起卦不掷钱，六爻由生辰和所问推出');
            await sleep(this.quick ? 350 : 700);
            for (let i = 0; i < 6; i++) await this.revealLine(i, false);
            return;
        }
        const wide = (window.innerWidth || 1000) > 768;
        if (this.quick) this.setStatus('六爻连掷', wide ? '点「掷钱」或按空格，六爻自下而上一次掷完' : '点「掷钱」，六爻自下而上一次掷完');
        else this.setStatus('第一爻', wide ? '点「掷钱」或按空格，自下而上掷六次' : '点「掷钱」，自下而上掷六次');
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
                // 快掷：不等下一次点击，接着把剩下的爻掷完
                while (this.quick && this.cast < 6 && !this.dead) {
                    await this.revealLine(this.cast, true);
                    this.cast++;
                }
                if (this.dead) return;
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
            c.style.setProperty('--dur', (this.quick ? 300 + Math.random() * 100 : 560 + Math.random() * 260) + 'ms');
            c.style.setProperty('--turns', String(this.quick ? 2 + Math.floor(Math.random() * 2) : 3 + Math.floor(Math.random() * 3)));
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
            await sleep(this.quick ? 430 : 880);
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
        const left = 64 >> (i + 1);
        const leftText = left === 1 ? '余此一卦' : `余 ${toChineseNum(left)} 卦`;
        this.countEl.textContent = leftText;
        // 圆图转到位要花的时间。掷钱时下一爻等人来点；生辰起卦是自己往下走的，
        // 得等这一下转完再出下一爻，不然圆图转到一半又被拽去别处，来回晃
        const turn = withCoins ? (this.quick ? 420 : 900) : (this.quick ? 320 : 600);
        if (typeof Cosmos !== 'undefined') Cosmos.narrow(i, shaoBit(this.value, i), leftText, turn);
        if (!withCoins) { await sleep(turn + (this.quick ? 60 : 200)); return; }
        await sleep(this.quick ? 150 : 420);
    }
    async actSettle() {
        if (this.dead) return;
        if (typeof Cosmos !== 'undefined') Cosmos.settle(this.value, '余此一卦');
        this.setStatus(this.finalGua[0], this.change.hasChange && this.change.changeGua
            ? `动爻 ${this.change.changingYaos.length} 处，变为${this.change.changeGua[0]}` : '六爻皆静');
        this.chosenCard = { cosmosValue: this.value };
        await sleep(this.quick ? 700 : 1200);
        if (this.stage.classList) this.stage.classList.add('settling');
        await sleep(320);
    }
}

// 起卦前的一句开场：首页内容依次退场，句子逐字浮现在圆心。
// 每次打开页面只出现一次，之后起卦只留首页退场的那一小段；出现时点一下或按 Esc 可以直接过去
let _invocationShown = false;
async function showInvocation() {
    document.body.classList.add('casting');
    if (_invocationShown) {
        await sleep(420);
        document.body.classList.remove('casting');
        return;
    }
    _invocationShown = true;
    // 写了问题：所问既定；没写：默念所问
    const asked = (document.getElementById('question') || {}).value;
    const text = asked && asked.trim() ? '所问既定，六爻将起' : '默念所问，六爻将起';
    const inv = document.createElement('div');
    inv.className = 'invocation';
    inv.innerHTML = '<p>' + text.split('').map((ch, i) => `<span style="--k:${i}">${ch}</span>`).join('') + '</p>';
    document.body.appendChild(inv);
    let dismiss = () => {};
    const tapped = new Promise(resolve => { dismiss = resolve; });
    // 不听回车和空格：起卦本身就是回车触发的，那一下按键还在往上冒泡
    const onKey = e => { if (e.key === 'Escape') dismiss(); };
    inv.addEventListener('click', () => dismiss());
    document.addEventListener('keydown', onKey);
    await Promise.race([sleep(1650), tapped]);
    if (document.removeEventListener) document.removeEventListener('keydown', onKey);
    inv.classList.add('fade-out');
    await sleep(380);
    inv.remove();
    document.body.classList.remove('casting');
}
