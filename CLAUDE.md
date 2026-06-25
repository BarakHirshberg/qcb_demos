# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Keep this file current.** After any *major* change — a new app, a new panel,
> an architectural shift, a new convention, or a hard-won gotcha — update the
> relevant section here in the same change. Do **not** log minor tweaks (small
> styling, label/copy edits, one-off fixes).

## What this is

Interactive, browser-based visualizations of undergraduate quantum-mechanics
systems, built as a teaching companion. Pure static site — **no build step, no
framework, no bundler**. Everything is computed client-side from exact analytic
eigenfunctions. Hosted free on GitHub Pages.

Live: https://barakhirshberg.github.io/qcb_demos/

**Status:** the **Hydrogen atom** app is complete and deployed. The **Harmonic
oscillator** and **Particle on a sphere** apps are planned and currently shown
as "coming soon" (non-clickable) on the landing page (`index.html`) and in the
nav of every page. Building one means: create `oscillator/` or `sphere/`
(`index.html` + JS importing `../js/special.js` and `../js/ui.js`), then flip the
"coming soon" `<span class="soon">` / `<div class="app-card soon">` back into
`<a href>` links in both `index.html` and `hydrogen/index.html`.

## Commands

```bash
# Run locally (the only way to "run" it — it's static):
python3 -m http.server 8000          # then open http://localhost:8000

# Physics self-tests (normalization integrals) print to the BROWSER console:
#   open .../hydrogen/?test   (or append #test)
```

There is **no test runner, linter, or package.json**. The math is verified two ways:

1. **Browser self-tests:** `selfTest()` in `js/special.js` checks ∫|R|²r²dr,
   ∫|Y|²dΩ, ∫|ψ|²dx ≈ 1; triggered by `?test` in the URL.
2. **Node + screenshots for offline verification** (see "Verification workflow").

## Architecture

- **`js/special.js`** — the math core and single source of truth. Plain ES module,
  no DOM. Associated Laguerre/Legendre, Hermite, complex & real spherical
  harmonics, radial `R_nℓ`, `oscPsi`, plus exact rational-coefficient generators
  (`laguerreCoeffs`, `legendreCoeffs`, `assocLegendreParts`) used to render the
  explicit polynomials in the UI. Atomic units: Bohr radius `a = 1`, `Z = 1`,
  and ħ=m=ω=1 for the oscillator. Includes `selfTest()`.
- **`js/ui.js`** — shared UI helpers: `segmented()` (the button-group selectors),
  `math()` (KaTeX render), `layout()`/`CONFIG`/`CONFIG_3D` (dark Plotly theme),
  `fmt`, `fracTex`, `COL` palette.
- **`assets/css/style.css`** — all styling; dark theme; `.grid.cols-2/3`,
  `.card`, `.seg` selectors, `.soon` (coming-soon styling).
- **Per-app folder** (`hydrogen/`) — `index.html` (loads Plotly + KaTeX from CDN,
  the shared CSS, and its module script) + one JS module. Each app owns its
  layout and rendering but imports all physics from `js/special.js`.

External deps are **CDN-only** (Plotly.js, KaTeX) — intentional, for zero-build
longevity. Don't add npm/bundling.

### Hydrogen app (`hydrogen/hydrogen.js`) — the non-obvious parts

- `state = {n,l,m,isoFrac,showNodes}`. `render()` rebuilds everything; the iso
  slider and nodes toggle call only `drawClouds()` (cheap). Quantum-number
  selectors enforce validity: changing `n` rebuilds the `l` options, `l` rebuilds
  `m` (`ℓ=0…n−1`, `m=−ℓ…+ℓ`). URL params: `?n=&l=&m=&nodes=0|1` (also for
  shareable links and screenshot testing).
- **3D rendering strategy (important):** the complex `|ψ|²` and any real orbital
  with `m=0` are **axially symmetric**, so they are drawn as a smooth
  *surface of revolution*: fine 2-D `(s,z)` contour via `marchingSquares` →
  `revolveMesh` (mesh3d). Only the **non-axisymmetric real orbitals (m≠0)** use a
  3-D Plotly `isosurface` (`build3DReal` + `isoTrace3`). This avoids the speckle
  artifacts a coarse Cartesian isosurface produces for high-n shells.
- **Boundary-surface level = enclosed probability** (slider, default 90%), found
  by sorting voxel/cell densities (`cutoff2D`/`cutoff3D`), not "% of max".
- **Nodes overlay** (`nodeTraces`): radial spheres (`n−ℓ−1`), polar cones
  (`ℓ−|m|`, a flat disk at ϑ=90°), azimuthal planes (`|m|`, real orbital only).
- Angular panel: Θ(ϑ) amplitude + |Θ|² density as **polar** plots; Θ and Φ as
  **Cartesian** plots (angle axes in **radians**, π ticks rendered serif/italic).
- **Energy panel** (`renderEnergy`): Coulomb well `V(r)=−1/r` + the ladder
  `E_n=−1/2n²` (atomic units), each level drawn to its turning point `r_n=2n²`
  and converging to the ionization limit `E=0`. Only the **selected** level is a
  line split into its `n²` degenerate states (one segment per state, grouped/
  colored by ℓ, selected state circled); the other levels are plain lines.

## Conventions (match the course notes — keep consistent across apps)

- Polar angle **ϑ** (vartheta), azimuthal **φ** (varphi), angular quantum number
  **ℓ** (not `l` in displayed math), reduced mass **μ**, Bohr radius **a**,
  nuclear charge **Z**, potential `Ze²/r`.
- Radial function is **eq. (33)**: `R_nℓ = N_nℓ e^{−Zr/na}(2Zr/na)^ℓ L_{n−ℓ−1}^{2ℓ+1}(2Zr/na)`;
  `N_nℓ` is eq. (35); the Laguerre argument is `x = 2Zr/na`. Radial probability
  shown as `P(r)=|R|²r²` (eq. 39). Source PDF: the user's `class12_hydrogen_atom.pdf`.
- Each plot shows the explicit polynomial above it (Laguerre for radial, the
  associated Legendre `P_ℓ^m(cosϑ)` for angular), mirroring the notes.

## Verification workflow (offline, this machine)

`special.js` runs under Node only as an ES module:

```bash
cp js/special.js /tmp/special.mjs            # node needs the .mjs extension
node --experimental-modules /tmp/<test>.mjs  # import from /tmp/special.mjs
```

To exercise an app's `render()` headlessly, load the module with stubbed
`window/document/katex/Plotly` globals (Plotly.react = no-op) and invoke the
stored DOMContentLoaded handler — catches runtime errors without a browser.

**Visual checks: use Firefox, not Chrome.** Headless Chrome's WebGL is broken on
this machine (Plotly 3D renders empty/wrong). Firefox works:

```bash
MOZ_HEADLESS=1 firefox --headless --profile /tmp/ffX --window-size=1500,2600 \
  --screenshot /tmp/out.png "http://127.0.0.1:8000/hydrogen/?n=3&l=2&m=0&nodes=1"
```

Use a **fresh `--profile` dir** each time, or Firefox caches the old JS. Crop
regions with ImageMagick `convert in.png -crop WxH+X+Y +repage out.png`.

## Node version gotcha

Local Node is **v10** (browsers run modern JS; this only affects offline test
scripts). Avoid in test scripts: top-level `await`, `globalThis` (use `global`),
`&&=`/`||=`. ES modules require `.mjs` + `--experimental-modules`.

## Plotly gotcha

For a single 3-D isosurface, do **not** rely on `surface.count: 1` — it can draw
near the density peak instead of at the requested level (shrinks the orbital to a
dot). Use `isomin = level`, `isomax = maxValue`, `surface.count: 2`, caps off
(see `isoTrace3`).

## Deploy

GitHub Pages, **"Deploy from a branch" → `main` / root** (NOT GitHub Actions — an
Actions workflow was tried and removed because it failed/was overkill for a
static site). `.nojekyll` makes Pages serve files as-is. Every push to `main`
republishes (~1 min). On this machine `gh` is **not installed** and there is **no
GitHub token**, but **SSH push works** (authenticated as `BarakHirshberg`):

```bash
git push origin main   # remote: git@github.com:BarakHirshberg/qcb_demos.git
```

Commit messages end with a `Co-Authored-By: Claude ...` line. Commit/push only
when the user asks.
