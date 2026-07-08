// ritual —— 六幕发牌仪式(ArcanaRitual)与「心若不诚」开场白

class ArcanaRitual {
    constructor(stage, finalGua, hexLines, change) {
        this.stage = stage;
        this.finalGua = finalGua;
        this.hexLines = hexLines;
        this.change = change;
        this.cards = [];
    }
    async run() {
        this.buildStage();
        await this.actAwaken();
        await this.actRiffle();
        await this.actFan();
        await this.actChoose();
        await this.actRise();
        await this.actFlip();
        await this.actProclaim();
    }
    buildStage() {
        this.stage.innerHTML = `
<div class="ritual-status" id="ritualStatus"></div>
<div class="deck-area" id="deckArea"></div>
<button type="button" class="ritual-skip" id="ritualSkip">跳过仪式 ›</button>`;
        this.statusEl = this.stage.querySelector('#ritualStatus');
        this.deckEl = this.stage.querySelector('#deckArea');
        const skipBtn = this.stage.querySelector('#ritualSkip');
        if (skipBtn) skipBtn.addEventListener('click', () => { if (this._onSkip) this._onSkip(); });
    }
    setStatus(roman, cn) {
        this.statusEl.innerHTML = `${roman}<span class="ritual-status-sub">${cn}</span>`;
        this.statusEl.classList.add('show');
    }
    async actAwaken() {
        this.setStatus('Ⅰ · AWAKENING', '牌垫苏醒');
        await sleep(1200);
    }
    async actRiffle() {
        this.setStatus('Ⅱ · RIFFLE', '洗牌');
        const pool = this.pickDeckPool(DECK_POOL_SIZE);
        for (let i = 0; i < DECK_POOL_SIZE; i++) {
            const card = makeArcanaCard(pool[i], { large: false });
            card.style.transform = `translate3d(${(Math.random()-0.5)*6}px, ${(Math.random()-0.5)*6}px, ${-i*0.5}px) rotate(${(Math.random()-0.5)*4}deg)`;
            card.style.zIndex = String(i);
            this.deckEl.appendChild(card);
            this.cards.push(card);
        }
        await sleep(280);
        this.cards.forEach((c, i) => {
            setTimeout(() => {
                const side = i % 2 === 0 ? -1 : 1;
                c.style.transition = 'transform 0.6s cubic-bezier(0.4,0,0.2,1)';
                c.style.transform = `translate3d(${side*42}px, ${(Math.random()-0.5)*10}px, ${i*1.5}px) rotate(${side*5}deg)`;
            }, i * 28);
        });
        await sleep(750);
        this.cards.forEach((c, i) => {
            setTimeout(() => {
                c.style.transform = `translate3d(${(Math.random()-0.5)*4}px, ${(Math.random()-0.5)*4}px, ${-i*0.4}px) rotate(${(Math.random()-0.5)*3}deg)`;
            }, i * 16);
        });
        await sleep(600);
    }
    async actFan() {
        this.setStatus('Ⅲ · FAN', '扇形摊开');
        const n = this.cards.length;
        const isMob = window.innerWidth <= 768;
        const radius = isMob ? 180 : 240;
        const arc = isMob ? 140 : 110;     // 移动端加大弧度，牌间距更明显
        const rotMul = isMob ? 0.5 : 0.4;
        const center = (n - 1) / 2;
        this.cards.forEach((c, i) => {
            const t = n === 1 ? 0.5 : i / (n - 1);
            const angle = -arc/2 + t * arc;
            const rad = angle * Math.PI / 180;
            const x = Math.sin(rad) * radius;
            const y = -Math.cos(rad) * radius * 0.18 + 20;
            const rot = angle * rotMul;
            // z-index 围绕中心层叠：中央卡顶层、向两侧渐次后退
            const z = 40 - Math.round(Math.abs(i - center));
            // 存储扇形位置供选牌阶段使用
            c._fanX = x;
            c._fanY = y;
            c._fanRot = rot;
            c._fanZ = z;
            setTimeout(() => {
                c.style.transition = 'transform 1.05s cubic-bezier(0.4,0,0.2,1), opacity 0.8s ease, filter 0.8s ease';
                c.style.setProperty('--fan-x', x + 'px');
                c.style.setProperty('--fan-y', y + 'px');
                c.style.setProperty('--fan-rot', rot + 'deg');
                c.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`;
                c.style.zIndex = String(z);
                c.classList.add('awake');
            }, i * 45);
        });
        await sleep(1700);
    }
    async actChoose() {
        this.setStatus('CHOOSE · 心选一卦', '凝神择牌 · 轻触预览');
        const randomIdx = () => Math.floor(Math.random() * this.cards.length);

        // 「由天意定之」：从容的出口，不读秒、不催促
        const fateBtn = document.createElement('button');
        fateBtn.type = 'button';
        fateBtn.className = 'choose-fate-btn';
        fateBtn.textContent = '由天意定之';
        this.deckEl.appendChild(fateBtn);

        return new Promise(resolve => {
            let resolved = false;
            let candidateIndex = -1;

            const liftCard = (card) => {
                card.style.zIndex = '100';
                card.style.transition = 'transform 0.22s ease, filter 0.22s ease';
                card.style.transform = `translate3d(${card._fanX}px, ${card._fanY - 20}px, 0) rotate(${card._fanRot}deg) scale(1.08)`;
                card.style.filter = 'drop-shadow(0 8px 20px rgba(201,169,110,0.5))';
                card.classList.add('candidate');
            };
            const dropCard = (card) => {
                card.style.zIndex = String(card._fanZ);
                card.style.transition = 'transform 0.22s ease, filter 0.22s ease';
                card.style.transform = `translate3d(${card._fanX}px, ${card._fanY}px, 0) rotate(${card._fanRot}deg)`;
                card.style.filter = '';
                card.classList.remove('candidate');
            };

            const cleanup = () => {
                fateBtn.remove();
                this.cards.forEach(c => {
                    c.classList.remove('selectable', 'candidate');
                    c.style.cursor = '';
                    if (c._chooseHandler) {
                        c.removeEventListener('click', c._chooseHandler);
                        delete c._chooseHandler;
                    }
                });
            };
            const settle = (idx) => {
                if (resolved) return;
                resolved = true;
                this.chosenIndex = idx;
                cleanup();
                resolve();
            };

            // 两段式（桌面 / 移动一致）：点击成为候选（上浮预览），再次点击同一张落定
            // 避免桌面端「悬停即选、误触即定终身」
            this.cards.forEach((c, i) => {
                c.classList.add('selectable');
                c.style.cursor = 'pointer';
                const handler = () => {
                    if (candidateIndex === i) {
                        haptic(15);
                        settle(i);
                    } else {
                        if (candidateIndex >= 0 && this.cards[candidateIndex]) dropCard(this.cards[candidateIndex]);
                        haptic(8);
                        candidateIndex = i;
                        liftCard(c);
                        this.setStatus('CHOOSE · 心选一卦', '再触此卦 · 落定');
                    }
                };
                c._chooseHandler = handler;
                c.addEventListener('click', handler);
            });

            fateBtn.addEventListener('click', () => { haptic(12); settle(randomIdx()); });
        });
    }
    async actRise() {
        this.setStatus('Ⅳ · ASCENSION', '浮升抽牌');
        const mid = (typeof this.chosenIndex === 'number')
            ? this.chosenIndex
            : Math.floor(this.cards.length / 2);
        const chosen = this.cards[mid];
        this.cards.forEach((c, i) => {
            if (i === mid) return;
            c.style.transition = 'transform 1.3s ease, opacity 1.3s ease, filter 1s ease';
            c.style.opacity = '0.22';
            c.classList.remove('awake');
        });
        await sleep(450);
        const bin = TRIGRAM_TO_BINARY[this.finalGua[2][0]] + TRIGRAM_TO_BINARY[this.finalGua[2][1]];
        const finalCard = makeArcanaCard(this.finalGua, {
            large: true,
            hexLines: this.hexLines,
            changingYaos: this.change.changingYaos,
            rare: isRareGua(bin)
        });
        chosen.innerHTML = finalCard.innerHTML;
        chosen.className = finalCard.className + ' active';
        chosen.style.transition = 'transform 1.4s cubic-bezier(0.3, 0, 0.2, 1), filter 1s ease, width 0.8s ease, height 0.8s ease';
        chosen.style.width = '110px';
        chosen.style.height = '188px';
        chosen.style.marginLeft = '-55px';
        chosen.style.marginTop = '-94px';
        chosen.style.transform = 'translate3d(0, -20px, 60px) rotate(0deg) scale(1.15)';
        chosen.style.zIndex = '50';
        this.chosenCard = chosen;
        await sleep(1050);
    }
    async actFlip() {
        this.setStatus('Ⅴ · REVELATION', '翻开显影');
        this.chosenCard.style.transition = 'transform 0.65s ease, filter 0.65s ease';
        this.chosenCard.style.transform = 'translate3d(0, -10px, 60px) rotate(0deg) scale(1.10)';
        this.chosenCard.style.filter = 'drop-shadow(0 0 6px rgba(244,196,122,0.4))';
        await sleep(800);
        this.chosenCard.style.transform = 'translate3d(0, -20px, 60px) rotate(0deg) scale(1.15)';
        this.chosenCard.style.filter = '';
        haptic(25);
        this.chosenCard.classList.add('flipped');
        this.chosenCard.classList.remove('active');
        this.chosenCard.classList.add('peak');
        await sleep(800);
        this.chosenCard.classList.add('yao-animate');
        await sleep(900);
    }
    async actProclaim() {
        this.setStatus('Ⅵ · PROCLAMATION', '昭示归寂');
        await sleep(800);
        this.cards.forEach((c, i) => {
            if (c === this.chosenCard) return;
            c.style.transition = 'transform 1s ease, opacity 1s ease';
            c.style.opacity = '0';
            c.style.transform = `translate3d(${(Math.random()-0.5)*40}px, 60px, -200px) rotate(${(Math.random()-0.5)*20}deg)`;
        });
        await sleep(700);
        this.statusEl.style.transition = 'opacity 0.8s ease';
        this.statusEl.style.opacity = '0';
        await sleep(550);
    }
    pickDeckPool(n) {
        const indices = Array.from({ length: 64 }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        return indices.slice(0, n).map(idx => GUA[idx]);
    }
}

// 占卜主流程 
async function showInvocation() {
    const inv = document.createElement('div');
    inv.className = 'invocation';
    inv.innerHTML = '<span>心若不诚 · 卦不应人</span>';
    document.body.appendChild(inv);
    await sleep(1500);
    inv.classList.add('fade-out');
    await sleep(400);
    inv.remove();
}
