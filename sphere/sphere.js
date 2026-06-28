// =============================================================================
//  sphere.js — particle on a sphere (rigid rotor)
//  Eigenfunctions are the spherical harmonics Y_ℓ^m(ϑ,φ); energies E_ℓ depend
//  only on ℓ with (2ℓ+1)-fold degeneracy. Reuses the hydrogen angular machinery.
// =============================================================================
import {
  sphHarmNorm, assocLegendreParts,
  sphHarmComplex, realSphHarm, realOrbitalName, selfTest,
} from '../js/special.js';
import { segmented, math, layout, CONFIG, CONFIG_3D, COL, fmt } from '../js/ui.js';
import {
  katexInline, legendreTex, renderAngular, polarNodeAngles, azimuthalNodePlanes,
  coneSurface, planeSurface, scene3d,
} from '../js/angular.js';

const LMAX = 6;
const state = { l: 1, m: 0, showNodes: true };
const LCOL = ['#6ea8fe', '#f78fb3', '#4dd2a0', '#ffd166', '#c792ea', '#ff9f6b'];
const LNAME = ['s', 'p', 'd', 'f', 'g', 'h'];

// ---- Controls: only valid (ℓ,m) offered (m = −ℓ…+ℓ) -------------------------
function renderControls() {
  segmented(document.getElementById('seg-l'),
    range(0, LMAX), state.l, (v) => { state.l = v; clampM(); render(); });
  segmented(document.getElementById('seg-m'),
    range(-state.l, state.l), state.m, (v) => { state.m = v; render(); });
  segmented(document.getElementById('seg-nodes'),
    [false, true], state.showNodes,
    (v) => { state.showNodes = v; renderControls(); renderBalloons(); },
    (v) => (v ? 'show' : 'hide'));
}
function clampM() { if (Math.abs(state.m) > state.l) state.m = 0; }
function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }

// =============================================================================
//  Equations
// =============================================================================
function renderEquations() {
  const { l, m } = state, am = Math.abs(m);
  const Nlm = sphHarmNorm(l, m);
  const phiSign = m === 0 ? '' : (m > 0 ? `e^{i${m === 1 ? '' : m}\\varphi}` : `e^{-i${m === -1 ? '' : -m}\\varphi}`);
  const phi = m === 0 ? '\\tfrac{1}{\\sqrt{2\\pi}}' : `\\tfrac{1}{\\sqrt{2\\pi}}\\,${phiSign}`;
  math(document.getElementById('eq-angular'),
    `Y_{${l}}^{${m}}(\\vartheta,\\varphi)=\\underbrace{N_{\\ell}^{m}\\,P_{${l}}^{${am}}(\\cos\\vartheta)}_{\\Theta_{${l}${m}}(\\vartheta)}\\;\\cdot\\;\\underbrace{${phi}}_{\\Phi_{${m}}(\\varphi)},\\quad N_{\\ell}^{m}=${fmt(Nlm)}`);
  document.getElementById('eq-angular-note').innerHTML =
    `N<sub>ℓ</sub><sup>m</sup> = ${fmt(Nlm)} &nbsp;·&nbsp; P<sub>${l}</sub><sup>${am}</sup>(cos ϑ) = ${katexInline(legendreTex(assocLegendreParts(l, am)))}`;

  const pol = l - am, azi = am;
  document.getElementById('dens-note').innerHTML =
    `|Y<sub>ℓ</sub><sup>m</sup>|² ∝ |e<sup>imφ</sup>|² = 1, so the density is <b>axially symmetric</b> about z. ` +
    `Angular nodes: <b>${pol}</b> polar (cones).`;
  const nm = realOrbitalName(l, m);
  document.getElementById('real-note').innerHTML = m === 0
    ? `For m = 0 the real and complex harmonics coincide: <b>${katexInline(nm)}</b>. Blue: Y&gt;0, red: Y&lt;0. ` +
      `Angular nodes: <b>${pol}</b> polar (cones).`
    : `Real harmonic <b>${katexInline(nm)}</b> — the directional “orbital” shape (combination of m = ±${am}). ` +
      `Blue: Y&gt;0, red: Y&lt;0. Angular nodes: <b>${pol}</b> polar (cones) + <b>${azi}</b> azimuthal (planes).`;
}

// =============================================================================
//  Energy ladder: E_ℓ = ℏ²ℓ(ℓ+1)/2I, each level split into its 2ℓ+1 m-states
// =============================================================================
function renderEnergy() {
  const { l: lSel, m: mSel } = state;
  const E = (l) => l * (l + 1);                 // units of ℏ²/2I
  math(document.getElementById('eq-energy'),
    `E_\\ell=\\frac{\\hbar^2\\,\\ell(\\ell+1)}{2I}=\\ell(\\ell+1)\\ \\tfrac{\\hbar^2}{2I}` +
    `\\qquad E_{${lSel}}=${E(lSel)}\\ \\tfrac{\\hbar^2}{2I}`);
  document.getElementById('energy-sel').innerHTML =
    `selected: ℓ=${lSel}, m=${mSel} &nbsp;·&nbsp; E = ℓ(ℓ+1) = ${E(lSel)} (ℏ²/2I) &nbsp;·&nbsp; g = 2ℓ+1 = ${2 * lSel + 1}`;

  const x0 = 0.05, x1 = 0.95, e = E(lSel), g = 2 * lSel + 1, w = (x1 - x0) / g;
  const traces = [];
  // non-selected levels: plain lines
  const bx = [], by = [];
  for (let l = 0; l <= LMAX; l++) { if (l === lSel) continue; bx.push(x0, x1, null); by.push(E(l), E(l), null); }
  traces.push({ x: bx, y: by, mode: 'lines', line: { color: COL.dim, width: 1.5 }, hoverinfo: 'skip' });
  // selected level: faint band + 2ℓ+1 segments + circle
  traces.push({ x: [x0, x1], y: [e, e], mode: 'lines', line: { color: 'rgba(230,237,243,0.13)', width: 16 }, hoverinfo: 'skip' });
  const sx = [], sy = [], mAnn = []; let selMid = null;
  for (let k = 0; k < g; k++) {
    const mm = -lSel + k, a = x0 + w * (k + 0.12), b = x0 + w * (k + 0.88);
    sx.push(a, b, null); sy.push(e, e, null);
    mAnn.push({ x: (a + b) / 2, y: e, yanchor: 'top', yshift: -6, xanchor: 'center', text: `${mm}`,
      showarrow: false, font: { color: mm === mSel ? COL.text : COL.dim, size: 9 } });
    if (mm === mSel) selMid = (a + b) / 2;
  }
  traces.push({ x: sx, y: sy, mode: 'lines', line: { color: COL.accent, width: 7 }, hoverinfo: 'skip' });
  if (selMid !== null) traces.push({ x: [selMid], y: [e], mode: 'markers',
    marker: { symbol: 'circle', size: 13, color: 'rgba(0,0,0,0)', line: { color: '#fff', width: 2 } }, hoverinfo: 'skip' });

  const ann = [...mAnn];
  for (let l = 0; l <= LMAX; l++)
    ann.push({ x: x1, y: E(l), xanchor: 'left', xshift: 8, yanchor: 'middle',
      text: `ℓ=${l} <span style="color:${COL.dim}">(g=${2 * l + 1})</span>`,
      showarrow: false, font: { color: l === lSel ? COL.text : COL.dim, size: l === lSel ? 12 : 10 } });

  Plotly.react('plot-energy', traces, layout({
    margin: { l: 56, r: 70, t: 10, b: 16 }, showlegend: false,
    xaxis: { range: [0, 1.02], showticklabels: false, showgrid: false, zeroline: false },
    yaxis: { title: 'E  (ℏ²/2I)', range: [-2, E(LMAX) + 4], zeroline: true, zerolinecolor: COL.dim },
    annotations: ann,
  }), CONFIG);
}

// =============================================================================
//  3D balloons: r(ϑ,φ) = |Y|² (complex) and |Y_real| (real, sign-colored)
// =============================================================================
function renderBalloons() {
  drawBalloon('plot-Ydens', 'dens');
  drawBalloon('plot-Yreal', 'real');
}

function drawBalloon(divId, kind) {
  const { l, m } = state, Nt = 90, Np = 160;
  const X = [], Y = [], Z = [], C = []; let L = 1e-6;
  for (let i = 0; i <= Nt; i++) {
    const t = (Math.PI * i) / Nt, st = Math.sin(t), ct = Math.cos(t);
    const rx = [], ry = [], rz = [], rc = [];
    for (let j = 0; j <= Np; j++) {
      const p = (2 * Math.PI * j) / Np;
      let r, c;
      if (kind === 'dens') { const Yc = sphHarmComplex(l, m, t, p); r = Yc.re * Yc.re + Yc.im * Yc.im; c = 1; }
      else { const v = realSphHarm(l, m, t, p); r = Math.abs(v); c = Math.sign(v); }
      rx.push(r * st * Math.cos(p)); ry.push(r * st * Math.sin(p)); rz.push(r * ct); rc.push(c);
      if (r > L) L = r;
    }
    X.push(rx); Y.push(ry); Z.push(rz); C.push(rc);
  }
  const opacity = state.showNodes ? 0.6 : 1;
  const surf = kind === 'dens'
    ? { type: 'surface', x: X, y: Y, z: Z, surfacecolor: C, colorscale: [[0, COL.density], [1, COL.density]],
        showscale: false, opacity, lighting: { ambient: 0.6, diffuse: 0.8, specular: 0.1, roughness: 0.9 }, hoverinfo: 'skip' }
    : { type: 'surface', x: X, y: Y, z: Z, surfacecolor: C, cmin: -1, cmax: 1,
        colorscale: [[0, COL.neg], [0.5, '#8893a3'], [1, COL.pos]], showscale: false, opacity,
        lighting: { ambient: 0.6, diffuse: 0.8, specular: 0.1, roughness: 0.9 }, hoverinfo: 'skip' };
  const traces = [surf];
  if (state.showNodes) {
    for (const th of polarNodeAngles(l, m)) traces.push(coneSurface(th, L * 1.15, '#aab4c0'));
    if (kind === 'real') for (const ph of azimuthalNodePlanes(m)) traces.push(planeSurface(ph, L * 1.15, '#aab4c0'));
  }
  Plotly.react(divId, traces, layout({ margin: { l: 0, r: 0, t: 0, b: 0 }, scene: scene3d(L * 1.12) }), CONFIG_3D);
}

// (nodal-surface helpers — polarNodeAngles / azimuthalNodePlanes / coneSurface /
//  planeSurface / scene3d — live in js/angular.js)

// =============================================================================
function render() {
  renderControls();
  renderEquations();
  renderEnergy();
  renderAngular(state.l, state.m);
  renderBalloons();
}

function applyUrlState() {
  const p = new URLSearchParams(location.search);
  const l = parseInt(p.get('l'), 10);
  if (l >= 0 && l <= LMAX) state.l = l;
  const m = parseInt(p.get('m'), 10);
  if (Math.abs(m) <= state.l) state.m = m;
  if (p.get('nodes') === '0') state.showNodes = false;
}

window.addEventListener('DOMContentLoaded', () => {
  applyUrlState();
  render();
  if (location.hash === '#test' || location.search.includes('test')) selfTest();
});
