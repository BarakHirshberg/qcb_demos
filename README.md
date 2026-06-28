# Quantum Mechanics Visualizer

Interactive, browser-based visualizations of the standard quantum-mechanics
systems, built as a teaching companion for an undergraduate course. Everything
is computed client-side from the exact analytic eigenfunctions — no server, no
build step.

**Live site:** https://barakhirshberg.github.io/qcb_demos/

## Apps

- **Hydrogen atom** — radial Laguerre functions `R_nℓ(r)` and the radial
  probability `P(r) = r²|R_nℓ|²`; the angular part `Y_ℓ^m(ϑ,φ)` split into the
  Legendre `Θ(ϑ)` (amplitude + density, polar & Cartesian) and the
  particle-on-a-ring `Φ_m(φ)`; and 3-D boundary surfaces of the complex `|ψ|²`
  and the real orbital `ψ`, with an enclosed-probability slider and a
  "show nodes" overlay (radial spheres, polar cones, azimuthal planes).
- **Particle on a sphere** (rigid rotor) — the spherical harmonics `Y_ℓ^m(ϑ,φ)`
  with no radial part: the rotational energy ladder `E_ℓ=ℏ²ℓ(ℓ+1)/2I` with its
  2ℓ+1 degeneracy, the Θ/Φ angular plots, and 3-D balloons of `|Y|²` and the
  real (orbital-shaped) harmonics with nodal cones/planes.
- **Particle on a ring** (planar rotor) — the states `Φ_m(φ)=e^{imφ}/√(2π)`: the
  `m²` energy ladder with ±m degeneracy, a complex (traveling) ⇄ real (standing)
  basis toggle, and a 3-D "wave on the ring" colored by phase/sign.
- **Harmonic oscillator** — `ψ_n(x)=N_n H_n(√α x)e^{−αx²/2}` (Hermite polynomials,
  α=μω/ℏ): the parabolic well with equally-spaced levels `E_n=(n+½)ℏω`, the
  selected ψ_n on its energy line, and `|ψ_n|²` against the classical probability.
- **Particle in a box** (infinite square well) — one app with three modes:
  1D (`E_n=n²h²/8mL²`), 2D (`E=(nₓ²+n_y²)…`, degeneracy + drumhead surface), and
  two non-interacting particles in 1D (same product math; a joint-vs-conditional
  demo showing the particles are uncorrelated).

Notation follows the course notes: `ϑ` polar angle, `φ` azimuthal, `ℓ` for the
angular quantum number, Bohr radius `a`, nuclear charge `Z`. The valid quantum
numbers are enforced: `ℓ = 0…n−1`, `m = −ℓ…+ℓ`.

## Run locally

It's a static site — just serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Append `?n=3&l=2&m=0&nodes=1` to the hydrogen URL to deep-link a specific state.
Append `?test` to log the numerical normalization self-tests to the console.

## Tech

Plain HTML + CSS + vanilla ES-module JavaScript. [Plotly.js](https://plotly.com/javascript/)
for the interactive 2-D/3-D plots and [KaTeX](https://katex.org/) for the
equations, both from CDNs. The math core is in `js/special.js`
(associated Laguerre/Legendre, Hermite, spherical harmonics) with built-in
normalization checks.

## Deploy

Hosted on GitHub Pages straight from the `main` branch (no build step): in the
repo settings, **Pages → Build and deployment → Source: Deploy from a branch →
`main` / `/ (root)`**. The `.nojekyll` file makes Pages serve the files as-is.
Every push to `main` republishes automatically.

## License

MIT — see [LICENSE](LICENSE).
