import {ChangeDetectionStrategy, Component, computed, inject, input, output} from '@angular/core';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {IconComponent} from '../ui/icon.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {ChartBand, ChartComponent, ChartSeries} from '../ui/chart.component';
import {MonteCarlo, Projection, ScenarioKey, tableRows} from './plan.service';

export type PlanView = 'scenarios' | 'mc';

/**
 * The projection of a plan month by month: the base scenario with the band from prudent to optimistic (or the Monte
 * Carlo median with the band of 90% of the simulations), the money put in dashed; "See as a table" with a few dates.
 */
@Component({
  selector: 'app-plan-projection',
  imports: [TPipe, IconComponent, LoadStateComponent, ChartComponent],
  template: `
    <div class="card-head">
      <h2 id="plan-proj">{{ 'plan.projection' | t }}</h2>
      <div class="ranges" role="group" [attr.aria-label]="'plan.view.label' | t">
        <button type="button" [attr.aria-pressed]="view() === 'scenarios'" (click)="viewChange.emit('scenarios')">{{ 'plan.view.scenarios' | t }}</button>
        <button type="button" [attr.aria-pressed]="view() === 'mc'" (click)="viewChange.emit('mc')">{{ 'plan.view.monteCarlo' | t }}</button>
      </div>
    </div>
    @if (failed() && projection()) {
      <app-load-state state="error" (retry)="retry.emit()"/>
    }
    @if (view() === 'mc' && mcState() === 'loading' && !mc()) {
      <app-load-state state="loading" shape="chart"/>
    } @else if (view() === 'mc' && mcState() === 'error') {
      <app-load-state state="error" (retry)="retry.emit()"/>
    } @else if (chart(); as c) {
      @if (view() === 'mc' && mc(); as m) {
        @if (m.available) {
          <p class="note"><app-icon name="info"/><span>{{ method(m) }}</span></p>
        } @else {
          <p class="note warn"><app-icon name="warn"/><span>{{ 'plan.mc.short' | t: {count: m.historyMonths} }}</span></p>
        }
      }
      <div [class.stale]="pending()">
        <app-chart [labels]="c.labels" [series]="c.series" [band]="c.band" [height]="280" [currency]="currency()"
                   [ariaLabel]="c.aria" [legend]="false" [table]="false" [zero]="true"/>
      </div>
      <ul class="legend" aria-hidden="true">
        @for (l of legend(); track l.name) {
          <li><i [class]="l.kind"></i>{{ l.name }}</li>
        }
      </ul>
      @if (table(); as t) {
        <details>
          <summary>{{ 'plan.table' | t }}</summary>
          <div class="table-scroll">
            <table>
              <thead><tr><th scope="col">{{ 'chart.date' | t }}</th>
                @for (col of t.columns; track col) {<th scope="col">{{ col }}</th>}
                <th scope="col">{{ 'plan.series.invested' | t }}</th></tr></thead>
              <tbody>
                @for (row of t.rows; track row.label) {
                  <tr><th scope="row">{{ row.label }}</th>
                    @for (v of row.values; track $index) {<td>{{ v }}</td>}
                    <td>{{ row.invested }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </details>
      }
    } @else if (!failed()) {
      <app-load-state [state]="pending() ? 'loading' : 'empty'" shape="chart" [emptyText]="'plan.targetPassed' | t"/>
    }`,
  styles: [`
    :host { display: grid; gap: 12px; min-width: 0; }
    h2 { margin: 0; font-size: 1rem; font-weight: 700; }
    .note { display: flex; gap: 6px; align-items: flex-start; margin: 0; font-size: .82rem; color: var(--muted);
      --icon-size: 15px; }
    .note app-icon { margin-top: 1px; }
    .note.warn { color: var(--warn); font-weight: 600; }
    .stale { opacity: .55; transition: opacity .15s; }
    .legend { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: .8rem;
      color: var(--muted); }
    .legend li { display: inline-flex; align-items: center; gap: 6px; }
    .legend i { width: 18px; height: 0; border-top: 3px solid var(--s1); display: inline-block; }
    .legend i.dash { border-top: 2px dashed var(--s2); }
    .legend i.box { height: 10px; border: 0; border-radius: 2px; background: var(--band); outline: 1px solid var(--s1);
      outline-offset: -1px; }
    summary { cursor: pointer; color: var(--accent); font-weight: 600; font-size: .85rem; width: fit-content; }
    table { width: 100%; border-collapse: collapse; font-size: .8rem; margin-top: 6px; }
    th, td { padding: 5px 6px; border-bottom: 1px solid var(--line); text-align: right; font-variant-numeric: tabular-nums;
      white-space: nowrap; }
    th:first-child { text-align: left; }
    thead th { color: var(--muted); font-weight: 600; white-space: normal; vertical-align: bottom; }
    tbody th { font-weight: 500; }
    @media (max-width: 599px) {
      table { font-size: .74rem; }
      th, td { padding: 5px 3px; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanProjectionComponent {
  readonly projection = input.required<Projection | null>();
  readonly mc = input<MonteCarlo | null>(null);
  readonly view = input<PlanView>('scenarios');
  readonly mcState = input<LoadState>('ready');
  /** the last call failed */
  readonly failed = input(false);
  /** new numbers on their way: the chart fades */
  readonly pending = input(false);
  readonly currency = input('EUR');
  readonly viewChange = output<PlanView>();
  readonly retry = output<void>();
  private i18n = inject(I18nService);

  /** the Monte Carlo band is there and fits the plan on screen */
  private readonly mcOn = computed(() => {
    const m = this.mc();
    const p = this.projection();
    return this.view() === 'mc' && !!p && !!m?.available && !!m.p50 && !!m.p5 && !!m.p95
      && m.p50.length === p.labels.length;
  });

  readonly chart = computed(() => {
    this.i18n.lang();
    const p = this.projection();
    if (!p) {
      return null;
    }
    const money = (v: number) => this.i18n.money(v, p.currency, 0);
    const invested: ChartSeries = {name: this.i18n.t('plan.series.invested'), values: p.invested, color: 1, dash: 1,
      width: 1.5};
    const flat = (name: string, values: number[]): ChartSeries => ({name, values, color: 0, dash: 0, width: 0});
    let series: ChartSeries[];
    let band: ChartBand;
    let aria: string;
    const m = this.mc();
    if (this.mcOn() && m) {
      series = [{name: this.i18n.t('plan.series.median'), values: m.p50!, color: 0, dash: 0, width: 2.5},
        flat(this.i18n.t('plan.series.p5'), m.p5!), flat(this.i18n.t('plan.series.p95'), m.p95!), invested];
      band = {name: '', lo: m.p5!, hi: m.p95!};
      aria = this.i18n.t('plan.chart.aria.mc', {date: this.i18n.date(p.targetDate), lo: money(m.p5!.at(-1)!),
        median: money(m.p50!.at(-1)!), hi: money(m.p95!.at(-1)!)});
    } else {
      series = [{name: this.name('BASE'), values: p.base, color: 0, dash: 0, width: 2.5},
        flat(this.name('PRUDENT'), p.prudent), flat(this.name('OPTIMISTIC'), p.optimistic), invested];
      band = {name: '', lo: p.prudent, hi: p.optimistic};
      aria = this.i18n.t('plan.chart.aria', {date: this.i18n.date(p.targetDate), lo: money(this.gross('PRUDENT')),
        base: money(this.gross('BASE')), hi: money(this.gross('OPTIMISTIC'))});
    }
    return {labels: p.labels, series, band, aria};
  });

  /** under the chart: the middle line, the band, the money put in */
  readonly legend = computed(() => {
    this.i18n.lang();
    if (!this.projection()) {
      return [];
    }
    const mc = this.mcOn();
    return [
      {name: mc ? this.i18n.t('plan.series.median') : this.name('BASE'), kind: 'line'},
      {name: this.i18n.t(mc ? 'plan.series.mcBand' : 'plan.series.band'), kind: 'box'},
      {name: this.i18n.t('plan.series.invested'), kind: 'dash'}
    ];
  });

  /** a few dates: the three scenarios (or the Monte Carlo percentiles) and the money put in */
  readonly table = computed(() => {
    this.i18n.lang();
    const p = this.projection();
    if (!p) {
      return null;
    }
    const m = this.mc();
    const mc = this.mcOn() && !!m;
    const columns = mc
      ? [this.i18n.t('plan.series.p5'), this.i18n.t('plan.series.median'), this.i18n.t('plan.series.p95')]
      : (['PRUDENT', 'BASE', 'OPTIMISTIC'] as const).map(k => this.i18n.t(`plan.scenario.${k}`));
    const money = (v: number) => this.i18n.money(v, p.currency, 0);
    const rows = tableRows(p.months).map(k => ({
      label: k === 0 ? this.i18n.t('plan.table.today') : this.i18n.month(p.labels[k], false),
      values: (mc ? [m!.p5![k], m!.p50![k], m!.p95![k]] : [p.prudent[k], p.base[k], p.optimistic[k]]).map(money),
      invested: money(p.invested[k])
    }));
    return {columns, rows};
  });

  method(m: MonteCarlo): string {
    return this.i18n.t('plan.mc.method', {count: this.i18n.number(m.simulations, 0), months: m.historyMonths,
      mean: this.i18n.percent(m.yearlyMean ?? 0), vol: this.i18n.percent(m.yearlyVolatility ?? 0)});
  }

  private scenario(key: ScenarioKey) {
    return this.projection()!.scenarios.find(s => s.key === key)!;
  }

  private gross(key: ScenarioKey): number {
    return this.scenario(key).gross;
  }

  /** "Base 5%" */
  private name(key: ScenarioKey): string {
    return `${this.i18n.t(`plan.scenario.${key}`)} ${this.i18n.percent(this.scenario(key).rate / 100, 2)}`;
  }
}
