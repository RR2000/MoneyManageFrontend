import {
  AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, OnDestroy, signal,
  viewChild
} from '@angular/core';
import Chart from 'chart.js/auto';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {ThemeService} from '../theme/theme.service';
import {chartColors, SERIES_DASH} from '../theme/chart-colors';

/** One line of a chart. The colour comes from the theme (series index); dash and width tell lines apart too. */
export interface ChartSeries {
  name: string;
  /** one value per label; null = no value that day */
  values: (number | null)[];
  /** index of the theme series colour (0 = --s1); default: position in the list */
  color?: number;
  /** dash pattern index (0 = solid); default: same as the colour */
  dash?: number;
  width?: number;
  /** area under the line, in the band colour */
  area?: boolean;
  /** drawn but not in the legend, the tooltip and the table (e.g. the edges of a band) */
  hidden?: boolean;
}

/** a shaded range between two value lists (e.g. from the prudent to the optimistic scenario) */
export interface ChartBand {
  name: string;
  lo: (number | null)[];
  hi: (number | null)[];
}

export type ChartFormat = 'money' | 'number' | 'percent';

/** at most this many rows in the table under the chart; longer series are sampled evenly, the last point always in */
const TABLE_ROWS = 24;

/**
 * The only chart of the app (Chart.js on a canvas). Colours and dashes from the theme tokens, dates and numbers in the
 * language of the app, a tooltip on hover or touch, and the same data as a table for who cannot see the chart.
 * Labels are ISO dates ('2026-11-28' or '2026-11'), or plain text.
 */
@Component({
  selector: 'app-chart',
  imports: [TPipe],
  template: `
    <div class="box" [style.height.px]="height()">
      <canvas #canvas role="img" [attr.aria-label]="ariaLabel()"></canvas>
    </div>
    @if (legend() && legendItems().length > 1) {
      <ul class="legend" aria-hidden="true">
        @for (item of legendItems(); track item.name) {
          <li><i [class]="item.kind" [style.border-color]="item.color" [style.background]="item.kind === 'box' ? item.color : null"></i>{{ item.name }}</li>
        }
      </ul>
    }
    @if (table()) {
      <details>
        <summary>{{ 'chart.table' | t }}</summary>
        <div class="table-scroll">
          <table>
            <thead><tr><th scope="col">{{ 'chart.date' | t }}</th>
              @for (s of tableSeries(); track s.name) {
                <th scope="col">{{ s.name }}</th>
              }</tr></thead>
            <tbody>
              @for (row of tableRows(); track row.label) {
                <tr><th scope="row">{{ row.label }}</th>
                  @for (v of row.values; track $index) {
                    <td>{{ v }}</td>
                  }</tr>
              }
            </tbody>
          </table>
        </div>
      </details>
    }`,
  styles: [`
    :host { display: grid; gap: 8px; min-width: 0; }
    .box { position: relative; width: 100%; }
    .legend { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: .8rem;
      color: var(--muted); }
    .legend li { display: inline-flex; align-items: center; gap: 6px; }
    .legend i { width: 18px; height: 0; border-top: 3px solid; display: inline-block; }
    .legend i.dash { border-top-style: dashed; }
    .legend i.dot { border-top-style: dotted; }
    .legend i.box { height: 10px; border: 0; border-radius: 2px; opacity: .6; }
    summary { cursor: pointer; color: var(--accent); font-weight: 600; font-size: .85rem; width: fit-content; }
    table { width: 100%; border-collapse: collapse; font-size: .82rem; margin-top: 6px; }
    th, td { padding: 5px 8px; border-bottom: 1px solid var(--line); text-align: right; font-variant-numeric: tabular-nums;
      white-space: nowrap; }
    th:first-child { text-align: left; }
    thead th { color: var(--muted); font-weight: 600; }
    tbody th { font-weight: 500; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChartComponent implements AfterViewInit, OnDestroy {
  readonly labels = input<string[]>([]);
  readonly series = input<ChartSeries[]>([]);
  readonly band = input<ChartBand | null>(null);
  readonly format = input<ChartFormat>('money');
  readonly currency = input('EUR');
  readonly height = input(240);
  /** what the chart shows, in words (the canvas is an image for screen readers) */
  readonly ariaLabel = input('');
  /** the y axis starts at zero */
  readonly zero = input(false);
  readonly legend = input(true);
  readonly table = input(true);
  readonly type = input<'line' | 'bar'>('line');

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  private chart?: Chart;
  private readonly viewReady = signal(false);

  readonly legendItems = computed(() => {
    const colors = this.colorsFor(this.theme.dark());
    const items = this.series().filter(s => !s.hidden).map((s, i) => {
      const dash = s.dash ?? s.color ?? i;
      return {name: s.name, color: colors.series[(s.color ?? i) % colors.series.length],
        kind: dash === 0 ? 'line' : dash === 2 ? 'dot' : 'dash'};
    });
    const band = this.band();
    return band ? [...items, {name: band.name, color: colors.band, kind: 'box'}] : items;
  });

  readonly tableSeries = computed(() => this.series().filter(s => !s.hidden));

  readonly tableRows = computed(() => {
    this.i18n.lang();
    const labels = this.labels();
    const picks = sample(labels.length, TABLE_ROWS);
    const band = this.band();
    return picks.map(i => ({
      label: this.formatLabel(labels[i], true),
      values: [
        ...this.tableSeries().map(s => this.formatValue(s.values[i])),
        ...(band ? [`${this.formatValue(band.lo[i])} – ${this.formatValue(band.hi[i])}`] : [])
      ]
    }));
  });

  constructor() {
    // redraw when the data, the theme or the language change
    effect(() => {
      this.labels();
      this.series();
      this.band();
      this.format();
      this.type();
      this.theme.dark();
      this.i18n.lang();
      if (this.viewReady()) {
        this.draw();
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  /** the colours of the theme now (the argument only makes the computed depend on the theme) */
  private colorsFor(_dark: boolean) {
    return chartColors();
  }

  formatValue(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '–';
    }
    switch (this.format()) {
      case 'money':
        return this.i18n.money(value, this.currency(), Math.abs(value) >= 1000 ? 0 : 2);
      case 'percent':
        return this.i18n.percent(value);
      default:
        return this.i18n.number(value, 0, 2);
    }
  }

  /** an axis value, short: 12k, 1.2M */
  private formatTick(value: number): string {
    if (this.format() === 'percent') {
      return this.i18n.percent(value, 0);
    }
    return new Intl.NumberFormat(this.i18n.locale(), {notation: 'compact', maximumFractionDigits: 1}).format(value);
  }

  formatLabel(label: string, long = false): string {
    if (/^\d{4}-\d{2}-\d{2}/.test(label)) {
      const date = new Date(label.substring(0, 10) + 'T00:00:00');
      return new Intl.DateTimeFormat(this.i18n.locale(), long ? {dateStyle: 'medium'} : {day: 'numeric', month: 'short', year: '2-digit'}).format(date);
    }
    if (/^\d{4}-\d{2}$/.test(label)) {
      const date = new Date(label + '-01T00:00:00');
      return new Intl.DateTimeFormat(this.i18n.locale(), {month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit'}).format(date);
    }
    return label;
  }

  private draw(): void {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas) {
      return;
    }
    this.chart?.destroy();
    const colors = chartColors();
    const labels = this.labels();
    const line = this.type() === 'line';
    const datasets: any[] = [];
    const band = this.band();
    if (band) {
      datasets.push({label: '', data: band.lo, borderWidth: 0, pointRadius: 0, fill: false, spanGaps: true, hidden: false,
        isBand: true});
      datasets.push({label: band.name, data: band.hi, borderWidth: 0, pointRadius: 0, fill: '-1', backgroundColor: colors.band,
        spanGaps: true, isBand: true});
    }
    this.series().forEach((s, i) => {
      const color = colors.series[(s.color ?? i) % colors.series.length];
      datasets.push({
        label: s.name,
        data: s.values,
        borderColor: color,
        backgroundColor: line ? (s.area ? colors.band : color) : color,
        borderDash: line ? SERIES_DASH[(s.dash ?? s.color ?? i) % SERIES_DASH.length] : undefined,
        borderWidth: line ? (s.width ?? 2) : 0,
        fill: line && s.area ? 'origin' : false,
        pointRadius: 0,
        pointHoverRadius: line ? 4 : 0,
        spanGaps: true,
        tension: 0,
        isHidden: s.hidden
      });
    });
    const longLabels = labels.map(l => this.formatLabel(l, true));
    this.chart = new Chart(canvas, {
      type: this.type(),
      data: {labels, datasets},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        color: colors.muted,
        interaction: {mode: 'index', intersect: false},
        layout: {padding: {top: 4, right: 4}},
        scales: {
          x: {
            ticks: {color: colors.muted, maxRotation: 0, autoSkip: true, autoSkipPadding: 16,
              callback: (_v, index) => this.formatLabel(labels[index] ?? '')},
            grid: {display: false},
            border: {color: colors.grid}
          },
          y: {
            beginAtZero: this.zero(),
            ticks: {color: colors.muted, maxTicksLimit: 6, callback: v => this.formatTick(Number(v))},
            grid: {color: colors.grid},
            border: {display: false}
          }
        },
        plugins: {
          legend: {display: false},
          tooltip: {
            backgroundColor: colors.surface,
            titleColor: colors.text,
            bodyColor: colors.text,
            borderColor: colors.grid,
            borderWidth: 1,
            padding: 8,
            filter: item => !(item.dataset as any).isHidden && !((item.dataset as any).isBand && !item.dataset.label),
            callbacks: {
              title: items => longLabels[items[0]?.dataIndex ?? 0] ?? '',
              label: item => `${item.dataset.label}: ${this.formatValue(item.parsed.y as number)}`
            }
          }
        }
      }
    });
  }
}

/** indexes of at most `max` points out of `n`, evenly spread, the last one always included, newest first */
export function sample(n: number, max: number): number[] {
  if (n <= 0) {
    return [];
  }
  if (n <= max) {
    return Array.from({length: n}, (_, i) => n - 1 - i);
  }
  const out = new Set<number>();
  for (let k = 0; k < max; k++) {
    out.add(n - 1 - Math.round(k * (n - 1) / (max - 1)));
  }
  return [...out];
}
