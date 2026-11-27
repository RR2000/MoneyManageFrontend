import {Component, inject, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {RouterLink} from '@angular/router';
import {timeout} from 'rxjs';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {errorCode} from '../banks/banking.service';

/** A money account (GET /api/money-accounts): its rows by source, first and last day, a bank importing into it. */
export interface MoneyAccount {
  name: string;
  rows: number;
  fileRows: number;
  manualRows: number;
  bankRows: number;
  firstDate: string | null;
  lastDate: string | null;
  linked: boolean;
}

const CALL_TIMEOUT_MS = 30 * 1000;

/**
 * The money accounts with where their rows come from, and "delete account": the rows that disappear are counted, and
 * the name has to be typed again, character by character. An account where a bank imports cannot be deleted.
 */
@Component({
  selector: 'app-money-accounts',
  imports: [FormsModule, RouterLink, TPipe],
  templateUrl: './money-accounts.component.html',
  styleUrl: '../banks/banks.component.css'
})
export class MoneyAccountsComponent implements OnInit {
  /** next to the words, never instead of them */
  readonly icons = {FILE: '\u{1F4C4}', MANUAL: '✎', BANK: '\u{1F3E6}', linked: '\u{1F517}'};
  readonly i18n = inject(I18nService);
  private http = inject(HttpClient);

  accounts = signal<MoneyAccount[] | null>(null);
  loading = signal(true);
  loadError = signal(false);
  /** the account whose deletion is being confirmed */
  confirming = signal<string | null>(null);
  typed = '';
  deleting = signal(false);
  deleteError = signal('');
  deleted = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.http.get<MoneyAccount[]>('/api/money-accounts').pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: list => {
        this.accounts.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      }
    });
  }

  rowsText(count: number): string {
    return count === 1 ? this.i18n.t('accounts.rows.one') : this.i18n.t('accounts.rows', {count});
  }

  period(account: MoneyAccount): string {
    return this.i18n.t('accounts.period', {from: this.i18n.date(account.firstDate), to: this.i18n.date(account.lastDate)});
  }

  ask(account: MoneyAccount): void {
    this.confirming.set(account.name);
    this.typed = '';
    this.deleteError.set('');
    this.deleted.set('');
  }

  cancel(): void {
    this.confirming.set(null);
    this.typed = '';
    this.deleteError.set('');
  }

  delete(account: MoneyAccount): void {
    if (this.typed !== account.name) {
      return;
    }
    this.deleting.set(true);
    this.deleteError.set('');
    this.http.post<{ name: string; rows: number }>('/api/money-accounts/delete', {name: account.name, confirm: this.typed})
      .pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
        next: result => {
          this.deleting.set(false);
          this.confirming.set(null);
          this.typed = '';
          this.accounts.update(list => (list ?? []).filter(a => a.name !== account.name));
          this.deleted.set(this.i18n.t('accounts.delete.done', {name: account.name, rows: this.rowsText(result.rows)}));
        },
        error: (err: unknown) => {
          this.deleting.set(false);
          const code = errorCode(err);
          const key = `accounts.error.${code}`;
          this.deleteError.set(code && this.i18n.has(key) ? this.i18n.t(key as MessageKey)
            : err instanceof HttpErrorResponse && err.status === 429 ? this.i18n.t('common.tooMany')
              : this.i18n.t('accounts.delete.error'));
        }
      });
  }
}
