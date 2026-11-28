import {Component, computed, effect, inject, input, signal, untracked} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {AccountDetail, AccountsService, BalancePoint, consentDaysLeft} from './accounts.service';
import {MovementsComponent} from './movements.component';
import {DeleteAccountComponent} from './delete-account.component';
import {BankAccount, BankingService, BankLink, isNotFound} from '../banks/banking.service';
import {BankHistoryComponent} from '../banks/bank-history.component';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {PageHeaderComponent} from '../ui/page-header.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {FigureComponent} from '../ui/figure.component';
import {AmountComponent} from '../ui/amount.component';
import {ChartComponent, ChartSeries} from '../ui/chart.component';
import {IconComponent} from '../ui/icon.component';

/** a consent this close to its end is in the "to do" colours */
export const CONSENT_WARN_DAYS = 14;

type Range = '1M' | '6M' | '1Y' | 'ALL';
const RANGES: { range: Range; label: MessageKey; months: number | null }[] = [
  {range: '1M', label: 'range.1M', months: 1},
  {range: '6M', label: 'range.6M', months: 6},
  {range: '1Y', label: 'range.1Y', months: 12},
  {range: 'ALL', label: 'range.ALL', months: null}
];

/**
 * /accounts/:id, the page of one money account: balance and its history, this month's money in and out, the bank that
 * imports into it (consent, last sync, "Sync now", "Replace with the bank's data"), the movements, and "Delete account".
 */
@Component({
  selector: 'app-account-page',
  imports: [RouterLink, TPipe, PageHeaderComponent, LoadStateComponent, FigureComponent, AmountComponent, ChartComponent,
    IconComponent, MovementsComponent, DeleteAccountComponent, BankHistoryComponent],
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.css'
})
export class AccountPageComponent {
  /** from the route */
  readonly id = input.required<string>();

  readonly i18n = inject(I18nService);
  private service = inject(AccountsService);
  private banking = inject(BankingService);
  private router = inject(Router);
  readonly ranges = RANGES;
  readonly warnDays = CONSENT_WARN_DAYS;

  readonly detail = signal<AccountDetail | null>(null);
  readonly state = signal<LoadState>('loading');
  readonly range = signal<Range>('6M');
  readonly points = signal<BalancePoint[]>([]);
  readonly chartState = signal<LoadState>('loading');
  readonly bank = signal<{ link: BankLink; account: BankAccount } | null>(null);
  readonly syncing = signal(false);
  readonly syncError = signal(false);

  readonly consentDays = computed(() => {
    const bank = this.bank();
    return bank ? consentDaysLeft(bank.link) : null;
  });

  /** one point per day, the balance carried over the days without movements */
  readonly chart = computed(() => {
    const points = this.points();
    if (points.length === 0) {
      return {labels: [] as string[], series: [] as ChartSeries[]};
    }
    const labels: string[] = [];
    const values: number[] = [];
    const byDay = new Map(points.map(p => [p.date, p.balance]));
    const end = new Date();
    let last = points[0].balance;
    for (let d = new Date(points[0].date + 'T00:00:00'); d <= end; d.setDate(d.getDate() + 1)) {
      const key = isoDay(d);
      last = byDay.get(key) ?? last;
      labels.push(key);
      values.push(last);
    }
    return {labels, series: [{name: this.i18n.t('account.balance'), values, area: true, width: 2.5}] as ChartSeries[]};
  });

  constructor() {
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.state.set('loading');
    this.service.detail(this.id()).subscribe({
      next: detail => {
        this.detail.set(detail);
        this.state.set('ready');
        this.loadChart();
        this.loadBank(detail);
      },
      // an address of an account that is not there (deleted, or an old link): said so, not "Retry"
      error: (err: unknown) => this.state.set(isNotFound(err) ? 'empty' : 'error')
    });
  }

  setRange(range: Range): void {
    this.range.set(range);
    this.loadChart();
  }

  loadChart(): void {
    const months = RANGES.find(r => r.range === this.range())?.months ?? null;
    let from: string | null = null;
    if (months !== null) {
      const d = new Date();
      d.setMonth(d.getMonth() - months);
      from = isoDay(d);
    }
    this.chartState.set('loading');
    this.service.balances(this.id(), from).subscribe({
      next: points => {
        this.points.set(points);
        this.chartState.set(points.length ? 'ready' : 'empty');
      },
      error: () => this.chartState.set('error')
    });
  }

  /** the bank link of this account, when open banking is on for the user */
  private loadBank(detail: AccountDetail): void {
    if (!detail.linked) {
      this.bank.set(null);
      return;
    }
    this.banking.links().subscribe({
      next: links => {
        for (const link of links) {
          const account = link.accounts.find(a => a.moneyAccount === detail.name);
          if (account) {
            this.bank.set({link, account});
            return;
          }
        }
        this.bank.set(null);
      },
      error: () => this.bank.set(null)
    });
  }

  sync(): void {
    this.syncing.set(true);
    this.syncError.set(false);
    this.banking.sync().subscribe({
      next: () => {
        this.syncing.set(false);
        this.load();
      },
      error: () => {
        this.syncing.set(false);
        this.syncError.set(true);
      }
    });
  }

  monthLabel(): string {
    return this.i18n.month(isoDay(new Date()).substring(0, 7));
  }

  deleted(text: string): void {
    this.router.navigate(['/accounts'], {state: {message: text}});
  }
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
