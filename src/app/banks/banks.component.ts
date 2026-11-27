import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {ActivatedRoute, Router} from '@angular/router';
import {timeout} from 'rxjs';
import {Aspsp, BankAccount, BankingService, BankLink, isNotFound, REDIRECT} from './banking.service';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';

/** countries the open banking provider covers; Italy first */
export const COUNTRIES = ['IT', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS',
  'IE', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB'];
/** the banner "reconnect" appears this many days before the consent expires */
export const EXPIRY_WARNING_DAYS = 14;
/** banks listed before "Show all", so a country with hundreds of banks does not make an endless page */
export const LIST_LIMIT = 30;
export const NEW_ACCOUNT = '__new__';
const CALL_TIMEOUT_MS = 30 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** the text without accents and case, to match "intesa" with "Intesa Sanpaolo" and "credit" with "Crédit" */
function folded(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The linked banks (open banking): link a new one (the consent is given on the bank's site, which comes back here with
 * ?result=ok|error), when each consent expires, the last sync and its error, the accounts with their balance and the
 * money account their movements go to; sync now, reconnect, unlink.
 */
@Component({
  selector: 'app-banks',
  imports: [FormsModule, TPipe],
  templateUrl: './banks.component.html',
  styleUrl: './banks.component.css'
})
export class BanksComponent implements OnInit {
  readonly countries = COUNTRIES;
  readonly NEW_ACCOUNT = NEW_ACCOUNT;
  /** next to the words, never instead of them */
  readonly icons = {ok: '✓', warning: '⚠', expired: '⌛'};
  readonly i18n = inject(I18nService);
  private banking = inject(BankingService);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private redirect = inject(REDIRECT);

  links = signal<BankLink[] | null>(null);
  loading = signal(true);
  loadError = signal(false);
  /** outcome of the consent, from ?result= of the bank's redirect */
  result = signal<'ok' | 'error' | null>(null);
  moneyAccounts = signal<string[]>([]);

  pickerOpen = signal(false);
  country = signal('IT');
  filter = signal('');
  showAll = signal(false);
  aspsps = signal<Aspsp[] | null>(null);
  aspspsLoading = signal(false);
  aspspsError = signal(false);
  /** name of the bank whose page is being opened: everything waits */
  redirecting = signal('');
  startError = signal('');

  syncing = signal(false);
  syncMessage = signal<'done' | 'error' | null>(null);

  /** account whose money account is being saved */
  saving = signal('');
  savedAccount = signal('');
  accountError = signal<Record<string, string>>({});
  /** value picked in each select while it is saved, so a failure puts the old one back */
  chosen = signal<Record<string, string>>({});
  /** account for which the name of a new money account is being written */
  newFor = signal('');
  newName = '';

  confirmUnlink = signal('');
  unlinking = signal('');
  linkError = signal<Record<string, string>>({});

  filtered = computed(() => {
    const words = folded(this.filter().trim());
    return (this.aspsps() ?? []).filter(a => folded(a.name).includes(words));
  });
  visibleAspsps = computed(() => this.showAll() ? this.filtered() : this.filtered().slice(0, LIST_LIMIT));
  /** anything that waits for the server and would conflict with another click */
  busy = computed(() => !!this.redirecting() || this.syncing() || !!this.unlinking());

  ngOnInit(): void {
    const result = this.route.snapshot.queryParamMap.get('result');
    if (result === 'ok' || result === 'error') {
      this.result.set(result);
      // the outcome is shown once: a reload or a shared link does not show it again
      this.router.navigate([], {relativeTo: this.route, queryParams: {result: null}, queryParamsHandling: 'merge',
        replaceUrl: true});
    }
    this.load();
    this.http.get<string[]>('/api/banks/transactions/accounts').subscribe({
      next: names => this.moneyAccounts.set(names),
      error: () => this.moneyAccounts.set([])
    });
  }

  /** `quiet`: after a change, the list stays on screen while it is read again */
  load(quiet = false): void {
    if (!quiet) {
      this.loading.set(true);
      this.loadError.set(false);
    }
    this.banking.links().pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: links => {
        this.links.set(links);
        this.loading.set(false);
        this.loadError.set(false);
        this.chosen.set({});
      },
      error: (err: unknown) => {
        this.loading.set(false);
        if (isNotFound(err)) {
          // the feature is off, or not for this user: the page is not there
          this.router.navigate(['/']);
        } else if (!quiet || !this.links()) {
          this.loadError.set(true);
        }
        this.chosen.set({});
      }
    });
  }

  openPicker(): void {
    this.pickerOpen.set(true);
    this.startError.set('');
    if (!this.aspsps()) {
      this.loadAspsps();
    }
  }

  closePicker(): void {
    this.pickerOpen.set(false);
  }

  setCountry(country: string): void {
    this.country.set(country);
    this.loadAspsps();
  }

  setFilter(filter: string): void {
    this.filter.set(filter);
    this.showAll.set(false);
  }

  loadAspsps(): void {
    this.aspspsLoading.set(true);
    this.aspspsError.set(false);
    this.aspsps.set(null);
    this.showAll.set(false);
    const country = this.country();
    this.banking.aspsps(country).pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: list => {
        if (country === this.country()) {
          this.aspsps.set([...list].sort((a, b) => a.name.localeCompare(b.name)));
          this.aspspsLoading.set(false);
        }
      },
      error: () => {
        if (country === this.country()) {
          this.aspspsLoading.set(false);
          this.aspspsError.set(true);
        }
      }
    });
  }

  /** Link a bank, or the same bank again ("Reconnect"): the browser goes to the bank's page. */
  start(aspsp: string, country: string): void {
    this.redirecting.set(aspsp);
    this.startError.set('');
    this.linkError.set({});
    this.banking.startLink(aspsp, country).pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      // `redirecting` stays on: the page is about to be left
      next: answer => this.redirect(answer.url),
      error: (err: unknown) => {
        this.redirecting.set('');
        this.startError.set(this.errorText(err, 'banks.startError'));
      }
    });
  }

  sync(): void {
    this.syncing.set(true);
    this.syncMessage.set(null);
    this.banking.sync().subscribe({
      next: () => {
        this.syncing.set(false);
        this.syncMessage.set('done');
        this.load(true);
      },
      error: () => {
        this.syncing.set(false);
        this.syncMessage.set('error');
        // the error of each bank is in its link
        this.load(true);
      }
    });
  }

  selectValue(account: BankAccount): string {
    if (this.newFor() === account.id) {
      return NEW_ACCOUNT;
    }
    return this.chosen()[account.id] ?? account.moneyAccount ?? '';
  }

  /** the money accounts to choose from, with the one already linked even if the list did not have it */
  options(account: BankAccount): string[] {
    const names = this.moneyAccounts();
    return account.moneyAccount && !names.includes(account.moneyAccount) ? [account.moneyAccount, ...names] : names;
  }

  choose(account: BankAccount, value: string): void {
    this.savedAccount.set('');
    if (value === NEW_ACCOUNT) {
      this.newFor.set(account.id);
      this.newName = '';
      return;
    }
    this.newFor.set('');
    if (value && value !== account.moneyAccount) {
      this.save(account, value);
    }
  }

  createNew(account: BankAccount): void {
    const name = this.newName.trim();
    if (name) {
      this.save(account, name);
    }
  }

  cancelNew(): void {
    this.newFor.set('');
    this.newName = '';
  }

  private save(account: BankAccount, moneyAccount: string): void {
    this.saving.set(account.id);
    this.chosen.update(all => ({...all, [account.id]: moneyAccount}));
    this.accountError.update(all => ({...all, [account.id]: ''}));
    this.banking.setMoneyAccount(account.id, moneyAccount).pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: () => {
        this.saving.set('');
        this.savedAccount.set(account.id);
        this.newFor.set('');
        this.newName = '';
        if (!this.moneyAccounts().includes(moneyAccount)) {
          this.moneyAccounts.update(names => [...names, moneyAccount].sort());
        }
        this.load(true);
      },
      error: (err: unknown) => {
        this.saving.set('');
        this.chosen.update(all => {
          const rest = {...all};
          delete rest[account.id];
          return rest;
        });
        this.accountError.update(all => ({...all, [account.id]: this.errorText(err, 'banks.moneyAccount.error')}));
      }
    });
  }

  askUnlink(link: BankLink): void {
    this.confirmUnlink.set(link.id);
  }

  keepLink(): void {
    this.confirmUnlink.set('');
  }

  unlink(link: BankLink): void {
    this.unlinking.set(link.id);
    this.linkError.update(all => ({...all, [link.id]: ''}));
    this.banking.unlink(link.id).pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: () => {
        this.unlinking.set('');
        this.confirmUnlink.set('');
        this.links.update(links => (links ?? []).filter(l => l.id !== link.id));
      },
      error: (err: unknown) => {
        this.unlinking.set('');
        this.linkError.update(all => ({...all, [link.id]: this.errorText(err, 'banks.unlinkError')}));
      }
    });
  }

  /** whole days left before the consent expires (0: today), null if the bank gave no date */
  daysLeft(link: BankLink): number | null {
    if (!link.validUntil) {
      return null;
    }
    const until = new Date(link.validUntil).getTime();
    return isNaN(until) ? null : Math.floor((until - Date.now()) / DAY_MS);
  }

  expired(link: BankLink): boolean {
    const days = this.daysLeft(link);
    return link.status === 'EXPIRED' || (days !== null && days < 0);
  }

  expiresText(link: BankLink): string {
    const days = this.daysLeft(link);
    if (days === null) {
      return '';
    }
    if (this.expired(link)) {
      return this.i18n.t('banks.expiredOn', {date: this.i18n.date(link.validUntil)});
    }
    const when = days === 0 ? this.i18n.t('banks.expiresToday')
      : days === 1 ? this.i18n.t('banks.expiresIn.one') : this.i18n.t('banks.expiresIn', {days});
    return `${when} (${this.i18n.t('banks.validUntil', {date: this.i18n.date(link.validUntil)})})`;
  }

  /** the "reconnect" banner: expired, or expiring within EXPIRY_WARNING_DAYS */
  warning(link: BankLink): string {
    if (this.expired(link)) {
      return this.i18n.t('banks.expired');
    }
    const days = this.daysLeft(link);
    if (days === null || days > EXPIRY_WARNING_DAYS) {
      return '';
    }
    return days === 0 ? this.i18n.t('banks.expiring.today')
      : days === 1 ? this.i18n.t('banks.expiring.one') : this.i18n.t('banks.expiring', {days});
  }

  /** the code of an error of the bank in words */
  errorCodeText(code: string): string {
    const key = `banks.error.${code}`;
    return this.i18n.has(key) ? this.i18n.t(key) : this.i18n.t('banks.error.unknown', {code});
  }

  balanceText(account: BankAccount): string {
    const balance = account.balance;
    if (!balance) {
      return this.i18n.t('banks.balance.none');
    }
    const amount = this.i18n.t('banks.balance', {amount: this.i18n.money(balance.amount, account.currency)});
    const typeKey = `banks.balanceType.${balance.type}`;
    const type = this.i18n.has(typeKey) ? this.i18n.t(typeKey) : balance.type;
    const date = this.i18n.date(balance.date);
    return date ? `${amount} ${this.i18n.t('banks.balance.on', {type, date})}` : `${amount} (${type})`;
  }

  statusKey(link: BankLink): MessageKey {
    return this.expired(link) ? 'banks.status.EXPIRED' : `banks.status.${link.status}`;
  }

  /** the server's code when it sends one we know, else the generic text of the action */
  private errorText(err: unknown, fallback: MessageKey): string {
    const code = err instanceof HttpErrorResponse ? err.error?.code : undefined;
    if (typeof code === 'string' && this.i18n.has(`banks.error.${code}`)) {
      return capitalized(this.errorCodeText(code));
    }
    if (err instanceof HttpErrorResponse && err.status === 429) {
      return capitalized(this.i18n.t('banks.error.RATE_LIMIT'));
    }
    return this.i18n.t(fallback);
  }
}
