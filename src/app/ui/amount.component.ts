import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {I18nService} from '../i18n/i18n.service';

/**
 * An amount with its currency. `signed`: always with + or − (money in or out is said by the sign, the colour only
 * helps). Tabular digits, never wrapped.
 */
@Component({
  selector: 'app-amount',
  template: '{{ text() }}',
  host: {'[class.in]': 'signed() && value() > 0', '[class.out]': 'signed() && value() < 0'},
  styles: [':host { font-variant-numeric: tabular-nums; white-space: nowrap; } :host(.in) { color: var(--good); }'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AmountComponent {
  readonly value = input.required<number>();
  readonly currency = input<string | null>('EUR');
  readonly signed = input(false);
  /** fixed decimals; default: those of the currency */
  readonly decimals = input<number | undefined>(undefined);
  private i18n = inject(I18nService);

  readonly text = computed(() => {
    this.i18n.lang();
    return this.signed()
      ? this.i18n.signedMoney(this.value(), this.currency(), this.decimals())
      : this.i18n.money(this.value(), this.currency(), this.decimals());
  });
}
