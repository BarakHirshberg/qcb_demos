// =============================================================================
//  hydrogen.js — the hydrogen atom app
// =============================================================================
import {
  radialR, radialNorm, radialRmax, laguerreCoeffs,
  sphHarmNorm, assocLegendre, assocLegendreParts, ringPhi, sphHarmComplex, realSphHarm,
  realOrbitalName, factorial, selfTest,
} from '../js/special.js';
import { segmented, math, layout, CONFIG, CONFIG_3D, COL, fmt, fracTex } from '../js/ui.js';

const NMAX = 6;
const state = { n: 2, l: 1, m: 0, isoFrac: 0.9, showNodes: true };

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
function katexInline(tex) {
  return katex.renderToString(tex, { displayMode: false, throwOnError: false });
}

// Format P_l^m(cosϑ) = sign · sin^m ϑ · (polynomial in cos ϑ) as LaTeX.
function legendreTex(parts) {
  const cosPow = (k) => (k === 0 ? '' : k === 1 ? '\\cos\\vartheta' : `\\cos^{${k}}\\vartheta`);
  const sinPart = parts.sinPow === 0 ? '' : parts.sinPow === 1 ? '\\sin\\vartheta\\,' : `\\sin^{${parts.sinPow}}\\vartheta\\,`;
  const nz = parts.poly.map((c, k) => ({ c, k })).filter((t) => t.c.num !== 0);
  if (nz.length === 0) return '0';

  if (nz.length === 1) {                       // single term: coef · sin^m ϑ · cos^k ϑ
    const { c, k } = nz[0];
    const sign = parts.sign * (c.num < 0 ? -1 : 1) < 0 ? '-' : '';
    const mag = { num: Math.abs(c.num), den: c.den };
    const coef = (mag.num === 1 && mag.den === 1) ? '' : fracTex(mag);
    const body = `${coef}${sinPart}${cosPow(k)}` || '1';
    return `${sign}${body}`;
  }

  const terms = nz.map(({ c, k }, idx) => {       // multi-term → parenthesize
    const mag = { num: Math.abs(c.num), den: c.den };
    const coef = (mag.num === 1 && mag.den === 1 && k > 0) ? '' : fracTex(mag);
    const sgn = c.num < 0 ? '-' : (idx ? '+' : '');
    return `${sgn} ${coef}${cosPow(k)}`.trim();
  });
  return `${parts.sign < 0 ? '-' : ''}${sinPart}\\left(${terms.join(' ')}\\right)`;
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
//  Angular plots: Θ(ϑ) amplitude + density (polar & cartesian) + Φ_m(φ) ring
// =============================================================================
function thetaPolarLayout() {
  return layout({
    margin: { l: 30, r: 30, t: 20, b: 20 },
    polar: {
      bgcolor: 'rgba(0,0,0,0)',
      radialaxis: { gridcolor: COL.grid, tickfont: { size: 9 }, angle: 90, showticklabels: false },
      angularaxis: { gridcolor: COL.grid, rotation: 0, direction: 'counterclockwise',
        tickmode: 'array', tickvals: [0, 90, 180, 270], ticktext: ['x', 'z', '−x', '−z'] },
    },
  });
}

function renderAngular() {
  const { l, m } = state;
  const Th = (theta) => sphHarmNorm(l, m) * assocLegendre(l, Math.abs(m), Math.cos(theta));

  // Sweep a plane containing the z-axis: γ from +z, mapped to Plotly polar angle.
  const Ng = 720, posR = [], posT = [], negR = [], negT = [], denR = [], denT = [];
  for (let i = 0; i <= Ng; i++) {
    const gamma = (i / Ng) * 2 * Math.PI;
    const theta = gamma <= Math.PI ? gamma : 2 * Math.PI - gamma;
    const val = Th(theta), tdeg = 90 - gamma * 180 / Math.PI;
    if (val >= 0) { posR.push(Math.abs(val)); posT.push(tdeg); negR.push(null); negT.push(tdeg); }
    else { negR.push(Math.abs(val)); negT.push(tdeg); posR.push(null); posT.push(tdeg); }
    denR.push(val * val); denT.push(tdeg);
  }

  // (a) amplitude Θ(ϑ) — polar, signed lobes
  Plotly.react('plot-theta', [
    { type: 'scatterpolar', r: posR, theta: posT, mode: 'lines', line: { color: COL.pos, width: 3 }, name: 'Θ > 0' },
    { type: 'scatterpolar', r: negR, theta: negT, mode: 'lines', line: { color: COL.neg, width: 3 }, name: 'Θ < 0' },
  ], thetaPolarLayout(), CONFIG);

  // (b) density |Θ(ϑ)|² — polar, single color filled
  Plotly.react('plot-theta-den', [
    { type: 'scatterpolar', r: denR, theta: denT, mode: 'lines', fill: 'toself',
      line: { color: COL.density, width: 2.5 }, fillcolor: 'rgba(124,92,255,0.25)', name: '|Θ|²' },
  ], thetaPolarLayout(), CONFIG);

  // (c) Θ(ϑ) and |Θ(ϑ)|² vs ϑ — cartesian
  const ths = [], amp = [], den = [];
  for (let i = 0; i <= 360; i++) {
    const th = (i / 360) * Math.PI, v = Th(th);
    ths.push(th); amp.push(v); den.push(v * v);             // ϑ in radians 0…π
  }
  Plotly.react('plot-theta-cart', [
    { x: ths, y: amp, mode: 'lines', line: { color: COL.accent, width: 2.5 }, name: 'Θ(ϑ)' },
    { x: ths, y: den, mode: 'lines', fill: 'tozeroy', line: { color: COL.density, width: 2.5 },
      fillcolor: 'rgba(124,92,255,0.18)', name: '|Θ(ϑ)|²' },
  ], layout({
    showlegend: true,
    legend: { x: 0.5, y: 1.18, xanchor: 'center', orientation: 'h', font: { size: 10 } },
    margin: { l: 46, r: 14, t: 30, b: 40 },
    xaxis: { title: 'ϑ  (rad)', range: [0, Math.PI],
      tickvals: [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI],
      ticktext: ['0', 'π/4', 'π/2', '3π/4', 'π'] },
    yaxis: { title: 'Θ , |Θ|²', zeroline: true, zerolinecolor: COL.dim },
  }), CONFIG);

  // (d) Ring Φ_m(φ): real & imaginary parts vs φ.
  const Np = 400, ps = [], re = [], im = [];
  for (let i = 0; i <= Np; i++) {
    const p = (i / Np) * 2 * Math.PI, z = ringPhi(m, p);
    ps.push(p); re.push(z.re); im.push(z.im);              // φ in radians 0…2π
  }
  Plotly.react('plot-phi', [
    { x: ps, y: re, mode: 'lines', line: { color: COL.pos, width: 2.5 }, name: 'Re Φ' },
    { x: ps, y: im, mode: 'lines', line: { color: COL.accent2, width: 2.5, dash: 'dot' }, name: 'Im Φ' },
  ], layout({
    showlegend: true,
    legend: { x: 0.5, y: 1.18, xanchor: 'center', orientation: 'h', font: { size: 10 } },
    margin: { l: 46, r: 14, t: 30, b: 40 },
    xaxis: { title: 'φ  (rad)', range: [0, 2 * Math.PI],
      tickvals: [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, 2 * Math.PI],
      ticktext: ['0', 'π/2', 'π', '3π/2', '2π'] },
    yaxis: { title: 'Φ<sub>m</sub>(φ)', range: [-0.46, 0.46] },
  }), CONFIG);
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
  // Cross-sections hidden for now — re-enable by restoring the divs in
  // index.html and these calls: renderCrossSection('cross-xz','xz'), 'yz', 'xy'.
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
function nodeTraces(kind) {
  const { n, l, m } = state, L = isoField.L, GRAY = '#aab4c0', t = [];
  for (const r of radialNodes(n, l, L)) t.push(sphereSurface(r, GRAY));    // radial
  for (const th of polarNodeAngles(l, m)) t.push(coneSurface(th, L, GRAY)); // polar
  if (kind === 'real') for (const ph of azimuthalNodePlanes(m)) t.push(planeSurface(ph, L, GRAY));
  return t;
}

// Interior zeros of P_l^|m|(cos ϑ): the ℓ−|m| polar nodal angles.
function polarNodeAngles(l, m) {
  const am = Math.abs(m), N = 1500, out = [];
  let prev = assocLegendre(l, am, Math.cos(Math.PI / N));
  for (let i = 2; i < N; i++) {
    const th = (i / N) * Math.PI, cur = assocLegendre(l, am, Math.cos(th));
    if ((prev < 0) !== (cur < 0)) out.push(th);
    prev = cur;
  }
  return out;
}

// Distinct nodal planes (azimuth in [0,π)) of cos/sin(|m|φ): |m| of them.
function azimuthalNodePlanes(m) {
  if (m === 0) return [];
  const am = Math.abs(m), out = [];
  for (let k = 0; k < 2 * am; k++) {
    const phi = m > 0 ? (Math.PI / 2 + k * Math.PI) / am : (k * Math.PI) / am;
    let p = phi % Math.PI; if (p < 0) p += Math.PI;
    if (!out.some((q) => Math.abs(q - p) < 1e-6)) out.push(p);
  }
  return out;
}

function nodeSurface(X, Y, Z, color) {
  return {
    type: 'surface', x: X, y: Y, z: Z, showscale: false, opacity: 0.2,
    colorscale: [[0, color], [1, color]], hoverinfo: 'skip',
    lighting: { ambient: 1, diffuse: 0, specular: 0 },
    contours: { x: { highlight: false }, y: { highlight: false }, z: { highlight: false } },
  };
}

function sphereSurface(r, color) {
  const Nu = 24, Nv = 48, X = [], Y = [], Z = [];
  for (let u = 0; u <= Nu; u++) {
    const th = (Math.PI * u) / Nu, rx = [], ry = [], rz = [];
    for (let v = 0; v <= Nv; v++) {
      const ph = (2 * Math.PI * v) / Nv;
      rx.push(r * Math.sin(th) * Math.cos(ph)); ry.push(r * Math.sin(th) * Math.sin(ph)); rz.push(r * Math.cos(th));
    }
    X.push(rx); Y.push(ry); Z.push(rz);
  }
  return nodeSurface(X, Y, Z, color);
}

function coneSurface(th, L, color) {
  const Nv = 64, st = Math.sin(th), ct = Math.cos(th), X = [], Y = [], Z = [];
  for (const r of [0, L]) {
    const rx = [], ry = [], rz = [];
    for (let v = 0; v <= Nv; v++) {
      const ph = (2 * Math.PI * v) / Nv;
      rx.push(r * st * Math.cos(ph)); ry.push(r * st * Math.sin(ph)); rz.push(r * ct);
    }
    X.push(rx); Y.push(ry); Z.push(rz);
  }
  return nodeSurface(X, Y, Z, color);
}

function planeSurface(ph, L, color) {
  const cx = Math.cos(ph), sy = Math.sin(ph);
  const X = [[-L * cx, L * cx], [-L * cx, L * cx]];
  const Y = [[-L * sy, L * sy], [-L * sy, L * sy]];
  const Z = [[-L, -L], [L, L]];
  return nodeSurface(X, Y, Z, color);
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

// Cross-section of the signed real-orbital wavefunction ψ through a principal
// plane ('xz', 'yz' contain the z-axis; 'xy' is the equatorial plane ⟂ z).
function renderCrossSection(divId, plane) {
  const { n, l, m } = state, L = isoField.L;
  const Ng = 161, A = [], B = [], Z = [];
  for (let i = 0; i < Ng; i++) A.push(-L + (2 * L) * i / (Ng - 1));   // horizontal
  for (let j = 0; j < Ng; j++) B.push(-L + (2 * L) * j / (Ng - 1));   // vertical
  let amax = 0;
  for (let j = 0; j < Ng; j++) {
    const row = [];
    for (let i = 0; i < Ng; i++) {
      const a = A[i], b = B[j];
      let x, y, z;
      if (plane === 'xz') { x = a; y = 0; z = b; }
      else if (plane === 'yz') { x = 0; y = a; z = b; }
      else { x = a; y = b; z = 0; }                  // xy (equatorial)
      const r = Math.sqrt(x * x + y * y + z * z);
      const theta = r === 0 ? 0 : Math.acos(z / r);
      const phi = Math.atan2(y, x);
      const val = radialR(n, l, r) * realSphHarm(l, m, theta, phi);
      row.push(val); amax = Math.max(amax, Math.abs(val));
    }
    Z.push(row);
  }
  const ax = { xz: ['x', 'z'], yz: ['y', 'z'], xy: ['x', 'y'] }[plane];
  Plotly.react(divId, [{
    type: 'heatmap', x: A, y: B, z: Z, zmid: 0, zmin: -amax, zmax: amax,
    colorscale: 'RdBu', reversescale: true, showscale: false, hoverinfo: 'skip',
  }], layout({
    margin: { l: 44, r: 10, t: 6, b: 40 },
    xaxis: { title: `${ax[0]}  (a)`, scaleanchor: 'y', constrain: 'domain' },
    yaxis: { title: `${ax[1]}  (a)` },
  }), CONFIG);
}

// Extent that frames ~99% of the radial probability.
function cloudExtent(n, l, rmax) {
  const N = 2000, h = rmax / N; let tot = 0; const cdf = [];
  for (let i = 0; i <= N; i++) { const r = i * h, R = radialR(n, l, r); tot += r * r * R * R * h; cdf.push(tot); }
  for (let i = 0; i <= N; i++) if (cdf[i] >= 0.99 * tot) return Math.ceil((i * h * 1.05) / 5) * 5;
  return rmax;
}

function scene3d(L) {
  const ax = (t) => ({ title: t, range: [-L, L], gridcolor: COL.grid, zerolinecolor: COL.grid,
    backgroundcolor: 'rgba(0,0,0,0)', showbackground: true, color: COL.dim });
  return { aspectmode: 'cube', xaxis: ax('x'), yaxis: ax('y'), zaxis: ax('z'),
    camera: { eye: { x: 1.5, y: 1.5, z: 1.1 } } };
}

// =============================================================================
function render() {
  renderControls();
  renderEquations();
  renderRadial();
  renderAngular();
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
