import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {Location} from '@angular/common';
import {RouterLink} from '@angular/router';
import {AccountsService, MoneyAccount} from './accounts.service';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {PageHeaderComponent} from '../ui/page-header.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {AmountComponent} from '../ui/amount.component';
import {IconComponent} from '../ui/icon.component';
import {SampleDataComponent} from '../ui/sample-data.component';

/** /accounts: every money account with its balance, where its rows come from, and the way to its page. */
@Component({
  selector: 'app-accounts-page',
  imports: [RouterLink, TPipe, PageHeaderComponent, LoadStateComponent, AmountComponent, IconComponent, SampleDataComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'nav.accounts' | t" [subtitle]="'accounts.intro.short' | t">
        <a class="btn" routerLink="/import"><app-icon name="import"/>{{ 'nav.import' | t }}</a>
      </app-page-header>
      @if (message()) {
        <div class="done" role="status"><app-icon name="ok"/><span>{{ message() }}</span>
          <button type="button" class="btn" (click)="message.set('')">{{ 'banks.dismiss' | t }}</button></div>
      }
      @if (state() === 'ready') {
        <div class="tiles">
          @for (total of totals(); track total.currency) {
            <div class="tile"><span class="label">{{ 'accounts.total' | t }}</span>
              <app-amount class="value" [value]="total.amount" [currency]="total.currency"/>
              <span class="note">{{ 'accounts.count' | t: {count: total.count} }}</span></div>
          }
        </div>
        <ul class="list">
          @for (account of accounts(); track account.id) {
            <li>
              <a [routerLink]="['/accounts', account.id]">
                <span class="name">{{ account.name }}</span>
                @if (account.balance !== null) {
                  <app-amount class="balance" [value]="account.balance" [currency]="account.currency"/>
                }
                <span class="meta">
                  @if (account.linked) {
                    <span class="chip good"><app-icon name="link"/>{{ 'accounts.linked.short' | t }}</span>
                  }
                  <span>{{ rowsText(account.rows) }}</span>
                  @if (account.lastDate) {
                    <span>· {{ 'accounts.last' | t: {date: i18n.date(account.lastDate)} }}</span>
                  }
                </span>
                <app-icon class="chev" name="chevronRight"/>
              </a>
            </li>
          }
        </ul>
      } @else {
        <app-load-state [state]="state()" [emptyText]="'accounts.none' | t" (retry)="load()">
          <a class="btn primary" routerLink="/import"><app-icon name="import"/>{{ 'nav.import' | t }}</a>
          <app-sample-data (loaded)="load()"/>
        </app-load-state>
      }
    </div>`,
  styles: [`
    .tiles { margin-bottom: 16px; }
    .done { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 14px; margin-bottom: 16px;
      border-radius: 10px; background: var(--good-bg); color: var(--good); font-weight: 600; }
    .done span { flex: 1 1 12rem; }
    .list { list-style: none; margin: 0; padding: 0; background: var(--surface); border: 1px solid var(--line);
      border-radius: var(--radius); overflow: hidden; }
    .list li + li { border-top: 1px solid var(--line); }
    .list a { display: grid; grid-template-columns: minmax(0, 1fr) auto 20px; gap: 2px 12px; align-items: center;
      padding: 12px 16px; color: var(--fg); text-decoration: none; min-height: 60px; }
    .list a:hover { background: var(--surface-2); }
    .name { font-weight: 600; overflow-wrap: anywhere; }
    .balance { font-weight: 700; grid-column: 2; grid-row: 1; text-align: right; }
    .meta { grid-column: 1 / 3; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: .8rem;
      color: var(--muted); }
    .chev { grid-column: 3; grid-row: 1 / 3; color: var(--muted); }
  `]
})
export class AccountsPageComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private service = inject(AccountsService);
  readonly accounts = signal<MoneyAccount[]>([]);
  readonly state = signal<LoadState>('loading');
  /** said by the page that sent us here (e.g. an account deleted) */
  readonly message = signal<string>(stateMessage(inject(Location).getState()));

  /** the balances added up per currency (never mixed) */
  readonly totals = computed(() => {
    const by = new Map<string, { currency: string; amount: number; count: number }>();
    for (const a of this.accounts()) {
      if (a.balance === null) {
        continue;
      }
      const t = by.get(a.currency) ?? {currency: a.currency, amount: 0, count: 0};
      t.amount += a.balance;
      t.count++;
      by.set(a.currency, t);
    }
    return [...by.values()];
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.service.list().subscribe({
      next: list => {
        this.accounts.set(list);
        this.state.set(list.length ? 'ready' : 'empty');
      },
      error: () => this.state.set('error')
    });
  }

  rowsText(count: number): string {
    return count === 1 ? this.i18n.t('accounts.rows.one') : this.i18n.t('accounts.rows', {count});
  }
}

function stateMessage(state: unknown): string {
  const message = (state as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : '';
}
