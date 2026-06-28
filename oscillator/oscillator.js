// =============================================================================
//  oscillator.js — 1-D quantum harmonic oscillator
//  Dimensionless units: x in √(ℏ/μω) (so α = μω/ℏ = 1), E in ℏω.
//  E_n = (n+½)ℏω;  ψ_n(x) = N_n H_n(√α x) e^{−αx²/2};  H_n physicists' Hermite.
// =============================================================================
import { oscPsi, oscNorm, oscClassical, hermiteCoeffs, selfTest } from '../js/special.js';
import { segmented, math, layout, CONFIG, COL, fmt } from '../js/ui.js';

const NMAX = 10;
const state = { n: 0, classical: true, zoom: false };

function renderControls() {
  segmented(document.getElementById('seg-n'),
    range(0, NMAX), state.n, (v) => { state.n = v; render(); });
  segmented(document.getElementById('seg-classical'),
    [false, true], state.classical,
    (v) => { state.classical = v; renderControls(); renderDensity(); },
    (v) => (v ? 'show' : 'hide'));
  segmented(document.getElementById('seg-zoom'),
    [false, true], state.zoom,
    (v) => { state.zoom = v; renderControls(); renderLevels(); },
    (v) => (v ? 'on' : 'off'));
}
function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }
function turning(n) { return Math.sqrt(2 * n + 1); }   // classical turning point x_t = √(2n+1)

// H_n(y) as LaTeX (integer coefficients), e.g. 8y^{3} − 12y
function hermiteTex(n) {
  const parts = [];
  hermiteCoeffs(n).forEach((c, k) => {
    if (c.num === 0) return;
    const mag = Math.abs(c.num), coef = (mag === 1 && k > 0) ? '' : `${mag}`;
    const pw = k === 0 ? '' : (k === 1 ? 'y' : `y^{${k}}`);
    parts.push(`${c.num < 0 ? '-' : (parts.length ? '+' : '')} ${coef}${pw}`.trim());
  });
  return parts.length ? parts.join(' ') : '0';
}

// =============================================================================
//  Equations
// =============================================================================
function renderEquations() {
  const { n } = state;
  math(document.getElementById('eq-energy'),
    `E_n=\\left(n+\\tfrac{1}{2}\\right)\\hbar\\omega\\qquad E_{${n}}=\\tfrac{${2 * n + 1}}{2}\\,\\hbar\\omega\\quad(\\Delta E=\\hbar\\omega)`);
  math(document.getElementById('eq-psi'),
    `\\psi_{${n}}(x)=N_{${n}}\\,H_{${n}}(\\sqrt{\\alpha}\\,x)\\,e^{-\\alpha x^2/2},\\quad \\alpha=\\mu\\omega/\\hbar`);
  document.getElementById('eq-psi-note').innerHTML =
    `N<sub>${n}</sub> = ${fmt(oscNorm(n))} &nbsp;(α = 1) &nbsp;·&nbsp; ` +
    `H<sub>${n}</sub>(y) = ${katex.renderToString(hermiteTex(n), { displayMode: false, throwOnError: false })} , &nbsp; y = √α x`;
  document.getElementById('psi-note').innerHTML =
    `n nodes; zero-point energy E<sub>0</sub> = ½ℏω. ψ<sub>n</sub> leaks into the classically forbidden ` +
    `region |x| &gt; x<sub>t</sub> = √(2n+1) (tunneling); as n grows |ψ<sub>n</sub>|² approaches the classical ` +
    `probability (correspondence principle).`;
}

// =============================================================================
//  Energy diagram: parabola + equally spaced levels + selected ψ on its level
// =============================================================================
function renderLevels() {
  const { n } = state, xmax = Math.sqrt(2 * NMAX + 1) + 0.8;
  const traces = [];
  // parabola V = ½x²
  const vx = [], vy = [];
  for (let i = 0; i <= 400; i++) { const x = -xmax + (2 * xmax) * i / 400; vx.push(x); vy.push(0.5 * x * x); }
  traces.push({ x: vx, y: vy, mode: 'lines', line: { color: COL.dim, width: 2 }, hoverinfo: 'skip' });
  // levels (within the well, from −x_t to +x_t); selected highlighted
  for (let k = 0; k <= NMAX; k++) {
    const e = k + 0.5, xt = turning(k);
    traces.push({ x: [-xt, xt], y: [e, e], mode: 'lines',
      line: { color: k === n ? COL.text : COL.grid, width: k === n ? 1.5 : 1 }, hoverinfo: 'skip' });
  }
  // turning-point verticals for the selected level
  const e = n + 0.5, xt = turning(n);
  for (const s of [-1, 1]) traces.push({ x: [s * xt, s * xt], y: [0, e], mode: 'lines',
    line: { color: COL.accent2, width: 1, dash: 'dot' }, hoverinfo: 'skip' });
  // selected ψ_n drawn on its energy line (bigger amplitude when zoomed in)
  const ampScale = state.zoom ? 0.75 : 0.42;
  const px = [], py = []; let amax = 1e-9;
  for (let i = 0; i <= 600; i++) { const x = -xmax + (2 * xmax) * i / 600; amax = Math.max(amax, Math.abs(oscPsi(n, x))); }
  for (let i = 0; i <= 600; i++) { const x = -xmax + (2 * xmax) * i / 600; px.push(x); py.push(e + ampScale * oscPsi(n, x) / amax); }
  traces.push({ x: px, y: py, mode: 'lines', line: { color: COL.accent, width: 2.5 }, hoverinfo: 'skip' });

  const yRange = state.zoom ? [e - 0.95, e + 0.95] : [-0.3, NMAX + 1.6];
  const ann = [];
  for (let k = 0; k <= NMAX; k++)
    if (!state.zoom || (k + 0.5 >= yRange[0] && k + 0.5 <= yRange[1]))
      ann.push({ x: -xmax, y: k + 0.5, xanchor: 'right', xshift: -4, yanchor: 'middle', text: `n=${k}`,
        showarrow: false, font: { color: k === n ? COL.text : COL.dim, size: k === n ? 12 : 9 } });

  Plotly.react('plot-levels', traces, layout({
    margin: { l: 56, r: 16, t: 10, b: 44 },
    xaxis: { title: 'x  (√(ℏ/μω))', range: [-xmax, xmax], zeroline: false },
    yaxis: { title: 'E , V  (ℏω)', range: yRange, zeroline: false },
    annotations: ann,
  }), CONFIG);
}

// =============================================================================
//  ψ_n(x)  and  |ψ_n(x)|² (with classical probability)
// =============================================================================
function renderWave() {
  const { n } = state, xr = turning(n) + 2.8, N = 700, xs = [], ys = [];
  for (let i = 0; i <= N; i++) { const x = -xr + (2 * xr) * i / N; xs.push(x); ys.push(oscPsi(n, x)); }
  const nodes = [];
  for (let i = 1; i <= N; i++) if ((ys[i - 1] < 0) !== (ys[i] < 0)) nodes.push(xs[i] - (xs[i] - xs[i - 1]) * Math.abs(ys[i]) / (Math.abs(ys[i - 1]) + Math.abs(ys[i])));
  const xt = turning(n);
  Plotly.react('plot-psi', [
    { x: xs, y: ys, mode: 'lines', line: { color: COL.accent, width: 2.5 } },
    { x: nodes, y: nodes.map(() => 0), mode: 'markers',
      marker: { color: COL.accent2, size: 7, symbol: 'circle-open', line: { width: 2 } } },
    tpLine(xt, [Math.min(...ys), Math.max(...ys)]), tpLine(-xt, [Math.min(...ys), Math.max(...ys)]),
  ], layout({
    xaxis: { title: 'x  (√(ℏ/μω))', range: [-xr, xr], zeroline: true, zerolinecolor: COL.dim },
    yaxis: { title: 'ψ<sub>n</sub>(x)', zeroline: true, zerolinecolor: COL.dim },
  }), CONFIG);
  renderDensity();
}

function renderDensity() {
  const { n, classical } = state, A = turning(n), xr = A + 2.8, N = 700;
  const xs = [], d = []; let dmax = 1e-9;
  for (let i = 0; i <= N; i++) { const x = -xr + (2 * xr) * i / N, p = oscPsi(n, x); xs.push(x); d.push(p * p); dmax = Math.max(dmax, p * p); }
  const cap = dmax * 1.3;
  const traces = [
    { x: xs, y: d, mode: 'lines', fill: 'tozeroy', line: { color: COL.density, width: 2.5 },
      fillcolor: 'rgba(124,92,255,0.18)', name: '|ψ|²' },
  ];
  if (classical) {
    const cx = [], cy = [];
    for (let i = 0; i <= N; i++) {
      const x = xs[i], v = oscClassical(n, x);
      cx.push(x); cy.push(v === null ? null : Math.min(v, cap));
    }
    traces.push({ x: cx, y: cy, mode: 'lines', line: { color: COL.accent2, width: 2, dash: 'dot' }, name: 'classical' });
  }
  traces.push(tpLine(A, [0, cap]), tpLine(-A, [0, cap]));
  Plotly.react('plot-density', traces, layout({
    showlegend: classical, legend: { x: 0.5, y: 1.15, xanchor: 'center', orientation: 'h', font: { size: 10 } },
    margin: { l: 46, r: 14, t: classical ? 28 : 10, b: 44 },
    xaxis: { title: 'x  (√(ℏ/μω))', range: [-xr, xr], zeroline: true, zerolinecolor: COL.dim },
    yaxis: { title: '|ψ<sub>n</sub>(x)|²', range: [0, cap * 1.05] },
  }), CONFIG);
}

function tpLine(x, [y0, y1]) {
  return { x: [x, x], y: [y0, y1], mode: 'lines', line: { color: COL.accent2, width: 1, dash: 'dot' },
    hoverinfo: 'skip', showlegend: false };
}

// =============================================================================
function render() {
  renderControls();
  renderEquations();
  renderLevels();
  renderWave();   // also calls renderDensity()
}

function applyUrlState() {
  const p = new URLSearchParams(location.search);
  const n = parseInt(p.get('n'), 10);
  if (n >= 0 && n <= NMAX) state.n = n;
  if (p.get('classical') === '0') state.classical = false;
  if (p.get('zoom') === '1') state.zoom = true;
}

window.addEventListener('DOMContentLoaded', () => {
  applyUrlState();
  render();
  if (location.hash === '#test' || location.search.includes('test')) selfTest();
});
