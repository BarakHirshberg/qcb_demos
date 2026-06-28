// =============================================================================
//  box.js — particle in an infinite square well
//  Modes: 1D · 2D · two free particles (1D) · two interacting particles (1D).
//  Units: lengths in L (=1), energies in h²/8mL².  1D: ψ_n=√(2/L)sin(nπx/L), E_n=n².
//  Interacting mode: H = T₁+T₂ + C/√((x₁−x₂)²+η²), solved by configuration
//  interaction in the product box basis (cf. Guy Cohen's two-particle demo).
// =============================================================================
import { eighJacobi, selfTest } from '../js/special.js';
import { segmented, math, layout, CONFIG, CONFIG_3D, COL } from '../js/ui.js';

const NMAX1 = 8, NMAX2 = 4;
const CI_NMAX = 10, CI_NG = 140, ETA = 0.05, UMAX = 10, KSHOW = 8;
const state = { mode: '1d', n: 1, a: 1, b: 1, slice: 0.5, zoom: false, U: 3, k: 0 };

const el = (id) => document.getElementById(id);
const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
const psi1 = (n, x) => Math.SQRT2 * Math.sin(n * Math.PI * x);
const psi2 = (a, b, x, y) => 2 * Math.sin(a * Math.PI * x) * Math.sin(b * Math.PI * y);
function degeneracy(a, b) {
  const E = a * a + b * b; let g = 0;
  for (let i = 1; i <= NMAX2; i++) for (let j = 1; j <= NMAX2; j++) if (i * i + j * j === E) g++;
  return g;
}

// =============================================================================
//  Interacting solver (configuration interaction)
// =============================================================================
let V1 = null;                       // interaction matrix at unit strength (cached)
let ciCache = { U: null };

function buildV1() {
  const nm = CI_NMAX, Ng = CI_NG, M = nm * nm, dx = 1 / Ng, xs = [];
  for (let i = 0; i < Ng; i++) xs.push((i + 0.5) / Ng);
  const g = [];                      // g[(p-1)*nm+(q-1)][i] = φ_p φ_q at xs[i]
  for (let p = 1; p <= nm; p++) for (let q = 1; q <= nm; q++) {
    const arr = new Array(Ng); for (let i = 0; i < Ng; i++) arr[i] = psi1(p, xs[i]) * psi1(q, xs[i]);
    g[(p - 1) * nm + (q - 1)] = arr;
  }
  const W = [];                      // W[(b'-1)*nm+(b-1)][i] = ∫ g_{b'b}(x₂) U(x₁ᵢ,x₂) dx₂
  for (let p = 0; p < M; p++) {
    const gg = g[p], w = new Array(Ng).fill(0);
    for (let i = 0; i < Ng; i++) { let s = 0; for (let j = 0; j < Ng; j++) s += gg[j] / Math.sqrt((xs[i] - xs[j]) ** 2 + ETA * ETA); w[i] = s * dx; }
    W[p] = w;
  }
  const idx = (a, b) => (a - 1) * nm + (b - 1), V = Array.from({ length: M }, () => new Array(M).fill(0));
  for (let ap = 1; ap <= nm; ap++) for (let bp = 1; bp <= nm; bp++) for (let a = 1; a <= nm; a++) for (let b = 1; b <= nm; b++) {
    const gg = g[(ap - 1) * nm + (a - 1)], w = W[(bp - 1) * nm + (b - 1)];
    let s = 0; for (let i = 0; i < Ng; i++) s += gg[i] * w[i];
    V[idx(ap, bp)][idx(a, b)] = s * dx;
  }
  return V;
}

function solveCI(U) {
  if (ciCache.U === U) return ciCache;
  if (!V1) V1 = buildV1();
  const nm = CI_NMAX, M = nm * nm;
  const H = Array.from({ length: M }, (_, r) => { const row = new Array(M); for (let c = 0; c < M; c++) row[c] = U * V1[r][c]; return row; });
  for (let a = 1; a <= nm; a++) for (let b = 1; b <= nm; b++) H[(a - 1) * nm + (b - 1)][(a - 1) * nm + (b - 1)] += a * a + b * b;
  const { values, vectors } = eighJacobi(H);
  ciCache = { U, vals: values, vecs: vectors };
  return ciCache;
}

// =============================================================================
//  Shared ψ field (heatmaps / surface / conditional all read this)
// =============================================================================
let field = null;                    // { u, Zp[y][x], Zd[y][x], amax }

function buildFieldProduct(a, b) {
  const N = 100, u = []; for (let i = 0; i <= N; i++) u.push(i / N);
  const Zp = [], Zd = []; let amax = 0;
  for (let jy = 0; jy <= N; jy++) {
    const rp = new Array(N + 1), rd = new Array(N + 1);
    for (let ix = 0; ix <= N; ix++) { const v = psi2(a, b, u[ix], u[jy]); rp[ix] = v; rd[ix] = v * v; if (Math.abs(v) > amax) amax = Math.abs(v); }
    Zp.push(rp); Zd.push(rd);
  }
  field = { u, Zp, Zd, amax };
}

function buildFieldCI(vec) {
  const nm = CI_NMAX, N = 100, u = []; for (let i = 0; i <= N; i++) u.push(i / N);
  const Phi = []; for (let n = 1; n <= nm; n++) { const a = new Array(N + 1); for (let i = 0; i <= N; i++) a[i] = psi1(n, u[i]); Phi[n] = a; }
  const T = [];                      // T[a][jy] = Σ_b c_{ab} φ_b(x₂ⱼ)
  for (let a = 1; a <= nm; a++) {
    const row = new Array(N + 1).fill(0);
    for (let b = 1; b <= nm; b++) { const c = vec[(a - 1) * nm + (b - 1)]; if (!c) continue; const pb = Phi[b]; for (let j = 0; j <= N; j++) row[j] += c * pb[j]; }
    T[a] = row;
  }
  const Zp = [], Zd = []; let amax = 0;
  for (let jy = 0; jy <= N; jy++) {
    const rp = new Array(N + 1), rd = new Array(N + 1);
    for (let ix = 0; ix <= N; ix++) { let v = 0; for (let a = 1; a <= nm; a++) v += Phi[a][ix] * T[a][jy]; rp[ix] = v; rd[ix] = v * v; if (Math.abs(v) > amax) amax = Math.abs(v); }
    Zp.push(rp); Zd.push(rd);
  }
  field = { u, Zp, Zd, amax };
}

// =============================================================================
//  Controls + visibility
// =============================================================================
function renderControls() {
  segmented(el('seg-mode'), ['1d', '2d', '2p', '2pi'], state.mode,
    (v) => { state.mode = v; render(); },
    (v) => ({ '1d': '1D', '2d': '2D', '2p': '2 particles', '2pi': '2 particles (interacting)' }[v]));
  segmented(el('seg-n'), range(1, NMAX1), state.n, (v) => { state.n = v; render(); });
  segmented(el('seg-a'), range(1, NMAX2), state.a, (v) => { state.a = v; render(); });
  segmented(el('seg-b'), range(1, NMAX2), state.b, (v) => { state.b = v; render(); });
  segmented(el('seg-zoom'), [false, true], state.zoom,
    (v) => { state.zoom = v; renderControls(); renderEnergy1D(); }, (v) => (v ? 'on' : 'off'));
  segmented(el('seg-k'), range(0, KSHOW - 1), state.k, (v) => { state.k = v; render(); },
    (v) => (v === 0 ? 'ground' : `k=${v}`));
  el('lbl-a').innerHTML = state.mode === '2p' ? 'n<sub>1</sub>' : 'n<sub>x</sub>';
  el('lbl-b').innerHTML = state.mode === '2p' ? 'n<sub>2</sub>' : 'n<sub>y</sub>';
}
function setVisibility() {
  const m = state.mode, ab = m === '2d' || m === '2p';
  el('qn-1d').style.display = m === '1d' ? '' : 'none';
  el('qn-a').style.display = ab ? '' : 'none';
  el('qn-b').style.display = ab ? '' : 'none';
  el('qn-U').style.display = m === '2pi' ? '' : 'none';
  el('qn-k').style.display = m === '2pi' ? '' : 'none';
  el('card-energy').style.display = m === '2pi' ? 'none' : '';
  el('eq-2pi').style.display = m === '2pi' ? '' : 'none';
  el('panel-1d').style.display = m === '1d' ? '' : 'none';
  el('panel-2d').style.display = m === '1d' ? 'none' : '';
  el('panel-2p-extra').style.display = (m === '2p' || m === '2pi') ? '' : 'none';
  el('zoom-ctrl').style.display = m === '1d' ? '' : 'none';
}

// =============================================================================
//  Equations + notes
// =============================================================================
function renderEquations() {
  const { mode, n, a, b } = state;
  if (mode === '1d') {
    el('energy-sub').textContent = '— 1D box,  Eₙ = n² · h²/8mL²';
    math(el('eq-box'), `\\psi_n(x)=\\sqrt{\\tfrac{2}{L}}\\,\\sin\\!\\left(\\tfrac{n\\pi x}{L}\\right),\\qquad E_n=\\frac{n^2 h^2}{8mL^2}\\quad n=1,2,\\dots`);
    el('energy-hint').innerHTML = 'Infinite square well: ψ = 0 at the walls. Levels grow as n² (spacing increases with n), and there is a non-zero ground-state energy E₁. The selected ψₙ is drawn on its energy line.';
    el('energy-sel').innerHTML = `selected: n = ${n} &nbsp;·&nbsp; E = n² = ${n * n} (h²/8mL²) &nbsp;·&nbsp; ${n - 1} interior node${n - 1 === 1 ? '' : 's'}`;
    el('psi-note-1d').innerHTML = `ψ<sub>n</sub> = √(2/L)·sin(nπx/L), with n−1 interior nodes and ⟨x⟩ = L/2. As n grows the density's local average approaches the uniform classical result (correspondence).`;
    return;
  }
  if (mode === '2pi') {
    const { vals } = solveCI(state.U), k = Math.min(state.k, vals.length - 1);
    math(el('eq-2pi'), `\\hat H=-\\tfrac{\\hbar^2}{2m}\\!\\left(\\partial_{x_1}^2+\\partial_{x_2}^2\\right)+\\dfrac{C}{\\sqrt{(x_1-x_2)^2+\\eta^2}}`);
    el('h2-2d').innerHTML = `Wavefunction &nbsp;ψ(x₁,x₂) &nbsp;<span class="sub-h">— ${k === 0 ? 'ground state' : `eigenstate k = ${k}`}, &nbsp;E = ${vals[k].toFixed(2)} (h²/8mL²), &nbsp;C = ${state.U.toFixed(1)} (numerical)</span>`;
    el('lbl-hm-psi').innerHTML = 'ψ(x₁,x₂) — signed';
    el('lbl-hm-dens').innerHTML = '|ψ(x₁,x₂)|² — correlated joint density';
    el('psi-note-2d').innerHTML = `With repulsion the state <b>no longer factorizes</b>: ψ(x₁,x₂) ≠ φ(x₁)φ(x₂). The density is depleted along the diagonal x₁ = x₂ (the particles avoid each other) — they are <b>correlated</b>. Set C = 0 to recover the uncorrelated product.`;
    el('lbl-surf').innerHTML = '3D surface z = ψ(x₁,x₂) · drag to rotate';
    el('corr-note').innerHTML = `<b>Now interacting.</b> Drag x₁: particle 2's conditional P(x₂|x₁) (dashed) <b>shifts away from x₁</b> — finding particle 1 changes where particle 2 likely is. That is correlation; the joint no longer factorizes. (Slide C → 0 to recover the flat, uncorrelated case.)`;
    return;
  }
  const two = mode === '2p';
  el('energy-sub').textContent = two ? '— two particles,  E = E₁ + E₂' : '— 2D box,  E = (nₓ²+n_y²) · h²/8mL²';
  math(el('eq-box'), two
    ? `\\psi_{n_1 n_2}(x_1,x_2)=\\varphi_{n_1}(x_1)\\,\\varphi_{n_2}(x_2)=\\tfrac{2}{L}\\sin\\!\\tfrac{n_1\\pi x_1}{L}\\,\\sin\\!\\tfrac{n_2\\pi x_2}{L},\\quad E=\\tfrac{h^2}{8mL^2}\\,(n_1^2+n_2^2)`
    : `\\psi_{n_x n_y}(x,y)=\\tfrac{2}{L}\\sin\\!\\tfrac{n_x\\pi x}{L}\\,\\sin\\!\\tfrac{n_y\\pi y}{L},\\quad E=\\tfrac{h^2}{8mL^2}\\,(n_x^2+n_y^2)`);
  el('energy-hint').innerHTML = two
    ? 'No interaction ⇒ the Hamiltonian separates and the energy is a sum E = E₁ + E₂. Swapping the two quantum numbers gives a degenerate state.'
    : 'A 2D well separates into x and y. Distinct (nₓ,n_y) with the same nₓ²+n_y² are degenerate (e.g. (1,2) and (2,1)).';
  el('energy-sel').innerHTML = `selected: (${a},${b}) &nbsp;·&nbsp; E = ${a}²+${b}² = ${a * a + b * b} (h²/8mL²) &nbsp;·&nbsp; degeneracy g = ${degeneracy(a, b)}`;
  el('h2-2d').innerHTML = two ? 'Wavefunction &nbsp;ψ(x₁,x₂)' : 'Wavefunction &nbsp;ψ(x,y)';
  el('lbl-hm-psi').innerHTML = two ? 'ψ(x₁,x₂) — signed (nodal lines)' : 'ψ(x,y) — signed (nodal lines)';
  el('lbl-hm-dens').innerHTML = two
    ? '|ψ(x₁,x₂)|² — joint: particle 1 near x₁ <b>and</b> particle 2 near x₂'
    : '|ψ(x,y)|² — probability of finding the particle near (x,y)';
  el('psi-note-2d').innerHTML = two
    ? `<b>Same math as the 2D box, different question.</b> Here |ψ(x₁,x₂)|² dx₁dx₂ is the <b>joint</b> probability that particle 1 is near x₁ <i>and</i> particle 2 is near x₂. Since the particles don't interact, ψ = φ(x₁)φ(x₂) factorizes — see the correlation panel below.`
    : `One particle in the plane: |ψ(x,y)|² dx dy is the probability of finding it in the small area dx dy around (x,y). Nodal lines at x = kL/nₓ and y = kL/n_y; (n_y,nₓ) is degenerate (x↔y symmetry).`;
  el('lbl-surf').innerHTML = two ? '3D surface z = ψ(x₁,x₂) · drag to rotate' : '3D surface z = ψ(x,y) — the “drumhead” mode · drag to rotate';
  if (two) el('corr-note').innerHTML =
    `The joint probability <b>factorizes</b>: P(x₁,x₂) = |φ<sub>n₁</sub>(x₁)|² · |φ<sub>n₂</sub>(x₂)|². So if you find particle 1 at some x₁, particle 2's distribution is the <b>conditional</b> P(x₂|x₁) — and because of the factorization it equals the plain marginal |φ<sub>n₂</sub>(x₂)|² <b>no matter where x₁ is</b>. Drag the slider: the dashed conditional never moves ⇒ the particles are <b>uncorrelated</b>. (For interaction, try the “2 particles (interacting)” mode.)`;
}

// =============================================================================
//  Energy diagrams
// =============================================================================
function renderEnergy() {
  if (state.mode === '2pi') return;   // energy diagram removed for interacting mode
  if (state.mode === '1d') renderEnergy1D();
  else renderEnergy2D();
}

function renderEnergy1D() {
  const n = state.n, ymax = NMAX1 * NMAX1 + 4, traces = [];
  for (const w of [[0, 0], [1, 1]]) traces.push({ x: [w[0], w[1]], y: [0, ymax], mode: 'lines', line: { color: COL.dim, width: 3 }, hoverinfo: 'skip' });
  traces.push({ x: [0, 1], y: [0, 0], mode: 'lines', line: { color: COL.dim, width: 3 }, hoverinfo: 'skip' });
  for (let k = 1; k <= NMAX1; k++) traces.push({ x: [0, 1], y: [k * k, k * k], mode: 'lines',
    line: { color: k === n ? COL.text : COL.grid, width: k === n ? 1.5 : 1 }, hoverinfo: 'skip' });
  const e = n * n, gap = 2 * n - 1, amp = (state.zoom ? 0.7 : 0.42) * gap;
  const px = [], py = [];
  for (let i = 0; i <= 400; i++) { const x = i / 400; px.push(x); py.push(e + amp * psi1(n, x) / Math.SQRT2); }
  traces.push({ x: px, y: py, mode: 'lines', line: { color: COL.accent, width: 2.5 }, hoverinfo: 'skip' });
  const yRange = state.zoom ? [e - 0.9 * gap, e + 0.9 * gap] : [-2, ymax];
  const ann = [];
  for (let k = 1; k <= NMAX1; k++)
    if (!state.zoom || (k * k >= yRange[0] && k * k <= yRange[1]))
      ann.push({ x: 0, y: k * k, xanchor: 'right', xshift: -6, yanchor: 'middle',
        text: `n=${k}`, showarrow: false, font: { color: k === n ? COL.text : COL.dim, size: k === n ? 12 : 9 } });
  Plotly.react('plot-energy', traces, layout({
    margin: { l: 60, r: 16, t: 10, b: 44 },
    xaxis: { title: 'x  (L)', range: [-0.05, 1.05], zeroline: false },
    yaxis: { title: 'E  (h²/8mL²)', range: yRange, zeroline: false },
    annotations: ann,
  }), CONFIG);
}

function renderEnergy2D() {
  const { a, b } = state, selE = a * a + b * b;
  const map = new Map();
  for (let i = 1; i <= NMAX2; i++) for (let j = 1; j <= NMAX2; j++) {
    const e = i * i + j * j; if (!map.has(e)) map.set(e, []); map.get(e).push([i, j]);
  }
  const lv = [...map.entries()].sort((p, q) => p[0] - q[0]), Emax = lv[lv.length - 1][0];
  const x0 = 0.05, x1 = 0.95, traces = [];
  const bx = [], by = [];
  for (const [e] of lv) { if (e === selE) continue; bx.push(x0, x1, null); by.push(e, e, null); }
  traces.push({ x: bx, y: by, mode: 'lines', line: { color: COL.dim, width: 1.5 }, hoverinfo: 'skip' });
  traces.push({ x: [x0, x1], y: [selE, selE], mode: 'lines', line: { color: 'rgba(230,237,243,0.13)', width: 16 }, hoverinfo: 'skip' });
  const states = map.get(selE), g = states.length, w = (x1 - x0) / g;
  const sx = [], sy = [], mAnn = []; let selMid = null;
  states.forEach(([i, j], idx) => {
    const aa = x0 + w * (idx + 0.12), bb = x0 + w * (idx + 0.88);
    sx.push(aa, bb, null); sy.push(selE, selE, null);
    const isSel = i === a && j === b;
    mAnn.push({ x: (aa + bb) / 2, y: selE, yanchor: 'top', yshift: -6, xanchor: 'center', text: `(${i},${j})`,
      showarrow: false, font: { color: isSel ? COL.text : COL.dim, size: 10 } });
    if (isSel) selMid = (aa + bb) / 2;
  });
  traces.push({ x: sx, y: sy, mode: 'lines', line: { color: COL.accent, width: 7 }, hoverinfo: 'skip' });
  if (selMid !== null) traces.push({ x: [selMid], y: [selE], mode: 'markers',
    marker: { symbol: 'circle', size: 13, color: 'rgba(0,0,0,0)', line: { color: '#fff', width: 2 } }, hoverinfo: 'skip' });
  const ann = [...mAnn];
  for (const [e, st] of lv) ann.push({ x: x1, y: e, xanchor: 'left', xshift: 8, yanchor: 'middle',
    text: `E=${e} <span style="color:${COL.dim}">(g=${st.length})</span>`,
    showarrow: false, font: { color: e === selE ? COL.text : COL.dim, size: e === selE ? 12 : 10 } });
  Plotly.react('plot-energy', traces, layout({
    margin: { l: 56, r: 96, t: 10, b: 16 }, showlegend: false,
    xaxis: { range: [0, 1.04], showticklabels: false, showgrid: false, zeroline: false },
    yaxis: { title: 'E  (h²/8mL²)', range: [0, Emax + 2], zeroline: true, zerolinecolor: COL.dim },
    annotations: ann,
  }), CONFIG);
}

// =============================================================================
//  Wavefunction panels (read the shared `field`)
// =============================================================================
function renderBody1D() {
  const n = state.n, N = 500, xs = [], ys = [], ds = [];
  for (let i = 0; i <= N; i++) { const x = i / N, p = psi1(n, x); xs.push(x); ys.push(p); ds.push(p * p); }
  const nodes = []; for (let k = 1; k < n; k++) nodes.push(k / n);
  Plotly.react('plot-psi', [
    { x: xs, y: ys, mode: 'lines', line: { color: COL.accent, width: 2.5 } },
    { x: nodes, y: nodes.map(() => 0), mode: 'markers', marker: { color: COL.accent2, size: 7, symbol: 'circle-open', line: { width: 2 } } },
  ], layout({ xaxis: { title: 'x  (L)', range: [0, 1] }, yaxis: { title: 'ψ<sub>n</sub>(x)', zeroline: true, zerolinecolor: COL.dim } }), CONFIG);
  Plotly.react('plot-dens', [
    { x: xs, y: ds, mode: 'lines', fill: 'tozeroy', line: { color: COL.density, width: 2.5 }, fillcolor: 'rgba(124,92,255,0.18)' },
  ], layout({ xaxis: { title: 'x  (L)', range: [0, 1] }, yaxis: { title: '|ψ<sub>n</sub>(x)|²', rangemode: 'tozero' } }), CONFIG);
}

function renderBody2D() {
  const { mode } = state, { u, Zp, Zd, amax } = field;
  const lab = (mode === '2d') ? ['x', 'y'] : ['x₁', 'x₂'];
  const hmLayout = () => layout({ margin: { l: 44, r: 10, t: 6, b: 40 },
    xaxis: { title: `${lab[0]}  (L)`, scaleanchor: 'y', constrain: 'domain' }, yaxis: { title: `${lab[1]}  (L)` } });
  Plotly.react('plot-hm-psi', [{ type: 'heatmap', x: u, y: u, z: Zp, zmid: 0, zmin: -amax, zmax: amax,
    colorscale: 'RdBu', reversescale: true, showscale: false, hoverinfo: 'skip' }], hmLayout(), CONFIG);
  const densLayout = hmLayout();
  if (mode === '2p' || mode === '2pi') densLayout.shapes = [{ type: 'line', xref: 'x', yref: 'y',
    x0: state.slice, x1: state.slice, y0: 0, y1: 1, line: { color: '#fff', width: 2, dash: 'dot' } }];
  Plotly.react('plot-hm-dens', [{ type: 'heatmap', x: u, y: u, z: Zd, zmin: 0, zmax: amax * amax,
    colorscale: 'Hot', showscale: false, hoverinfo: 'skip' }], densLayout, CONFIG);
  const scAx = (t) => ({ title: t, gridcolor: COL.grid, zerolinecolor: COL.grid, backgroundcolor: 'rgba(0,0,0,0)', showbackground: true, color: COL.dim });
  Plotly.react('plot-surf', [{ type: 'surface', x: u, y: u, z: Zp, surfacecolor: Zp, cmid: 0,
    colorscale: 'RdBu', reversescale: true, showscale: false,
    lighting: { ambient: 0.7, diffuse: 0.7, specular: 0.1 }, hoverinfo: 'skip' }], layout({
    margin: { l: 0, r: 0, t: 0, b: 0 },
    scene: { aspectmode: 'cube', xaxis: scAx(lab[0]), yaxis: scAx(lab[1]), zaxis: scAx('ψ'), camera: { eye: { x: 1.6, y: 1.6, z: 1.1 } } },
  }), CONFIG_3D);
}

// marginals + conditional, computed numerically from the |ψ|² grid (works for
// both the factorized 2p case and the correlated 2pi case)
function drawSlice() {
  const { u, Zd } = field, N = u.length - 1, du = 1 / N, x1 = state.slice;
  const P1 = new Array(N + 1).fill(0), P2 = new Array(N + 1).fill(0);
  for (let jy = 0; jy <= N; jy++) for (let ix = 0; ix <= N; ix++) { const d = Zd[jy][ix]; P1[ix] += d * du; P2[jy] += d * du; }
  const istar = Math.round(x1 * N);
  let Zc = 0; for (let jy = 0; jy <= N; jy++) Zc += Zd[jy][istar] * du;
  const cond = new Array(N + 1); for (let jy = 0; jy <= N; jy++) cond[jy] = Zc > 1e-9 ? Zd[jy][istar] / Zc : P2[jy];
  const p1max = Math.max(...P1);
  Plotly.react('plot-marg1', [
    { x: u, y: P1, mode: 'lines', fill: 'tozeroy', line: { color: COL.density, width: 2 }, fillcolor: 'rgba(124,92,255,0.18)' },
    { x: [x1, x1], y: [0, p1max * 1.05], mode: 'lines', line: { color: '#fff', width: 2, dash: 'dot' } },
  ], layout({ margin: { l: 46, r: 14, t: 10, b: 40 },
    xaxis: { title: 'x₁  (L)', range: [0, 1] }, yaxis: { title: 'P(x₁)', rangemode: 'tozero' } }), CONFIG);
  Plotly.react('plot-cond', [
    { x: u, y: P2, mode: 'lines', fill: 'tozeroy', line: { color: COL.density, width: 2 }, fillcolor: 'rgba(124,92,255,0.18)', name: 'marginal P(x₂)' },
    { x: u, y: cond, mode: 'lines', line: { color: COL.accent2, width: 2.5, dash: 'dot' }, name: 'conditional P(x₂|x₁)' },
  ], layout({ showlegend: true, legend: { x: 0.5, y: 1.16, xanchor: 'center', orientation: 'h', font: { size: 10 } },
    margin: { l: 46, r: 14, t: 28, b: 40 }, xaxis: { title: 'x₂  (L)', range: [0, 1] },
    yaxis: { title: 'density', rangemode: 'tozero' } }), CONFIG);
  el('slice-val').textContent = `x₁ = ${x1.toFixed(2)} L`;
  try { Plotly.relayout('plot-hm-dens', { 'shapes[0].x0': x1, 'shapes[0].x1': x1 }); } catch (e) { /* not a 2-particle mode */ }
}

// =============================================================================
function render() {
  renderControls();
  setVisibility();
  renderEquations();
  renderEnergy();
  if (state.mode === '1d') { renderBody1D(); return; }
  if (state.mode === '2pi') {
    const { vecs } = solveCI(state.U);
    buildFieldCI(vecs[Math.min(state.k, vecs.length - 1)]);
    renderBody2D(); drawSlice(); return;
  }
  buildFieldProduct(state.a, state.b);
  renderBody2D();
  if (state.mode === '2p') drawSlice();
}

function applyUrlState() {
  const p = new URLSearchParams(location.search);
  const mode = p.get('mode');
  if (['1d', '2d', '2p', '2pi'].includes(mode)) state.mode = mode;
  const n = parseInt(p.get('n'), 10); if (n >= 1 && n <= NMAX1) state.n = n;
  const a = parseInt(p.get('a'), 10); if (a >= 1 && a <= NMAX2) state.a = a;
  const b = parseInt(p.get('b'), 10); if (b >= 1 && b <= NMAX2) state.b = b;
  const k = parseInt(p.get('k'), 10); if (k >= 0 && k < KSHOW) state.k = k;
  const U = parseFloat(p.get('U')); if (U >= 0 && U <= UMAX) state.U = U;
  if (p.get('zoom') === '1') state.zoom = true;
}

let slicePending = false;
function scheduleSlice() {
  if (slicePending) return;
  slicePending = true;
  requestAnimationFrame(() => { slicePending = false; if (state.mode === '2p' || state.mode === '2pi') drawSlice(); });
}
let uPending = false;
function scheduleU() {
  if (uPending) return;
  uPending = true;
  requestAnimationFrame(() => { uPending = false; render(); });
}

window.addEventListener('DOMContentLoaded', () => {
  applyUrlState();
  el('slice-slider').addEventListener('input', (e) => { state.slice = Math.min(0.98, Math.max(0.02, e.target.value / 100)); scheduleSlice(); });
  const us = el('U-slider');
  us.value = String(Math.round((state.U / UMAX) * 100));
  us.addEventListener('input', () => { state.U = (us.value / 100) * UMAX; el('U-val').textContent = `C = ${state.U.toFixed(1)}`; scheduleU(); });
  el('U-val').textContent = `C = ${state.U.toFixed(1)}`;
  render();
  if (location.hash === '#test' || location.search.includes('test')) selfTest();
});
