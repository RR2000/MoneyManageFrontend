import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {I18nService} from '../i18n/i18n.service';
import {IconComponent, IconName} from '../ui/icon.component';
import {ChartComponent, ChartSeries} from '../ui/chart.component';
import {Tracking} from './plan.service';

/**
 * Planned against real: where the investments are against the plan (in words, with an icon: never a colour alone) and
 * the two lines, real solid and planned dashed. Used on the plan page and, smaller, on the home page.
 */
@Component({
  selector: 'app-plan-tracking',
  imports: [IconComponent, ChartComponent],
  template: `
    <p class="status" [class]="'status ' + kind()" role="status">
      <app-icon [name]="icon()"/><span>{{ text() }}</span>
    </p>
    @if (chart(); as c) {
      <app-chart [labels]="c.labels" [series]="c.series" [height]="height()" [currency]="currency()"
                 [ariaLabel]="c.aria" [table]="table()"/>
    }`,
  styles: [`
    :host { display: grid; gap: 10px; min-width: 0; }
    .status { display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 8px 12px; border-radius: 10px;
      font-weight: 600; --icon-size: 20px; }
    .status app-icon { margin-top: 1px; }
    .status.good { background: var(--good-bg); color: var(--good); }
    .status.warn { background: var(--warn-bg); color: var(--warn); }
    .status.info { background: var(--surface-2); color: var(--fg); font-weight: 500; }
    .status.info app-icon { color: var(--accent); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanTrackingComponent {
  readonly tracking = input.required<Tracking>();
  readonly currency = input('EUR');
  readonly height = input(200);
  readonly table = input(true);
  private i18n = inject(I18nService);

  readonly kind = computed(() => {
    switch (this.tracking().status) {
      case 'WAITING':
        return 'info';
      case 'BELOW':
        return 'warn';
      default:
        return 'good';
    }
  });

  readonly icon = computed<IconName>(() => {
    switch (this.tracking().status) {
      case 'WAITING':
        return 'calendar';
      case 'ABOVE':
        return 'up';
      case 'BELOW':
        return 'down';
      default:
        return 'ok';
    }
  });

  /** "On track: €1,820 above the plan (+3.1%) at the end of October 2026" */
  readonly text = computed(() => {
    this.i18n.lang();
    const t = this.tracking();
    if (t.status === 'WAITING') {
      return this.i18n.t('plan.track.WAITING', {date: this.i18n.date(t.nextCheck)});
    }
    const gap = t.gap ?? 0;
    const share = t.gapShare;
    const params = {
      gap: this.i18n.money(Math.abs(gap), this.currency(), 0),
      // under 0.05% the share would read "0%": left out
      share: share === null || Math.abs(share) < 0.0005 ? ''
        : ` (${share > 0 ? '+' : '−'}${this.i18n.percent(Math.abs(share))})`,
      month: this.i18n.month(t.month)
    };
    if (t.status === 'ON_TRACK') {
      return this.i18n.t(gap >= 0 ? 'plan.track.ON_TRACK.above' : 'plan.track.ON_TRACK.below', params);
    }
    return this.i18n.t(t.status === 'ABOVE' ? 'plan.track.ABOVE' : 'plan.track.BELOW', params);
  });

  /** at least two months to draw a line */
  readonly chart = computed(() => {
    this.i18n.lang();
    const points = this.tracking().points;
    if (points.length < 2) {
      return null;
    }
    const series: ChartSeries[] = [
      {name: this.i18n.t('plan.track.actual'), values: points.map(p => p.actual), color: 0, dash: 0, width: 2.5},
      {name: this.i18n.t('plan.track.planned'), values: points.map(p => p.planned), color: 1, dash: 1}
    ];
    const aria = this.i18n.t('plan.track.aria', {from: this.i18n.month(points[0].month),
      to: this.i18n.month(points[points.length - 1].month)});
    return {labels: points.map(p => p.month), series, aria};
  });
}
