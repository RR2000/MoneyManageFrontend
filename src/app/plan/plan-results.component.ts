import {ChangeDetectionStrategy, Component, computed, inject, input, output} from '@angular/core';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {IconComponent} from '../ui/icon.component';
import {LoadStateComponent} from '../ui/load-state.component';
import {Projection} from './plan.service';

/**
 * What the plan gives at the target date in the base scenario: before taxes, after them, in euro of today. While new
 * numbers are on their way it says so at once (and the old ones fade); with a field to fix, it says that instead.
 */
@Component({
  selector: 'app-plan-results',
  imports: [TPipe, IconComponent, LoadStateComponent],
  template: `
    <p class="recalc" role="status" aria-live="polite">
      @if (pending()) {
        <span class="spin" aria-hidden="true"></span><span>{{ 'plan.recalc' | t }}</span>
      } @else if (invalid()) {
        <app-icon name="warn"/><span>{{ 'plan.fixErrors' | t }}</span>
      }
    </p>
    @if (projection()) {
      <div class="tiles" [class.stale]="pending() || invalid()" [attr.aria-busy]="pending()">
        @for (r of results(); track r.label) {
          <div class="tile">
            <span class="label">{{ r.label }}</span>
            <span class="value">{{ r.value }}</span>
            <span class="note">{{ r.note }}</span>
          </div>
        }
      </div>
    } @else if (failed()) {
      <section class="card"><app-load-state state="error" (retry)="retry.emit()"/></section>
    } @else if (pending()) {
      <section class="card"><app-load-state state="loading"/></section>
    } @else {
      <p class="passed"><app-icon name="warn"/><span>{{ 'plan.targetPassed' | t }}</span></p>
    }`,
  styles: [`
    :host { display: grid; gap: 8px; min-width: 0; }
    .recalc { display: flex; gap: 8px; align-items: center; margin: 0; min-height: 22px; font-size: .86rem;
      color: var(--muted); font-weight: 600; --icon-size: 16px; }
    .recalc app-icon, .passed app-icon { color: var(--warn); }
    .spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line); border-top-color: var(--accent);
      animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 3s; } }
    .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .tile .value { font-size: 1.35rem; }
    .stale { opacity: .55; transition: opacity .15s; }
    .passed { display: flex; gap: 6px; align-items: flex-start; margin: 0; font-weight: 600; --icon-size: 18px; }
    @media (max-width: 599px) {
      .tiles { grid-template-columns: minmax(0, 1fr); }
      .tile { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 0 10px; }
      .tile .note { grid-column: 1 / -1; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanResultsComponent {
  readonly projection = input.required<Projection | null>();
  /** the tax and the inflation (percent) the projection was made with */
  readonly taxRate = input(0);
  readonly inflation = input(0);
  readonly pending = input(false);
  readonly invalid = input(false);
  readonly failed = input(false);
  readonly retry = output<void>();
  private i18n = inject(I18nService);

  readonly results = computed(() => {
    this.i18n.lang();
    const p = this.projection();
    const b = p?.scenarios.find(s => s.key === 'BASE');
    if (!p || !b) {
      return [];
    }
    const money = (v: number) => this.i18n.money(v, p.currency, 0);
    const pct = (v: number) => this.i18n.percent(v / 100, 2);
    return [
      {label: this.i18n.t('plan.result.at', {date: this.i18n.date(p.targetDate)}), value: money(b.gross),
        note: this.i18n.t('plan.result.gross.note', {rate: pct(b.rate)})},
      {label: this.i18n.t('plan.result.afterTax'), value: money(b.afterTax),
        note: this.i18n.t('plan.result.afterTax.note', {rate: pct(this.taxRate()), gain: money(Math.max(0, b.gross - b.invested))})},
      {label: this.i18n.t('plan.result.real'), value: money(b.real),
        note: this.i18n.t('plan.result.real.note', {rate: pct(this.inflation()), years: this.i18n.number(p.years, 0, 1)})}
    ];
  });
}
