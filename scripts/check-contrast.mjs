// WCAG AA check of the colour tokens in src/styles.scss, light and dark: text 4.5:1, graphics and borders 3:1.
// Part of `npm test`: a token changed below the threshold fails the build.
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('../src/styles.scss', import.meta.url), 'utf8');

function block(source, start) {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`block not found: ${start}`);
  const open = source.indexOf('{', from);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`unclosed block: ${start}`);
}

function tokens(text) {
  const out = {};
  for (const m of text.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

const light = tokens(block(css, ':root {'));
const dark = {...light, ...tokens(block(css, '@mixin dark-tokens'))};

const lum = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [foreground, background, minimum]
const TEXT = 4.5, UI = 3;
const pairs = [
  ['fg', 'bg', TEXT], ['fg', 'surface', TEXT], ['fg', 'surface-2', TEXT],
  ['muted', 'bg', TEXT], ['muted', 'surface', TEXT], ['muted', 'surface-2', TEXT],
  ['accent', 'surface', TEXT], ['accent', 'bg', TEXT], ['accent', 'accent-soft', TEXT], ['accent-fg', 'accent', TEXT],
  ['good', 'surface', TEXT], ['good', 'good-bg', TEXT],
  ['warn', 'surface', TEXT], ['warn', 'warn-bg', TEXT],
  ['bad', 'surface', TEXT], ['bad', 'bad-bg', TEXT],
  ['fg', 'accent-soft', TEXT], ['fg', 'warn-bg', TEXT], ['fg', 'good-bg', TEXT], ['fg', 'bad-bg', TEXT],
  ['line-strong', 'surface', UI], ['line-strong', 'bg', UI],
  ['s1', 'surface', UI], ['s2', 'surface', UI], ['s3', 'surface', UI], ['s4', 'surface', UI], ['s5', 'surface', UI]
];

let failed = 0;
for (const [name, theme] of [['light', light], ['dark', dark]]) {
  for (const [fg, bg, min] of pairs) {
    if (!theme[fg] || !theme[bg]) {
      console.error(`${name}: missing token --${theme[fg] ? bg : fg}`);
      failed++;
      continue;
    }
    const r = ratio(theme[fg], theme[bg]);
    if (r < min) {
      console.error(`${name}: --${fg} on --${bg} is ${r.toFixed(2)}:1, needs ${min}:1`);
      failed++;
    }
  }
}
if (failed) {
  process.exit(1);
}
console.log(`contrast: ${pairs.length * 2} pairs at WCAG AA (light and dark)`);
