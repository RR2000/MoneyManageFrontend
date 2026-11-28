import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {I18nService} from '../i18n/i18n.service';
import {IconComponent} from '../ui/icon.component';

/**
 * What went out this month against the monthly average: the amounts and the share in words, and a bar that says the
 * same (its text is the bar's label). Above the average the bar is full and the text says by how much, with an icon.
 */
@Component({
  selector: 'app-month-bar',
  imports: [IconComponent],
  template: `
    <p class="line"><span class="spent">{{ spentText() }}</span>{{ ' ' }}<span class="of">{{ ofText() }}</span></p>
    <div class="bar" role="img" [attr.aria-label]="shareText()" [class.over]="over()">
      <i [style.width.%]="width()"></i>
    </div>
    <p class="share" [class.over]="over()">
      @if (over()) {<app-icon name="up"/>}
      <span>{{ shareText() }}</span>
    </p>`,
  styles: [`
    :host { display: grid; gap: 6px; min-width: 0; }
    .line { margin: 0; overflow-wrap: anywhere; }
    .spent { font-size: 1.3rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .of { color: var(--muted); font-size: .88rem; }
    .bar { height: 12px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--s1); }
    .bar.over i { background: var(--warn); }
    .share { display: flex; gap: 5px; align-items: center; margin: 0; font-size: .82rem; color: var(--muted);
      --icon-size: 14px; }
    .share.over { color: var(--warn); font-weight: 600; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthBarComponent {
  readonly spent = input.required<number>();
  readonly average = input.required<number | null>();
  readonly currency = input('EUR');
  private i18n = inject(I18nService);

  readonly over = computed(() => {
    const avg = this.average();
    return avg !== null && avg > 0 && this.spent() > avg;
  });

  readonly width = computed(() => {
    const avg = this.average();
    if (avg === null || avg <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(this.spent() / avg * 1000) / 10));
  });

  readonly spentText = computed(() => {
    this.i18n.lang();
    return this.i18n.money(this.spent(), this.currency(), 0);
  });

  readonly ofText = computed(() => {
    const avg = this.average();
    return avg === null ? this.i18n.t('costs.month.noAverage')
      : this.i18n.t('costs.month.of', {average: this.i18n.money(avg, this.currency(), 0)});
  });

  readonly shareText = computed(() => {
    const avg = this.average();
    if (avg === null || avg <= 0) {
      return this.i18n.t('costs.month.noAverage');
    }
    if (this.over()) {
      return this.i18n.t('costs.month.over', {amount: this.i18n.money(this.spent() - avg, this.currency(), 0)});
    }
    return this.i18n.t('costs.month.share', {share: this.i18n.percent(this.spent() / avg, 0)});
  });
}
