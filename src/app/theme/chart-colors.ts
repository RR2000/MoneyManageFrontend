import {token} from './theme.service';

/** Colours for Chart.js (it draws on a canvas, so CSS variables must be read as values), from the theme on screen. */
export interface ChartColors {
  text: string;
  muted: string;
  grid: string;
  surface: string;
  band: string;
  /** one per series, in order; series are also told apart by dash and width */
  series: string[];
}

/** dash patterns that go with the series colours, so a line is recognisable without its colour */
export const SERIES_DASH: number[][] = [[], [6, 4], [2, 3], [10, 3, 2, 3], [14, 4]];

export function chartColors(): ChartColors {
  return {
    text: token('--fg', '#15202b'),
    muted: token('--muted', '#4f5d6b'),
    grid: token('--grid', '#e4e9ee'),
    surface: token('--surface', '#ffffff'),
    band: token('--band', 'rgba(31, 111, 197, .14)'),
    series: ['--s1', '--s2', '--s3', '--s4', '--s5'].map(name => token(name, '#1f6fc5'))
  };
}
