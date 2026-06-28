// =============================================================================
//  ring.js — particle on a ring (planar rigid rotor)
//  Eigenfunctions Φ_m(φ) = e^{imφ}/√(2π); energy E_m = ℏ²m²/2I, so ±m are
//  degenerate. Complex (traveling) ⇄ real (standing) basis toggle.
// =============================================================================
import { selfTest } from '../js/special.js';
import { segmented, math, layout, CONFIG, CONFIG_3D, COL, fmt } from '../js/ui.js';

const MMAX = 6;
const state = { m: 1, basis: 'complex' };

// cyclic colormap for the complex phase (start = end ⇒ seamless)
const PHASE = [[0, '#ff5d5d'], [0.17, '#ffb84d'], [0.33, '#d6ff4d'], [0.5, '#4dffd6'],
  [0.67, '#4d8cff'], [0.83, '#c14dff'], [1, '#ff5d5d']];

// Wavefunction sampler for the current state → {re, im, val, dens}; `val` is the
// real quantity plotted/lifted (Re Φ for complex, the standing wave for real).
function phiFn() {
  const { m, basis } = state;
  if (basis === 'complex') {
    const c = 1 / Math.sqrt(2 * Math.PI);
    return (p) => { const re = c * Math.cos(m * p), im = c * Math.sin(m * p); return { re, im, val: re, dens: c * c }; };
  }
  if (m === 0) { const c = 1 / Math.sqrt(2 * Math.PI); return () => ({ re: c, im: 0, val: c, dens: c * c }); }
  const c = 1 / Math.sqrt(Math.PI), am = Math.abs(m);
  return (p) => { const v = c * (m > 0 ? Math.cos(am * p) : Math.sin(am * p)); return { re: v, im: 0, val: v, dens: v * v }; };
}

// ---- Controls ---------------------------------------------------------------
function renderControls() {
  segmented(document.getElementById('seg-m'),
    range(-MMAX, MMAX), state.m, (v) => { state.m = v; render(); });
  segmented(document.getElementById('seg-basis'),
    ['complex', 'real'], state.basis,
    (v) => { state.basis = v; render(); },
    (v) => v === 'complex' ? 'complex  e^{imφ}' : 'real  cos/sin');
}
function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }

// =============================================================================
//  Equations + notes
// =============================================================================
function renderEquations() {
  const { m, basis } = state, am = Math.abs(m);
  let tex;
  if (basis === 'complex') {
    const e = m === 0 ? '' : (m > 0 ? `e^{i${m === 1 ? '' : m}\\varphi}` : `e^{-i${am === 1 ? '' : am}\\varphi}`);
    tex = `\\Phi_{${m}}(\\varphi)=\\tfrac{1}{\\sqrt{2\\pi}}\\,${e || '1'}`;
  } else if (m === 0) {
    tex = `\\Phi_{0}(\\varphi)=\\tfrac{1}{\\sqrt{2\\pi}}`;
  } else {
    tex = `\\Phi(\\varphi)=\\tfrac{1}{\\sqrt{\\pi}}\\,${m > 0 ? `\\cos(${am === 1 ? '' : am}\\varphi)` : `\\sin(${am === 1 ? '' : am}\\varphi)`}`;
  }
  math(document.getElementById('eq-phi'), tex);

  document.getElementById('phi-note').innerHTML = basis === 'complex'
    ? `Eigenstate of L̂<sub>z</sub> with eigenvalue mℏ = ${m}ℏ (circulation ${m > 0 ? 'counter-clockwise' : m < 0 ? 'clockwise' : 'none'}). ` +
      `|Φ|² = 1/2π is <b>uniform</b> — equal probability everywhere on the ring — while the phase e<sup>imφ</sup> winds ${am} time(s) around.`
    : `Standing wave (equal mix of m = ±${am}); not an L̂<sub>z</sub> eigenstate. ` +
      (am === 0 ? `Constant — uniform density.` : `|Φ|² has <b>${2 * am} nodes</b> around the ring.`);
}

// =============================================================================
//  Energy ladder: E_m = m² (ℏ²/2I); ±m share each level (g = 2, except m = 0)
// =============================================================================
function renderEnergy() {
  const { m: mSel } = state, E = (k) => k * k, kSel = Math.abs(mSel);
  math(document.getElementById('eq-energy'),
    `E_m=\\frac{\\hbar^2 m^2}{2I}=m^2\\ \\tfrac{\\hbar^2}{2I}\\qquad E_{${mSel}}=${mSel * mSel}\\ \\tfrac{\\hbar^2}{2I}`);
  document.getElementById('energy-sel').innerHTML =
    `selected: m=${mSel} &nbsp;·&nbsp; E = m² = ${mSel * mSel} (ℏ²/2I) &nbsp;·&nbsp; ` +
    (kSel === 0 ? 'non-degenerate (g = 1)' : `doubly degenerate (g = 2: m = ±${kSel})`);

  const x0 = 0.05, x1 = 0.95, e = E(kSel), traces = [];
  const bx = [], by = [];
  for (let k = 0; k <= MMAX; k++) { if (k === kSel) continue; bx.push(x0, x1, null); by.push(E(k), E(k), null); }
  traces.push({ x: bx, y: by, mode: 'lines', line: { color: COL.dim, width: 1.5 }, hoverinfo: 'skip' });
  traces.push({ x: [x0, x1], y: [e, e], mode: 'lines', line: { color: 'rgba(230,237,243,0.13)', width: 16 }, hoverinfo: 'skip' });

  const states = kSel === 0 ? [0] : [-kSel, kSel], g = states.length, w = (x1 - x0) / g;
  const sx = [], sy = [], mAnn = []; let selMid = null;
  states.forEach((mm, i) => {
    const a = x0 + w * (i + 0.12), b = x0 + w * (i + 0.88);
    sx.push(a, b, null); sy.push(e, e, null);
    mAnn.push({ x: (a + b) / 2, y: e, yanchor: 'top', yshift: -6, xanchor: 'center', text: `m=${mm}`,
      showarrow: false, font: { color: mm === mSel ? COL.text : COL.dim, size: 10 } });
    if (mm === mSel) selMid = (a + b) / 2;
  });
  traces.push({ x: sx, y: sy, mode: 'lines', line: { color: COL.accent, width: 7 }, hoverinfo: 'skip' });
  if (selMid !== null) traces.push({ x: [selMid], y: [e], mode: 'markers',
    marker: { symbol: 'circle', size: 13, color: 'rgba(0,0,0,0)', line: { color: '#fff', width: 2 } }, hoverinfo: 'skip' });

  const ann = [...mAnn];
  for (let k = 0; k <= MMAX; k++)
    ann.push({ x: x1, y: E(k), xanchor: 'left', xshift: 8, yanchor: 'middle',
      text: `E=${k * k} <span style="color:${COL.dim}">(g=${k === 0 ? 1 : 2})</span>`,
      showarrow: false, font: { color: k === kSel ? COL.text : COL.dim, size: k === kSel ? 12 : 10 } });

  Plotly.react('plot-energy', traces, layout({
    margin: { l: 56, r: 80, t: 10, b: 16 }, showlegend: false,
    xaxis: { range: [0, 1.02], showticklabels: false, showgrid: false, zeroline: false },
    yaxis: { title: 'E  (ℏ²/2I)', range: [-2, E(MMAX) + 4], zeroline: true, zerolinecolor: COL.dim },
    annotations: ann,
  }), CONFIG);
}

// =============================================================================
//  Φ_m(φ) cartesian  +  3D "wave on the ring"
// =============================================================================
function renderPhi() {
  const f = phiFn(), { basis } = state;
  const N = 400, ps = [], re = [], im = [], den = [];
  for (let i = 0; i <= N; i++) { const p = (i / N) * 2 * Math.PI, z = f(p); ps.push(p); re.push(z.re); im.push(z.im); den.push(z.dens); }

  const traces = basis === 'complex'
    ? [{ x: ps, y: re, mode: 'lines', line: { color: COL.pos, width: 2.5 }, name: 'Re Φ' },
       { x: ps, y: im, mode: 'lines', line: { color: COL.accent2, width: 2.5, dash: 'dot' }, name: 'Im Φ' },
       { x: ps, y: den, mode: 'lines', line: { color: COL.density, width: 2 }, name: '|Φ|²' }]
    : [{ x: ps, y: re, mode: 'lines', line: { color: COL.accent, width: 2.5 }, name: 'Φ' },
       { x: ps, y: den, mode: 'lines', fill: 'tozeroy', line: { color: COL.density, width: 2.5 },
         fillcolor: 'rgba(124,92,255,0.18)', name: '|Φ|²' }];
  Plotly.react('plot-phi', traces, layout({
    showlegend: true, legend: { x: 0.5, y: 1.18, xanchor: 'center', orientation: 'h', font: { size: 10 } },
    margin: { l: 46, r: 14, t: 30, b: 40 },
    xaxis: { title: 'φ  (rad)', range: [0, 2 * Math.PI],
      tickvals: [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, 2 * Math.PI],
      ticktext: ['0', '<i>π</i>/2', '<i>π</i>', '3<i>π</i>/2', '2<i>π</i>'],
      tickfont: { family: 'Georgia, "Times New Roman", serif' } },
    yaxis: { title: 'Φ , |Φ|²', zeroline: true, zerolinecolor: COL.dim },
  }), CONFIG);

  renderRing();
}

function renderRing() {
  const { m, basis } = state, f = phiFn(), N = 280, A = 0.5;
  const xs = [], ys = [], zs = [], col = [], bx = [], by = [], bz = [];
  let maxAbs = 1e-9;
  for (let i = 0; i <= N; i++) maxAbs = Math.max(maxAbs, Math.abs(f((i / N) * 2 * Math.PI).val));
  for (let i = 0; i <= N; i++) {
    const p = (i / N) * 2 * Math.PI, z = f(p);
    xs.push(Math.cos(p)); ys.push(Math.sin(p)); zs.push(A * z.val / maxAbs);
    col.push(basis === 'complex' ? ((m * p) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) : z.val);
    bx.push(Math.cos(p)); by.push(Math.sin(p)); bz.push(0);
  }
  const line = basis === 'complex'
    ? { width: 8, color: col, colorscale: PHASE, cmin: 0, cmax: 2 * Math.PI }
    : { width: 8, color: col, colorscale: 'RdBu', reversescale: true, cmin: -maxAbs, cmax: maxAbs };
  Plotly.react('plot-ring', [
    { type: 'scatter3d', mode: 'lines', x: bx, y: by, z: bz, line: { color: COL.grid, width: 3 }, hoverinfo: 'skip' },
    { type: 'scatter3d', mode: 'lines', x: xs, y: ys, z: zs, line, hoverinfo: 'skip' },
  ], layout({
    margin: { l: 0, r: 0, t: 0, b: 0 },
    scene: {
      aspectmode: 'data',
      xaxis: ax('x'), yaxis: ax('y'),
      zaxis: { ...ax('Φ (scaled)'), range: [-0.8, 0.8] },
      camera: { eye: { x: 1.4, y: 1.4, z: 1.0 } },
    },
  }), CONFIG_3D);
}
function ax(t) {
  return { title: t, gridcolor: COL.grid, zerolinecolor: COL.grid,
    backgroundcolor: 'rgba(0,0,0,0)', showbackground: true, color: COL.dim };
}

// =============================================================================
function render() {
  renderControls();
  renderEquations();
  renderEnergy();
  renderPhi();
}

function applyUrlState() {
  const p = new URLSearchParams(location.search);
  const m = parseInt(p.get('m'), 10);
  if (Number.isFinite(m) && Math.abs(m) <= MMAX) state.m = m;
  if (p.get('basis') === 'real') state.basis = 'real';
}

window.addEventListener('DOMContentLoaded', () => {
  applyUrlState();
  render();
  if (location.hash === '#test' || location.search.includes('test')) selfTest();
});
