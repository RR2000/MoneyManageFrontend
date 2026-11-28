import {Component, inject, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient, HttpErrorResponse, HttpHeaders} from '@angular/common/http';
import {RouterLink} from '@angular/router';
import {forkJoin, Observable, of, timeout} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {I18nService} from '../i18n/i18n.service';
import {demoError} from '../demo/demo';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {PageHeaderComponent} from '../ui/page-header.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {IconComponent} from '../ui/icon.component';
import {SampleDataComponent} from '../ui/sample-data.component';
import {CALL_TIMEOUT_MS} from '../accounts/accounts.service';

/** the banks whose export files the server reads, with the kind of file */
export const BANKS: readonly { value: string; label: string; key?: MessageKey }[] = [
  {value: 'Revolut', label: 'Revolut (CSV)'},
  {value: 'Degiro', label: '', key: 'import.bank.degiro'},
  {value: 'Unicredit', label: 'Unicredit (CSV)'},
  {value: 'Sanpaolo', label: 'Intesa Sanpaolo (XLSX)'}
];
/** a big file takes a while to be read */
const UPLOAD_TIMEOUT_MS = 120 * 1000;

/** what happened to an upload or a balance: words, and whether it went wrong */
export interface Outcome {
  text: string;
  error: boolean;
}

/** one money account and the balance written for it */
interface BalanceRow {
  name: string;
  value: string;
  outcome: Outcome | null;
}

/**
 * /import: the files of a bank and of the broker, and today's balance of every account (the balance of the days before
 * is worked out from the movements). Three independent boxes, in the order they are usually done; an empty account
 * can start from the sample data instead.
 */
@Component({
  selector: 'app-import-page',
  imports: [FormsModule, RouterLink, TPipe, PageHeaderComponent, LoadStateComponent, IconComponent, SampleDataComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'nav.import' | t" [subtitle]="'import.subtitle' | t">
        <a class="btn" routerLink="/accounts"><app-icon name="accounts"/>{{ 'import.toAccounts' | t }}</a>
      </app-page-header>

      @if (accountsState() === 'empty') {
        <section class="card sample" aria-labelledby="import-sample">
          <h2 id="import-sample">{{ 'import.sample.title' | t }}</h2>
          <p class="text">{{ 'import.sample.text' | t }}</p>
          <div class="buttons"><app-sample-data (loaded)="sampleLoaded()"/></div>
        </section>
      }

      <section class="card" aria-labelledby="import-bank">
        <h2 id="import-bank"><span class="step" aria-hidden="true">1</span>{{ 'import.bank.title' | t }}</h2>
        <p class="text">{{ 'import.bank.text' | t }}</p>
        <form class="form" (ngSubmit)="uploadBank()">
          <div class="field">
            <label for="import-bank-name">{{ 'import.bank' | t }}</label>
            <select id="import-bank-name" name="bank" [(ngModel)]="bankName" [disabled]="bankBusy()">
              @for (b of banks; track b.value) {
                <option [value]="b.value">{{ b.key ? (b.key | t) : b.label }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="import-bank-file">{{ 'import.bankFile' | t }}</label>
            <input id="import-bank-file" type="file" accept=".csv,.xlsx" (change)="bankFile = fileOf($event)"
                   [disabled]="bankBusy()">
          </div>
          <div class="buttons full">
            <button type="submit" class="btn primary" [disabled]="!bankFile || bankBusy()">
              <app-icon name="import"/>{{ (bankBusy() ? 'import.uploading' : 'import.upload') | t }}</button>
          </div>
          <div class="full" aria-live="polite">
            @if (bankBusy()) {
              <p class="line" role="status"><span class="spinner" aria-hidden="true"></span>{{ 'import.uploading' | t }}</p>
            } @else if (bankOutcome(); as o) {
              <p class="line" [class.ok]="!o.error" [class.bad]="o.error" [attr.role]="o.error ? 'alert' : 'status'">
                <app-icon [name]="o.error ? 'error' : 'ok'"/><span>{{ o.text }}</span></p>
            }
          </div>
        </form>
      </section>

      <section class="card" aria-labelledby="import-broker">
        <h2 id="import-broker"><span class="step" aria-hidden="true">2</span>{{ 'import.broker.title' | t }}</h2>
        <p class="text">{{ 'import.broker.text' | t }}</p>
        <form class="form" (ngSubmit)="uploadBroker()">
          <div class="field full">
            <label for="import-broker-file">{{ 'import.brokerFile' | t }}</label>
            <input id="import-broker-file" type="file" accept=".csv" (change)="brokerFile = fileOf($event)"
                   [disabled]="brokerBusy()">
          </div>
          <div class="buttons full">
            <button type="submit" class="btn primary" [disabled]="!brokerFile || brokerBusy()">
              <app-icon name="import"/>{{ (brokerBusy() ? 'import.uploading' : 'import.upload') | t }}</button>
          </div>
          <div class="full" aria-live="polite">
            @if (brokerBusy()) {
              <p class="line" role="status"><span class="spinner" aria-hidden="true"></span>{{ 'import.uploading' | t }}</p>
            } @else if (brokerOutcome(); as o) {
              <p class="line" [class.ok]="!o.error" [class.bad]="o.error" [attr.role]="o.error ? 'alert' : 'status'">
                <app-icon [name]="o.error ? 'error' : 'ok'"/><span>{{ o.text }}</span></p>
            }
          </div>
        </form>
      </section>

      <section class="card" aria-labelledby="import-balances">
        <h2 id="import-balances"><span class="step" aria-hidden="true">3</span>{{ 'import.balances.title' | t }}</h2>
        <p class="text">{{ 'import.balances.text' | t }}</p>
        @if (accountsState() === 'ready') {
          <form class="form" novalidate (ngSubmit)="saveBalances()">
            @for (row of rows(); track row.name; let i = $index) {
              <div class="field">
                <label [for]="'import-balance-' + i">{{ row.name }}</label>
                <input [id]="'import-balance-' + i" [name]="'balance-' + i" type="text" inputmode="decimal" autocomplete="off"
                       [(ngModel)]="row.value" [disabled]="balancesBusy()" [placeholder]="'import.balance.placeholder' | t"
                       [attr.aria-invalid]="!!row.outcome?.error" [attr.aria-describedby]="row.outcome ? 'import-balance-' + i + '-out' : null">
                @if (row.outcome; as o) {
                  <p class="line small" [id]="'import-balance-' + i + '-out'" [class.ok]="!o.error" [class.bad]="o.error">
                    <app-icon [name]="o.error ? 'error' : 'ok'"/><span>{{ o.text }}</span></p>
                }
              </div>
            }
            <div class="buttons full">
              <button type="submit" class="btn primary" [disabled]="balancesBusy()">
                {{ (balancesBusy() ? 'import.balances.saving' : 'import.balances.save') | t }}</button>
            </div>
            <div class="full" aria-live="polite">
              @if (balancesBusy()) {
                <p class="line" role="status"><span class="spinner" aria-hidden="true"></span>{{ 'import.balances.saving' | t }}</p>
              } @else if (balancesMessage(); as m) {
                <p class="line" [class.ok]="!m.error" [class.bad]="m.error" [attr.role]="m.error ? 'alert' : 'status'">
                  <app-icon [name]="m.error ? 'error' : 'ok'"/><span>{{ m.text }}</span></p>
              }
            </div>
          </form>
        } @else {
          <app-load-state [state]="accountsState()" [emptyText]="'import.balances.none' | t" (retry)="loadAccounts()"/>
        }
      </section>
    </div>`,
  styles: [`
    .page { display: grid; gap: 16px; }
    app-page-header { margin-bottom: 0; }
    h2 { display: flex; gap: 10px; align-items: center; }
    .step { display: inline-grid; place-items: center; flex: none; width: 26px; height: 26px; border-radius: 50%;
      background: var(--accent-soft); color: var(--accent); font-size: .85rem; font-weight: 800; }
    .text { margin: 0; color: var(--muted); font-size: .9rem; }
    .sample { border-color: var(--accent); }
    .form { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: 12px 16px; }
    .full { grid-column: 1 / -1; }
    .full:empty { display: none; }
    .field { display: grid; gap: 4px; align-content: start; min-width: 0; }
    label { font-size: .84rem; font-weight: 600; overflow-wrap: anywhere; }
    select, input:not([type=file]) { width: 100%; min-width: 0; min-height: 44px; padding: 8px 10px; font-size: 1rem;
      border-radius: 8px; }
    input[type=file] { width: 100%; min-width: 0; min-height: 44px; padding: 8px 0; font: inherit; color: var(--fg); }
    input[type=file]::file-selector-button { min-height: 40px; margin-right: 10px; padding: 6px 14px; border-radius: 8px;
      border: 1px solid var(--line-strong); background: var(--surface); color: var(--fg); font: inherit; font-weight: 600;
      cursor: pointer; }
    input[aria-invalid="true"] { border-color: var(--bad); border-width: 2px; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; }
    .line { display: flex; gap: 6px; align-items: center; margin: 0; overflow-wrap: anywhere; --icon-size: 16px; }
    .line.small { font-size: .84rem; align-items: flex-start; }
    .line.ok { color: var(--good); font-weight: 600; }
    .line.bad { color: var(--bad); font-weight: 600; }
    .spinner { display: inline-block; flex: none; width: 1em; height: 1em; border: 2px solid currentColor;
      border-right-color: transparent; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 2.4s; } }
  `]
})
export class ImportPageComponent implements OnInit {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  readonly banks = BANKS;

  bankName = 'Revolut';
  bankFile: File | null = null;
  readonly bankBusy = signal(false);
  readonly bankOutcome = signal<Outcome | null>(null);

  brokerFile: File | null = null;
  readonly brokerBusy = signal(false);
  readonly brokerOutcome = signal<Outcome | null>(null);

  readonly rows = signal<BalanceRow[]>([]);
  readonly accountsState = signal<LoadState>('loading');
  readonly balancesBusy = signal(false);
  readonly balancesMessage = signal<Outcome | null>(null);

  ngOnInit(): void {
    this.loadAccounts();
  }

  fileOf(event: Event): File | null {
    return (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  /** the money accounts, for today's balances; a bank file may have just added one */
  loadAccounts(): void {
    this.accountsState.set('loading');
    this.http.get<string[]>('/api/banks/transactions/accounts').pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: names => {
        const written = new Map(this.rows().map(r => [r.name, r.value]));
        this.rows.set(names.map(name => ({name, value: written.get(name) ?? '', outcome: null})));
        this.accountsState.set(names.length ? 'ready' : 'empty');
      },
      error: () => this.accountsState.set('error')
    });
  }

  sampleLoaded(): void {
    this.loadAccounts();
  }

  uploadBank(): void {
    if (!this.bankFile) {
      return;
    }
    this.bankBusy.set(true);
    this.bankOutcome.set(null);
    const form = new FormData();
    form.append('multipartFile', this.bankFile);
    this.http.post<unknown[]>(`/api/banks/transactions/${encodeURIComponent(this.bankName)}/upload`, form)
      .pipe(timeout(UPLOAD_TIMEOUT_MS)).subscribe({
        next: rows => {
          this.bankBusy.set(false);
          const count = Array.isArray(rows) ? rows.length : 0;
          this.bankOutcome.set({text: this.i18n.t(count === 1 ? 'import.bankUploaded.one' : 'import.bankUploaded', {count}),
            error: false});
          this.loadAccounts();
        },
        error: (err: unknown) => {
          this.bankBusy.set(false);
          this.bankOutcome.set({text: this.errorText(err), error: true});
        }
      });
  }

  uploadBroker(): void {
    const file = this.brokerFile;
    if (!file) {
      return;
    }
    this.brokerBusy.set(true);
    this.brokerOutcome.set(null);
    file.text().then(csv => {
      this.http.post('/api/brokers/transactions/upload', csv, {
        headers: new HttpHeaders({'Content-Type': 'text/csv'}),
        responseType: 'text'
      }).pipe(timeout(UPLOAD_TIMEOUT_MS)).subscribe({
        next: () => {
          this.brokerBusy.set(false);
          this.brokerOutcome.set({text: this.i18n.t('import.brokerUploaded'), error: false});
        },
        error: (err: unknown) => {
          this.brokerBusy.set(false);
          this.brokerOutcome.set({text: this.errorText(err), error: true});
        }
      });
    }, () => {
      this.brokerBusy.set(false);
      this.brokerOutcome.set({text: this.i18n.t('import.unreadable'), error: true});
    });
  }

  /** every balance written (the empty ones are left as they are), one call each, then what happened to each */
  saveBalances(): void {
    this.balancesMessage.set(null);
    const rows = this.rows().map(r => ({...r, outcome: null as Outcome | null}));
    const written = rows.filter(r => r.value.trim() !== '');
    for (const row of written) {
      if (parseAmount(row.value) === null) {
        row.outcome = {text: this.i18n.t('import.balance.invalid'), error: true};
      }
    }
    this.rows.set(rows);
    if (!written.length) {
      this.balancesMessage.set({text: this.i18n.t('import.balances.empty'), error: true});
      return;
    }
    const valid = written.filter(r => !r.outcome);
    if (valid.length < written.length) {
      return;
    }
    this.balancesBusy.set(true);
    const calls: Observable<[string, Outcome]>[] = valid.map(row =>
      // the amount in the body, not in the URL: URLs end up in the access logs
      this.http.post(`/api/banks/transactions/accounts/${encodeURIComponent(row.name)}/balance`,
        {amountToday: parseAmount(row.value)}).pipe(
        timeout(CALL_TIMEOUT_MS),
        map((): [string, Outcome] => [row.name, {text: this.i18n.t('import.balance.saved'), error: false}]),
        catchError((err: unknown) => of<[string, Outcome]>([row.name, {text: this.errorText(err), error: true}]))));
    forkJoin(calls).subscribe(results => {
      const outcomes = new Map(results);
      this.rows.update(list => list.map(r => outcomes.has(r.name) ? {...r, outcome: outcomes.get(r.name)!} : r));
      this.balancesBusy.set(false);
      const failed = results.filter(([, o]) => o.error).length;
      this.balancesMessage.set(failed
        ? {text: this.i18n.t(failed === 1 ? 'import.balances.failed.one' : 'import.balances.failed', {count: failed}), error: true}
        : {text: this.i18n.t('import.balances.saved'), error: false});
    });
  }

  /** the server's reason when it gives one (why a file was refused), else a generic text */
  private errorText(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return this.i18n.t('common.unreachable');
      }
      const demo = demoError(err);
      if (demo) {
        return this.i18n.t(demo.key, demo.params);
      }
      let message: unknown = err.error?.message;
      if (!message && typeof err.error === 'string') {
        try {
          message = JSON.parse(err.error)?.message;
        } catch {
          message = '';
        }
      }
      if (typeof message === 'string' && message) {
        return this.i18n.t('common.error', {message});
      }
    }
    return this.i18n.t('common.failed');
  }
}

/** "1.234,56", "1234.56", "-20" -> number; null if it is not a number */
export function parseAmount(text: string): number | null {
  let t = text.trim().replace(/\s/g, '').replace(/[€$£]/g, '');
  if (t.includes(',') && t.includes('.')) {
    // the last of the two is the decimal separator
    t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else {
    t = t.replace(',', '.');
  }
  if (!/^[-+]?\d+(\.\d+)?$/.test(t)) {
    return null;
  }
  return Number(t);
}
