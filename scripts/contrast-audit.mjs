// scripts/contrast-audit.mjs
// WCAG 2.2 contrast audit of text/background pairs in src/styles/main.css.
// Reads the theme variables straight from the stylesheet, so it stays in sync.
// Usage: node scripts/contrast-audit.mjs   (exits 1 if any pair fails AA)
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8');

function themeVars(selectorRe) {
  const block = css.match(selectorRe)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
}
const THEMES = {
  dark: themeVars(/:root,\s*\[data-theme="dark"\]\s*\{([^}]*)\}/),
  light: themeVars(/\[data-theme="light"\]\s*\{([^}]*)\}/),
};

function parse(c) {
  c = c.trim();
  let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = [...h].map(x => x + x).join('');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  m = c.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(',').map(s => parseFloat(s));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  throw new Error(`Cannot parse color ${c}`);
}
const over = (top, bottom) => {
  const [r, g, b, a] = top;
  return [r * a + bottom[0] * (1 - a), g * a + bottom[1] * (1 - a), b * a + bottom[2] * (1 - a), 1];
};
const lum = ([r, g, b]) => {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [label, foreground, background layers (bottom first), kind]
// kind: 'text' = 4.5:1, 'large' = 3:1 (>=24px or >=18.66px bold), 'ui' = 3:1 (non-text: borders, icons)
const PAIRS = [
  ['Body text', 'text', ['bg'], 'text'],
  ['Muted text on page', 'text-muted', ['bg'], 'text'],
  ['Sidebar text', 'text', ['bg-sidebar'], 'text'],
  ['Sidebar header / muted text', 'text-muted', ['bg-sidebar'], 'text'],
  ['Sidebar buttons & links', 'link', ['bg-sidebar'], 'text'],
  ['Sidebar button border', 'border-strong', ['bg-sidebar'], 'ui'],
  ['Sidebar status message', 'text-muted', ['bg-sidebar'], 'text'],
  ['Sidebar error message', 'error', ['bg-sidebar'], 'text'],
  ['Active tree item text', 'text', ['bg-sidebar', 'rgba(0,122,204,0.15)'], 'text'],
  ['Column name (muted)', 'text-muted', ['bg-sidebar'], 'text'],
  ['Header text', 'text', ['bg-header'], 'text'],
  ['Footer text (muted)', 'text-muted', ['bg-footer'], 'text'],
  ['Footer links', 'link', ['bg-footer'], 'text'],
  ['Panel header (muted)', 'text-muted', ['panel-header-bg'], 'text'],
  ['Output placeholder', 'text-muted', ['bg-output'], 'text'],
  ['Output query', 'link', ['bg-output'], 'text'],
  ['Output success', 'success', ['bg-output'], 'text'],
  ['Output error', 'error', ['bg-output'], 'text'],
  ['Primary button (white on accent)', '#ffffff', ['accent'], 'text'],
  ['Form label (muted)', 'text-muted', ['bg'], 'text'],
  ['Input / select border', 'border-strong', ['bg'], 'ui'],
  ['SQL preview (green)', 'success', ['bg-sidebar'], 'text'],
  ['Palette description', 'text-muted', ['bg'], 'text'],
  ['Active DB badge', 'success', ['panel-header-bg', 'rgba(78,201,176,0.1)'], 'text'],
  ['Diagram active table (amber)', 'warning', ['bg'], 'text'],
  ['Secondary button border', 'border-strong', ['bg'], 'ui'],
  ['Focus outline', 'link', ['bg-sidebar'], 'ui'],
  ['Active diagram edge', 'warning', ['bg'], 'ui'],
  ['Junction badge', 'junction', ['bg-sidebar', 'rgba(186,104,200,0.2)'], 'text'],
  ['Count badge', 'text', ['border'], 'text'],
  ['PK badge', '#1e1e1e', ['#f1c40f'], 'text'],
  ['FK badge', '#ffffff', ['#1d6aa5'], 'text'],
  ['UK badge', '#ffffff', ['#9b59b6'], 'text'],
  ['FK reference', 'link', ['bg-sidebar'], 'text'],
  ['DB card title', 'link', ['bg', 'rgba(0,122,204,0.08)'], 'text'],
  ['CLEAR button text', 'text', ['panel-header-bg'], 'text'],
  ['CLEAR button border', 'border-strong', ['panel-header-bg'], 'ui'],
  ['Settings selected option', '#ffffff', ['accent'], 'text'],
  ['Settings option border', 'border-strong', ['bg'], 'ui'],
  ['Danger button', '#ffffff', ['#b42318'], 'text'],
  ['Resizer focus outline', 'link', ['bg'], 'ui'],
];
const MIN = { text: 4.5, large: 3, ui: 3 };

let failures = 0;
for (const [theme, vars] of Object.entries(THEMES)) {
  const resolve = c => parse(vars[c] ?? c);
  console.log(`\n=== ${theme.toUpperCase()} THEME ===`);
  for (const [label, fg, layers, kind] of PAIRS) {
    let bg = resolve(layers[0]);
    for (const l of layers.slice(1)) bg = over(resolve(l), bg);
    const r = ratio(over(resolve(fg), bg), bg);
    const ok = r >= MIN[kind];
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (need ${MIN[kind]})  ${label}`);
  }
}
console.log(`\n${failures === 0 ? 'All pairs meet WCAG AA.' : `${failures} pair(s) fail WCAG AA.`}`);
process.exit(failures ? 1 : 0);
