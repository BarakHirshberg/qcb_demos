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
- **Harmonic oscillator** — *coming soon.*
- **Particle on a sphere** — *coming soon.*

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

Pushing to `main` triggers `.github/workflows/deploy.yml`, which publishes the
site to GitHub Pages automatically.

## License

MIT — see [LICENSE](LICENSE).
