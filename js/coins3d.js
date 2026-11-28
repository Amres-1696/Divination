// coins3d —— 起卦时的三枚黄铜钱（three.js 实时渲染）
// 质感、动作都照宣传片：同一套高度图烘的贴图、同一个场景拍的环境图、同一套下落公式（往下丢、约一圈翻转、落地一跳、转着停稳）。
// three.js 和贴图不进首屏：页面一加载完就在后台取（约 400 KB；大多数人进来就先掷一把，不能等「闲下来」）。
// 掷钱时还没取到、浏览器不支持 WebGL、或者系统设了「减少动态效果」，就还用原来的平面铜钱（ritual.js 的 tossCoins）。卦象在掷之前就定好了，这里只负责把它掷出来：每枚落成哪一面由传进来的爻决定。
const Coins3D = (() => {
    const FPS = 30, G = 9.81;
    const R = 118 / 2 * 0.40 / 1920;           // 铜钱半径（米）：和宣传片同一个尺寸，镜头按网页上的像素换算
    const DIAM = 2 * R, T = R * 0.21, HOLE = R * 0.27;
    const CAM_H = 0.55;                         // 镜头离桌面：近一点，落下时由大变小、偏离中心的铜钱看得到侧边厚度
    const HOP1 = 2;
    const VER = '1';
    const contactH = tilt => R * Math.sin(Math.abs(tilt)) + (T / 2) * Math.cos(tilt);
    let THREE = null, assets = null, loading = null;

    function base() { return new URL('coins3d/', document.baseURI).href; }
    function usable() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return false;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
        try {
            const c = document.createElement('canvas');
            return !!(c.getContext && c.getContext('webgl2'));
        } catch (e) { return false; }
    }
    function preload() {
        if (loading) return loading;
        if (!usable()) return (loading = Promise.resolve(false));
        loading = (async () => {
            const B = base();
            THREE = await import(B + 'three.module.min.js');
            const { RGBELoader } = await import(B + 'RGBELoader.js');
            const tl = new THREE.TextureLoader();
            const tex = (name, srgb) => new Promise((res, rej) => tl.load(`${B}tex/${name}?v=${VER}`, t => {
                t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; res(t);
            }, undefined, rej));
            const [env, ziC, ziR, ziN, beiC, beiR, beiN] = await Promise.all([
                new RGBELoader().loadAsync(`${B}tex/env.hdr?v=${VER}`),
                tex('zi_color.webp', true), tex('zi_rough.png'), tex('zi_normal.png'),
                tex('bei_color.webp', true), tex('bei_rough.png'), tex('bei_normal.png'),
            ]);
            env.mapping = THREE.EquirectangularReflectionMapping;
            // 对着宣传片的静止铜钱调过：铜色压掉一点红，粗糙度整体抬一点
            const TINT = new THREE.Color(0.86, 0.95, 1.0);
            const face = (map, rough, normal) => new THREE.MeshStandardMaterial({ map, roughnessMap: rough, normalMap: normal, color: TINT, metalness: 1, roughness: 1.22 });
            assets = {
                env, geo: coinGeometry(),
                mats: [face(ziC, ziR, ziN), face(beiC, beiR, beiN),
                    new THREE.MeshStandardMaterial({ color: new THREE.Color(0.16, 0.115, 0.055).multiply(TINT), metalness: 1, roughness: 0.6 })],
            };
            return true;
        })().catch(() => { assets = null; return false; });
        return loading;
    }
    const ready = () => !!assets;
    const pending = () => !!loading && !assets;   // 正在取

    function coinGeometry() {
        const V = (x, y, z) => new THREE.Vector3(x, y, z);
        const shape = new THREE.Shape(); shape.absarc(0, 0, R, 0, Math.PI * 2, false);
        const hole = new THREE.Path();
        hole.moveTo(-HOLE, -HOLE); hole.lineTo(-HOLE, HOLE); hole.lineTo(HOLE, HOLE); hole.lineTo(HOLE, -HOLE); hole.lineTo(-HOLE, -HOLE);
        shape.holes.push(hole);
        const bt = 0.00014;
        const g = new THREE.ExtrudeGeometry(shape, { depth: T - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: bt, bevelSegments: 3, curveSegments: 96 });
        g.translate(0, 0, -(T - 2 * bt) / 2);
        const pos = g.attributes.position, uv = g.attributes.uv;
        for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / DIAM + 0.5, pos.getY(i) / DIAM + 0.5);
        g.computeVertexNormals();
        // 按三角形朝向分三组：字面（+Z）、背面（−Z）、边与孔壁
        const n = pos.count, buckets = [[], [], []];
        const a = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0), fn = V(0, 0, 0);
        for (let i = 0; i < n; i += 3) {
            a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
            fn.subVectors(c, b).cross(a.clone().sub(b)).normalize();
            buckets[fn.z > 0.9 ? 0 : fn.z < -0.9 ? 1 : 2].push(i);
        }
        const out = new THREE.BufferGeometry(), attrs = { position: 3, normal: 3, uv: 2 }, arrays = {};
        for (const k in attrs) arrays[k] = new Float32Array(n * attrs[k]);
        let w = 0;
        buckets.forEach((list, gi) => {
            const start = w;
            for (const i of list) for (let k = 0; k < 3; k++, w++)
                for (const key in attrs) for (let d = 0; d < attrs[key]; d++) arrays[key][w * attrs[key] + d] = g.attributes[key].array[(i + k) * attrs[key] + d];
            out.addGroup(start, w - start, gi);
        });
        for (const k in attrs) out.setAttribute(k, new THREE.BufferAttribute(arrays[k], attrs[k]));
        g.dispose();
        return out;
    }

    // 一把：三枚的落点、先后、来向（单位米）。quick 时三枚落得更紧
    function makeThrow(faces, quick) {
        const u = (a, b) => a + (b - a) * Math.random();
        const V = (x, y) => new THREE.Vector3(x, y, 0);
        // 落点：散在一个扁椭圆里，两两不挨着，三点不成一条线
        let pts;
        for (let tries = 0; tries < 400; tries++) {
            pts = [0, 1, 2].map(() => { const a = u(0, Math.PI * 2), r = Math.sqrt(Math.random()); return V(Math.cos(a) * r * 1.9 * DIAM, Math.sin(a) * r * 0.45 * DIAM); });
            const ok = pts.every((p, i) => pts.every((q, j) => i >= j || p.distanceTo(q) > 1.2 * DIAM));
            const area = Math.abs((pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[2].x - pts[0].x) * (pts[1].y - pts[0].y)) / 2;
            if (ok && area > 0.25 * DIAM * DIAM) break;
        }
        const cen = pts.reduce((s, p) => s.add(p), V(0, 0)).multiplyScalar(1 / 3);
        pts.forEach(p => p.sub(cen));
        const hand = u(0, Math.PI * 2);
        const order = [0, 1, 2].sort(() => Math.random() - .5);
        const delay = [0, 0, 0];
        let acc = 0;
        order.forEach((j, k) => { if (k) acc += u(1.5, 4.5) * (quick ? 0.6 : 1); delay[j] = acc; });
        return pts.map((land, j) => {
            const dirA = hand + u(-0.25, 0.25);
            // 手在画框外、靠近镜头的高处：离手时投到画面上已经在画框外，先大后小地砸进来
            const z0 = u(0.30, 0.37), v0 = u(0.15, 0.40);
            const reach = 6.5 * DIAM * u(0.95, 1.1) * (CAM_H - z0) / CAM_H;
            const tf = (-v0 + Math.sqrt(v0 * v0 + 2 * G * z0)) / G;
            return {
                face: faces[j], delay: delay[j], land, start: V(Math.cos(dirA) * reach, Math.sin(dirA) * reach),
                D: tf * FPS, v0, z0, turns: u(0.5, 1.1), settle: u(14, 17),
                yaw0: u(-Math.PI, Math.PI), yawDrift: u(-0.6, 0.6),
                delta: (u(5, 8) * Math.PI / 180) * (Math.random() < .5 ? 1 : -1), hand,
            };
        });
    }
    // 一枚的位姿（Blender 坐标，Z 朝上）。t 是这枚自己的帧（0 = 离手）
    function coinPose(c, t, out) {
        const V = (x, y, z) => new THREE.Vector3(x, y, z);
        const faceQ = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), c.face === 'zi' ? 0 : Math.PI);
        const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), Z = V(0, 0, 1);
        if (t <= c.D) {
            const tt = Math.max(t, 0) / FPS, uu = Math.max(t, 0) / c.D;
            const z = c.z0 - c.v0 * tt - 0.5 * G * tt * tt;
            const flip = c.delta + (1 - uu) * c.turns * 2 * Math.PI;
            qa.setFromAxisAngle(V(Math.cos(c.yaw0), Math.sin(c.yaw0), 0), flip);
            qb.setFromAxisAngle(Z, c.yaw0 + c.yawDrift * uu);
            out.q.copy(qa).multiply(qb).multiply(faceQ);
            out.p.copy(c.start).lerp(c.land, uu);
            out.p.z = Math.max(z, 0) + contactH(uu > 0.9 ? flip : 0);
            return out;
        }
        const S = c.settle, s = Math.min(t - c.D, S + 1);
        let hop = 0;
        if (s < HOP1) { const k = s / HOP1; hop = 0.5 * G * (HOP1 / FPS / 2) ** 2 / 2 * 4 * k * (1 - k); }
        let tilt = c.delta * (0.2 + 0.8 * Math.exp(-s)) * Math.max(0, 1 - s / S) ** 0.75;
        if (s > S - 0.01) tilt = 0;
        const phi = c.yaw0 + 0.6 * s + 3 * S / 2.5 * Math.min(s / S, 1) ** 2.5;
        qa.setFromAxisAngle(V(Math.cos(phi), Math.sin(phi), 0), tilt);
        qb.setFromAxisAngle(Z, c.yaw0 + c.yawDrift);
        out.q.copy(qa).multiply(qb).multiply(faceQ);
        out.p.copy(c.land); out.p.z = contactH(tilt) + hop;
        return out;
    }
    // 再掷时被拿走的一枚：往镜头这边提起来，朝新一把的来向带出画面
    function liftPose(c, t, len, hand, out) {
        coinPose(c, 999, out);
        const e = Math.min(1, Math.max(0, t / len)) ** 3;
        out.p.x += Math.cos(hand) * 0.10 * e; out.p.y += Math.sin(hand) * 0.10 * e;
        out.p.z = T / 2 + 0.24 * Math.sin(Math.PI / 2 * e);
        out.q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-Math.sin(hand), Math.cos(hand), 0), e * 1.2));
        return out;
    }

    // ---------------------------------------------------------------- 声音（宣传片同一套做法预渲的短音效，每段约 9 KB）
    let actx = null;
    const sfx = {};
    function soundOn() { return typeof loadSettings !== 'function' || loadSettings().coinSound !== false; }
    function audioWake() {
        if (!soundOn()) return;
        try {
            if (!actx) {
                actx = new (window.AudioContext || window.webkitAudioContext)();
                ['land0', 'land1', 'land2', 'land3', 'land4', 'land5', 'lift'].forEach(n =>
                    fetch(`${base()}sfx/${n}.mp3?v=${VER}`).then(r => r.arrayBuffer()).then(b => actx.decodeAudioData(b)).then(buf => { sfx[n] = buf; }).catch(() => {}));
            }
            if (actx.state === 'suspended') actx.resume();
        } catch (e) { actx = null; }
    }
    function play(name, pan, gain) {
        if (!actx || !sfx[name] || !soundOn()) return;
        try {
            const src = actx.createBufferSource(); src.buffer = sfx[name];
            const g = actx.createGain(); g.gain.value = gain;
            const p = actx.createStereoPanner ? actx.createStereoPanner() : null;
            if (p) { p.pan.value = pan; src.connect(g).connect(p).connect(actx.destination); } else src.connect(g).connect(actx.destination);
            src.start();
        } catch (e) {}
    }

    // ---------------------------------------------------------------- 台子：一张透明画布盖在铜钱那一格上，约 10 × 7 枚铜钱大
    function attach(slot, coinPx) {
        if (!assets) return null;
        const W = Math.round(coinPx * 10), H = Math.round(coinPx * 7);
        const canvas = document.createElement('canvas');
        canvas.className = 'coins-3d-canvas';
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
        } catch (e) { return null; }
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        renderer.setPixelRatio(dpr);
        renderer.setSize(W, H, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;             // 宣传片用 Blender 的 Standard，不压高光
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setClearColor(0x000000, 0);
        slot.classList.add('coins-3d');
        slot.appendChild(canvas);

        const pmrem = new THREE.PMREMGenerator(renderer);
        const envTex = pmrem.fromEquirectangular(assets.env).texture;
        pmrem.dispose();
        const scene = new THREE.Scene();
        scene.environment = envTex;
        scene.environmentIntensity = 0.66;
        scene.environmentRotation.set(0, Math.PI / 2, 0);
        const root = new THREE.Group(); root.rotation.x = -Math.PI / 2; scene.add(root);   // 里面全用 Blender 坐标（Z 朝上）
        const viewH = H * DIAM / coinPx;
        const cam = new THREE.PerspectiveCamera(2 * Math.atan(viewH / 2 / CAM_H) * 180 / Math.PI, W / H, 0.05, 5);
        cam.position.set(0, CAM_H, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
        // 太阳：方位 −45°、仰角 52°，只管投影（和宣传片一样）
        const az = -45 * Math.PI / 180, el = 52 * Math.PI / 180;
        const sun = new THREE.DirectionalLight(0xffffff, 0);
        sun.position.set(Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)).multiplyScalar(0.5);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        const half = viewH * W / H / 2 + 0.05;
        Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 0.01, far: 2 });
        sun.shadow.radius = 3; sun.shadow.bias = -0.0002;
        root.add(sun); root.add(sun.target);
        const floorMat = new THREE.ShadowMaterial({ opacity: 0.42 });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), floorMat);
        floor.receiveShadow = true; root.add(floor);
        const blobTex = (() => {
            const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
            const gr = x.createRadialGradient(32, 32, 10, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
            x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
        })();
        const blobGeo = new THREE.PlaneGeometry(R * 2.6, R * 2.6);
        const meshes = [], blobs = [];
        for (let j = 0; j < 6; j++) {          // 0–2 这一把，3–5 正被拿走的上一把
            const m = new THREE.Mesh(assets.geo, assets.mats); m.castShadow = true; m.visible = false; root.add(m); meshes.push(m);
            const b = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
            b.position.z = 0.00005; b.visible = false; root.add(b); blobs.push(b);
        }
        // 运动模糊：飞着的时候按快门 0.5 帧取 8 个时刻分别渲，再平均；停稳了直接渲到画布上
        const N = 8;
        const rts = Array.from({ length: N }, () => new THREE.WebGLRenderTarget(W * dpr, H * dpr, { type: THREE.HalfFloatType }));
        const avg = new THREE.ShaderMaterial({
            uniforms: Object.fromEntries(Array.from({ length: N }, (_, i) => ['t' + i, { value: rts[i].texture }]).concat([['n', { value: N }]])),
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
            fragmentShader: `varying vec2 vUv; uniform float n; ${Array.from({ length: N }, (_, i) => `uniform sampler2D t${i};`).join('')}
                vec3 toSrgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1./2.4)) - .055, step(vec3(.0031308), c)); }
                void main(){ vec4 s = vec4(0.); ${Array.from({ length: N }, (_, i) => `if (${i}. < n) s += texture2D(t${i}, vUv);`).join(' ')} s /= n;
                vec3 c = s.a > 0. ? s.rgb / s.a : vec3(0.); gl_FragColor = vec4(toSrgb(c) * s.a, s.a); }`,
            depthTest: false, depthWrite: false, blending: THREE.NoBlending,
        });
        const quadGeo = new THREE.PlaneGeometry(2, 2);
        const quadScene = new THREE.Scene(); quadScene.add(new THREE.Mesh(quadGeo, avg));
        const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const tmp = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
        // 预热：着色器编译、贴图上传、环境图和阴影都在搭台时做完（这时圆图正在展开，没人在掷），
        // 不然第一次掷钱的头几帧会卡一下
        try {
            meshes.slice(0, 3).forEach((m, j) => { m.visible = true; m.position.set((j - 1) * 1.5 * DIAM, 0, T / 2); });
            renderer.compile(scene, cam);
            renderer.compile(quadScene, quadCam);
            assets.mats.forEach(m => ['map', 'roughnessMap', 'normalMap'].forEach(k => m[k] && renderer.initTexture(m[k])));
            renderer.setRenderTarget(rts[0]); renderer.render(scene, cam);
            renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
            meshes.forEach(m => { m.visible = false; });
            renderer.render(scene, cam);
        } catch (e) { meshes.forEach(m => { m.visible = false; }); }
        function setMesh(j, show) {
            const m = meshes[j], b = blobs[j];
            m.visible = b.visible = show;
            if (!show) return;
            m.position.copy(tmp.p); m.quaternion.copy(tmp.q);
            b.position.x = tmp.p.x; b.position.y = tmp.p.y;
            const k = Math.min(1, Math.max(0, 1 - (tmp.p.z - T / 2) / 0.03));
            b.material.opacity = k; b.scale.setScalar(1 + (1 - k) * 0.6);
        }
        let state = null, t0 = 0, raf = 0, dead = false;
        const timers = [];
        function place(t) {
            state.cur.forEach((c, j) => { const lt = t - state.lead - c.delay; setMesh(j, lt >= 0 && (coinPose(c, lt, tmp), true)); });
            for (let j = 0; j < 3; j++) {
                const c = state.prev && state.prev[j];
                setMesh(3 + j, !!c && t < state.lift && (liftPose(c, t, state.lift, state.cur[0].hand, tmp), true));
            }
        }
        function frame() {
            raf = 0;
            if (dead || !state) return;
            const t = (performance.now() - t0) / 1000 * FPS;
            const moving = (state.prev && t < state.lift + 1) || state.cur.some(c => { const lt = t - state.lead - c.delay; return lt > -1 && lt < c.D + 3; });
            if (moving) {
                for (let i = 0; i < N; i++) {
                    place(t + (i / (N - 1) - 0.5) * 0.5);
                    renderer.setRenderTarget(rts[i]); renderer.clear(); renderer.render(scene, cam);
                }
                renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
            } else {
                place(t);
                renderer.setRenderTarget(null); renderer.render(scene, cam);
            }
            // 停稳之后再画一帧就不再画了，省电
            if (t < state.end) raf = requestAnimationFrame(frame);
        }
        return {
            // 掷一把：line 是这一爻（6 / 7 / 8 / 9），背面朝上的枚数照 LINE_TO_BEI。返回最后一枚着地还要多少毫秒
            toss(line, quick) {
                if (dead) return 0;
                audioWake();
                const bei = (typeof LINE_TO_BEI !== 'undefined' ? LINE_TO_BEI[line] : 0) || 0;
                const faces = [0, 1, 2].map(j => (j < bei ? 'bei' : 'zi')).sort(() => Math.random() - .5);
                const prev = state ? state.cur : null;
                const lift = quick ? 6 : 8, lead = prev ? (quick ? 3 : 5) : 0;
                const cur = makeThrow(faces, quick);
                const last = lead + Math.max(...cur.map(c => c.delay + c.D));
                state = { prev, cur, lift, lead, end: lead + Math.max(...cur.map(c => c.delay + c.D + c.settle)) + 2 };
                t0 = performance.now();
                timers.forEach(clearTimeout); timers.length = 0;
                if (prev) play('lift', 0, 0.9);
                const first = Math.min(...cur.map(c => c.delay + c.D));
                cur.forEach(c => {
                    const at = (lead + c.delay + c.D) / FPS * 1000;
                    timers.push(setTimeout(() => {
                        play('land' + Math.floor(Math.random() * 6), Math.max(-0.7, Math.min(0.7, c.land.x / (3 * DIAM))), c.delay + c.D === first ? 1 : 0.82);
                        if (c.delay + c.D === first && typeof haptic === 'function') haptic(12);
                    }, at));
                });
                if (!raf) raf = requestAnimationFrame(frame);
                return last / FPS * 1000;
            },
            destroy() {
                if (dead) return;
                dead = true;
                if (raf) cancelAnimationFrame(raf);
                timers.forEach(clearTimeout);
                rts.forEach(r => r.dispose()); avg.dispose(); quadGeo.dispose();
                blobs.forEach(b => b.material.dispose()); blobGeo.dispose(); blobTex.dispose();
                floor.geometry.dispose(); floorMat.dispose(); envTex.dispose();
                renderer.dispose(); renderer.forceContextLoss();
                canvas.remove();
                slot.classList.remove('coins-3d');
            },
        };
    }

    // 页面一加载完就取（开了省流量的除外：等到开始起卦再取）
    if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.addEventListener) {
        const later = () => {
            const save = navigator.connection && navigator.connection.saveData;
            if (save) return;
            setTimeout(() => preload(), 200);
        };
        if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
    }
    return { preload, ready, pending, attach, usable };
})();
