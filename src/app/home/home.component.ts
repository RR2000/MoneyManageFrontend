import {Component, computed, effect, inject, OnInit, signal, untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Subscription} from 'rxjs';
import {HomeService, LatestMovement, NetWorth, STALE_PRICE_DAYS, daysSince} from './home.service';
import {CONSENT_WARN_DAYS, isoDay} from '../accounts/account-page.component';
import {consentDaysLeft} from '../accounts/accounts.service';
import {BankingService, BankLink} from '../banks/banking.service';
import {Instrument} from '../instruments/instruments.component';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {PageHeaderComponent} from '../ui/page-header.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {FigureComponent} from '../ui/figure.component';
import {AmountComponent} from '../ui/amount.component';
import {ChartComponent, ChartSeries} from '../ui/chart.component';
import {IconComponent, IconName} from '../ui/icon.component';
import {SourceTagComponent} from '../ui/source-tag.component';
import {CostsService, FixedCosts, monthOnly} from '../costs/costs.service';
import {MonthBarComponent} from '../costs/month-bar.component';
import {PlanService, PlanSummary} from '../plan/plan.service';
import {PlanTrackingComponent} from '../plan/plan-tracking.component';
import {SampleDataComponent} from '../ui/sample-data.component';

type Range = '6M' | '1Y' | '3Y' | 'ALL';
const RANGES: { range: Range; label: MessageKey; months: number | null }[] = [
  {range: '6M', label: 'range.6M', months: 6},
  {range: '1Y', label: 'range.1Y', months: 12},
  {range: '3Y', label: 'range.3Y', months: 36},
  {range: 'ALL', label: 'range.ALL', months: null}
];

/** One line of "To do": icon and words (never a colour alone), and the way to deal with it. */
export interface TodoItem {
  kind: 'warn' | 'info';
  icon: IconName;
  title: string;
  text: string;
  action: { label: string; link: string; primary: boolean };
}

/** A box of the net worth (cash, investments...), with the page it leads to; `signed`: debts, with their minus. */
interface Tile {
  label: string;
  value: number;
  note: string;
  link: string | null;
  signed?: boolean;
}

/**
 * /, the overview: net worth today and over time, what needs a hand (consents about to end, syncs that failed, prices
 * that stopped, movements without a category), the parts of the net worth, the plan (planned against real), the fixed
 * costs of this month and the newest movements of every account.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink, TPipe, PageHeaderComponent, LoadStateComponent, FigureComponent, AmountComponent, ChartComponent,
    IconComponent, SourceTagComponent, MonthBarComponent, PlanTrackingComponent, SampleDataComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private service = inject(HomeService);
  private costs = inject(CostsService);
  private plans = inject(PlanService);
  readonly banking = inject(BankingService);
  readonly ranges = RANGES;

  readonly range = signal<Range>('1Y');
  readonly netWorth = signal<NetWorth | null>(null);
  /** the whole net worth card (figure, tiles) */
  readonly state = signal<LoadState>('loading');
  /** only the chart, when the period changes */
  readonly chartState = signal<LoadState>('loading');
  readonly movements = signal<LatestMovement[]>([]);
  readonly movementsState = signal<LoadState>('loading');
  readonly instruments = signal<Instrument[]>([]);
  readonly instrumentsState = signal<LoadState>('loading');
  readonly links = signal<BankLink[]>([]);
  readonly linksState = signal<LoadState>('loading');
  readonly fixedCosts = signal<FixedCosts | null>(null);
  readonly costsState = signal<LoadState>('loading');
  /** the plan saved last */
  readonly plan = signal<PlanSummary | null>(null);
  readonly planState = signal<LoadState>('loading');
  readonly syncing = signal(false);
  readonly syncError = signal(false);
  private netWorthCall?: Subscription;

  readonly figure = computed(() => {
    const n = this.netWorth();
    if (!n) {
      return null;
    }
    const delta = round(n.today.total - n.before.total);
    return {value: n.today.total, delta, share: n.before.total > 0 ? delta / n.before.total : null};
  });

  readonly chart = computed(() => {
    const n = this.netWorth();
    const points = n?.points ?? [];
    const series: ChartSeries[] = [{name: this.i18n.t('home.netWorth'), values: points.map(p => p.total), area: true,
      width: 2.5}];
    const first = points[0];
    const last = points.at(-1);
    const aria = first && last ? this.i18n.t('home.chart', {from: this.i18n.date(first.date), to: this.i18n.date(last.date),
      start: this.i18n.money(first.total, n!.currency, 0), end: this.i18n.money(last.total, n!.currency, 0)}) : '';
    return {labels: points.map(p => p.date), series, aria};
  });

  /** "1 item in USD is not in the total" */
  readonly excludedText = computed(() => {
    const e = this.netWorth()?.excluded;
    const count = e ? e.accounts + e.realEstates + e.otherAssets + e.debts : 0;
    if (!e || count === 0) {
      return '';
    }
    const currencies = e.currencies.join(', ');
    return count === 1 ? this.i18n.t('home.excluded.one', {currencies})
      : this.i18n.t('home.excluded', {count, currencies});
  });

  readonly tiles = computed<Tile[]>(() => {
    const n = this.netWorth();
    if (!n) {
      return [];
    }
    const t = n.today;
    // shares of what is owned (before the debts), so they add up to 100% whatever the debts; the debts are said as a
    // share of the same total ("equal to 12% of the assets")
    const owned = [t.cash, t.investments, t.realEstate + t.otherAssets].filter(v => v > 0).reduce((a, b) => a + b, 0);
    const pct = (value: number) => this.i18n.percent(value / owned, 0);
    const share = (value: number) => owned > 0 && value > 0 ? ' · ' + this.i18n.t('home.share', {share: pct(value)}) : '';
    const count = (value: number, one: MessageKey, many: MessageKey) =>
      value === 1 ? this.i18n.t(one) : this.i18n.t(many, {count: value});
    return [
      {label: this.i18n.t('home.cash'), value: t.cash, link: '/accounts',
        note: count(n.accounts, 'home.accounts.one', 'accounts.count') + share(t.cash)},
      {label: this.i18n.t('nav.investments'), value: t.investments, link: '/investments',
        note: count(n.instruments, 'home.instruments.one', 'home.instruments') + share(t.investments)},
      {label: this.i18n.t('home.assets'), value: t.realEstate + t.otherAssets, link: '/assets',
        note: count(n.realEstates, 'home.properties.one', 'home.properties') + ', '
          + count(n.otherAssets, 'assets.count.other.one', 'assets.count.other') + share(t.realEstate + t.otherAssets)},
      {label: this.i18n.t('home.debts'), value: t.debts, link: '/assets', signed: true,
        note: n.debts === 0 ? this.i18n.t('home.debts.none') : count(n.debts, 'assets.count.debt.one', 'assets.count.debt')
          + (owned > 0 && t.debts < 0 ? ' · ' + this.i18n.t('home.debts.share', {share: pct(-t.debts)}) : '')}
    ];
  });

  /** nothing at all: no account, no investment, no property, no other asset, no debt */
  readonly empty = computed(() => {
    const n = this.netWorth();
    const e = n?.excluded;
    return !!n && !!e && n.accounts + n.realEstates + n.otherAssets + n.debts + n.instruments + e.accounts + e.realEstates
      + e.otherAssets + e.debts === 0;
  });

  readonly todo = computed<TodoItem[]>(() => {
    const items: TodoItem[] = [];
    const t = (key: MessageKey, params?: Record<string, string | number>) => this.i18n.t(key, params);
    if (this.banking.available() === true) {
      for (const link of this.links()) {
        const bank = link.aspsp;
        if (link.status !== 'ACTIVE') {
          items.push({kind: 'warn', icon: 'warn', title: t('home.todo.consentEnded', {bank}),
            text: t('home.todo.consentEnded.text'), action: {label: t('home.todo.renew'), link: '/banks', primary: true}});
          continue;
        }
        const days = consentDaysLeft(link);
        if (days !== null && days <= CONSENT_WARN_DAYS) {
          items.push({kind: 'warn', icon: 'calendar',
            title: days === 0 ? t('home.todo.consentToday', {bank}) : t('home.todo.consentDays', {bank, days}),
            text: t('home.todo.consent.text', {date: this.i18n.date(link.validUntil)}),
            action: {label: t('home.todo.renew'), link: '/banks', primary: true}});
        }
        if (link.lastError) {
          items.push({kind: 'warn', icon: 'error', title: t('home.todo.syncError', {bank}),
            text: t('home.todo.syncError.text'), action: {label: t('home.todo.open'), link: '/banks', primary: false}});
        }
      }
    }
    for (const instrument of this.instruments()) {
      const name = instrument.name || instrument.isin;
      const days = daysSince(instrument.lastDate);
      if (days === null) {
        items.push({kind: 'info', icon: 'investments', title: t('home.todo.noPrice', {name}),
          text: t('home.todo.noPrice.text'), action: {label: t('home.todo.check'), link: '/investments', primary: false}});
      } else if (days > STALE_PRICE_DAYS) {
        items.push({kind: 'info', icon: 'investments',
          title: t('home.todo.stalePrice', {name, date: this.i18n.date(instrument.lastDate)}),
          text: t('home.todo.price.text'), action: {label: t('home.todo.check'), link: '/investments', primary: false}});
      }
    }
    const loose = this.fixedCosts()?.uncategorized ?? 0;
    if (loose > 0) {
      items.push({kind: 'info', icon: 'tag',
        title: loose === 1 ? t('home.todo.uncategorized.one') : t('home.todo.uncategorized', {count: loose}),
        text: t('home.todo.uncategorized.text'), action: {label: t('costs.assign'), link: '/costs/uncategorized', primary: false}});
    }
    if (this.empty()) {
      items.push({kind: 'info', icon: 'import', title: t('home.todo.noData'), text: t('home.todo.noData.text'),
        action: {label: t('nav.import'), link: '/import', primary: true}});
    }
    return items;
  });

  readonly todoState = computed<LoadState>(() => {
    const banking = this.banking.available();
    const links = banking === true ? this.linksState() : banking === null ? 'loading' : 'ready';
    if (this.instrumentsState() === 'error' || links === 'error') {
      return 'error';
    }
    // the fixed costs have a box of their own with its error: here they only wait
    if (this.instrumentsState() === 'loading' || links === 'loading' || this.costsState() === 'loading') {
      return 'loading';
    }
    return 'ready';
  });

  /** "Fixed costs of November" */
  readonly costsTitle = computed(() => {
    const month = this.fixedCosts()?.month;
    return month ? this.i18n.t('home.costs', {month: monthOnly(this.i18n.locale(), month)}) : this.i18n.t('nav.costs');
  });

  /** the newest sync of the linked banks */
  readonly lastSync = computed(() => {
    const times = this.links().map(l => l.lastSyncAt).filter((s): s is string => !!s).sort();
    return times.at(-1) ?? null;
  });

  constructor() {
    // the links only when open banking is there for this user (known after the first call of the app)
    effect(() => {
      if (this.banking.available() === true) {
        untracked(() => this.loadLinks());
      }
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  /** everything again: at the start, and after the sample data arrived */
  reload(): void {
    this.loadNetWorth();
    this.loadMovements();
    this.loadInstruments();
    this.loadCosts();
    this.loadPlan();
  }

  setRange(range: Range): void {
    this.range.set(range);
    this.loadNetWorth(true);
  }

  /** `chartOnly`: the figure and the tiles stay on screen, only the chart waits */
  loadNetWorth(chartOnly = false): void {
    const months = RANGES.find(r => r.range === this.range())?.months ?? null;
    let from: string | null = null;
    if (months !== null) {
      const d = new Date();
      d.setMonth(d.getMonth() - months);
      from = isoDay(d);
    }
    if (!chartOnly || !this.netWorth()) {
      this.state.set('loading');
    }
    this.chartState.set('loading');
    this.netWorthCall?.unsubscribe();
    this.netWorthCall = this.service.netWorth(from).subscribe({
      next: answer => {
        this.netWorth.set(answer);
        this.state.set(this.empty() ? 'empty' : 'ready');
        this.chartState.set(answer.points.length > 1 ? 'ready' : 'empty');
      },
      error: () => {
        if (this.state() === 'loading') {
          this.state.set('error');
        }
        this.chartState.set('error');
      }
    });
  }

  loadMovements(): void {
    this.movementsState.set('loading');
    this.service.latest().subscribe({
      next: list => {
        this.movements.set(list);
        this.movementsState.set(list.length ? 'ready' : 'empty');
      },
      error: () => this.movementsState.set('error')
    });
  }

  loadInstruments(): void {
    this.instrumentsState.set('loading');
    this.service.instruments().subscribe({
      next: list => {
        this.instruments.set(list);
        this.instrumentsState.set('ready');
      },
      error: () => this.instrumentsState.set('error')
    });
  }

  loadCosts(): void {
    this.costsState.set('loading');
    this.costs.fixedCosts().subscribe({
      next: answer => {
        this.fixedCosts.set(answer);
        this.costsState.set(answer.categories.length ? 'ready' : 'empty');
      },
      error: () => this.costsState.set('error')
    });
  }

  loadPlan(): void {
    this.planState.set('loading');
    this.plans.overview().subscribe({
      next: answer => {
        this.plan.set(answer.plans[0] ?? null);
        this.planState.set(answer.plans.length ? 'ready' : 'empty');
      },
      error: () => this.planState.set('error')
    });
  }

  loadLinks(): void {
    this.linksState.set('loading');
    this.banking.links().subscribe({
      next: links => {
        this.links.set(links);
        this.linksState.set('ready');
      },
      error: () => this.linksState.set('error')
    });
  }

  retryTodo(): void {
    if (this.instrumentsState() === 'error') {
      this.loadInstruments();
    }
    if (this.linksState() === 'error') {
      this.loadLinks();
    }
  }

  sync(): void {
    this.syncing.set(true);
    this.syncError.set(false);
    this.banking.sync().subscribe({
      next: result => {
        this.syncing.set(false);
        this.links.set(result.links);
        this.linksState.set('ready');
        this.loadNetWorth(true);
        this.loadMovements();
        this.loadCosts();
      },
      error: () => {
        this.syncing.set(false);
        this.syncError.set(true);
      }
    });
  }

  /** "Today", "Yesterday", "27 Nov" */
  day(iso: string): string {
    const days = daysSince(iso);
    if (days === 0) {
      return this.i18n.t('day.today');
    }
    if (days === 1) {
      return this.i18n.t('day.yesterday');
    }
    return new Intl.DateTimeFormat(this.i18n.locale(), {day: 'numeric', month: 'short',
      ...(days !== null && days > 300 ? {year: 'numeric'} : {})}).format(new Date(iso.substring(0, 10) + 'T00:00:00'));
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
