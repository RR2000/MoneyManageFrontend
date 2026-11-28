import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Subscription} from 'rxjs';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {PageHeaderComponent} from '../ui/page-header.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {IconComponent} from '../ui/icon.component';
import {CADENCE_LABELS, CostsService, FixedCosts, monthOnly, Upcoming} from './costs.service';
import {MonthBarComponent} from './month-bar.component';

const PERIODS: { months: number; label: MessageKey }[] = [
  {months: 6, label: 'costs.period.6'},
  {months: 12, label: 'costs.period.12'},
  {months: 24, label: 'costs.period.24'}
];

/**
 * /costs, the fixed costs: what they cost a month and a year on average over the last complete months, how much to set
 * aside every month (rounded up), every fixed category as a bar with its amount written, and what comes next with its
 * expected day and cadence in words. Categories and rules are on /costs/rules.
 */
@Component({
  selector: 'app-costs-page',
  imports: [RouterLink, TPipe, PageHeaderComponent, LoadStateComponent, IconComponent, MonthBarComponent],
  templateUrl: './costs-page.component.html',
  styleUrl: './costs-page.component.css'
})
export class CostsPageComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private service = inject(CostsService);
  readonly periods = PERIODS;

  readonly months = signal(12);
  readonly data = signal<FixedCosts | null>(null);
  readonly state = signal<LoadState>('loading');
  private call?: Subscription;

  /** "From Nov 2025 to Oct 2026" */
  readonly periodText = computed(() => {
    const d = this.data();
    if (!d || d.monthsUsed === 0) {
      return '';
    }
    return this.i18n.t('costs.period.text', {from: this.i18n.month(d.from.substring(0, 7)),
      to: this.i18n.month(d.to.substring(0, 7))});
  });

  /** the largest monthly average, for the length of the bars */
  readonly max = computed(() => Math.max(0, ...(this.data()?.categories ?? []).map(c => c.monthly ?? 0)));

  readonly nothing = computed(() => !!this.data() && this.data()!.categories.length === 0);

  ngOnInit(): void {
    this.load();
  }

  setMonths(months: number): void {
    this.months.set(months);
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.call?.unsubscribe();
    this.call = this.service.fixedCosts(this.months()).subscribe({
      next: answer => {
        this.data.set(answer);
        this.state.set(answer.categories.length ? 'ready' : 'empty');
      },
      error: () => this.state.set('error')
    });
  }

  money(value: number | null, currency = 'EUR', decimals = 0): string {
    return value === null ? '-' : this.i18n.money(value, currency, decimals);
  }

  /** width of a bar in percent; never 0 for a cost above 0, so it can be seen */
  width(value: number | null): number {
    const max = this.max();
    if (!value || value <= 0 || max <= 0) {
      return 0;
    }
    return Math.max(2, Math.round(value / max * 1000) / 10);
  }

  cadence(u: Upcoming): string {
    return this.i18n.t(CADENCE_LABELS[u.cadence]);
  }

  /** "around 1 Dec · monthly", "expected on 20 Nov, not here yet · monthly", "cadence not known · last on 3 Nov" */
  when(u: Upcoming): string {
    if (!u.expectedOn) {
      return this.i18n.t('costs.upcoming.unknown', {date: this.i18n.date(u.last)});
    }
    const date = this.i18n.date(u.expectedOn);
    return (u.late ? this.i18n.t('costs.upcoming.late', {date}) : this.i18n.t('costs.upcoming.on', {date}))
      + ' · ' + this.cadence(u);
  }

  monthName(): string {
    const d = this.data();
    const name = d ? monthOnly(this.i18n.locale(), d.month) : '';
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}
