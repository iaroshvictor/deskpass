/**
 * The application's design tokens, in one place.
 *
 * The palette is the "dark tactical" one introduced by the livestream screen:
 * near-black surfaces, hairline borders, muted greys for labels and a small
 * set of signal colours. It used to live as a local `const C` inside that one
 * file while the other forty-nine files hardcoded colours of their own; this
 * module is the single source both now read.
 *
 * Built with MUI v7 CSS theme variables rather than `palette.mode`, so the
 * two schemes exist side by side as CSS custom properties and switching does
 * not re-render the tree or flash on load.
 */
import { createTheme } from '@mui/material/styles';

export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Roboto Mono", monospace';

/**
 * The raw dark palette.
 *
 * Also exported on its own, because the livestream screen paints the overlays
 * that sit ON TOP of the video — chips, badges, the "connecting" hint — with
 * these fixed values whatever the app theme is: the picture is letterboxed
 * against black, so a light chip over a night scene would be unreadable. The
 * rest of that screen, like every other screen, goes through the MUI theme
 * below, whose dark scheme is built from these same values.
 */
export const tactical = {
  bg: '#0a0a0c',
  panel: '#141416',
  panel2: '#0e0e10',
  border: '#26262b',
  borderSoft: '#1d1d21',
  text: '#e8e8ea',
  dim: '#6b6b74',
  label: '#8a8a93',
  green: '#3ddc84',
  red: '#ff5a5a',
  redBadge: '#d92c2c',
  accent: '#7aa2ff',
} as const;

/**
 * Categorical colours, for marks that stand for a thing rather than a state:
 * one per camera on the DVR timeline, one per series on a chart.
 *
 * Distinct from the palette above, which carries meaning (red is alarm). These
 * only have to be told apart, so they are picked to hold their separation on
 * both a near-black and a white ground, and to stay distinguishable for the
 * common forms of colour blindness — no red/green pair adjacent in the cycle.
 */
export const SERIES = [
  '#4f8dff', '#f2a03d', '#38c3a0', '#e2679a',
  '#a78bfa', '#4dc9e6', '#c3d34a', '#ff7b54',
] as const;

/** Surfaces and accents that have no standard MUI slot. */
declare module '@mui/material/styles' {
  interface Palette {
    surface: { sunken: string; raised: string; borderSoft: string; badge: string };
    series: string[];
  }
  interface PaletteOptions {
    surface?: { sunken: string; raised: string; borderSoft: string; badge: string };
    series?: string[];
  }
}

const dark = {
  palette: {
    background: { default: tactical.bg, paper: tactical.panel },
    divider: tactical.border,
    text: { primary: tactical.text, secondary: tactical.label, disabled: tactical.dim },
    primary: { main: tactical.accent, contrastText: tactical.bg },
    success: { main: tactical.green, contrastText: tactical.bg },
    error: { main: tactical.red, contrastText: tactical.bg },
    warning: { main: '#ffb86b', contrastText: tactical.bg },
    surface: {
      sunken: tactical.panel2, raised: tactical.borderSoft,
      borderSoft: tactical.borderSoft, badge: tactical.redBadge,
    },
    series: [...SERIES],
  },
};

// The light scheme keeps the same accents so a screen does not change meaning
// when the operator switches: blue is still "active", green still "healthy",
// red still "alarm". Only the surfaces invert, and the accents darken enough
// to stay legible on white.
const light = {
  palette: {
    background: { default: '#f4f5f7', paper: '#ffffff' },
    divider: '#d7dae0',
    text: { primary: '#16171a', secondary: '#55565c', disabled: '#676872' },
    primary: { main: '#3358d4', contrastText: '#ffffff' },
    success: { main: '#167a42', contrastText: '#ffffff' },
    error: { main: '#c62828', contrastText: '#ffffff' },
    warning: { main: '#a86400', contrastText: '#ffffff' },
    surface: { sunken: '#eceef1', raised: '#ffffff', borderSoft: '#e6e8ec', badge: '#c62828' },
    series: [...SERIES],
  },
};

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: { dark, light },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: 'Inter, Roboto, system-ui, sans-serif',
    // The livestream readouts are monospaced and tightly tracked; the same
    // treatment marks any value the operator scans rather than reads.
    caption: { fontFamily: MONO, fontSize: 11, letterSpacing: 1 },
    overline: { fontFamily: MONO, fontSize: 9, letterSpacing: 1.2, lineHeight: 1.6 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          backgroundImage: 'none',                    // MUI's elevation tint fights a flat palette
          border: `1px solid ${t.vars.palette.divider}`,
        }),
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: ({ theme: t }) => ({
          fontFamily: MONO, fontSize: 11,
          background: t.vars.palette.surface.sunken,
          border: `1px solid ${t.vars.palette.divider}`,
          color: t.vars.palette.text.primary,
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme: t }) => ({ borderColor: t.vars.palette.surface.borderSoft }),
        head: { fontFamily: MONO, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
      },
    },
    MuiChip: { styleOverrides: { label: { fontFamily: MONO, fontSize: 11 } } },
  },
});

export default theme;
