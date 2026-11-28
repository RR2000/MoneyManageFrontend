import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {interval, Subscription} from 'rxjs';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {PageHeaderComponent} from '../ui/page-header.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {FigureComponent} from '../ui/figure.component';
import {ChartComponent, ChartSeries} from '../ui/chart.component';
import {IconComponent} from '../ui/icon.component';
import {InstrumentsComponent} from '../instruments/instruments.component';
import {AllocationComponent} from './allocation.component';
import {InvestmentsService, Portfolio, Position} from './investments.service';

const REFRESH_MS = 5 * 60 * 1000;

type Range = '1Y' | '3Y' | 'ALL';
const RANGES: { range: Range; label: MessageKey; months: number | null }[] = [
  {range: '1Y', label: 'range.1Y', months: 12},
  {range: '3Y', label: 'range.3Y', months: 36},
  {range: 'ALL', label: 'range.ALL', months: null}
];
type View = 'total' | 'each';

/** a box of the summary: value, sign said by text and icon, a note */
interface Tile {
  label: string;
  value: string;
  sign: 1 | -1 | 0 | null;
  note: string;
}

/**
 * /investments: what the portfolio is worth, the gain before and after taxes and the returns computed from the real
 * trades (methods written on the page), the value and the money put in over time, every position (a list on a phone,
 * a table on a wide screen), the allocation against the targets, and the securities with the source of their prices.
 */
@Component({
  selector: 'app-investments-page',
  imports: [RouterLink, TPipe, PageHeaderComponent, LoadStateComponent, FigureComponent, ChartComponent,
    IconComponent, InstrumentsComponent, AllocationComponent],
  templateUrl: './investments-page.component.html',
  styleUrl: './investments-page.component.css'
})
export class InvestmentsPageComponent implements OnInit, OnDestroy {
  readonly i18n = inject(I18nService);
  private service = inject(InvestmentsService);
  readonly ranges = RANGES;

  readonly data = signal<Portfolio | null>(null);
  readonly state = signal<LoadState>('loading');
  readonly range = signal<Range>('ALL');
  readonly view = signal<View>('total');
  private call?: Subscription;
  private refresh?: Subscription;

  readonly held = computed(() => this.data()?.positions ?? []);

  /** "Prices of 26 Nov 2026" from the oldest last price of the positions in the total */
  readonly pricesAt = computed(() => {
    const dates = this.held().filter(p => p.inTotal && p.lastDate).map(p => p.lastDate!).sort();
    return dates.length ? this.i18n.t('inv.pricesAt', {date: this.i18n.date(dates[0])}) : '';
  });

  readonly tiles = computed<Tile[]>(() => {
    const d = this.data();
    if (!d) {
      return [];
    }
    const t = d.totals;
    const perf = d.performance;
    const m = (v: number) => this.i18n.money(v, d.currency, Math.abs(v) >= 1000 ? 0 : 2);
    const signed = (v: number) => this.i18n.signedMoney(v, d.currency, Math.abs(v) >= 1000 ? 0 : 2);
    const share = (v: number | null) => v === null ? '' : signedPercent(this.i18n, v);
    const sign = (v: number | null): 1 | -1 | 0 | null => v === null ? null : v > 0 ? 1 : v < 0 ? -1 : 0;
    const tiles: Tile[] = [
      {label: this.i18n.t('inv.invested'), value: m(t.invested), sign: null,
        note: this.i18n.t('inv.invested.note')},
      {label: this.i18n.t('inv.gain'), value: signed(t.gain), sign: sign(t.gain),
        note: (t.gainShare !== null ? this.i18n.t('inv.gain.note', {share: share(t.gainShare)}) : '')
          + (t.realized !== 0 ? ' · ' + this.i18n.t('inv.realized', {amount: signed(t.realized)}) : '')},
      {label: this.i18n.t('inv.net'), value: signed(t.netGain), sign: sign(t.netGain),
        note: this.i18n.t('inv.net.note', {rate: this.i18n.percent(d.taxRate, 0), tax: m(t.tax)})},
      {label: this.i18n.t('inv.xirr'), value: perf.xirr === null ? '–' : signedPercent(this.i18n, perf.xirr),
        sign: sign(perf.xirr), note: this.i18n.t('inv.xirr.note')},
      {label: this.i18n.t('inv.twr'), value: perf.twrYearly === null ? '–' : signedPercent(this.i18n, perf.twrYearly),
        sign: sign(perf.twrYearly), note: perf.twr === null ? this.i18n.t('inv.twr.note.none')
          : this.i18n.t('inv.twr.note', {share: signedPercent(this.i18n, perf.twr)})}
    ];
    return tiles;
  });

  /** the simple gain on what was spent buying, and since when */
  readonly simpleText = computed(() => {
    const d = this.data();
    const perf = d?.performance;
    if (!d || !perf || perf.simple === null || !perf.since) {
      return '';
    }
    return this.i18n.t('inv.simple', {gain: this.i18n.signedMoney(perf.simpleGain, d.currency, 0),
      share: signedPercent(this.i18n, perf.simple), bought: this.i18n.money(d.totals.bought, d.currency, 0),
      date: this.i18n.date(perf.since)});
  });

  readonly shortPeriod = computed(() => {
    const perf = this.data()?.performance;
    return !!perf && perf.since !== null && perf.days < 365;
  });

  /** positions left out of the totals, in words */
  readonly excludedText = computed(() => {
    const e = this.data()?.excluded;
    if (!e || e.instruments === 0) {
      return '';
    }
    const parts: string[] = [];
    const other = e.instruments - e.withoutPrice;
    if (other > 0) {
      parts.push(other === 1 ? this.i18n.t('inv.excluded.currency.one', {currencies: e.currencies.join(', ')})
        : this.i18n.t('inv.excluded.currency', {count: other, currencies: e.currencies.join(', ')}));
    }
    if (e.withoutPrice > 0) {
      parts.push(e.withoutPrice === 1 ? this.i18n.t('inv.excluded.noPrice.one')
        : this.i18n.t('inv.excluded.noPrice', {count: e.withoutPrice}));
    }
    return parts.join(' ');
  });

  readonly chart = computed(() => {
    const d = this.data();
    const all = d?.history ?? [];
    const months = RANGES.find(r => r.range === this.range())?.months ?? null;
    let points = all;
    if (months !== null && all.length) {
      const from = new Date();
      from.setMonth(from.getMonth() - months);
      const iso = from.toISOString().substring(0, 10);
      points = all.filter(p => p.date >= iso);
    }
    const labels = points.map(p => p.date);
    let series: ChartSeries[];
    if (this.view() === 'each' && d) {
      series = d.positions.filter(p => p.inTotal).map((p, i) => ({
        name: p.name || p.isin, values: points.map(pt => pt.byIsin[p.isin] ?? null), color: i % 5, dash: i % 3
      }));
    } else {
      series = [
        {name: this.i18n.t('inv.chart.value'), values: points.map(p => p.value), area: true, width: 2.5, color: 0, dash: 0},
        {name: this.i18n.t('inv.chart.invested'), values: points.map(p => p.invested), color: 1, dash: 1, width: 2}
      ];
    }
    const first = points[0];
    const last = points.at(-1);
    const aria = d && first && last ? this.i18n.t('inv.chart.aria', {from: this.i18n.date(first.date),
      to: this.i18n.date(last.date), start: this.i18n.money(first.value, d.currency, 0),
      end: this.i18n.money(last.value, d.currency, 0), invested: this.i18n.money(last.invested, d.currency, 0)}) : '';
    return {labels, series, aria, enough: points.length > 1};
  });

  ngOnInit(): void {
    this.load();
    // prices that were still downloading show up later: read again now and then, keeping what is on screen
    this.refresh = interval(REFRESH_MS).subscribe(() => this.load(true));
  }

  ngOnDestroy(): void {
    this.refresh?.unsubscribe();
    this.call?.unsubscribe();
  }

  /** `quiet`: the page stays on screen while it reads again (and if that fails) */
  load(quiet = false): void {
    if (!quiet || !this.data()) {
      this.state.set('loading');
    }
    this.call?.unsubscribe();
    this.call = this.service.portfolio().subscribe({
      next: data => {
        this.data.set(data);
        this.state.set(data.positions.length + data.closed === 0 ? 'empty' : 'ready');
      },
      error: () => {
        if (!this.data()) {
          this.state.set('error');
        }
      }
    });
  }

  /** the prices of a security changed (symbol, CSV): everything is read again */
  pricesChanged(): void {
    this.load(true);
  }

  targetsChanged(): void {
    this.load(true);
  }

  money(value: number | null, currency: string, decimals?: number): string {
    return value === null ? '–' : this.i18n.money(value, currency, decimals);
  }

  signedMoney(value: number | null, currency: string): string {
    return value === null ? '–' : this.i18n.signedMoney(value, currency, Math.abs(value) >= 1000 ? 0 : 2);
  }

  share(value: number | null): string {
    return value === null ? '–' : signedPercent(this.i18n, value);
  }

  portion(value: number | null): string {
    return value === null ? '–' : this.i18n.percent(value, 1);
  }

  quantity(p: Position): string {
    return this.i18n.number(p.quantity, 0, 4);
  }

  sign(value: number | null): string {
    return value === null || value === 0 ? '' : value > 0 ? 'up' : 'down';
  }

  excludedLabel(p: Position): string {
    return p.excluded === 'CURRENCY' ? this.i18n.t('inv.pos.currency', {currency: p.currency})
      : p.excluded === 'NO_PRICE' ? this.i18n.t('inv.pos.noPrice') : '';
  }
}

/** a share with its sign always written: +12.3%, −4% */
export function signedPercent(i18n: I18nService, value: number): string {
  const text = i18n.percent(Math.abs(value), 1);
  return value > 0 ? '+' + text : value < 0 ? '−' + text : text;
}
