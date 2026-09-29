/* The AI Engineering Atlas: 16 Three.js figures drawn by ONE shared WebGL renderer.
   Browsers cap live WebGL contexts at ~16, so each figure is a 2D canvas that the shared renderer paints into. */
(function () {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $id = id => document.getElementById(id);
  const fail = msg => document.querySelectorAll('.stage').forEach(s => s.insertAdjacentHTML('beforeend', `<div class="nogl">${msg}</div>`));
  if (!window.THREE) return fail('3D figures need the Three.js library, which did not load. Everything else on the page still works.');
  let R;
  try { R = new THREE.WebGLRenderer({ antialias: true, alpha: true }); if (!R.getContext()) throw 0; }
  catch (e) { return fail('3D figures need WebGL, which is turned off in this browser. Everything else on the page still works.'); }
  R.setPixelRatio(1); R.setClearColor(0x000000, 0);

  const DPR = Math.min(devicePixelRatio || 1, 2);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const C = n => new THREE.Color(tok(n) || '#888888');
  const isLight = () => C('--bg').getHSL({}).l > .5;
  const blend = () => isLight() ? THREE.NormalBlending : THREE.AdditiveBlending;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const recolors = [];
  const paint = f => { recolors.push(f); f(); };
  onTheme(() => recolors.forEach(f => f()));
  document.fonts && document.fonts.ready.then(() => recolors.forEach(f => f()));
  const listen = (n, f) => { document.addEventListener(n, e => f(e.detail)); if (window.lastEvt && n in lastEvt) f(lastEvt[n]); };
  const emit = (n, d) => { if (window.lastEvt) lastEvt[n] = d; document.dispatchEvent(new CustomEvent(n, { detail: d })); };
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  /* ---------- shared renderer ---------- */
  const stages = [];
  let RW = 1, RH = 1;
  function stage(id, { fov = 40, ortho = 0 } = {}) {
    const cv = $id(id); if (!cv) return null;
    const s = { cv, g: cv.getContext('2d'), scene: new THREE.Scene(), visible: false, tick: null, w: 1, h: 1, ortho };
    s.camera = ortho ? new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 200) : new THREE.PerspectiveCamera(fov, 1, .1, 200);
    const resize = () => {
      const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
      s.w = w; s.h = h; cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
      const a = w / h;
      if (ortho) { const k = Math.max(1, 1.6 / a); Object.assign(s.camera, { left: -ortho * a * k, right: ortho * a * k, top: ortho * k, bottom: -ortho * k }); }
      else s.camera.aspect = a;
      s.camera.updateProjectionMatrix();
      s.onResize && s.onResize(w, h);
    };
    new ResizeObserver(resize).observe(cv); resize();
    new IntersectionObserver(([e]) => { s.visible = e.isIntersecting; if (s.visible && s.onShow) { s.onShow(); s.onShow = null; } }, { rootMargin: '150px' }).observe(cv);
    stages.push(s);
    return s;
  }
  function draw(s) {
    const w = s.cv.width, h = s.cv.height; if (w < 2 || h < 2) return;
    if (w > RW || h > RH) { RW = Math.max(RW, w); RH = Math.max(RH, h); R.setSize(RW, RH, false); }
    R.setViewport(0, 0, w, h); R.setScissor(0, 0, w, h); R.setScissorTest(true);
    R.clear(); R.render(s.scene, s.camera);
    s.g.clearRect(0, 0, w, h); s.g.drawImage(R.domElement, 0, RH - h, w, h, 0, 0, w, h);
  }
  function drag(s, obj, { auto = .12, pitch = 1, lim = .9 } = {}) {
    let down = false, px = 0, py = 0, last = -1e9;
    s.cv.addEventListener('pointerdown', e => { down = true; px = e.clientX; py = e.clientY; });
    addEventListener('pointerup', () => { down = false; });
    s.cv.addEventListener('pointercancel', () => { down = false; });
    s.cv.addEventListener('pointermove', e => {
      if (!down) return;
      obj.rotation.y += (e.clientX - px) * .008;
      if (pitch) obj.rotation.x = clamp(obj.rotation.x + (e.clientY - py) * .005, -lim, lim);
      px = e.clientX; py = e.clientY; last = performance.now();
    });
    return dt => { if (!down && !RM && performance.now() - last > 2000) obj.rotation.y += auto * dt; };
  }
  const ndc = (s, e) => { const r = s.cv.getBoundingClientRect(); return new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); };
  function onTap(s, fn) {
    let x = 0, y = 0;
    s.cv.addEventListener('pointerdown', e => { x = e.clientX; y = e.clientY; });
    s.cv.addEventListener('pointerup', e => { if (Math.hypot(e.clientX - x, e.clientY - y) < 6) fn(ndc(s, e)); });
  }

  /* ---------- primitives ---------- */
  const PV = `attribute vec3 aColor; attribute float aAlpha; attribute float aSize; uniform float uSize; uniform float uFlat;
    varying vec3 vC; varying float vA;
    void main(){ vC=aColor; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0);
      gl_PointSize=uSize*aSize*mix(10.0/-mv.z,1.0,uFlat); gl_Position=projectionMatrix*mv; }`;
  const PF = `uniform float uHard; varying vec3 vC; varying float vA;
    void main(){ float d=length(gl_PointCoord-0.5)*2.0; if(d>1.0) discard;
      float a=mix(pow(1.0-d,1.6),1.0-smoothstep(0.6,1.0,d),uHard); gl_FragColor=vec4(vC,a*vA); }`;
  function points(n, { size = 4, hard = 0, flat = 0 } = {}) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), al = new Float32Array(n).fill(1), sz = new Float32Array(n).fill(1);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(al, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    const mat = new THREE.ShaderMaterial({ uniforms: { uSize: { value: size * DPR }, uHard: { value: hard }, uFlat: { value: flat } }, vertexShader: PV, fragmentShader: PF, transparent: true, depthWrite: false });
    const obj = new THREE.Points(geo, mat); obj.frustumCulled = false;
    return {
      obj, pos, col, al, sz, geo, mat, n,
      up() { ['position', 'aColor', 'aAlpha', 'aSize'].forEach(k => { geo.attributes[k].needsUpdate = true; }); },
      set(i, v) { pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; },
      color(i, c) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; },
    };
  }
  function label(text, color, { px = 26, h = .3, weight = 500, mono = 0 } = {}) {
    const fam = mono ? (tok('--mono') || 'monospace') : (tok('--sans') || 'sans-serif');
    if (mono) text = text.toUpperCase();
    const cv = document.createElement('canvas'), g = cv.getContext('2d'), f = `${weight} ${px * 2}px ${fam}`;
    g.font = f;
    const w = Math.ceil(g.measureText(text).width) + 12;
    cv.width = w; cv.height = px * 2 + 12; g.font = f; g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 6, cv.height / 2);
    const t = new THREE.CanvasTexture(cv); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
    sp.scale.set(w / cv.height * h, h, 1); sp.renderOrder = 20; sp.userData = { text, opts: { px, h, weight, mono } };
    return sp;
  }
  function relabel(sp, color, text = sp.userData.text) {
    const n = label(text, color, sp.userData.opts);
    sp.material.map.dispose(); sp.material.map = n.material.map; sp.material.needsUpdate = true; sp.scale.copy(n.scale); sp.userData.text = text;
  }
  let GT;
  function glowTex() {
    if (GT) return GT;
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return (GT = new THREE.CanvasTexture(cv));
  }
  function glow(scale, opacity = .6) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, opacity }));
    sp.scale.setScalar(scale); sp.userData.o = opacity; return sp;
  }
  const setGlow = (sp, c) => { sp.material.color = c; sp.material.blending = blend(); sp.material.opacity = sp.userData.o * (isLight() ? .55 : 1); sp.material.needsUpdate = true; };
  const lmat = (opacity = 1) => new THREE.LineBasicMaterial({ transparent: true, opacity, depthWrite: false });
  const curveLine = (curve, n, mat) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(n)), mat);
  function segs(arr, mat) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return new THREE.LineSegments(g, mat); }
  const sphere = (r, seg = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * .75)), new THREE.MeshBasicMaterial({ transparent: true }));
  const pointsBlend = p => { p.mat.blending = blend(); p.mat.needsUpdate = true; };

  /* ======================= Fig 0 · hero globe ======================= */
  (function hero() {
    const s = stage('hero3d', { fov: 32 }); if (!s) return;
    const G = new THREE.Group(); s.scene.add(G); G.rotation.set(.32, -.6, 0);
    const RG = 3;
    const occ = new THREE.Mesh(new THREE.SphereGeometry(RG * .985, 64, 48), new THREE.MeshBasicMaterial());
    G.add(occ);
    const N = innerWidth < 700 ? 1600 : 3200, dots = points(N, { size: 1.15, hard: 1 });
    for (let i = 0; i < N; i++) { const y = 1 - i / (N - 1) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996323; dots.set(i, V(Math.cos(th) * r * RG, y * RG, Math.sin(th) * r * RG)); }
    G.add(dots.obj);
    const ll = (la, lo, r = RG) => { la *= Math.PI / 180; lo *= Math.PI / 180; return V(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.sin(lo) * r); };
    const NODES = [['Tokens', '--ctx', 38, -20], ['Embeddings', '--mem', 12, -52], ['Attention', '--model', 52, 30], ['Reasoning', '--model', 20, 70], ['RAG', '--mem', -18, -30], ['Context', '--ctx', -8, 20], ['Memory', '--mem', -40, -5], ['Tools', '--tool', 8, 125], ['MCP', '--tool', -22, 150], ['Agents', '--model', 30, 170], ['Harness', '--human', -10, -110], ['Guardrails', '--risk', -45, -140], ['Evals', '--tool', 48, -150], ['Multi-agent', '--model', 62, 110], ['Compute', '--fg2', -58, 80]];
    const nodes = NODES.map(([n, c, la, lo]) => {
      const p = ll(la, lo), m = sphere(.055, 12), gl = glow(.6, .75), lb = label(n, '#fff', { px: 20, h: .22, mono: 1 });
      m.position.copy(p); gl.position.copy(p); lb.position.copy(p.clone().multiplyScalar(1.12));
      G.add(m, gl, lb); return { n, c, p, m, gl, lb };
    });
    const EDGES = [[0, 1], [0, 2], [2, 3], [1, 4], [4, 5], [5, 6], [6, 10], [7, 8], [7, 9], [9, 10], [10, 11], [9, 13], [9, 12], [3, 9], [5, 10], [14, 2], [8, 10]];
    const arcs = EDGES.map(([a, b], k) => {
      const A = nodes[a].p, B = nodes[b].p, mid = A.clone().add(B).multiplyScalar(.5);
      mid.normalize().multiplyScalar(RG + .3 + A.distanceTo(B) * .22);
      const curve = new THREE.QuadraticBezierCurve3(A, mid, B), line = curveLine(curve, 48, lmat(.28));
      G.add(line); return { curve, line, a, ph: (k * .37) % 1, sp: .16 + (k % 5) * .03 };
    });
    const TR = 16, com = points(arcs.length * TR, { size: 3 }); G.add(com.obj);
    const halo = glow(11, .1); s.scene.add(halo);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RG * 1.3, .005, 6, 240), new THREE.MeshBasicMaterial({ transparent: true, opacity: .4 }));
    ring.rotation.set(Math.PI / 2 + .28, .18, 0); s.scene.add(ring);
    paint(() => {
      occ.material.color = C('--bg');
      const f3 = C('--fg3'); for (let i = 0; i < N; i++) { dots.color(i, f3); dots.al[i] = isLight() ? .5 : .55; } dots.up();
      nodes.forEach(o => { const c = C(o.c); o.m.material.color = c; setGlow(o.gl, c); relabel(o.lb, tok('--fg2')); });
      arcs.forEach((a, k) => { a.line.material.color = C('--fg3'); const c = C(nodes[a.a].c); for (let i = 0; i < TR; i++) com.color(k * TR + i, c); });
      setGlow(halo, C('--model')); ring.material.color = C('--fg3'); pointsBlend(com); com.up();
    });
    const tmp = new THREE.Vector3(), wp = new THREE.Vector3(), cp = new THREE.Vector3();
    const spin = drag(s, G, { auto: .07, lim: .6 });
    let mx = 0, my = 0;
    addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
    s.camera.position.set(0, 0, 13.5);
    s.tick = (dt, t) => {
      spin(dt);
      s.camera.position.x += (mx * 1.2 - s.camera.position.x) * .04; s.camera.position.y += (-my * .9 - s.camera.position.y) * .04; s.camera.lookAt(0, 0, 0);
      arcs.forEach((a, k) => {
        const u = RM ? -1 : ((t * a.sp + a.ph) % 1) * 1.6 - .3;
        for (let i = 0; i < TR; i++) {
          const v = u - i * .012, idx = k * TR + i;
          if (v < 0 || v > 1) { com.al[idx] = 0; continue; }
          a.curve.getPoint(v, tmp); com.set(idx, tmp); com.al[idx] = (1 - i / TR) * .95; com.sz[idx] = 1 - i / TR * .6;
        }
      });
      com.up();
      cp.copy(s.camera.position).normalize();
      nodes.forEach(o => { o.m.getWorldPosition(wp); const f = clamp((wp.normalize().dot(cp) - .1) * 3); o.lb.material.opacity = f; });
    };
  })();

  /* ======================= Fig 2.1 · neural network ======================= */
  (function nn() {
    const s = stage('nn3d'); if (!s) return;
    seed = 11;
    const sizes = [5, 7, 7, 4], X = [-4.5, -1.5, 1.5, 4.5];
    const net = new THREE.Group(); s.scene.add(net);
    const L = sizes.map((n, l) => Array.from({ length: n }, (_, i) => {
      const m = sphere(.17, 20);
      m.position.set(X[l], (i - (n - 1) / 2) * .95, (i % 2 ? .45 : -.45) * (l % 2 ? 1 : -1));
      net.add(m); return { m, a: 0, t: 0 };
    }));
    const W = sizes.slice(1).map((n, l) => Array.from({ length: n }, () => Array.from({ length: sizes[l] }, () => rnd() * 2 - 1)));
    const lp = [];
    for (let l = 0; l < sizes.length - 1; l++) L[l].forEach(a => L[l + 1].forEach(b => lp.push(...a.m.position.toArray(), ...b.m.position.toArray())));
    const lines = segs(lp, lmat(.2)); net.add(lines);
    const PU = points(80, { size: 3.5 }); net.add(PU.obj);
    const pulses = [];
    let dim, hot, out;
    paint(() => { dim = C('--line2'); hot = C('--model'); out = C('--tool'); lines.material.color = C('--fg3'); const c = C('--ctx'); for (let i = 0; i < 80; i++) PU.color(i, c); pointsBlend(PU); });
    const EX = [['a cat', [.86, .09, .03, .02]], ['a dog', [.07, .88, .03, .02]], ['a bird', [.04, .05, .89, .02]], ['a car', [.02, .03, .04, .91]]], OUT = ['cat', 'dog', 'bird', 'car'];
    const hud = $id('nnHud');
    let ex = 0, t = 99, fired = [];
    function fire() { ex = (ex + 1) % EX.length; t = 0; fired = [0, 0, 0, 0]; L.flat().forEach(n => { n.t = 0; }); hud.textContent = `input: photo of ${EX[ex][0]} → …`; }
    function layer(l) {
      if (l === 0) L[0].forEach(n => { n.t = .2 + rnd() * .8; });
      else if (l === sizes.length - 1) L[l].forEach((n, i) => { n.t = EX[ex][1][i]; });
      else L[l].forEach((n, i) => { const z = W[l - 1][i].reduce((a, w, j) => a + w * L[l - 1][j].t, 0); n.t = 1 / (1 + Math.exp(-z * 2)); });
      if (l < sizes.length - 1) L[l].forEach(a => { if (a.t > .55) L[l + 1].forEach(b => { if (pulses.length < 80 && rnd() < .5) pulses.push({ a: a.m.position, b: b.m.position, k: 0 }); }); });
      if (l === sizes.length - 1) hud.innerHTML = `input: photo of ${EX[ex][0]}<br>` + OUT.map((o, i) => `${o} <b>${(EX[ex][1][i] * 100).toFixed(0)}%</b>`).join(' · ');
    }
    $id('nnFire').onclick = fire;
    const spin = drag(s, net, { auto: .1 });
    s.camera.position.set(0, 1.2, 10); s.camera.lookAt(0, 0, 0); net.rotation.y = -.35;
    let auto = 0;
    const tc = new THREE.Color(), tv = new THREE.Vector3();
    s.tick = dt => {
      spin(dt); t += dt; auto += dt;
      if (auto > 5 && !RM) { auto = 0; fire(); }
      for (let l = 0; l < sizes.length; l++) if (!fired[l] && t > l * .75) { fired[l] = 1; layer(l); }
      L.forEach((ly, l) => ly.forEach(n => { n.a += (n.t - n.a) * Math.min(1, dt * 6); n.m.material.color.copy(tc.copy(dim).lerp(l === sizes.length - 1 ? out : hot, n.a)); n.m.scale.setScalar(1 + n.a * .5); }));
      for (let i = pulses.length - 1; i >= 0; i--) { pulses[i].k += dt * 1.4; if (pulses[i].k >= 1) pulses.splice(i, 1); }
      for (let i = 0; i < 80; i++) { const p = pulses[i]; if (!p) { PU.al[i] = 0; continue; } tv.lerpVectors(p.a, p.b, p.k); PU.set(i, tv); PU.al[i] = 1; }
      PU.up();
    };
    setTimeout(fire, 300);
  })();

  /* ======================= Fig 2.2 · loss landscape ======================= */
  (function loss() {
    const s = stage('loss3d'); if (!s) return;
    const f = (x, z) => .035 * (x * x + z * z) - 1.3 * Math.exp(-((x - 1.6) ** 2 + (z - 1.1) ** 2) / 1.6) - .8 * Math.exp(-((x + 2.1) ** 2 + (z + 1.6) ** 2) / .9) + .18 * Math.sin(1.3 * x) * Math.cos(1.1 * z);
    const H = 1.4, g = new THREE.Group(); s.scene.add(g);
    const geo = new THREE.PlaneGeometry(10, 10, 90, 90); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, hs = [];
    for (let i = 0; i < p.count; i++) { const y = f(p.getX(i), p.getZ(i)) * H; p.setY(i, y); hs.push(y); }
    const lo = Math.min(...hs), hi = Math.max(...hs), colors = new Float32Array(p.count * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const surf = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: .92 }));
    const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: .14 }));
    g.add(surf, wire);
    const ball = sphere(.18, 24), bg = glow(1.3, .8); ball.add(bg); g.add(ball);
    const MAXP = 400, tp = new Float32Array(MAXP * 3), tgeo = new THREE.BufferGeometry();
    tgeo.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tgeo.setDrawRange(0, 0);
    const trail = new THREE.Line(tgeo, lmat(.9)); g.add(trail);
    paint(() => {
      const a = C('--ctx'), b = C('--mem'), c = C('--model'), base = C('--bg'), t = new THREE.Color();
      hs.forEach((y, i) => { const k = (y - lo) / (hi - lo); if (k < .5) t.copy(a).lerp(b, k * 2); else t.copy(b).lerp(c, (k - .5) * 2); t.lerp(base, .35); colors.set([t.r, t.g, t.b], i * 3); });
      geo.attributes.color.needsUpdate = true;
      wire.material.color = C('--fg'); ball.material.color = C('--fg'); setGlow(bg, C('--fg')); trail.material.color = C('--fg');
    });
    let x = 4, z = -3.5, n = 0, run = false, acc = 0;
    const cur = V(x, f(x, z) * H + .2, z), hud = $id('lossHud'), lr = $id('lossLr');
    lr.oninput = () => { $id('lossLrOut').textContent = (+lr.value).toFixed(2); };
    seed = 5;
    function drop() {
      const a = rnd() * Math.PI * 2; x = Math.cos(a) * 4.3; z = Math.sin(a) * 4.3; n = 0; run = true; acc = 0;
      cur.set(x, f(x, z) * H + .2, z); tp.set([x, f(x, z) * H + .08, z], 0); tgeo.setDrawRange(0, 1);
    }
    $id('lossDrop').onclick = drop;
    const spin = drag(s, g, { auto: .06, lim: .6 });
    s.camera.position.set(0, 7, 10); s.camera.lookAt(0, -.6, 0);
    const tgt = V(0, 0, 0);
    s.tick = dt => {
      spin(dt);
      if (run) {
        acc += dt;
        while (acc > .07 && run) {
          acc -= .07;
          const h = 1e-3, gx = (f(x + h, z) - f(x - h, z)) / (2 * h), gz = (f(x, z + h) - f(x, z - h)) / (2 * h);
          const k = +lr.value, nx = clamp(x - k * gx, -5, 5), nz = clamp(z - k * gz, -5, 5), moved = Math.hypot(nx - x, nz - z);
          x = nx; z = nz; n++;
          if (n < MAXP) tp.set([x, f(x, z) * H + .08, z], n * 3);
          tgeo.setDrawRange(0, Math.min(n + 1, MAXP)); tgeo.attributes.position.needsUpdate = true;
          if ((moved < 1e-3 && n > 5) || n > 240) run = false;
        }
        hud.innerHTML = `step <b>${n}</b> · loss <b>${f(x, z).toFixed(3)}</b>${run ? '' : (f(x, z) < -1 ? '<br>found the deep valley' : '<br>settled in a shallow valley')}`;
      }
      cur.lerp(tgt.set(x, f(x, z) * H + .2, z), Math.min(1, dt * 10));
      ball.position.copy(cur);
    };
    ball.position.copy(cur);
    s.onShow = drop;
  })();

  /* ======================= Fig 3.2 · embeddings ======================= */
  (function emb() {
    const s = stage('emb3d'); if (!s) return;
    const W = {
      '--model': { man: [-3.2, -1.4, 1.2], woman: [-3.2, .2, 1.2], boy: [-3.9, -1.2, .4], girl: [-3.9, .4, .4], king: [-.8, -1.4, 2], queen: [-.8, .2, 2], prince: [-.1, -1.5, 2.8], princess: [-.1, .1, 2.8] },
      '--tool': { cat: [2.2, 1.6, -.8], kitten: [1.9, 2.3, -.4], dog: [3, 1.3, -1], puppy: [3.2, 2, -.5], lion: [2.4, .9, -1.9], tiger: [2.9, .6, -2.2] },
      '--ctx': { apple: [-2, 2.4, -2], banana: [-2.8, 2.8, -2.5], mango: [-2.4, 3.3, -1.8], orange: [-1.8, 3, -2.8] },
      '--mem': { python: [2.5, -2.2, 1.2], javascript: [3.2, -1.6, 1.9], code: [2.6, -1.3, 1.3], bug: [3.4, -2.5, 1.1], compiler: [2.1, -2.7, 2] },
      '--risk': { happy: [-.4, -2.6, -1.6], joyful: [-.8, -3, -1.2], sad: [.6, -3.3, -2.1], angry: [1, -2.8, -2.5] },
    };
    const g = new THREE.Group(); s.scene.add(g);
    const items = [];
    Object.entries(W).forEach(([c, ws]) => Object.entries(ws).forEach(([w, p]) => {
      const v = V(...p), dot = sphere(.075, 14), sp = label(w, '#fff', { px: 22, h: .26 });
      dot.position.copy(v); sp.position.copy(v).add(V(0, .24, 0)); g.add(dot, sp);
      items.push({ w, c, v, dot, sp });
    }));
    const links = segs([], lmat(.8)); g.add(links);
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(9, 8, 6)), lmat(.35)); g.add(box);
    const arrows = new THREE.Group(); g.add(arrows);
    let sel = 'king', analogy = false;
    function update() {
      const me = items.find(i => i.w === sel);
      const near = new Set(items.filter(i => i !== me).sort((a, b) => a.v.distanceTo(me.v) - b.v.distanceTo(me.v)).slice(0, 4).map(i => i.w));
      items.forEach(it => {
        const onn = analogy ? ['man', 'woman', 'king', 'queen'].includes(it.w) : it === me || near.has(it.w);
        it.sp.material.opacity = onn ? 1 : .2; it.dot.material.opacity = onn ? 1 : .3; it.dot.scale.setScalar(it === me && !analogy ? 1.8 : 1);
      });
      arrows.clear();
      if (analogy) {
        links.geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
        const P = w => items.find(i => i.w === w).v;
        const mk = (a, b, c) => { const d = P(b).clone().sub(P(a)); arrows.add(new THREE.ArrowHelper(d.clone().normalize(), P(a), d.length() - .1, C(c), .24, .12)); };
        mk('man', 'woman', '--mem'); mk('king', 'queen', '--mem'); mk('man', 'king', '--fg3'); mk('woman', 'queen', '--fg3');
      } else {
        const pts = []; items.filter(i => near.has(i.w)).forEach(i => pts.push(...me.v.toArray(), ...i.v.toArray()));
        links.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      }
    }
    const selEl = $id('embWord'), btn = $id('embAnalogy');
    selEl.innerHTML = items.map(i => `<option ${i.w === sel ? 'selected' : ''}>${i.w}</option>`).join('');
    selEl.onchange = () => { sel = selEl.value; analogy = false; btn.classList.remove('on'); update(); };
    btn.onclick = () => { analogy = !analogy; btn.classList.toggle('on', analogy); update(); };
    paint(() => { items.forEach(it => { relabel(it.sp, tok(it.c)); it.dot.material.color = C(it.c); }); links.material.color = C('--fg'); box.material.color = C('--line2'); update(); });
    const spin = drag(s, g, { auto: .1 });
    s.camera.position.set(0, 1, 11.5); s.camera.lookAt(0, 0, 0);
    s.tick = dt => spin(dt);
  })();

  /* ======================= Fig 4.2 · transformer stack ======================= */
  (function tf() {
    const s = stage('tf3d', { fov: 36 }); if (!s) return;
    seed = 21;
    const G = new THREE.Group(); s.scene.add(G); G.rotation.set(.2, -.55, 0);
    const T = ['The', 'cat', 'sat', 'on', 'the'], L = 6, X = i => (i - 2) * 1.55, Y = l => -2.6 + l * 1.0;
    const plates = [], nodes = [], arcs = [], labels = [];
    for (let l = 0; l < L; l++) {
      const pg = new THREE.PlaneGeometry(8.4, 2.3); pg.rotateX(-Math.PI / 2);
      const pm = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ transparent: true, opacity: .04, side: THREE.DoubleSide, depthWrite: false }));
      const pe = new THREE.LineSegments(new THREE.EdgesGeometry(pg), lmat(.45));
      pm.position.y = pe.position.y = Y(l); G.add(pm, pe);
      const lb = label(`Layer ${l + 1}`, '#fff', { px: 18, h: .19, mono: 1 }); lb.position.set(-4.9, Y(l), 0); G.add(lb); labels.push([lb, '--fg3']);
      plates.push({ pm, pe });
      nodes.push(T.map((_, i) => { const m = sphere(.085, 14); m.position.set(X(i), Y(l), 0); G.add(m); return m; }));
      for (let j = 1; j < T.length; j++) for (let i = 0; i < j; i++) {
        const known = { '1,0': .55, '2,1': .6, '3,2': .45, '4,3': .35, '4,1': .55, '2,0': .2, '3,1': .3 }[j + ',' + i];
        const w = clamp((known ?? .1 + rnd() * .12) + (rnd() - .5) * .16 * (l % 3));
        if (w < .16) continue;
        const a = V(X(i), Y(l), 0), b = V(X(j), Y(l), 0), c = V((X(i) + X(j)) / 2, Y(l) + .06, .45 + (j - i) * .38);
        const line = curveLine(new THREE.QuadraticBezierCurve3(a, c, b), 28, lmat(0)); G.add(line);
        arcs.push({ l, w, line });
      }
    }
    const res = []; T.forEach((_, i) => res.push(X(i), Y(0) - .9, 0, X(i), Y(L - 1) + .45, 0));
    const resid = segs(res, lmat(.35)); G.add(resid);
    T.forEach((t, i) => { const lb = label(t, '#fff', { px: 26, h: .32 }); lb.position.set(X(i), Y(0) - 1.2, 0); G.add(lb); labels.push([lb, '--fg']); });
    const OUT = [['mat', .62], ['floor', .14], ['sofa', .09], ['roof', .05], ['moon', .02]], baseY = Y(L - 1) + .95;
    const bgeo = new THREE.BoxGeometry(.5, 1, .5); bgeo.translate(0, .5, 0);
    const bars = OUT.map(([w, p], k) => {
      const m = new THREE.Mesh(bgeo, new THREE.MeshBasicMaterial({ transparent: true })); m.position.set(X(4) - 1.2 + k * .9 - 1.4, baseY, -1.2);
      const lb = label(`${w} ${Math.round(p * 100)}%`, '#fff', { px: 18, h: .2, mono: 1 }); lb.position.set(m.position.x, baseY - .25, -1.2);
      G.add(m, lb); labels.push([lb, k ? '--fg3' : '--model']); return { m, lb, p };
    });
    const link = segs([X(4), Y(L - 1), 0, X(4), baseY - .5, 0, X(4), baseY - .5, 0, bars[0].m.position.x, baseY - .5, -1.2], lmat(.6)); G.add(link);
    let dim, hot;
    paint(() => {
      dim = C('--line2'); hot = C('--model');
      plates.forEach(p => { p.pm.material.color = C('--fg'); p.pe.material.color = C('--fg3'); });
      arcs.forEach(a => { a.line.material.color = C('--model'); });
      resid.material.color = C('--fg3'); link.material.color = C('--fg3');
      bars.forEach((b, k) => { b.m.material.color = C(k ? '--fg3' : '--model'); });
      labels.forEach(([lb, c]) => relabel(lb, tok(c)));
    });
    const hud = $id('tfHud'), STEP = .55, END = L * STEP + .5;
    let t = RM ? 99 : 0;
    $id('tfRun').onclick = () => { t = 0; };
    const spin = drag(s, G, { auto: .08, lim: .6 });
    s.camera.position.set(0, 1.4, 12); s.camera.lookAt(0, .2, 0);
    const tc = new THREE.Color();
    s.tick = dt => {
      spin(dt); t += dt;
      if (t > END + 5 && !RM) t = 0;
      nodes.forEach((row, l) => {
        const st = l * STEP + .2, peak = clamp(1 - Math.abs(t - st - .3) / .45), k = Math.max(peak, t > st ? .3 : 0);
        row.forEach(m => { m.material.color.copy(tc.copy(dim).lerp(hot, k)); m.scale.setScalar(1 + peak * .6); });
      });
      arcs.forEach(a => { const st = a.l * STEP + .2, peak = clamp(1 - Math.abs(t - st - .3) / .5); a.line.material.opacity = a.w * Math.max(peak * 1.3, t > st ? .28 : 0); });
      const gb = clamp((t - END) / .7);
      bars.forEach(b => { b.m.scale.y = Math.max(.001, b.p * 3 * ease(gb)); b.m.material.opacity = gb; b.lb.material.opacity = gb; b.lb.position.y = baseY + b.p * 3 * ease(gb) + .22; });
      const cur = Math.min(L, Math.floor((t - .2) / STEP) + 1);
      hud.innerHTML = t < END ? `input <b>"The cat sat on the"</b><br>layer ${clamp(cur, 1, L)} of ${L} · attention, then feed-forward` : 'next token → <b>"mat"</b> 62%';
    };
  })();

  /* ======================= Fig 7.1 · matrix multiplication ======================= */
  (function mm() {
    const s = stage('mm3d', { fov: 34 }); if (!s) return;
    const G = new THREE.Group(); s.scene.add(G); G.rotation.set(.45, -.75, 0);
    const n = 8, p = .42, half = (n - 1) / 2 * p, off = half + .55;
    const xj = j => -half + j * p, yi = i => half - i * p, zk = k => half - k * p;
    const gA = new THREE.BoxGeometry(.03, .36, .36), gB = new THREE.BoxGeometry(.36, .03, .36), gC = new THREE.BoxGeometry(.36, .36, .03);
    const cell = (geo, x, y, z) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial()); m.position.set(x, y, z); G.add(m); return m; };
    const A = [], B = [], Cm = [];
    for (let i = 0; i < n; i++) { A.push([]); Cm.push([]); for (let k = 0; k < n; k++) A[i].push(cell(gA, -off, yi(i), zk(k))); for (let j = 0; j < n; j++) Cm[i].push(cell(gC, xj(j), yi(i), off)); }
    for (let k = 0; k < n; k++) { B.push([]); for (let j = 0; j < n; j++) B[k].push(cell(gB, xj(j), off, zk(k))); }
    const cube = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(off * 2, off * 2, off * 2)), lmat(.22)); G.add(cube);
    const beam = segs([0, 0, 0, 0, 0, 0], lmat(.9)); G.add(beam);
    const BP = points(n, { size: 4 }); G.add(BP.obj);
    const la = label('A · 8×8', '#fff', { px: 18, h: .22, mono: 1 }), lbB = label('B · 8×8', '#fff', { px: 18, h: .22, mono: 1 }), lc = label('C = A × B', '#fff', { px: 18, h: .22, mono: 1 });
    la.position.set(-off, -off - .35, 0); lbB.position.set(0, off + .45, -off); lc.position.set(0, -off - .35, off); G.add(la, lbB, lc);
    let va, vb, vc, cmax, idx = 0, acc = 0, hold = 0, paused = false;
    seed = 31;
    function randomize() {
      va = [...Array(n)].map(() => [...Array(n)].map(() => rnd() * 2 - 1)); vb = [...Array(n)].map(() => [...Array(n)].map(() => rnd() * 2 - 1));
      vc = va.map((row, i) => vb[0].map((_, j) => row.reduce((a, v, k) => a + v * vb[k][j], 0)));
      cmax = Math.max(...vc.flat().map(Math.abs)); idx = 0;
    }
    randomize();
    let base, cA, cB, cC, fg;
    const tc = new THREE.Color();
    function colorAll() {
      const i0 = Math.floor(idx / n), j0 = idx % n, live = idx < n * n;
      for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) A[i][k].material.color.copy(tc.copy(base).lerp(cA, live && i === i0 ? 1 : .18 + .4 * Math.abs(va[i][k])));
      for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) B[k][j].material.color.copy(tc.copy(base).lerp(cB, live && j === j0 ? 1 : .18 + .4 * Math.abs(vb[k][j])));
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const q = i * n + j; Cm[i][j].material.color.copy(q === idx && live ? fg : q < idx ? tc.copy(base).lerp(cC, .3 + .7 * Math.abs(vc[i][j]) / cmax) : base); }
      if (live) {
        beam.geometry.setAttribute('position', new THREE.Float32BufferAttribute([xj(j0), yi(i0), zk(n - 1), xj(j0), yi(i0), off], 3));
        for (let k = 0; k < n; k++) { BP.set(k, V(xj(j0), yi(i0), zk(k))); BP.al[k] = 1; }
        $id('mmHud').innerHTML = `C[${i0},${j0}] = Σ A[${i0},k] · B[k,${j0}] = <b>${vc[i0][j0].toFixed(2)}</b><br>multiply-adds ${(idx + 1) * n} / ${n * n * n}`;
      } else { for (let k = 0; k < n; k++) BP.al[k] = 0; $id('mmHud').innerHTML = `done · <b>${n * n * n}</b> multiply-adds`; }
      BP.up();
    }
    paint(() => {
      base = C('--bg3'); cA = C('--ctx'); cB = C('--mem'); cC = C('--model'); fg = C('--fg');
      cube.material.color = C('--fg3'); beam.material.color = C('--model');
      for (let k = 0; k < n; k++) BP.color(k, C('--model')); pointsBlend(BP);
      relabel(la, tok('--ctx')); relabel(lbB, tok('--mem')); relabel(lc, tok('--model'));
      colorAll();
    });
    $id('mmToggle').onclick = e => { paused = !paused; e.target.textContent = paused ? 'Play' : 'Pause'; };
    const spin = drag(s, G, { auto: .08, lim: .8 });
    s.camera.position.set(0, .4, 11); s.camera.lookAt(0, 0, 0);
    s.tick = dt => {
      spin(dt);
      if (paused || RM) return;
      if (idx >= n * n) { hold += dt; if (hold > 1.8) { hold = 0; randomize(); colorAll(); } return; }
      acc += dt; if (acc > .16) { acc = 0; idx++; colorAll(); }
    };
  })();

  /* ======================= Fig 8.1 · reasoning tree ======================= */
  (function tree() {
    const s = stage('tree3d', { fov: 38 }); if (!s) return;
    seed = 1234;
    const G = new THREE.Group(); s.scene.add(G); G.rotation.x = .22;
    const RAD = [0, 2.7, 1.2, .55, .26], Yd = d => 3.1 - d * 1.55;
    const root = { d: 0, x: 0, z: 0, kids: [], parent: null, v: 1 }, all = [root];
    let layer = [root];
    for (let d = 1; d <= 4; d++) {
      const next = [];
      layer.forEach((pa, pi) => { for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3 + d * .7 + pi * .3; const nd = { d, x: pa.x + Math.cos(a) * RAD[d], z: pa.z + Math.sin(a) * RAD[d], kids: [], parent: pa, v: .15 + rnd() * .45 }; pa.kids.push(nd); all.push(nd); next.push(nd); } });
      layer = next;
    }
    let dc = root.kids[0]; dc.v = .95; dc = dc.kids[0]; dc.v = .92; dc = dc.kids[0]; dc.v = .9; dc.kids.forEach(k => { k.v = .88; });
    let sc = root.kids[1]; sc.v = .8; sc = sc.kids[2]; sc.v = .86; sc = sc.kids[0]; sc.v = .87; sc = sc.kids[1]; sc.v = .9; sc.answer = true;
    const ghost = points(all.length, { size: 2.2, hard: 1 }); G.add(ghost.obj);
    all.forEach((nd, i) => {
      nd.pos = V(nd.x, Yd(nd.d), nd.z); ghost.set(i, nd.pos);
      nd.m = sphere(nd.d ? .075 : .13, 14); nd.m.position.copy(nd.pos); nd.m.visible = false; G.add(nd.m);
      if (nd.parent) { nd.e = segs([...nd.parent.pos.toArray(), ...nd.pos.toArray()], lmat(0)); G.add(nd.e); }
    });
    const halo = glow(1.1, .8); halo.visible = false; G.add(halo);
    const BUD = [6, 16, 40];
    let effort = 1, order = [], found = null, shown = 0, acc = 0, running = false;
    function simulate(budget, keep) {
      const out = [], fr = [root]; let f = null;
      while (fr.length && out.length < budget) {
        fr.sort((a, b) => b.v - a.v); const nd = fr.shift(); out.push(nd);
        if (nd.d === 4) { if (nd.answer) { f = f || nd; if (!keep) break; } continue; }
        if (nd.v < .35 && nd.d > 0) continue;
        fr.push(...nd.kids);
      }
      return { out, f };
    }
    const dead = nd => (nd.d === 4 && !nd.answer) || (nd.d > 0 && nd.d < 4 && nd.v < .35);
    let cols;
    function style() {
      all.forEach(nd => {
        const k = order.indexOf(nd), vis = k >= 0 && k < shown;
        nd.m.visible = vis; if (nd.e) nd.e.material.opacity = vis ? .55 : 0;
        if (!vis) return;
        let c = dead(nd) ? cols.risk : cols.fg2;
        if (k === shown - 1 && running) c = cols.ctx;
        nd.m.material.color = c; if (nd.e) nd.e.material.color = dead(nd) ? cols.risk : cols.fg3;
      });
      if (!running && found && shown >= order.length) {
        for (let nd = found; nd; nd = nd.parent) { nd.m.material.color = cols.model; if (nd.e) { nd.e.material.color = cols.model; nd.e.material.opacity = 1; } }
        halo.visible = true; halo.position.copy(found.pos);
      }
    }
    paint(() => {
      cols = { risk: C('--risk'), fg2: C('--fg2'), fg3: C('--fg3'), ctx: C('--ctx'), model: C('--model') };
      all.forEach((nd, i) => { ghost.color(i, cols.fg3); ghost.al[i] = .45; }); ghost.up(); setGlow(halo, cols.model);
      style();
    });
    const hud = $id('treeHud');
    function run() {
      const r = simulate(BUD[effort], effort === 2); order = r.out; found = r.f; shown = 0; running = true; halo.visible = false; acc = 0;
      if (RM) { shown = order.length; finish(); }
    }
    function finish() {
      running = false; style();
      const tk = (order.length * 350 / 1000).toFixed(1) + 'K';
      hud.innerHTML = !found ? `${order.length} thoughts · ~${tk} tokens<br>answered from an unverified branch · <b style="color:var(--risk)">wrong</b>`
        : effort === 2 ? `${order.length} thoughts · ~${tk} tokens<br>same answer, more alternatives ruled out · <b>correct, higher cost</b>`
        : `${order.length} thoughts · ~${tk} tokens<br>verified answer · <b style="color:var(--tool)">correct</b>`;
    }
    const segEl = $id('effortSeg');
    segEl.onclick = e => { const b = e.target.closest('button'); if (!b) return; effort = +b.dataset.e; [...segEl.children].forEach(x => x.classList.toggle('on', x === b)); run(); };
    $id('treeRun').onclick = run;
    s.onShow = run;
    const spin = drag(s, G, { auto: .1, lim: .6 });
    s.camera.position.set(0, .6, 11.5); s.camera.lookAt(0, -.2, 0);
    s.tick = (dt, t) => {
      spin(dt);
      if (halo.visible) halo.scale.setScalar(1 + Math.sin(t * 3) * .12);
      if (!running) return;
      acc += dt;
      if (acc > .22) {
        acc = 0; shown++; style();
        const nd = order[shown - 1];
        hud.innerHTML = `thinking… ${shown} thoughts · ~${(shown * 350 / 1000).toFixed(1)}K tokens${nd && dead(nd) ? '<br><span style="color:var(--risk)">dead end, backtracking</span>' : ''}`;
        if (shown >= order.length) finish();
      }
    };
  })();

  /* ======================= Fig 9.1 · diffusion ======================= */
  (function dif() {
    const s = stage('dif3d', { fov: 36 }); if (!s) return;
    const N = innerWidth < 700 ? 3500 : 7000, P = points(N, { size: 1.8 });
    const G = new THREE.Group(); G.add(P.obj); s.scene.add(G); G.rotation.x = .35;
    const noise = new Float32Array(N * 3), tgt = new Float32Array(N * 3), tcol = new Float32Array(N * 3), ph = new Float32Array(N);
    const gauss = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); };
    let shape = 0, step = 0, running = false, grey;
    function build() {
      const a = C('--model'), b = C('--human'), c = C('--ctx'), d = C('--mem'), t = new THREE.Color();
      for (let i = 0; i < N; i++) {
        let x, y, z;
        if (shape === 0) {
          const u = Math.random() * Math.PI * 2, r = 1.6 + .6 * Math.cos(3 * u), q = V(gauss(), gauss(), gauss()).multiplyScalar(.12);
          x = r * Math.cos(2 * u) + q.x; y = r * Math.sin(2 * u) + q.y; z = .9 * Math.sin(3 * u) + q.z; t.copy(a).lerp(b, (Math.sin(u * 3) + 1) / 2);
        } else if (shape === 1) {
          const r = Math.pow(Math.random(), .6) * 3.6, ang = (i % 3) / 3 * Math.PI * 2 + r * .9;
          x = Math.cos(ang) * r + gauss() * .22; z = Math.sin(ang) * r + gauss() * .22; y = gauss() * .12 * (1.2 - r / 3.6); t.copy(a).lerp(c, r / 3.6).lerp(d, Math.random() * .3);
        } else if (i % 8 < 5) {
          const v = V(gauss(), gauss(), gauss()).normalize().multiplyScalar(1.5 + Math.random() * .05); x = v.x; y = v.y; z = v.z; t.copy(d).lerp(c, (y + 1.5) / 3);
        } else {
          const r = 2.1 + Math.random() * 1, an = Math.random() * Math.PI * 2, zz = Math.sin(an) * r;
          x = Math.cos(an) * r; y = zz * Math.sin(.45); z = zz * Math.cos(.45); t.copy(a).lerp(b, Math.random() * .4);
        }
        tgt[i * 3] = x; tgt[i * 3 + 1] = y; tgt[i * 3 + 2] = z; tcol[i * 3] = t.r; tcol[i * 3 + 1] = t.g; tcol[i * 3 + 2] = t.b;
        noise[i * 3] = gauss() * 2.4; noise[i * 3 + 1] = gauss() * 2.4; noise[i * 3 + 2] = gauss() * 2.4; ph[i] = Math.random() * 6.28;
      }
    }
    const hud = $id('difHud'), slider = $id('difStep');
    function render(time) {
      const k = ease(clamp(step / 50)), j = (1 - k) * .3, ck = Math.pow(k, 1.4);
      for (let i = 0; i < N; i++) {
        const w = Math.sin(time * 2.2 + ph[i]) * j;
        for (let a = 0; a < 3; a++) P.pos[i * 3 + a] = noise[i * 3 + a] * (1 - k) + tgt[i * 3 + a] * k + w * (a === 1 ? 1 : .6);
        P.col[i * 3] = grey.r + (tcol[i * 3] - grey.r) * ck; P.col[i * 3 + 1] = grey.g + (tcol[i * 3 + 1] - grey.g) * ck; P.col[i * 3 + 2] = grey.b + (tcol[i * 3 + 2] - grey.b) * ck;
      }
      P.up();
      const st = Math.round(step);
      hud.innerHTML = `step <b>${st}</b> / 50 · ${st < 12 ? 'pure noise' : st < 32 ? 'rough shape emerging' : st < 50 ? 'refining detail' : 'done'}`;
      slider.value = st; $id('difStepOut').textContent = st;
    }
    paint(() => { grey = C('--fg3'); build(); pointsBlend(P); });
    const go = () => { build(); step = 0; running = !RM; if (RM) step = 50; };
    const segEl = $id('difPrompt');
    segEl.onclick = e => { const b = e.target.closest('button'); if (!b) return; shape = +b.dataset.p; [...segEl.children].forEach(x => x.classList.toggle('on', x === b)); go(); };
    $id('difRun').onclick = go;
    slider.oninput = () => { running = false; step = +slider.value; };
    s.onShow = go;
    const spin = drag(s, G, { auto: .12, lim: .8 });
    s.camera.position.set(0, .3, 10.5); s.camera.lookAt(0, 0, 0);
    s.tick = (dt, t) => { spin(dt); if (running) { step += dt * 14; if (step >= 50) { step = 50; running = false; } } render(RM ? 0 : t); };
  })();

  /* ======================= Fig 10.1 · context tower ======================= */
  (function ctxTower() {
    const s = stage('ctx3d', { fov: 34 }); if (!s) return;
    const G = new THREE.Group(); s.scene.add(G); G.rotation.set(.36, -.7, 0);
    const H = 7, Wd = 2.6, base = -3.5;
    const boxG = new THREE.BoxGeometry(Wd + .2, H, Wd + .2);
    const shell = new THREE.LineSegments(new THREE.EdgesGeometry(boxG), lmat(.5)); shell.position.y = base + H / 2;
    const glass = new THREE.Mesh(boxG, new THREE.MeshBasicMaterial({ transparent: true, opacity: .025, depthWrite: false })); glass.position.copy(shell.position);
    const limG = new THREE.PlaneGeometry(Wd + .9, Wd + .9); limG.rotateX(-Math.PI / 2);
    const lim = new THREE.LineSegments(new THREE.EdgesGeometry(limG), lmat(.9)); lim.position.y = base + H;
    const limLb = label('200K limit', '#fff', { px: 18, h: .22, mono: 1 }); limLb.position.set(0, base + H + .35, -(Wd / 2 + .5));
    G.add(shell, glass, lim, limLb);
    const ticks = [], tickLbs = [];
    for (let k = 1; k <= 3; k++) { const y = base + H * k / 4; ticks.push(-(Wd / 2 + .1), y, Wd / 2 + .1, -(Wd / 2 + .4), y, Wd / 2 + .1); const lb = label(`${k * 50}K`, '#fff', { px: 16, h: .18, mono: 1 }); lb.position.set(-(Wd / 2 + .8), y, Wd / 2 + .1); G.add(lb); tickLbs.push(lb); }
    const tickL = segs(ticks, lmat(.6)); G.add(tickL);
    const geo = new THREE.BoxGeometry(Wd, 1, Wd), egeo = new THREE.EdgesGeometry(geo);
    let slabs = [], dying = [], over = false;
    const tint = sl => { const c = C(sl.c); sl.mesh.material.color = c; sl.mesh.material.opacity = isLight() ? .35 : .22; sl.edge.material.color = c; };
    function sync(d) {
      const k = H / d.limit; let y = base;
      d.items.forEach((it, i) => {
        const h = Math.max(.05, it.n * k); let sl = slabs[i];
        if (!sl) { const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })), edge = new THREE.LineSegments(egeo, lmat(.9)); mesh.add(edge); G.add(mesh); sl = slabs[i] = { mesh, edge, y: base + H + 3, h, f: 1 }; }
        sl.ty = y + h / 2; sl.th = h; sl.c = it.c; tint(sl); y += h;
      });
      dying.push(...slabs.splice(d.items.length));
      over = y > base + H + 1e-3;
      shell.material.color = C(over ? '--risk' : '--fg3');
    }
    paint(() => {
      glass.material.color = C('--fg'); lim.material.color = C('--risk'); relabel(limLb, tok('--risk'));
      tickL.material.color = C('--fg3'); tickLbs.forEach(lb => relabel(lb, tok('--fg3')));
      slabs.forEach(tint); shell.material.color = C(over ? '--risk' : '--fg3');
    });
    listen('ctx:update', sync);
    const spin = drag(s, G, { auto: .12, lim: .7 });
    s.camera.position.set(0, .8, 13); s.camera.lookAt(0, 0, 0);
    s.tick = dt => {
      spin(dt);
      const a = Math.min(1, dt * 7);
      slabs.forEach(sl => { sl.y += (sl.ty - sl.y) * a; sl.h += (sl.th - sl.h) * a; sl.mesh.position.y = sl.y; sl.mesh.scale.y = Math.max(.02, sl.h - .03); });
      dying = dying.filter(sl => { sl.f -= dt * 3; sl.mesh.material.opacity *= .85; sl.edge.material.opacity = Math.max(0, sl.f); sl.mesh.scale.y *= .9; if (sl.f <= 0) { G.remove(sl.mesh); return false; } return true; });
    };
  })();

  /* ======================= Fig 11.2 · vector search ======================= */
  (function rag3d() {
    const s = stage('rag3d', { fov: 36 }); if (!s) return;
    seed = 77;
    const G = new THREE.Group(); s.scene.add(G); G.rotation.set(.25, -.5, 0);
    const CL = [V(-2, 1.2, .5), V(1.9, 1.5, -1), V(-.5, -1.7, 1.8), V(2.2, -1.2, 1.2), V(-2.3, -1.4, -1.2), V(.4, .3, -2.5)];
    const chunkCl = [0, 0, 1, 2, 3, 4, 5, 1], BG = 420, bg = points(BG, { size: 1.5, hard: 1 });
    for (let i = 0; i < BG; i++) {
      const c = CL[i % 6], sp = i % 5 === 0 ? 2.6 : .75;
      bg.set(i, V(c.x + (rnd() - .5) * 2 * sp, c.y + (rnd() - .5) * 2 * sp, c.z + (rnd() - .5) * 2 * sp));
    }
    G.add(bg.obj);
    const chunks = chunkCl.map((cl, j) => {
      const m = sphere(.09, 14), lb = label(`[${j + 1}]`, '#fff', { px: 18, h: .22, mono: 1 });
      m.position.copy(CL[cl]).add(V((rnd() - .5) * .9, (rnd() - .5) * .9, (rnd() - .5) * .9)); lb.position.copy(m.position).add(V(0, .26, 0));
      G.add(m, lb); return { m, lb };
    });
    const q = sphere(.13, 16), qg = glow(1.3, .9), qlb = label('your question', '#fff', { px: 18, h: .22, mono: 1 });
    q.add(qg); G.add(q, qlb);
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: .1 })); G.add(bubble);
    const links = segs([], lmat(.9)); G.add(links);
    let top = [], from = V(4, 3.5, 3), to = V(0, 0, 0), k = 1, rad = 1;
    paint(() => {
      for (let i = 0; i < BG; i++) { bg.color(i, C('--fg3')); bg.al[i] = .5; } bg.up();
      chunks.forEach((c, j) => { c.m.material.color = C(top.includes(j) ? '--model' : '--mem'); relabel(c.lb, tok(top.includes(j) ? '--model' : '--fg2')); });
      q.material.color = C('--human'); setGlow(qg, C('--human')); relabel(qlb, tok('--fg')); bubble.material.color = C('--fg3'); links.material.color = C('--model');
    });
    listen('rag:query', d => {
      top = d.top; from = q.position.clone(); if (from.length() < .01) from.set(4, 3.5, 3);
      to = V(0, 0, 0); top.forEach(j => to.add(chunks[j].m.position)); to.multiplyScalar(1 / Math.max(1, top.length)).add(V(.35, .45, .3));
      rad = Math.min(2.2, Math.max(...top.map(j => chunks[j].m.position.distanceTo(to)), .6) + .2); k = RM ? 1 : 0;
      chunks.forEach((c, j) => { const on = top.includes(j); c.m.material.color = C(on ? '--model' : '--mem'); c.m.scale.setScalar(on ? 1.5 : 1); relabel(c.lb, tok(on ? '--model' : '--fg2')); });
      $id('ragHud').innerHTML = `question → nearest <b>${top.length}</b> of ${BG + 8} chunks`;
    });
    const spin = drag(s, G, { auto: .1 });
    s.camera.position.set(0, .8, 11); s.camera.lookAt(0, 0, 0);
    s.tick = dt => {
      spin(dt);
      k = Math.min(1, k + dt * 1.1);
      q.position.lerpVectors(from, to, ease(clamp(k / .6))); qlb.position.copy(q.position).add(V(0, .32, 0));
      const b = ease(clamp((k - .55) / .35)); bubble.position.copy(q.position); bubble.scale.setScalar(Math.max(.001, rad * b)); bubble.material.opacity = .06 * b;
      const pts = []; if (k > .85) top.forEach(j => pts.push(...q.position.toArray(), ...chunks[j].m.position.toArray()));
      links.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    };
  })();

  /* ======================= Fig 13.1 · agent helix ======================= */
  (function helix() {
    const s = stage('helix3d', { fov: 36 }); if (!s) return;
    const G = new THREE.Group(), W = new THREE.Group(); s.scene.add(W); W.add(G); W.rotation.x = .2;
    const RH_ = 2.3, PITCH = 1.3, Y0 = -3, TOP = 3.8;
    const ANG = { gather: 0, think: Math.PI / 2, act: Math.PI, observe: Math.PI * 1.5 }, COL = { gather: '--ctx', think: '--model', act: '--tool', observe: '--ctx', done: '--tool' };
    const gl = [], glbl = [];
    Object.entries(ANG).forEach(([k, a]) => {
      gl.push(Math.cos(a) * RH_, Y0 - .3, Math.sin(a) * RH_, Math.cos(a) * RH_, TOP, Math.sin(a) * RH_);
      const lb = label(k, '#fff', { px: 18, h: .22, mono: 1 }); lb.position.set(Math.cos(a) * (RH_ + .55), Y0 - .6, Math.sin(a) * (RH_ + .55)); G.add(lb); glbl.push([lb, COL[k]]);
    });
    const guides = segs(gl, lmat(.18)); G.add(guides);
    const cg = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true); cg.translate(0, .5, 0);
    const col = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }));
    const colE = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: .12 }));
    col.position.y = colE.position.y = Y0; G.add(col, colE);
    const MAXP = 1200, pp = new Float32Array(MAXP * 3), pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setDrawRange(0, 0);
    const path = new THREE.Line(pg, lmat(.85)); G.add(path);
    const bead = sphere(.14, 18), bg = glow(1.4, .9); bead.add(bg); G.add(bead);
    const marks = new THREE.Group(); G.add(marks);
    let np = 0, curA = 0, curY = Y0, fromA = 0, toA = 0, fromY = Y0, toY = Y0, k = 1, started = false, done = false, tok_ = 0, radius = .1, height = .01, ph = 'gather';
    const addPt = v => { if (np < MAXP) { pp.set([v.x, v.y, v.z], np * 3); np++; pg.setDrawRange(0, np); pg.attributes.position.needsUpdate = true; } };
    const posAt = (a, y) => V(Math.cos(a) * RH_, y, Math.sin(a) * RH_);
    function reset() { np = 0; pg.setDrawRange(0, 0); marks.clear(); curA = fromA = toA = 0; curY = fromY = toY = Y0; k = 1; started = false; done = false; tok_ = 0; bead.position.copy(posAt(0, Y0)); }
    paint(() => {
      guides.material.color = C('--fg3'); glbl.forEach(([lb, c]) => relabel(lb, tok(c)));
      col.material.color = C('--ctx'); colE.material.color = C('--ctx'); path.material.color = C('--fg2');
      bead.material.color = C(done ? '--tool' : '--fg'); setGlow(bg, C(done ? '--tool' : '--fg'));
      marks.children.forEach(m => { m.material.color = C(m.userData.c); });
    });
    listen('agent:reset', reset);
    listen('agent:step', d => {
      if (!d) return;
      tok_ = d.tok; ph = d.ph;
      if (k < 1 && !done) { curA = toA; curY = toY; }
      fromA = curA; fromY = curY;
      if (d.ph === 'done') { done = true; toA = curA; toY = curY + .9; }
      else {
        let a = ANG[d.ph];
        if (started) while (a <= curA + 1e-6) a += Math.PI * 2;
        toA = a; toY = Y0 + a / (Math.PI * 2) * PITCH; started = true;
      }
      k = RM ? 1 : 0;
      bead.material.color = C(done ? '--tool' : '--fg'); setGlow(bg, C(done ? '--tool' : '--fg'));
    });
    reset();
    const spin = drag(s, W, { auto: .15, lim: .6 });
    s.camera.position.set(0, 1.2, 12); s.camera.lookAt(0, 0, 0);
    let arrived = true;
    s.tick = dt => {
      spin(dt);
      if (k < 1) {
        arrived = false; k = Math.min(1, k + dt * 1.8); const e = ease(k);
        if (done) { const v = posAt(curA, curY).lerp(V(0, toY, 0), e); bead.position.copy(v); addPt(v); }
        else { curA = fromA + (toA - fromA) * e; curY = fromY + (toY - fromY) * e; const v = posAt(curA, curY); bead.position.copy(v); addPt(v); }
      } else if (!arrived) {
        arrived = true;
        if (done) curY = toY;
        const m = sphere(.07, 12); m.userData.c = COL[ph]; m.material.color = C(COL[ph]); m.position.copy(bead.position); marks.add(m);
      }
      radius += (.12 + tok_ / 11000 - radius) * Math.min(1, dt * 4);
      height += (Math.max(.01, curY - Y0) - height) * Math.min(1, dt * 4);
      col.scale.set(radius, height, radius); colE.scale.copy(col.scale);
      G.position.y += (-(curY - Y0) * .45 + .4 - G.position.y) * Math.min(1, dt * 2);
    };
  })();

  /* ======================= Fig 14.1 · harness rings ======================= */
  (function harness() {
    const s = stage('harness3d', { fov: 40 }); if (!s) return;
    seed = 7;
    const H = window.HARNESS, root = new THREE.Group(); s.scene.add(root);
    const core = sphere(.8, 32), cg = glow(4, .8); root.add(core, cg);
    const coreLb = label('model', '#fff', { px: 20, h: .24, mono: 1 }); root.add(coreLb);
    const rings = H.map((h, i) => {
      const Rr = 1.45 + i * .36, grp = new THREE.Group(); grp.rotation.set(rnd() * Math.PI, rnd() * Math.PI, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(Rr, .018, 8, 160), new THREE.MeshBasicMaterial({ transparent: true }));
      const hit = new THREE.Mesh(new THREE.TorusGeometry(Rr, .16, 6, 64), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.userData.i = i;
      const spinner = new THREE.Group(), sat = sphere(.1, 14), lb = label(h.n, '#fff', { px: 20, h: .26 });
      sat.position.x = Rr; lb.position.y = .36; sat.add(lb); spinner.add(sat); grp.add(ring, hit, spinner); root.add(grp);
      return { h, ring, hit, sat, lb, spinner, speed: (.25 + rnd() * .35) * (i % 2 ? -1 : 1) };
    });
    let sel = 2;
    function style() {
      core.material.color = C('--model'); setGlow(cg, C('--model')); relabel(coreLb, tok('--on'));
      rings.forEach((r, i) => {
        const c = C(r.h.c), on = i === sel;
        r.ring.material.color = c; r.sat.material.color = c; r.ring.material.opacity = on ? 1 : .22; r.sat.scale.setScalar(on ? 1.7 : 1);
        r.lb.visible = on; if (on) relabel(r.lb, tok(r.h.c));
      });
    }
    paint(style);
    listen('harness:select', i => { sel = i; style(); });
    const ray = new THREE.Raycaster();
    onTap(s, v => { ray.setFromCamera(v, s.camera); const hit = ray.intersectObjects(rings.map(r => r.hit))[0]; if (hit) emit('harness:select', hit.object.userData.i); });
    const spin = drag(s, root, { auto: .1 });
    s.camera.position.set(0, 0, 11); s.camera.lookAt(0, 0, 0);
    s.tick = dt => { spin(dt); if (!RM) rings.forEach(r => { r.spinner.rotation.z += r.speed * dt; }); };
  })();

  /* ======================= Fig 17.1 · MCP ======================= */
  (function mcp() {
    const s = stage('mcp3d', { fov: 34 }); if (!s) return;
    seed = 17;
    const G = new THREE.Group(); s.scene.add(G); G.rotation.set(.1, -.3, 0);
    const apps = ['Claude', 'ChatGPT', 'Cursor', 'VS Code', 'Your agent'], srv = ['GitHub', 'Slack', 'Postgres', 'Google Drive', 'Stripe', 'Filesystem'];
    const AP = apps.map((_, i) => { const a = (i - 2) * .42; return V(-4.6 + Math.abs(i - 2) * .25, Math.sin(a) * 3, Math.cos(a) * 1.2 - 1.2); });
    const SP = srv.map((_, j) => { const a = (j - 2.5) * .34; return V(4.6 - Math.abs(j - 2.5) * .2, Math.sin(a) * 3.2, Math.cos(a) * 1.2 - 1.2); });
    const lbs = [], dots = [];
    const node = (p, n, side, c) => { const m = sphere(.11, 14), lb = label(n, '#fff', { px: 20, h: .25 }); m.position.copy(p); lb.position.copy(p).add(V(side * (lb.scale.x / 2 + .25), 0, 0)); G.add(m, lb); lbs.push([lb, '--fg']); dots.push([m, c]); };
    AP.forEach((p, i) => node(p, apps[i], -1, '--model')); SP.forEach((p, j) => node(p, srv[j], 1, '--tool'));
    const HUB = V(0, 0, 0), hub = sphere(.42, 28), hg = glow(3, .7), hring = new THREE.Mesh(new THREE.TorusGeometry(.72, .012, 8, 120), new THREE.MeshBasicMaterial({ transparent: true }));
    const hlb = label('MCP', '#fff', { px: 22, h: .28, mono: 1 }); hlb.position.set(0, -.85, 0);
    const HG = new THREE.Group(); HG.add(hub, hg, hring, hlb); G.add(HG);
    const direct = [], via = [];
    AP.forEach(a => SP.forEach(b => { const mid = a.clone().add(b).multiplyScalar(.5).add(V(0, (rnd() - .5) * 1.6, (rnd() - .5) * 2.4)); direct.push(new THREE.QuadraticBezierCurve3(a, mid, b)); }));
    AP.forEach(a => via.push(new THREE.QuadraticBezierCurve3(a, V(a.x * .45, a.y * .35, .5), HUB)));
    SP.forEach(b => via.push(new THREE.QuadraticBezierCurve3(HUB, V(b.x * .45, b.y * .35, .5), b)));
    const mD = lmat(.25), mV = lmat(0);
    direct.forEach(c => G.add(curveLine(c, 30, mD))); via.forEach(c => G.add(curveLine(c, 30, mV)));
    const NP = 30 + 22, PT = points(NP, { size: 3 }); G.add(PT.obj);
    const pc = [...direct.map((c, i) => ({ c, d: 1, ph: (i * .137) % 1 })), ...via.flatMap((c, i) => [{ c, d: 0, ph: (i * .19) % 1 }, { c, d: 0, ph: (i * .19 + .5) % 1 }])];
    let mode = 0, m = 0;
    paint(() => {
      lbs.forEach(([lb, c]) => relabel(lb, tok(c))); dots.forEach(([d, c]) => { d.material.color = C(c); });
      hub.material.color = C('--tool'); setGlow(hg, C('--tool')); hring.material.color = C('--tool'); relabel(hlb, tok('--tool'));
      mD.color = C('--risk'); mV.color = C('--tool');
      pc.forEach((p, i) => PT.color(i, C(p.d ? '--risk' : '--tool'))); pointsBlend(PT);
    });
    listen('mcp:mode', v => { mode = v; });
    const spin = drag(s, G, { auto: .06, lim: .5 });
    s.camera.position.set(0, .5, 12.5); s.camera.lookAt(0, 0, 0);
    const tv = new THREE.Vector3();
    s.tick = (dt, t) => {
      spin(dt);
      m += (mode - m) * Math.min(1, dt * 3);
      mD.opacity = .25 * (1 - m); mV.opacity = .75 * m;
      HG.scale.setScalar(Math.max(.001, m)); hlb.material.opacity = m;
      pc.forEach((p, i) => { p.c.getPoint(RM ? .5 : (t * .35 + p.ph) % 1, tv); PT.set(i, tv); PT.al[i] = p.d ? (1 - m) * .8 : m; });
      PT.up();
    };
  })();

  /* ======================= Fig 19.1 · multi-agent swarm ======================= */
  (function swarm() {
    const s = stage('swarm3d', { fov: 36 }); if (!s) return;
    const G = new THREE.Group(); s.scene.add(G); G.rotation.set(.5, 0, 0);
    const orch = sphere(.5, 28), og = glow(3.2, .8), oring = new THREE.Mesh(new THREE.TorusGeometry(.85, .012, 8, 120), new THREE.MeshBasicMaterial({ transparent: true }));
    oring.rotation.x = Math.PI / 2; G.add(orch, og, oring);
    const olb = label('orchestrator', '#fff', { px: 18, h: .22, mono: 1 }); olb.position.set(0, .95, 0); G.add(olb);
    const W = Array.from({ length: 8 }, (_, i) => {
      const g = new THREE.Group(), core = sphere(.15, 16), bub = sphere(.72, 28), fill = sphere(.7, 24), lb = label(`worker ${i + 1}`, '#fff', { px: 16, h: .2, mono: 1 });
      bub.material.depthWrite = false; fill.material.depthWrite = false; lb.position.y = .95;
      g.add(core, bub, fill, lb); G.add(g); return { g, core, bub, fill, lb, prog: 0, dur: 1, a: 0, done: false };
    });
    const teth = segs(new Array(8 * 6).fill(0), lmat(.25)); G.add(teth);
    const PK = points(40, { size: 5 }); G.add(PK.obj);
    let n = 4, packets = [], phase = 'idle', T = 0, cols;
    const place = () => W.forEach((w, i) => { w.a = i / n * Math.PI * 2; w.g.visible = i < n; });
    paint(() => {
      cols = { model: C('--model'), ctx: C('--ctx'), tool: C('--tool'), fg3: C('--fg3') };
      orch.material.color = cols.model; setGlow(og, cols.model); oring.material.color = cols.model; relabel(olb, tok('--fg2'));
      W.forEach(w => { w.core.material.color = cols.tool; w.bub.material.color = cols.ctx; w.bub.material.opacity = .06; w.fill.material.color = cols.ctx; w.fill.material.opacity = isLight() ? .3 : .2; relabel(w.lb, tok('--fg3')); });
      teth.material.color = cols.fg3; pointsBlend(PK);
    });
    const hud = $id('swHud');
    listen('swarm:size', v => { if (phase === 'idle' || phase === 'done') { n = v; place(); } });
    listen('swarm:run', d => {
      n = d.n; place(); T = 0; phase = 'plan'; packets = [];
      W.forEach((w, i) => { w.prog = 0; w.done = false; w.dur = i < n ? d.loads[i].reduce((a, b) => a + b, 0) * .45 : 0; w.started = 0; });
      if (RM) { phase = 'done'; W.forEach(w => { w.prog = 1; }); }
    });
    place();
    const wpos = w => V(Math.cos(w.a) * 3.6, Math.sin(w.a * 2) * .3, Math.sin(w.a) * 3.6);
    const spin = drag(s, G, { auto: .12, lim: .8 });
    s.camera.position.set(0, .5, 11.5); s.camera.lookAt(0, 0, 0);
    const tv = new THREE.Vector3();
    s.tick = (dt, t) => {
      spin(dt); T += dt;
      const tp = [];
      W.forEach((w, i) => {
        if (!w.g.visible) { tp.push(0, 0, 0, 0, 0, 0); return; }
        const p = wpos(w); w.g.position.lerp(p, Math.min(1, dt * 4)); tp.push(0, 0, 0, ...w.g.position.toArray());
        w.fill.scale.setScalar(Math.max(.001, w.prog)); w.core.scale.setScalar(1 + (phase === 'work' && !w.done && w.started ? Math.sin(t * 8 + i) * .2 : 0));
      });
      teth.geometry.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
      if (phase === 'plan') { orch.scale.setScalar(1 + Math.sin(T * 10) * .08); if (T > 1) { phase = 'work'; W.slice(0, n).forEach((w, i) => packets.push({ w, out: 1, k: 0, delay: i * .08 })); } }
      else if (phase === 'work') {
        W.slice(0, n).forEach(w => { if (!w.started) return; if (!w.done) { w.prog = clamp((T - w.started) / w.dur); if (w.prog >= 1) { w.done = true; packets.push({ w, out: 0, k: 0, delay: 0 }); } } });
        if (W.slice(0, n).every(w => w.done) && !packets.length) { phase = 'synth'; T = 0; }
      } else if (phase === 'synth') { orch.scale.setScalar(1 + Math.sin(T * 12) * .1); if (T > 1) { phase = 'done'; orch.scale.setScalar(1); } }
      packets = packets.filter(p => { if (p.delay > 0) { p.delay -= dt; return true; } p.k += dt * 1.6; if (p.k >= 1) { if (p.out) p.w.started = T; return false; } return true; });
      for (let i = 0; i < 40; i++) {
        const p = packets[i]; if (!p || p.delay > 0) { PK.al[i] = 0; continue; }
        const a = V(0, 0, 0), b = p.w.g.position; tv.lerpVectors(p.out ? a : b, p.out ? b : a, ease(p.k)); PK.set(i, tv); PK.al[i] = 1; PK.color(i, p.out ? cols.model : cols.ctx);
      }
      PK.up();
      const doneN = W.slice(0, n).filter(w => w.done).length;
      hud.innerHTML = phase === 'idle' ? `${n} workers · press Run task` : phase === 'plan' ? 'orchestrator is planning subtopics' : phase === 'work' ? `workers researching · <b>${doneN}/${n}</b> returned` : phase === 'synth' ? 'orchestrator is synthesising the report' : `<b>done</b> · ${n} workers`;
    };
  })();

  /* ======================= Fig 24.1 · Swiss cheese ======================= */
  (function cheese() {
    const s = stage('cheese3d'); if (!s) return;
    const n = window.CHEESE.length, root = new THREE.Group(); s.scene.add(root);
    const HALF = 1.8, SPAN = 1.5;
    seed = 99;
    const plates = window.CHEESE.map((c, i) => {
      const holes = [];
      for (let tries = 0; holes.length < 3 && tries < 200; tries++) {
        const r = .5 + rnd() * .3, h = { u: (rnd() * 2 - 1) * (HALF - r - .12), v: (rnd() * 2 - 1) * (HALF - r - .12), r };
        if (holes.every(o => Math.hypot(o.u - h.u, o.v - h.v) > o.r + h.r + .1)) holes.push(h);
      }
      const sh = new THREE.Shape(); sh.moveTo(-HALF, -HALF); sh.lineTo(HALF, -HALF); sh.lineTo(HALF, HALF); sh.lineTo(-HALF, HALF); sh.lineTo(-HALF, -HALF);
      holes.forEach(h => { const p = new THREE.Path(); p.absarc(h.u, h.v, h.r, 0, Math.PI * 2, true); sh.holes.push(p); });
      const geo = new THREE.ShapeGeometry(sh, 32);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lmat(1));
      const grp = new THREE.Group(); grp.add(mesh, edge); grp.rotation.y = Math.PI / 2; grp.position.x = (i - (n - 1) / 2) * SPAN;
      root.add(grp);
      return { x: grp.position.x, holes, mesh, edge, on: true };
    });
    const target = new THREE.Mesh(new THREE.BoxGeometry(.8, .8, .8), new THREE.MeshBasicMaterial({ transparent: true, opacity: .9 }));
    target.position.x = (n / 2) * SPAN + 1; root.add(target);
    const tEdge = new THREE.LineSegments(new THREE.EdgesGeometry(target.geometry), lmat(1)); target.add(tEdge);
    const tlb = label('your data', '#fff', { px: 16, h: .2, mono: 1 }); tlb.position.set(target.position.x, -.8, 0); root.add(tlb);
    let flash = 0, blocked = 0, through = 0;
    const NPT = 90, PT = points(NPT, { size: 3.4 }); root.add(PT.obj);
    const parts = [];
    const cols = {};
    function style() {
      ['--risk', '--fg', '--model', '--mem', '--fg3'].forEach(k => { cols[k] = C(k); });
      plates.forEach(p => {
        p.mesh.material.color = cols['--risk']; p.mesh.material.opacity = p.on ? (isLight() ? .2 : .13) : .02;
        p.edge.material.color = p.on ? cols['--risk'] : cols['--fg3']; p.edge.material.opacity = p.on ? .85 : .18;
      });
      tEdge.material.color = cols['--mem']; relabel(tlb, tok('--mem')); pointsBlend(PT);
    }
    paint(style);
    listen('cheese:toggle', st => { st.forEach((on, i) => { plates[i].on = on; }); style(); blocked = 0; through = 0; });
    const hud = $id('cheeseHud'), startX = plates[0].x - 2.2, endX = target.position.x - .45;
    let spawn = 0;
    const spin = drag(s, root, { auto: 0, lim: .5 });
    root.rotation.y = -.55; root.rotation.x = .18;
    s.camera.position.set(0, 1.4, 11); s.camera.lookAt(0, 0, 0);
    s.tick = dt => {
      spin(dt);
      spawn += dt;
      if (spawn > .11 && parts.length < NPT) { spawn = 0; parts.push({ p: V(startX, (Math.random() * 2 - 1) * 1.5, (Math.random() * 2 - 1) * 1.5), dead: 0 }); }
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i];
        if (q.dead) { q.dead += dt; if (q.dead > .45) parts.splice(i, 1); continue; }
        const x0 = q.p.x, x1 = x0 + dt * 3.2; q.p.x = x1;
        for (const pl of plates) {
          if (!pl.on || !(x0 < pl.x && x1 >= pl.x)) continue;
          const u = -q.p.z, v = q.p.y;
          if (!pl.holes.some(h => Math.hypot(u - h.u, v - h.v) < h.r)) { q.p.x = pl.x; q.dead = .001; blocked++; break; }
        }
        if (!q.dead && x1 >= endX) { parts.splice(i, 1); through++; flash = 1; }
      }
      for (let i = 0; i < NPT; i++) {
        const q = parts[i]; if (!q) { PT.al[i] = 0; continue; }
        PT.set(i, q.p); PT.color(i, q.dead ? cols['--model'] : cols['--fg']); PT.al[i] = q.dead ? Math.max(0, 1 - q.dead * 2.3) : .95; PT.sz[i] = q.dead ? 1 + q.dead * 5 : 1;
      }
      PT.up();
      flash = Math.max(0, flash - dt * 3);
      target.material.color.copy(cols['--mem']).lerp(cols['--risk'], flash); target.material.opacity = .35 + flash * .5;
      target.rotation.y += dt * .4;
      const tot = blocked + through;
      hud.innerHTML = `blocked <b>${blocked}</b> · reached your data <b>${through}</b><br>leak rate <b>${tot ? (through / tot * 100).toFixed(1) : '0.0'}%</b>`;
    };
  })();

  /* ======================= Fig 27.1 · architecture ======================= */
  (function arch() {
    const s = stage('arch3d', { ortho: 6 }); if (!s) return;
    const A = window.ARCH, G = new THREE.Group(), In = new THREE.Group(); s.scene.add(G); G.add(In); In.position.x = .7;
    s.camera.position.set(12, 11, 12); s.camera.lookAt(0, 0, 0);
    const grid = []; for (let i = -9; i <= 9; i++) grid.push(i, 0, -6, i, 0, 6); for (let j = -6; j <= 6; j++) grid.push(-9, 0, j, 9, 0, j);
    const gl = segs(grid, lmat(.08)); In.add(gl);
    const blocks = {}, list = [];
    A.nodes.forEach(nd => {
      const geo = new THREE.BoxGeometry(nd.w, nd.h, nd.d); geo.translate(0, nd.h / 2, 0);
      const mats = Array.from({ length: 6 }, () => new THREE.MeshBasicMaterial());
      const mesh = new THREE.Mesh(geo, mats); mesh.position.set(nd.x, 0, nd.z); mesh.userData.id = nd.id;
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lmat(.9)); mesh.add(edge);
      const lb = label(nd.n, '#fff', { px: 20, h: .3 }); lb.position.set(nd.x, nd.h + .45, nd.z);
      In.add(mesh, lb); blocks[nd.id] = { nd, mesh, mats, edge, lb, lift: 0 }; list.push(mesh);
    });
    const P = id => { const b = blocks[id]; return V(b.nd.x, .06, b.nd.z); };
    const e = []; A.edges.forEach(([a, b]) => e.push(...P(a).toArray(), ...P(b).toArray()));
    const edges = segs(e, lmat(.5)); In.add(edges);
    const AMB = points(A.edges.length, { size: 5, flat: 1 }); In.add(AMB.obj);
    const TRC = points(1, { size: 16, flat: 1 }); In.add(TRC.obj);
    let sel = 'orch', cols;
    function style() {
      const bg = C('--bg');
      Object.values(blocks).forEach(b => {
        const c = C(b.nd.c), on = b.nd.id === sel;
        const shade = [.8, .86, on ? .55 : .7, .9, .84, .88];
        b.mats.forEach((m, i) => { m.color.copy(c).lerp(bg, shade[i]); });
        b.edge.material.color = on ? C('--fg') : c; b.edge.material.opacity = on ? 1 : .75;
        relabel(b.lb, tok(on ? '--fg' : '--fg2'));
      });
      gl.material.color = C('--fg3'); edges.material.color = C('--fg3');
      cols = { fg: C('--fg'), model: C('--model') };
      for (let i = 0; i < A.edges.length; i++) AMB.color(i, C(blocks[A.edges[i][0]].nd.c)); pointsBlend(AMB);
      TRC.color(0, cols.model); pointsBlend(TRC); AMB.up(); TRC.up();
    }
    paint(style);
    const select = (id, text) => { sel = id; style(); emit('arch:select', { id, text }); };
    const ray = new THREE.Raycaster();
    onTap(s, v => { ray.setFromCamera(v, s.camera); const h = ray.intersectObjects(list)[0]; if (h) select(h.object.userData.id); });
    s.cv.addEventListener('pointermove', e2 => { ray.setFromCamera(ndc(s, e2), s.camera); s.cv.style.cursor = ray.intersectObjects(list).length ? 'pointer' : 'grab'; });
    let trace = null;
    listen('arch:trace', () => { trace = { i: 0, k: 0 }; select(A.trace[0][0], A.trace[0][1]); });
    const spin = drag(s, G, { auto: .03, pitch: 0 });
    const tv = new THREE.Vector3();
    s.tick = (dt, t) => {
      spin(dt);
      A.edges.forEach(([a, b], i) => { tv.lerpVectors(P(a), P(b), RM ? .5 : (t * .3 + i * .17) % 1); tv.y = .12; AMB.set(i, tv); AMB.al[i] = .8; });
      AMB.up();
      Object.values(blocks).forEach(b => { const tl = b.nd.id === sel ? .18 : 0; b.lift += (tl - b.lift) * Math.min(1, dt * 6); b.mesh.position.y = b.lift; b.lb.position.y = b.nd.h + .45 + b.lift; });
      if (trace) {
        const T = A.trace, a = T[trace.i][0], b = T[Math.min(trace.i + 1, T.length - 1)][0];
        trace.k += dt * (RM ? 10 : 1.1);
        tv.lerpVectors(P(a), P(b), ease(clamp(trace.k))); tv.y = .35; TRC.set(0, tv); TRC.al[0] = 1; TRC.up();
        if (trace.k >= 1) {
          trace.i++; trace.k = 0;
          if (trace.i >= T.length - 1) { select(T[T.length - 1][0], T[T.length - 1][1]); trace = null; TRC.al[0] = 0; TRC.up(); }
          else select(T[trace.i][0], T[trace.i][1]);
        }
      }
    };
    TRC.al[0] = 0; TRC.up();
  })();

  /* ---------- one render loop for every figure ---------- */
  let last = performance.now();
  (function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    for (const s of stages) if (s.visible) { s.tick && s.tick(dt, now / 1000); draw(s); }
  })(last);
})();
