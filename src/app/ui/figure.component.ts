import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {I18nService} from '../i18n/i18n.service';
import {IconComponent} from './icon.component';

/**
 * The big number of a page (net worth, a balance) with its change: arrow, sign and words ("+1.234 € in 30 days
 * (+0.5%)"), never a colour alone.
 */
@Component({
  selector: 'app-figure',
  imports: [IconComponent],
  template: `
    @if (label()) {
      <span class="label">{{ label() }}</span>
    }
    <span class="big">{{ valueText() }}</span>
    @if (delta() !== null) {
      <span class="delta" [class.up]="delta()! > 0" [class.down]="delta()! < 0">
        @if (delta() !== 0) {
          <app-icon [name]="delta()! > 0 ? 'up' : 'down'"/>
        }
        {{ deltaText() }}
      </span>
    }`,
  styles: [`
    :host { display: grid; gap: 2px; min-width: 0; }
    .label { font-size: .74rem; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
    .big { font-size: 2.4rem; font-weight: 800; letter-spacing: -.02em; line-height: 1.1; font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere; }
    .delta { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; font-weight: 600; font-size: .88rem;
      color: var(--muted); --icon-size: 14px; }
    .delta.up { color: var(--good); }
    .delta.down { color: var(--bad); }
    @media (max-width: 839px) { .big { font-size: 2rem; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FigureComponent {
  readonly value = input.required<number>();
  readonly currency = input('EUR');
  readonly label = input('');
  readonly decimals = input<number | undefined>(undefined);
  /** change in the period, in the currency; null = no change shown */
  readonly delta = input<number | null>(null);
  /** the change as a share of the value before (0.012 = 1.2%), optional */
  readonly deltaShare = input<number | null>(null);
  /** the period, e.g. "30 days" */
  readonly period = input('');
  private i18n = inject(I18nService);

  readonly valueText = computed(() => {
    this.i18n.lang();
    return this.i18n.money(this.value(), this.currency(), this.decimals());
  });

  readonly deltaText = computed(() => {
    this.i18n.lang();
    const delta = this.delta();
    if (delta === null) {
      return '';
    }
    const period = this.period() ? ' ' + this.i18n.t('delta.in', {period: this.period()}) : '';
    if (delta === 0) {
      return this.i18n.t('delta.unchanged') + period;
    }
    let text = this.i18n.signedMoney(delta, this.currency(), Math.abs(delta) >= 1000 ? 0 : 2) + period;
    const share = this.deltaShare();
    if (share !== null && isFinite(share)) {
      text += ` (${share > 0 ? '+' : share < 0 ? '−' : ''}${this.i18n.percent(Math.abs(share))})`;
    }
    return text;
  });
}
