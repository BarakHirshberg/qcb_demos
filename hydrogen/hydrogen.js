// =============================================================================
//  hydrogen.js — the hydrogen atom app
// =============================================================================
import {
  radialR, radialNorm, radialRmax, laguerreCoeffs,
  sphHarmNorm, assocLegendreParts, sphHarmComplex, realSphHarm,
  realOrbitalName, selfTest,
} from '../js/special.js';
import { segmented, math, layout, CONFIG, CONFIG_3D, COL, fmt, fracTex } from '../js/ui.js';
import {
  katexInline, legendreTex, renderAngular, polarNodeAngles, azimuthalNodePlanes,
  sphereSurface, coneSurface, planeSurface, scene3d,
} from '../js/angular.js';

const NMAX = 6;
const state = { n: 2, l: 1, m: 0, isoFrac: 0.9, showNodes: true, zoomEnergy: false };

// ---- Controls: rebuild downstream options so only valid (n,l,m) are offered ----
function renderControls() {
  segmented(document.getElementById('seg-n'),
    range(1, NMAX), state.n, (v) => { state.n = v; clampL(); render(); });
  segmented(document.getElementById('seg-l'),
    range(0, state.n - 1), state.l, (v) => { state.l = v; clampM(); render(); });
  segmented(document.getElementById('seg-m'),
    range(-state.l, state.l), state.m, (v) => { state.m = v; render(); });
  segmented(document.getElementById('seg-nodes'),
    [false, true], state.showNodes,
    (v) => { state.showNodes = v; renderControls(); if (isoField) drawClouds(); },
    (v) => (v ? 'show' : 'hide'));
  segmented(document.getElementById('seg-zoom'),
    [false, true], state.zoomEnergy,
    (v) => { state.zoomEnergy = v; renderControls(); renderEnergy(); },
    (v) => (v ? 'on' : 'off'));
}
function clampL() { if (state.l > state.n - 1) state.l = state.n - 1; clampM(); }
function clampM() { if (Math.abs(state.m) > state.l) state.m = 0; }
function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }

// =============================================================================
//  Equations
// =============================================================================
function polyTex(coeffs, v = 'x') {
  const parts = [];
  coeffs.forEach((c, k) => {
    if (c.num === 0) return;
    const mag = { num: Math.abs(c.num), den: c.den };
    let coefTex = (mag.num === 1 && mag.den === 1 && k > 0) ? '' : fracTex(mag);
    const pow = k === 0 ? '' : (k === 1 ? v : `${v}^{${k}}`);
    const sign = c.num < 0 ? '-' : (parts.length ? '+' : '');
    parts.push(`${sign} ${coefTex}${pow}`.trim());
  });
  return parts.length ? parts.join(' ') : '0';
}

function renderEquations() {
  const { n, l, m } = state;
  const N = radialNorm(n, l);
  const naStr = n === 1 ? 'a' : `(${n}a)`;          // n·a in the notes' notation
  const arg = `\\tfrac{2Zr}{${n === 1 ? 'a' : `${n}a`}}`;
  const lpow = l === 0 ? '' : (l === 1 ? `\\left(${arg}\\right)` : `\\left(${arg}\\right)^{${l}}`);
  // Radial function — eq. (33) of the course notes.
  math(document.getElementById('eq-radial'),
    `R_{${n},${l}}(r)=N_{${n},${l}}\\,e^{-Zr/${naStr}}\\,${lpow}\\,L_{${n - l - 1}}^{${2 * l + 1}}\\!\\left(${arg}\\right)`);
  const poly = polyTex(laguerreCoeffs(n - l - 1, 2 * l + 1));
  document.getElementById('eq-radial-note').innerHTML =
    `N<sub>${n},${l}</sub> = ${fmt(N)} &nbsp;(Z = 1, a = 1) &nbsp;·&nbsp; ` +
    `L<sub>${n - l - 1}</sub><sup>${2 * l + 1}</sup>(x) = ${katexInline(poly)} , &nbsp; x = 2Zr/${naStr}`;

  const Nlm = sphHarmNorm(l, m);
  const phiSign = m === 0 ? '' : (m > 0 ? `e^{i${m === 1 ? '' : m}\\varphi}` : `e^{-i${m === -1 ? '' : -m}\\varphi}`);
  const phi = m === 0 ? '\\tfrac{1}{\\sqrt{2\\pi}}' : `\\tfrac{1}{\\sqrt{2\\pi}}\\,${phiSign}`;
  // Angular function in the notes' notation: Y_ℓ^m(ϑ,φ) = Θ_ℓm(ϑ) · Φ_m(φ).
  math(document.getElementById('eq-angular'),
    `Y_{${l}}^{${m}}(\\vartheta,\\varphi)=\\underbrace{N_{\\ell}^{m}\\,P_{${l}}^{${Math.abs(m)}}(\\cos\\vartheta)}_{\\Theta_{${l}${m}}(\\vartheta)}\\;\\cdot\\;\\underbrace{${phi}}_{\\Phi_{${m}}(\\varphi)},\\quad N_{\\ell}^{m}=${fmt(Nlm)}`);
  // Explicit associated Legendre P_l^|m|(cos ϑ), like the radial Laguerre note.
  const am = Math.abs(m);
  document.getElementById('eq-angular-note').innerHTML =
    `N<sub>ℓ</sub><sup>m</sup> = ${fmt(Nlm)} &nbsp;·&nbsp; ` +
    `P<sub>${l}</sub><sup>${am}</sup>(cos ϑ) = ${katexInline(legendreTex(assocLegendreParts(l, am)))}`;

  const rad = n - l - 1, pol = l - Math.abs(m), azi = Math.abs(m);
  document.getElementById('dens-note').innerHTML =
    `Complex eigenstate of L̂<sub>z</sub> with eigenvalue mℏ = ${m}ℏ. Since |ψ|² ∝ |e<sup>imφ</sup>|² = 1, the density has <b>no φ-dependence</b> — it is axially symmetric about z. ` +
    `Nodes: <b>${rad}</b> radial (spheres) + <b>${pol}</b> polar (cones).`;
  const nm = realOrbitalName(l, m);
  const base = m === 0
    ? `For m = 0 the real and complex orbitals coincide: <b>${katexInline(nm)}</b>. Blue: ψ&gt;0, red: ψ&lt;0.`
    : `Real orbital <b>${katexInline(nm)}</b> — the chemist's directional orbital, the combination of m = ±${Math.abs(m)} (e<sup>imφ</sup> → cos/sin). Blue: ψ&gt;0, red: ψ&lt;0.`;
  document.getElementById('psi-note').innerHTML = base +
    ` Nodes: <b>${rad}</b> radial, <b>${pol}</b> polar, <b>${azi}</b> azimuthal — angular total = ℓ = ${l} (use the “nodes” toggle).`;
}

// =============================================================================
//  Radial plots
// =============================================================================
function renderRadial() {
  const { n, l } = state;
  const rmax = niceRadialRange(n, l);
  const N = 600, rs = [], R = [], RP = [];
  for (let i = 0; i <= N; i++) {
    const r = (i / N) * rmax;
    const val = radialR(n, l, r);
    rs.push(r); R.push(val); RP.push(r * r * val * val);
  }
  const nodes = radialNodes(n, l, rmax);

  Plotly.react('plot-R', [
    { x: rs, y: R, mode: 'lines', line: { color: COL.accent, width: 2.5 }, name: 'R' },
    { x: nodes, y: nodes.map(() => 0), mode: 'markers',
      marker: { color: COL.accent2, size: 7, symbol: 'circle-open', line: { width: 2 } }, name: 'nodes' },
  ], layout({
    xaxis: { title: 'r  (a)', range: [0, rmax] },
    yaxis: { title: 'R<sub>nℓ</sub>(r)', zeroline: true, zerolinecolor: COL.dim },
  }), CONFIG);

  Plotly.react('plot-RP', [
    { x: rs, y: RP, mode: 'lines', fill: 'tozeroy',
      line: { color: COL.density, width: 2.5 }, fillcolor: 'rgba(124,92,255,0.18)' },
    { x: nodes, y: nodes.map(() => 0), mode: 'markers',
      marker: { color: COL.accent2, size: 7, symbol: 'circle-open', line: { width: 2 } } },
  ], layout({
    xaxis: { title: 'r  (a)', range: [0, rmax] },
    yaxis: { title: 'P(r) = r² |R<sub>nℓ</sub>|²', rangemode: 'tozero' },
  }), CONFIG);
}

// =============================================================================
//  Energy levels: Coulomb well + Rydberg ladder with degeneracy fanned out
// =============================================================================
const LCOL = ['#6ea8fe', '#f78fb3', '#4dd2a0', '#ffd166', '#c792ea', '#ff9f6b']; // s,p,d,f,g,h
const LNAME = ['s', 'p', 'd', 'f', 'g', 'h'];

function renderEnergy() {
  const { n: nSel, l: lSel, m: mSel } = state;
  const En = (n) => -1 / (2 * n * n);             // atomic units (Z = 1)
  const turn = (n) => 2 * n * n;                  // outer turning point r_n = 2n²

  // energy eigenvalue equation (notes eq. 41), with the selected n substituted
  math(document.getElementById('eq-energy'),
    `E_n=-\\frac{Z^2}{2n^2}\\,\\frac{e^2}{a}=-\\frac{1}{2n^2}\\ \\text{(a.u.)}` +
    `\\qquad E_{${nSel}}=-\\frac{1}{2(${nSel})^2}=${En(nSel).toFixed(4)}\\ \\text{a.u.}`);
  const xmax = turn(NMAX);                        // widest level sets the r-range

  // V(r) = −1/r
  const vx = [], vy = [];
  for (let i = 1; i <= 800; i++) { const r = (i / 800) * xmax; vx.push(r); vy.push(-1 / r); }
  const traces = [{ x: vx, y: vy, mode: 'lines', line: { color: COL.dim, width: 2 },
    hoverinfo: 'skip', showlegend: false }];

  const e = En(nSel);
  // non-selected levels: plain lines (spanning to their own turning points)
  const baseX = [], baseY = [];
  for (let n = 1; n <= NMAX; n++) {
    if (n === nSel) continue;
    baseX.push(0, turn(n), null); baseY.push(En(n), En(n), null);
  }
  traces.push({ x: baseX, y: baseY, mode: 'lines', line: { color: COL.dim, width: 1.5 },
    hoverinfo: 'skip', showlegend: false });

  // SELECTED level: one line divided into n² segments (one per state), colored by ℓ
  traces.push({ x: [0, turn(nSel)], y: [e, e], mode: 'lines',
    line: { color: 'rgba(230,237,243,0.13)', width: 16 }, hoverinfo: 'skip', showlegend: false });
  const segX = LNAME.map(() => []), segY = LNAME.map(() => []);
  let selMid = null, k = 0;
  const w = turn(nSel) / (nSel * nSel);
  for (let l = 0; l < nSel; l++)
    for (let mm = -l; mm <= l; mm++) {
      const a = w * (k + 0.1), b = w * (k + 0.9);        // segment + gap
      segX[l].push(a, b, null); segY[l].push(e, e, null);
      if (l === lSel && mm === mSel) selMid = (a + b) / 2;
      k++;
    }
  for (let l = 0; l < nSel; l++)
    traces.push({ x: segX[l], y: segY[l], mode: 'lines', name: LNAME[l],
      line: { color: LCOL[l], width: 6 }, hoverinfo: 'skip' });
  if (selMid !== null) traces.push({ x: [selMid], y: [e], mode: 'markers', showlegend: false,
    marker: { symbol: 'circle', size: 13, color: 'rgba(0,0,0,0)', line: { color: '#fff', width: 2 } },
    hoverinfo: 'skip' });

  // zoom-to-level frames the selected level (segments span the width); the
  // default view keeps the full well + ladder.
  const zoom = state.zoomEnergy;
  const h = Math.max(0.025, 0.4 * Math.abs(e));
  const xRange = zoom ? [0, turn(nSel) * 1.08] : [0, xmax + 6];
  const yRange = zoom ? [e - h, e + h] : [-0.55, 0.04];
  const inY = (y) => y >= yRange[0] && y <= yRange[1];
  const inX = (x) => x >= xRange[0] && x <= xRange[1];

  // selected-state info lives in an HTML caption above the plot (never overlaps lines)
  document.getElementById('energy-sel').innerHTML =
    `selected: n=${nSel}, ℓ=${lSel} (${LNAME[lSel]}), m=${mSel} &nbsp;·&nbsp; E = ${e.toFixed(4)} Ha &nbsp;·&nbsp; g = n² = ${nSel * nSel}`;
  const ann = [];
  if (inY(0)) ann.push({ x: xRange[1], y: 0, xanchor: 'right', yanchor: 'bottom', text: 'ionization  E = 0',
    showarrow: false, font: { color: COL.dim, size: 10 } });
  for (let n = 1; n <= NMAX; n++)            // n labels (only those in view)
    if (inY(En(n)) && inX(turn(n)))
      ann.push({ x: turn(n), y: En(n), xanchor: 'left', yanchor: 'middle', xshift: 6, text: `n=${n}`,
        showarrow: false, font: { color: n === nSel ? COL.text : COL.dim, size: n === nSel ? 11 : 10 } });

  Plotly.react('plot-energy', traces, layout({
    margin: { l: 60, r: 30, t: 10, b: 44 },
    showlegend: true, legend: { orientation: 'h', y: 1.1, x: 0.5, xanchor: 'center', font: { size: 11 } },
    xaxis: { title: 'r  (a)', range: xRange },
    yaxis: { title: 'E  (Hartree)', range: yRange, zeroline: true, zerolinecolor: COL.dim },
    annotations: ann,
  }), CONFIG);
}

function radialNodes(n, l, rmax) {
  const nodes = [], N = 2000;
  let prev = radialR(n, l, 1e-6);
  for (let i = 1; i <= N; i++) {
    const r = (i / N) * rmax, cur = radialR(n, l, r);
    if (prev === 0 || (prev < 0) !== (cur < 0)) {
      const rPrev = ((i - 1) / N) * rmax;
      nodes.push(rPrev + (r - rPrev) * Math.abs(prev) / (Math.abs(prev) + Math.abs(cur)));
    }
    prev = cur;
  }
  return nodes;
}

// Trim the plot range to where the density is meaningful.
function niceRadialRange(n, l) {
  const rmax = radialRmax(n), Ng = 1500;
  let peak = 0;
  for (let i = 0; i <= Ng; i++) {
    const r = (i / Ng) * rmax, R = radialR(n, l, r);
    peak = Math.max(peak, r * r * R * R);
  }
  for (let i = Ng; i >= 0; i--) {
    const r = (i / Ng) * rmax, R = radialR(n, l, r);
    if (r * r * R * R > 1e-3 * peak) return Math.ceil((r * 1.08) / 5) * 5;
  }
  return rmax;
}

// =============================================================================
//  3D orbital — two representations:
//    (1) |ψ_nℓm|² of the COMPLEX orbital (single color, no phase)
//    (2) ψ of the REAL orbital (signed: blue + / red − lobes)
//  Both use the same "boundary surface" level set by the enclosed-probability
//  slider, applied to each representation's own probability distribution.
// =============================================================================
let isoField = null;

function renderCloud() {
  buildIsoField();
  drawClouds();
}

// Prepare whatever the current (n,l,m) needs. The complex |ψ|² is axially
// symmetric (φ-independent), and so is every m = 0 real orbital → for those we
// build a smooth surface from a FINE 2-D (s,z) profile and revolve it (this
// avoids the speckling a coarse 3-D isosurface gives for high-n shells). Only
// the non-axisymmetric real orbitals (m ≠ 0) fall back to a 3-D isosurface.
function buildIsoField() {
  const { n, l, m } = state;
  const L = cloudExtent(n, l, radialRmax(n));
  isoField = { n, l, m, L };
  isoField.dens2d = profile2D(n, l, m, L, 'dens');         // |ψ_complex|²(s,z)
  if (m === 0) isoField.real2d = profile2D(n, l, m, L, 'real');  // signed ψ(s,z)
  else isoField.real3d = build3DReal(n, l, m, L);
}

// Fine 2-D field in the (s,z) half-plane. kind 'dens' → |ψ|²; 'real' → signed ψ.
function profile2D(n, l, m, L, kind) {
  const Gs = 200, Gz = 401, sC = [], zC = [], F = [];
  for (let i = 0; i < Gs; i++) sC.push((L * i) / (Gs - 1));
  for (let j = 0; j < Gz; j++) zC.push(-L + (2 * L) * j / (Gz - 1));
  for (let j = 0; j < Gz; j++) {
    const row = [];
    for (let i = 0; i < Gs; i++) {
      const s = sC[i], z = zC[j], r = Math.hypot(s, z);
      const theta = r === 0 ? 0 : Math.acos(z / r);
      const R = radialR(n, l, r);
      if (kind === 'dens') { const Y = sphHarmComplex(l, m, theta, 0); row.push(R * R * (Y.re * Y.re + Y.im * Y.im)); }
      else row.push(R * realSphHarm(l, m, theta, 0));      // m = 0 ⇒ φ-independent
    }
    F.push(row);
  }
  return { sC, zC, F, ds: L / (Gs - 1), dz: (2 * L) / (Gz - 1) };
}

// Level (density for useAbs=false, amplitude for useAbs=true) enclosing `frac`
// of the probability, using the cylindrical volume weight 2π·s.
function cutoff2D(p, frac, useAbs) {
  const cells = []; let total = 0;
  for (let j = 0; j < p.zC.length; j++)
    for (let i = 0; i < p.sC.length; i++) {
      const f = p.F[j][i], dens = useAbs ? f * f : f;
      const w = dens * (2 * Math.PI * p.sC[i]) * p.ds * p.dz;
      cells.push([useAbs ? Math.abs(f) : f, w]); total += w;
    }
  cells.sort((a, b) => b[0] - a[0]);
  let acc = 0; const target = frac * total;
  for (const [val, w] of cells) { acc += w; if (acc >= target) return val; }
  return 0;
}

// Revolve (s,z) contour segments about the z-axis into a single-color mesh3d.
function revolveMesh(segs, color, opacity = 0.92) {
  const K = 80, dphi = (2 * Math.PI) / K;
  const X = [], Y = [], Z = [], I = [], J = [], Kk = [];
  for (const [p1, p2] of segs) {
    const base = X.length;
    for (let k = 0; k <= K; k++) {
      const c = Math.cos(k * dphi), sn = Math.sin(k * dphi);
      X.push(p1[0] * c, p2[0] * c); Y.push(p1[0] * sn, p2[0] * sn); Z.push(p1[1], p2[1]);
    }
    for (let k = 0; k < K; k++) {
      const b = base + 2 * k;             // bottom@k, top@k, bottom@k+1, top@k+1
      I.push(b, b); J.push(b + 1, b + 3); Kk.push(b + 3, b + 2);
    }
  }
  return {
    type: 'mesh3d', x: X, y: Y, z: Z, i: I, j: J, k: Kk, color, opacity,
    flatshading: false, lighting: { ambient: 0.6, diffuse: 0.8, specular: 0.12, roughness: 0.9 },
    hoverinfo: 'skip',
  };
}

// 3-D signed real field for the non-axisymmetric (m ≠ 0) case.
function build3DReal(n, l, m, L) {
  const G = Math.min(72, Math.max(44, Math.round(L / 1.2)));
  const coords = [];
  for (let i = 0; i < G; i++) coords.push(-L + (2 * L) * i / (G - 1));
  const X = [], Y = [], Z = [], Pr = [], dens = [];
  let maxAbs = 0;
  for (let ix = 0; ix < G; ix++)
    for (let iy = 0; iy < G; iy++)
      for (let iz = 0; iz < G; iz++) {
        const x = coords[ix], y = coords[iy], z = coords[iz];
        const r = Math.sqrt(x * x + y * y + z * z);
        const theta = r === 0 ? 0 : Math.acos(z / r);
        const phi = Math.atan2(y, x);
        const pr = radialR(n, l, r) * realSphHarm(l, m, theta, phi);
        X.push(x); Y.push(y); Z.push(z); Pr.push(pr); dens.push(pr * pr);
        const ab = Math.abs(pr); if (ab > maxAbs) maxAbs = ab;
      }
  const sorted = dens.slice().sort((a, b) => b - a);
  const cum = []; let s = 0;
  for (let i = 0; i < sorted.length; i++) { s += sorted[i]; cum.push(s); }
  return { X, Y, Z, Pr, Prneg: Pr.map((v) => -v), maxAbs, sorted, cum, total: s };
}

function cutoff3D(f3, frac) {
  const target = frac * f3.total;
  let lo = 0, hi = f3.cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (f3.cum[mid] >= target) hi = mid; else lo = mid + 1; }
  return Math.sqrt(f3.sorted[lo]);   // amplitude level
}

function isoTrace3(f3, value, level, vmax, color, opacity = 0.9) {
  return {
    // A single iso-surface at `level`: bracket [level, vmax] and draw only the
    // lower (isomin) surface. (surface.count:1 is unreliable — it can render
    // near the peak instead, shrinking the orbital to a dot.)
    type: 'isosurface', x: f3.X, y: f3.Y, z: f3.Z, value,
    isomin: level, isomax: vmax,
    surface: { show: true, count: 2, fill: 1 },
    caps: { x: { show: false }, y: { show: false }, z: { show: false } },
    colorscale: [[0, color], [1, color]], showscale: false, opacity,
    lighting: { ambient: 0.55, diffuse: 0.85, specular: 0.15, roughness: 0.9 },
    hoverinfo: 'skip',
  };
}

function drawClouds() {
  const f = isoField, frac = state.isoFrac;
  const sc = layout({ margin: { l: 0, r: 0, t: 0, b: 0 }, scene: scene3d(f.L) });
  const oOp = state.showNodes ? 0.4 : 0.92;       // dim the orbital when nodes show

  // (1) complex |ψ|² — smooth revolution surface, single color
  const cutC = cutoff2D(f.dens2d, frac, false);
  const densTraces = [revolveMesh(marchingSquares(f.dens2d, cutC), COL.density, oOp)];
  if (state.showNodes) densTraces.push(...nodeTraces('dens'));
  Plotly.react('plot-dens', densTraces, sc, CONFIG_3D);

  // (2) real ψ — ± lobes at the same enclosed %
  let realTraces;
  if (f.m === 0) {                               // axisymmetric: revolve ±amp contours
    const amp = cutoff2D(f.real2d, frac, true);
    realTraces = [revolveMesh(marchingSquares(f.real2d, amp), COL.pos, oOp),
                  revolveMesh(marchingSquares(f.real2d, -amp), COL.neg, oOp)];
  } else {                                        // non-axisymmetric: 3-D isosurface
    const amp = cutoff3D(f.real3d, frac);
    realTraces = [isoTrace3(f.real3d, f.real3d.Pr, amp, f.real3d.maxAbs, COL.pos, oOp),
                  isoTrace3(f.real3d, f.real3d.Prneg, amp, f.real3d.maxAbs, COL.neg, oOp)];
  }
  if (state.showNodes) realTraces.push(...nodeTraces('real'));
  Plotly.react('plot-psi', realTraces, sc, CONFIG_3D);

  const el = document.getElementById('iso-val');
  if (el) el.textContent = `${Math.round(frac * 100)}% enclosed`;
}

// ---- Nodal surfaces: radial spheres, polar cones, azimuthal planes ----------
// (sphereSurface / coneSurface / planeSurface live in js/angular.js)
function nodeTraces(kind) {
  const { n, l, m } = state, L = isoField.L, GRAY = '#aab4c0', t = [];
  for (const r of radialNodes(n, l, L)) t.push(sphereSurface(r, GRAY));    // radial
  for (const th of polarNodeAngles(l, m)) t.push(coneSurface(th, L, GRAY)); // polar
  if (kind === 'real') for (const ph of azimuthalNodePlanes(m)) t.push(planeSurface(ph, L, GRAY));
  return t;
}

// Marching squares on a 2-D field → list of [[s,z],[s,z]] segments at `level`.
function marchingSquares(p, level) {
  const { sC, zC, F } = p, segs = [], Gs = sC.length, Gz = zC.length;
  const lerp = (va, vb, a, b) => a + (b - a) * ((level - va) / (vb - va));
  const TBL = {
    1: [['L', 'B']], 2: [['B', 'R']], 3: [['L', 'R']], 4: [['R', 'T']],
    5: [['L', 'B'], ['R', 'T']], 6: [['B', 'T']], 7: [['L', 'T']],
    8: [['L', 'T']], 9: [['B', 'T']], 10: [['B', 'R'], ['L', 'T']],
    11: [['R', 'T']], 12: [['L', 'R']], 13: [['B', 'R']], 14: [['L', 'B']],
  };
  for (let j = 0; j < Gz - 1; j++)
    for (let i = 0; i < Gs - 1; i++) {
      const d0 = F[j][i], d1 = F[j][i + 1], d2 = F[j + 1][i + 1], d3 = F[j + 1][i];
      let idx = 0;
      if (d0 > level) idx |= 1; if (d1 > level) idx |= 2;
      if (d2 > level) idx |= 4; if (d3 > level) idx |= 8;
      const cases = TBL[idx];
      if (!cases) continue;
      const s0 = sC[i], s1 = sC[i + 1], z0 = zC[j], z1 = zC[j + 1];
      const E = {
        B: () => [lerp(d0, d1, s0, s1), z0],
        R: () => [s1, lerp(d1, d2, z0, z1)],
        T: () => [lerp(d3, d2, s0, s1), z1],
        L: () => [s0, lerp(d0, d3, z0, z1)],
      };
      for (const [a, b] of cases) segs.push([E[a](), E[b]()]);
    }
  return segs;
}

// Extent that frames ~99% of the radial probability.
function cloudExtent(n, l, rmax) {
  const N = 2000, h = rmax / N; let tot = 0; const cdf = [];
  for (let i = 0; i <= N; i++) { const r = i * h, R = radialR(n, l, r); tot += r * r * R * R * h; cdf.push(tot); }
  for (let i = 0; i <= N; i++) if (cdf[i] >= 0.99 * tot) return Math.ceil((i * h * 1.05) / 5) * 5;
  return rmax;
}

// =============================================================================
function render() {
  renderControls();
  renderEquations();
  renderEnergy();
  renderRadial();
  renderAngular(state.l, state.m);
  renderCloud();
}

// Slider re-levels the cached field without rebuilding it; throttle to a frame.
let isoPending = false;
function scheduleIso() {
  if (isoPending) return;
  isoPending = true;
  requestAnimationFrame(() => { isoPending = false; if (isoField) drawClouds(); });
}

// Optional initial state via URL, e.g. ?n=6&l=0&m=0 (also makes shareable links).
function applyUrlState() {
  const p = new URLSearchParams(location.search);
  const n = parseInt(p.get('n'), 10);
  if (n >= 1 && n <= NMAX) state.n = n;
  const l = parseInt(p.get('l'), 10);
  if (l >= 0 && l <= state.n - 1) state.l = l;
  const m = parseInt(p.get('m'), 10);
  if (Math.abs(m) <= state.l) state.m = m;
  const nodes = p.get('nodes');
  if (nodes === '1') state.showNodes = true;
  else if (nodes === '0') state.showNodes = false;
  if (p.get('zoom') === '1') state.zoomEnergy = true;
}

window.addEventListener('DOMContentLoaded', () => {
  applyUrlState();
  const slider = document.getElementById('iso-slider');
  slider.addEventListener('input', () => {
    state.isoFrac = Math.max(0.02, slider.value / 100);
    scheduleIso();
  });
  render();
  if (location.hash === '#test' || location.search.includes('test')) selfTest();
});
