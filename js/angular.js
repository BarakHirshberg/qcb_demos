// =============================================================================
//  angular.js — shared angular-momentum machinery for the hydrogen atom and the
//  particle on a sphere. Both render the same Θ(ϑ)/Φ(φ) panels and the same 3-D
//  nodal surfaces (radial spheres, polar cones, azimuthal planes); this module
//  is the single source of truth for that code. Depends on global `katex` and
//  `Plotly`. Imports the special functions and the shared Plotly theme.
// =============================================================================
import { sphHarmNorm, assocLegendre, ringPhi } from './special.js';
import { layout, CONFIG, COL, fracTex } from './ui.js';

export function katexInline(tex) {
  return katex.renderToString(tex, { displayMode: false, throwOnError: false });
}

// Format P_ℓ^|m|(cosϑ) = sign · sin^m ϑ · (polynomial in cos ϑ) as LaTeX.
export function legendreTex(parts) {
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
//  Angular plots: Θ(ϑ) amplitude + density (polar) + Θ,Φ (cartesian)
//  Renders into ids plot-theta, plot-theta-den, plot-theta-cart, plot-phi.
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

export function renderAngular(l, m) {
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
      ticktext: ['0', '<i>π</i>/4', '<i>π</i>/2', '3<i>π</i>/4', '<i>π</i>'],
      tickfont: { family: 'Georgia, "Times New Roman", serif' } },
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
      ticktext: ['0', '<i>π</i>/2', '<i>π</i>', '3<i>π</i>/2', '2<i>π</i>'],
      tickfont: { family: 'Georgia, "Times New Roman", serif' } },
    yaxis: { title: 'Φ<sub>m</sub>(φ)', range: [-0.46, 0.46] },
  }), CONFIG);
}

// =============================================================================
//  Nodal angles + 3-D nodal surfaces (gray): spheres, cones, planes
// =============================================================================

// Interior zeros of P_ℓ^|m|(cos ϑ): the ℓ−|m| polar nodal angles.
export function polarNodeAngles(l, m) {
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
export function azimuthalNodePlanes(m) {
  if (m === 0) return [];
  const am = Math.abs(m), out = [];
  for (let k = 0; k < 2 * am; k++) {
    const phi = m > 0 ? (Math.PI / 2 + k * Math.PI) / am : (k * Math.PI) / am;
    let p = phi % Math.PI; if (p < 0) p += Math.PI;
    if (!out.some((q) => Math.abs(q - p) < 1e-6)) out.push(p);
  }
  return out;
}

export function nodeSurface(X, Y, Z, color, opacity = 0.2) {
  return {
    type: 'surface', x: X, y: Y, z: Z, showscale: false, opacity,
    colorscale: [[0, color], [1, color]], hoverinfo: 'skip',
    lighting: { ambient: 1, diffuse: 0, specular: 0 },
    contours: { x: { highlight: false }, y: { highlight: false }, z: { highlight: false } },
  };
}

export function sphereSurface(r, color) {
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

export function coneSurface(th, L, color) {
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

export function planeSurface(ph, L, color) {
  const cx = Math.cos(ph), sy = Math.sin(ph);
  const X = [[-L * cx, L * cx], [-L * cx, L * cx]];
  const Y = [[-L * sy, L * sy], [-L * sy, L * sy]];
  const Z = [[-L, -L], [L, L]];
  return nodeSurface(X, Y, Z, color);
}

export function scene3d(L) {
  const ax = (t) => ({ title: t, range: [-L, L], gridcolor: COL.grid, zerolinecolor: COL.grid,
    backgroundcolor: 'rgba(0,0,0,0)', showbackground: true, color: COL.dim });
  return { aspectmode: 'cube', xaxis: ax('x'), yaxis: ax('y'), zaxis: ax('z'),
    camera: { eye: { x: 1.5, y: 1.5, z: 1.1 } } };
}
