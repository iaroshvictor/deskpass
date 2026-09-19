// Readability of the two colour schemes.
//
// The palette in imports/ui/theme.ts is the single source of colour for the
// whole app, so a one-character edit there can make a screen unreadable
// without any visible error. These tests compute the WCAG 2.1 contrast ratio
// for the pairs the interface actually puts on top of each other.
//
// The file is parsed rather than imported: it pulls in @mui/material/styles,
// which needs the bundler, and only the literals matter here.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('imports/ui/theme.ts', 'utf8');

// ── read the palettes out of the source ──────────────────────────────────────
const block = (name, open, close) => {
  const start = source.indexOf(open);
  assert.ok(start !== -1, `${name} block not found in imports/ui/theme.ts`);
  const end = source.indexOf(close, start);
  assert.ok(end !== -1, `${name} block is not terminated`);
  return source.slice(start, end);
};

const tactical = Object.fromEntries(
  [...block('tactical', 'export const tactical = {', '} as const;')
    .matchAll(/(\w+):\s*'(#[0-9a-fA-F]{3,8})'/g)].map((m) => [m[1], m[2]]),
);

// A scheme entry is either a literal or a reference to the tactical palette.
const resolve = (token) => {
  const literal = token.match(/^'(#[0-9a-fA-F]{3,8})'$/);
  if (literal) return literal[1];
  const ref = token.match(/^tactical\.(\w+)$/);
  if (ref) {
    assert.ok(tactical[ref[1]], `tactical.${ref[1]} is referenced but not defined`);
    return tactical[ref[1]];
  }
  throw new Error(`cannot resolve colour token ${token}`);
};

const readScheme = (name) => {
  const text = block(name, `const ${name} = {`, '\n};');
  const pick = (path) => {
    const [group, key] = path.split('.');
    const groupText = text.match(new RegExp(`${group}:\\s*\\{([^}]*)\\}`));
    assert.ok(groupText, `${name}.${group} not found`);
    const entry = groupText[1].match(new RegExp(`${key}:\\s*([^,}]+)`));
    assert.ok(entry, `${name}.${path} not found`);
    return resolve(entry[1].trim());
  };
  return {
    bgDefault: pick('background.default'),
    bgPaper: pick('background.paper'),
    sunken: pick('surface.sunken'),
    textPrimary: pick('text.primary'),
    textSecondary: pick('text.secondary'),
    textDisabled: pick('text.disabled'),
    primary: pick('primary.main'),
    primaryOn: pick('primary.contrastText'),
    success: pick('success.main'),
    successOn: pick('success.contrastText'),
    error: pick('error.main'),
    errorOn: pick('error.contrastText'),
    warning: pick('warning.main'),
    warningOn: pick('warning.contrastText'),
  };
};

// ── WCAG 2.1 relative luminance and contrast ─────────────────────────────────
const channel = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

const luminance = (hex) => {
  const h = hex.length === 4
    ? [...hex.slice(1)].map((c) => parseInt(c + c, 16))
    : [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r, g, b] = h.map((v) => channel(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [hi, lo] = luminance(a) > luminance(b) ? [a, b] : [b, a];
  return (luminance(hi) + 0.05) / (luminance(lo) + 0.05);
};

const atLeast = (fg, bg, min, what) => {
  const ratio = contrast(fg, bg);
  assert.ok(
    ratio >= min,
    `${what}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, below the ${min}:1 minimum`,
  );
};

const light = readScheme('light');
const dark = readScheme('dark');

describe('the contrast helper agrees with the WCAG reference values', () => {
  test('black on white is 21:1', () => {
    assert.equal(Math.round(contrast('#000000', '#ffffff')), 21);
  });
  test('a colour against itself is 1:1', () => {
    assert.equal(Math.round(contrast('#3358d4', '#3358d4')), 1);
  });
  test('the documented 4.54:1 pair passes and a 4.4:1 pair does not', () => {
    assert.ok(contrast('#767676', '#ffffff') >= 4.5);
    assert.ok(contrast('#797979', '#ffffff') < 4.5);
  });
});

// The light scheme is new, so it is held to the full AA text minimum.
describe('light scheme text is readable on every surface', () => {
  const surfaces = { 'the page': light.bgDefault, 'a card': light.bgPaper, 'a sunken panel': light.sunken };
  for (const [where, bg] of Object.entries(surfaces)) {
    test(`primary text on ${where}`, () => atLeast(light.textPrimary, bg, 4.5, 'light text.primary'));
    test(`secondary text on ${where}`, () => atLeast(light.textSecondary, bg, 4.5, 'light text.secondary'));
    // This tone carries timestamps, counters and inactive tabs, not just
    // disabled controls, so it has to clear the text minimum as well.
    test(`muted text on ${where}`, () => atLeast(light.textDisabled, bg, 4.5, 'light text.disabled'));
  }
});

// The dark scheme is the original "tactical" design. Its muted grey is
// deliberately quiet — it de-emphasises metadata against near-black panels —
// so it is held to the 3:1 floor for incidental text rather than 4.5:1.
describe('dark scheme text is readable on every surface', () => {
  const surfaces = { 'the page': dark.bgDefault, 'a card': dark.bgPaper, 'a sunken panel': dark.sunken };
  for (const [where, bg] of Object.entries(surfaces)) {
    test(`primary text on ${where}`, () => atLeast(dark.textPrimary, bg, 4.5, 'dark text.primary'));
    test(`secondary text on ${where}`, () => atLeast(dark.textSecondary, bg, 4.5, 'dark text.secondary'));
    test(`muted text on ${where}`, () => atLeast(dark.textDisabled, bg, 3, 'dark text.disabled'));
  }
});

// Filled buttons and chips put contrastText straight onto main.
describe('filled controls are readable in both schemes', () => {
  for (const [name, scheme] of Object.entries({ light, dark })) {
    for (const tone of ['primary', 'success', 'error', 'warning']) {
      test(`${name} ${tone} button`, () =>
        atLeast(scheme[`${tone}On`], scheme[tone], 4.5, `${name} ${tone}.contrastText`));
    }
  }
});

// The livestream overlays (chips, badges, the "connecting" hint) are painted
// with the tactical tones whatever the scheme is, because they sit on the
// black video letterbox. Incidental UI text, so the 3:1 floor applies.
describe('livestream overlays stay readable on the video letterbox', () => {
  const black = '#000000';
  for (const tone of ['text', 'label', 'dim', 'green', 'red', 'accent']) {
    test(`${tone} over video`, () => atLeast(tactical[tone], black, 3, `tactical.${tone}`));
  }
  test('the alert badge label', () => atLeast('#ffffff', tactical.redBadge, 4.5, 'alert badge'));
});
