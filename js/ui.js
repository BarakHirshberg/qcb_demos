// =============================================================================
//  ui.js — shared UI helpers (segmented selectors, KaTeX, Plotly theme)
//  Depends on global `katex` and `Plotly` loaded from CDNs.
// =============================================================================

export const COL = {
  pos: '#4f8cff', neg: '#ff6b6b', accent: '#6ea8fe', accent2: '#f78fb3',
  grid: '#2a3340', text: '#e6edf3', dim: '#9aa7b4', density: '#7c5cff',
};

// Build a segmented button group inside `container`.
//   values    : array of selectable values
//   current   : currently selected value
//   onSelect  : callback(value)
//   labelFn   : optional value -> string (defaults to String(value))
export function segmented(container, values, current, onSelect, labelFn = String) {
  container.innerHTML = '';
  for (const v of values) {
    const b = document.createElement('button');
    b.textContent = labelFn(v);
    if (v === current) b.classList.add('sel');
    b.addEventListener('click', () => onSelect(v));
    container.appendChild(b);
  }
}

// Render a LaTeX string into an element.
export function math(el, latex, display = true) {
  katex.render(latex, el, { displayMode: display, throwOnError: false });
}

// Base dark Plotly layout; merge with per-plot overrides.
export function layout(overrides = {}) {
  const base = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: COL.text, family: 'system-ui, sans-serif', size: 12 },
    margin: { l: 56, r: 18, t: 18, b: 44 },
    xaxis: { gridcolor: COL.grid, zerolinecolor: COL.grid, linecolor: COL.grid },
    yaxis: { gridcolor: COL.grid, zerolinecolor: COL.grid, linecolor: COL.grid },
    showlegend: false,
    hovermode: 'closest',
  };
  return deepMerge(base, overrides);
}

export const CONFIG = { displayModeBar: false, responsive: true };
export const CONFIG_3D = {
  displayModeBar: true, responsive: true, displaylogo: false,
  modeBarButtonsToRemove: ['toImage2', 'sendDataToCloud'],
};

function deepMerge(a, b) {
  const out = Array.isArray(a) ? a.slice() : { ...a };
  for (const k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && typeof a[k] === 'object') {
      out[k] = deepMerge(a[k], b[k]);
    } else out[k] = b[k];
  }
  return out;
}

// Pretty-print a number for inline display.
export function fmt(x, sig = 4) {
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e4 || a < 1e-3) return x.toExponential(2);
  return parseFloat(x.toPrecision(sig)).toString();
}

// Format an exact fraction {num, den} as LaTeX (used for polynomial coefficients).
export function fracTex(f) {
  if (f.den === 1) return `${f.num}`;
  const sign = f.num < 0 ? '-' : '';
  return `${sign}\\tfrac{${Math.abs(f.num)}}{${f.den}}`;
}
