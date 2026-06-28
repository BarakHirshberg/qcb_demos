// =============================================================================
//  special.js — Special functions for the Quantum Mechanics Visualizer
//
//  Single source of truth for the math used by all five apps. Everything runs
//  in the browser as an ES module. Units: atomic units with the Bohr radius
//  a0 = 1 and (for the oscillator) hbar = m = omega = 1, so all expressions are
//  dimensionless and student-friendly.
//
//  Conventions:
//   - Associated Legendre P_l^m use the Condon-Shortley phase (-1)^m.
//   - Complex spherical harmonics Y_l^m = N_l^m P_l^m(cos t) e^{i m p}.
//   - Real spherical harmonics are the usual tesseral combinations (s, p_x,
//     p_y, p_z, d_xy, ...).
//  Also hosts eighJacobi (a small symmetric eigensolver) and the exact
//  rational-coefficient polynomial generators used to render formulas.
// =============================================================================

// ---- Symmetric eigensolver (cyclic Jacobi) ----------------------------------
// A is an n×n symmetric array-of-arrays. Returns { values, vectors } sorted by
// ascending eigenvalue; vectors[k] is the k-th eigenvector (length n).
export function eighJacobi(A0) {
  const n = A0.length;
  const A = A0.map((r) => r.slice());
  const V = Array.from({ length: n }, (_, i) => { const r = new Array(n).fill(0); r[i] = 1; return r; });
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
    if (off < 1e-20) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]);
      const c = Math.cos(th), s = Math.sin(th);
      for (let k = 0; k < n; k++) { const kp = A[k][p], kq = A[k][q]; A[k][p] = c * kp - s * kq; A[k][q] = s * kp + c * kq; }
      for (let k = 0; k < n; k++) { const pk = A[p][k], qk = A[q][k]; A[p][k] = c * pk - s * qk; A[q][k] = s * pk + c * qk; }
      for (let k = 0; k < n; k++) { const vp = V[k][p], vq = V[k][q]; V[k][p] = c * vp - s * vq; V[k][q] = s * vp + c * vq; }
    }
  }
  const vals = A.map((r, i) => r[i]);
  const ord = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b]);
  return { values: ord.map((i) => vals[i]), vectors: ord.map((i) => V.map((r) => r[i])) };
}

// ---- Factorials -------------------------------------------------------------

const _factCache = [1];
export function factorial(n) {
  if (n < 0) return NaN;
  for (let i = _factCache.length; i <= n; i++) _factCache[i] = _factCache[i - 1] * i;
  return _factCache[n];
}

export function logFactorial(n) {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}

// ---- Associated Laguerre polynomials  L_n^alpha(x) --------------------------
//  Recurrence: (k+1) L_{k+1} = (2k+1+a-x) L_k - (k+a) L_{k-1}
export function assocLaguerre(n, alpha, x) {
  if (n < 0) return 0;
  let Lkm1 = 1;                  // L_0
  if (n === 0) return Lkm1;
  let Lk = 1 + alpha - x;        // L_1
  for (let k = 1; k < n; k++) {
    const Lkp1 = ((2 * k + 1 + alpha - x) * Lk - (k + alpha) * Lkm1) / (k + 1);
    Lkm1 = Lk;
    Lk = Lkp1;
  }
  return Lk;
}

// Exact rational coefficients of L_n^alpha(x) (alpha a non-negative integer),
// returned as an array of {num, den} for powers x^0, x^1, ... x^n.
//  L_n^a(x) = sum_{k=0}^{n} (-1)^k C(n+a, n-k) x^k / k!
export function laguerreCoeffs(n, alpha) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    // C(n+alpha, n-k) is an integer; divide by k! and apply sign.
    const c = binom(n + alpha, n - k);
    out.push(reduceFrac((k % 2 === 0 ? 1 : -1) * c, factorial(k)));
  }
  return out;
}

function binom(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
function reduceFrac(num, den) { if (den < 0) { num = -num; den = -den; } const g = gcd(num, den); return { num: num / g, den: den / g }; }

// Exact coefficients of the ordinary Legendre polynomial P_l(x) (powers x^0..x^l),
// via the recurrence (n+1)P_{n+1} = (2n+1) x P_n − n P_{n-1}, using fractions.
export function legendreCoeffs(l) {
  const sub = (a, b) => reduceFrac(a.num * b.den - b.num * a.den, a.den * b.den);
  const scl = (a, k) => reduceFrac(a.num * k, a.den);
  const dvi = (a, k) => reduceFrac(a.num, a.den * k);
  let Pm1 = [{ num: 1, den: 1 }];
  if (l === 0) return Pm1;
  let Pc = [{ num: 0, den: 1 }, { num: 1, den: 1 }];
  for (let n = 1; n < l; n++) {
    const shifted = [{ num: 0, den: 1 }, ...Pc];        // x · P_n
    const len = Math.max(shifted.length, Pm1.length);
    const next = [];
    for (let i = 0; i < len; i++) {
      const a = shifted[i] ? scl(shifted[i], 2 * n + 1) : { num: 0, den: 1 };
      const b = Pm1[i] ? scl(Pm1[i], n) : { num: 0, den: 1 };
      next.push(dvi(sub(a, b), n + 1));
    }
    Pm1 = Pc; Pc = next;
  }
  return Pc;
}

// Explicit form P_l^m(cos ϑ) = sign · sin^m ϑ · (poly in cos ϑ), where the poly
// is d^m/dx^m P_l(x). Returns { sign:(-1)^m, sinPow:m, poly:[fractions of cosϑ] }.
export function assocLegendreParts(l, m) {
  const deriv = (c) => {
    const o = [];
    for (let i = 1; i < c.length; i++) o.push(reduceFrac(c[i].num * i, c[i].den));
    return o.length ? o : [{ num: 0, den: 1 }];
  };
  let poly = legendreCoeffs(l);
  for (let k = 0; k < m; k++) poly = deriv(poly);
  return { sign: m % 2 === 0 ? 1 : -1, sinPow: m, poly };
}

// ---- Associated Legendre  P_l^m(x),  -1 <= x <= 1 ---------------------------
//  Numerical-Recipes 'plgndr', valid for 0 <= m <= l. Condon-Shortley included.
function plgndrPos(l, m, x) {
  let pmm = 1;
  if (m > 0) {
    const somx2 = Math.sqrt(Math.max(0, (1 - x) * (1 + x)));
    let fact = 1;
    for (let i = 1; i <= m; i++) { pmm *= -fact * somx2; fact += 2; }
  }
  if (l === m) return pmm;
  let pmmp1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pmmp1;
  let pll = 0;
  for (let ll = m + 2; ll <= l; ll++) {
    pll = (x * (2 * ll - 1) * pmmp1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pmmp1;
    pmmp1 = pll;
  }
  return pll;
}

export function assocLegendre(l, m, x) {
  if (m >= 0) return plgndrPos(l, m, x);
  const am = -m;
  // P_l^{-m} = (-1)^m (l-m)!/(l+m)! P_l^m
  const sign = am % 2 === 0 ? 1 : -1;
  return sign * (factorial(l - am) / factorial(l + am)) * plgndrPos(l, am, x);
}

// ---- Hermite polynomials (physicists')  H_n(x) ------------------------------
//  H_{n+1} = 2x H_n - 2n H_{n-1}
export function hermite(n, x) {
  if (n === 0) return 1;
  let Hkm1 = 1, Hk = 2 * x;
  for (let k = 1; k < n; k++) { const Hkp1 = 2 * x * Hk - 2 * k * Hkm1; Hkm1 = Hk; Hk = Hkp1; }
  return Hk;
}

// Exact integer coefficients of H_n(y) (powers y^0..y^n), as {num,den:1} for
// pretty-printing. H_0=1, H_1=2y, H_2=4y²−2, H_3=8y³−12y, …
export function hermiteCoeffs(n) {
  if (n === 0) return [{ num: 1, den: 1 }];
  let Hm1 = [1], Hc = [0, 2];
  for (let k = 1; k < n; k++) {
    const t1 = [0, ...Hc.map((c) => 2 * c)];          // 2y · H_k
    const len = Math.max(t1.length, Hm1.length), next = [];
    for (let i = 0; i < len; i++) next.push((t1[i] || 0) - 2 * k * (Hm1[i] || 0));
    Hm1 = Hc; Hc = next;
  }
  return Hc.map((c) => ({ num: c, den: 1 }));
}

// =============================================================================
//  Hydrogen atom
// =============================================================================

//  Normalization constant N_nl of the radial function.
export function radialNorm(n, l) {
  return Math.sqrt(Math.pow(2 / n, 3) * factorial(n - l - 1) / (2 * n * factorial(n + l)));
}

//  R_nl(r) with a0 = 1. rho = 2r/n.
export function radialR(n, l, r) {
  const rho = (2 * r) / n;
  return radialNorm(n, l) * Math.exp(-r / n) * Math.pow(rho, l) *
         assocLaguerre(n - l - 1, 2 * l + 1, rho);
}

//  A sensible plotting/sampling radius: covers the bulk of the density.
export function radialRmax(n) { return 2 * n * (n + 6); }

// =============================================================================
//  Spherical harmonics
// =============================================================================

export function sphHarmNorm(l, m) {
  const am = Math.abs(m);
  return Math.sqrt((2 * l + 1) / (4 * Math.PI) * factorial(l - am) / factorial(l + am));
}

//  Complex spherical harmonic Y_l^m(theta, phi) -> {re, im}.
//  The |m|-based normalization pairs with P_l^{|m|}; the two signs of m have
//  equal magnitude and differ only by the e^{i m phi} phase (and an overall
//  sign convention that is irrelevant for |Y|^2 and for visualization).
export function sphHarmComplex(l, m, theta, phi) {
  const norm = sphHarmNorm(l, m) * assocLegendre(l, Math.abs(m), Math.cos(theta));
  return { re: norm * Math.cos(m * phi), im: norm * Math.sin(m * phi) };
}

//  Real (tesseral) spherical harmonic. Returns a signed real number.
export function realSphHarm(l, m, theta, phi) {
  const am = Math.abs(m);
  // Legendre without the Condon-Shortley phase keeps the real-orbital signs clean.
  const P = Math.pow(-1, am) * plgndrPos(l, am, Math.cos(theta));
  const N = Math.sqrt((2 * l + 1) / (4 * Math.PI) * factorial(l - am) / factorial(l + am));
  if (m > 0) return Math.SQRT2 * N * P * Math.cos(am * phi);
  if (m < 0) return Math.SQRT2 * N * P * Math.sin(am * phi);
  return N * P;
}

//  Particle-on-a-ring eigenfunction Phi_m(phi) = e^{i m phi} / sqrt(2 pi)
export function ringPhi(m, phi) {
  const c = 1 / Math.sqrt(2 * Math.PI);
  return { re: c * Math.cos(m * phi), im: c * Math.sin(m * phi) };
}

// Common spectroscopic names for the real orbitals (used in labels).
export function realOrbitalName(l, m) {
  const shell = ['s', 'p', 'd', 'f', 'g', 'h'][l] || `l=${l}`;
  if (l === 0) return 's';
  const sub = {
    1: { '-1': 'p_y', 0: 'p_z', 1: 'p_x' },
    2: { '-2': 'd_{xy}', '-1': 'd_{yz}', 0: 'd_{z^2}', 1: 'd_{xz}', 2: 'd_{x^2-y^2}' },
    3: { '-3': 'f_{y(3x^2-y^2)}', '-2': 'f_{xyz}', '-1': 'f_{yz^2}', 0: 'f_{z^3}',
         1: 'f_{xz^2}', 2: 'f_{z(x^2-y^2)}', 3: 'f_{x(x^2-3y^2)}' },
  };
  return (sub[l] && sub[l][m]) || `${shell}_{m=${m}}`;
}

// =============================================================================
//  Harmonic oscillator (hbar = m = omega = 1)
// =============================================================================

//  Normalization N_n = (2^n n!)^{-1/2} (alpha/pi)^{1/4}, with alpha = 1.
export function oscNorm(n) {
  return Math.exp(-0.5 * (n * Math.log(2) + logFactorial(n)) - 0.25 * Math.log(Math.PI));
}

//  psi_n(x) = (2^n n!)^{-1/2} pi^{-1/4} H_n(x) e^{-x^2/2}
export function oscPsi(n, x) {
  return oscNorm(n) * hermite(n, x) * Math.exp(-0.5 * x * x);
}

//  Classical probability density for a classical oscillator with energy E_n.
//  P_cl(x) = 1 / (pi sqrt(A^2 - x^2)), A = sqrt(2 E_n) = sqrt(2n+1).
export function oscClassical(n, x) {
  const A = Math.sqrt(2 * n + 1);
  if (Math.abs(x) >= A) return null;
  return 1 / (Math.PI * Math.sqrt(A * A - x * x));
}

// =============================================================================
//  Numeric self-tests (logged to console in dev). Normalization integrals.
// =============================================================================

export function selfTest() {
  const log = (name, val, target = 1) => {
    const ok = Math.abs(val - target) < 2e-2;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} = ${val.toFixed(4)} (want ${target})`);
    return ok;
  };
  let all = true;
  // Radial: ∫ R^2 r^2 dr = 1
  for (const [n, l] of [[1, 0], [2, 0], [2, 1], [3, 1], [4, 2]]) {
    const rmax = radialRmax(n), N = 4000, h = rmax / N;
    let s = 0;
    for (let i = 0; i <= N; i++) {
      const r = i * h, w = (i === 0 || i === N) ? 0.5 : 1;
      const R = radialR(n, l, r);
      s += w * R * R * r * r;
    }
    all &= log(`∫R_${n}${l}^2 r^2 dr`, s * h);
  }
  // Angular: ∫ |Y|^2 sin t dt dp = 1
  for (const [l, m] of [[0, 0], [1, 0], [1, 1], [2, -1], [3, 2]]) {
    const Nt = 200, Np = 200, ht = Math.PI / Nt, hp = (2 * Math.PI) / Np;
    let s = 0;
    for (let i = 0; i <= Nt; i++) {
      const t = i * ht, wt = (i === 0 || i === Nt) ? 0.5 : 1;
      for (let j = 0; j < Np; j++) {
        const p = j * hp, Y = sphHarmComplex(l, m, t, p);
        s += wt * (Y.re * Y.re + Y.im * Y.im) * Math.sin(t);
      }
    }
    all &= log(`∫|Y_${l}^${m}|^2 dΩ`, s * ht * hp);
  }
  // Real spherical harmonics are also normalized.
  for (const [l, m] of [[1, 1], [2, -2], [2, 0]]) {
    const Nt = 200, Np = 200, ht = Math.PI / Nt, hp = (2 * Math.PI) / Np;
    let s = 0;
    for (let i = 0; i <= Nt; i++) {
      const t = i * ht, wt = (i === 0 || i === Nt) ? 0.5 : 1;
      for (let j = 0; j < Np; j++) {
        const p = j * hp, Y = realSphHarm(l, m, t, p);
        s += wt * Y * Y * Math.sin(t);
      }
    }
    all &= log(`∫|Y_real(${l},${m})|^2 dΩ`, s * ht * hp);
  }
  // Oscillator: ∫ |psi|^2 dx = 1
  for (const n of [0, 1, 5, 10]) {
    const L = 9, N = 6000, h = (2 * L) / N;
    let s = 0;
    for (let i = 0; i <= N; i++) {
      const x = -L + i * h, w = (i === 0 || i === N) ? 0.5 : 1;
      const p = oscPsi(n, x);
      s += w * p * p;
    }
    all &= log(`∫|psi_${n}|^2 dx`, s * h);
  }
  console.log(all ? 'All self-tests passed ✔' : 'Some self-tests FAILED ✘');
  return !!all;
}
