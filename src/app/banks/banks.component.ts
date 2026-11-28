import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {ActivatedRoute, Router} from '@angular/router';
import {timeout} from 'rxjs';
import {Aspsp, BankAccount, BankingService, BankLink, errorCode, isNotFound, REDIRECT, SyncResult} from './banking.service';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {BankHistoryComponent} from './bank-history.component';
import {PageHeaderComponent} from '../ui/page-header.component';
import {LoadStateComponent} from '../ui/load-state.component';
import {IconComponent, IconName} from '../ui/icon.component';

/** countries the open banking provider covers; Italy first */
export const COUNTRIES = ['IT', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS',
  'IE', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB'];
/** the banner "reconnect" appears this many days before the consent expires */
export const EXPIRY_WARNING_DAYS = 14;
/** banks listed before "Show all", so a country with hundreds of banks does not make an endless page */
export const LIST_LIMIT = 30;
export const NEW_ACCOUNT = '__new__';
/** the option "not imported": PUT with null */
export const NO_ACCOUNT = '__none__';
const CALL_TIMEOUT_MS = 30 * 1000;
/** a sync reads every bank: it may take a while */
const SYNC_TIMEOUT_MS = 120 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Revolut gives the whole history only this long after the consent, then 90 days */
export const FULL_HISTORY_WINDOW_MS = 5 * 60 * 1000;

type Id = number | string;

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
  imports: [FormsModule, TPipe, BankHistoryComponent, PageHeaderComponent, LoadStateComponent, IconComponent],
  templateUrl: './banks.component.html',
  styleUrl: './banks.component.css'
})
export class BanksComponent implements OnInit {
  readonly countries = COUNTRIES;
  readonly NEW_ACCOUNT = NEW_ACCOUNT;
  readonly NO_ACCOUNT = NO_ACCOUNT;
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
  /** the link being reconnected to import the whole history */
  redirectingFull = signal<Id | null>(null);
  startError = signal('');

  syncing = signal(false);
  syncResult = signal<SyncResult | null>(null);
  syncError = signal('');

  /** account whose money account is being saved */
  saving = signal<Id | null>(null);
  savedAccount = signal<Id | null>(null);
  /** account just linked to a money account: its movements are being imported, the list is read again */
  importing = signal<Id | null>(null);
  accountError = signal<Record<string, string>>({});
  /** value picked in each select while it is saved, so a failure puts the old one back */
  chosen = signal<Record<string, string>>({});
  /** account for which the name of a new money account is being written */
  newFor = signal<Id | null>(null);
  newName = '';

  confirmUnlink = signal<Id | null>(null);
  unlinking = signal<Id | null>(null);
  linkError = signal<Record<string, string>>({});
  /** logos the browser could not load: the bank's initial instead of a broken image */
  brokenLogos = signal<ReadonlySet<string>>(new Set());

  filtered = computed(() => {
    const words = folded(this.filter().trim());
    return (this.aspsps() ?? []).filter(a => folded(a.name).includes(words));
  });
  visibleAspsps = computed(() => this.showAll() ? this.filtered() : this.filtered().slice(0, LIST_LIMIT));
  /** anything that waits for the server and would conflict with another click */
  busy = computed(() => !!this.redirecting() || this.syncing() || this.unlinking() !== null);

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
      next: links => this.showLinks(links),
      error: (err: unknown) => {
        this.loading.set(false);
        this.importing.set(null);
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

  private showLinks(links: BankLink[]): void {
    this.links.set(links);
    this.importing.set(null);
    this.loading.set(false);
    this.loadError.set(false);
    this.chosen.set({});
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
          this.aspsps.set([...list].sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true})));
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

  logoFailed(logo: string): void {
    this.brokenLogos.update(broken => new Set(broken).add(logo));
  }

  /** first letter of the bank's name, for the placeholder of a logo that does not load */
  initial(name: string): string {
    return ([...name.trim()][0] ?? '?').toUpperCase();
  }

  /**
   * Link a bank, or the same bank again ("Reconnect"): the browser goes to the bank's page. `fullHistory` ("Reconnect
   * and import the whole history"): right after the consent the accounts already linked to a money account are
   * imported again with all the history the bank gives.
   */
  start(aspsp: string, country: string, fullHistory = false, linkId: Id | null = null): void {
    this.redirecting.set(aspsp);
    this.redirectingFull.set(fullHistory ? linkId : null);
    this.startError.set('');
    this.linkError.set({});
    this.banking.startLink(aspsp, country, fullHistory).pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      // `redirecting` stays on: the page is about to be left
      next: answer => this.redirect(answer.url),
      error: (err: unknown) => {
        this.redirecting.set('');
        this.redirectingFull.set(null);
        this.startError.set(this.errorText(err, 'banks.startError'));
      }
    });
  }

  /**
   * An account not imported yet of a consent given more than 5 minutes ago: some banks (Revolut) now give only the
   * last 90 days, the whole history needs "Reconnect and import the whole history".
   */
  lateForHistory(link: BankLink, account: BankAccount): boolean {
    if (account.moneyAccount || !link.createdAt) {
      return false;
    }
    const created = new Date(link.createdAt).getTime();
    return !isNaN(created) && Date.now() - created > FULL_HISTORY_WINDOW_MS;
  }

  sync(): void {
    this.syncing.set(true);
    this.syncResult.set(null);
    this.syncError.set('');
    this.banking.sync().pipe(timeout(SYNC_TIMEOUT_MS)).subscribe({
      next: result => {
        this.syncing.set(false);
        this.syncResult.set(result);
        if (Array.isArray(result?.links)) {
          this.showLinks(result.links);
        } else {
          this.load(true);
        }
      },
      error: (err: unknown) => {
        this.syncing.set(false);
        this.syncError.set(this.errorText(err, 'banks.syncError'));
        // the error of each bank is in its link
        this.load(true);
      }
    });
  }

  syncText(result: SyncResult): string {
    const imported = result.imported === 1 ? this.i18n.t('banks.synced.one')
      : this.i18n.t('banks.synced', {count: result.imported ?? 0});
    return result.ambiguous ? `${imported} ${this.i18n.t('banks.ambiguous', {count: result.ambiguous})}` : imported;
  }

  selectValue(account: BankAccount): string {
    if (this.newFor() === account.id) {
      return NEW_ACCOUNT;
    }
    return this.chosen()[account.id] ?? account.moneyAccount ?? NO_ACCOUNT;
  }

  /** the money accounts to choose from, with the one already linked even if the list did not have it */
  options(account: BankAccount): string[] {
    const names = this.moneyAccounts();
    return account.moneyAccount && !names.includes(account.moneyAccount) ? [account.moneyAccount, ...names] : names;
  }

  choose(account: BankAccount, value: string): void {
    this.savedAccount.set(null);
    if (value === NEW_ACCOUNT) {
      this.newFor.set(account.id);
      this.newName = '';
      return;
    }
    this.newFor.set(null);
    const moneyAccount = value === NO_ACCOUNT ? null : value;
    if (moneyAccount !== (account.moneyAccount ?? null)) {
      this.save(account, moneyAccount);
    }
  }

  createNew(account: BankAccount): void {
    const name = this.newName.trim();
    if (name) {
      this.save(account, name);
    }
  }

  cancelNew(): void {
    this.newFor.set(null);
    this.newName = '';
  }

  private save(account: BankAccount, moneyAccount: string | null): void {
    this.saving.set(account.id);
    this.chosen.update(all => ({...all, [account.id]: moneyAccount ?? NO_ACCOUNT}));
    this.accountError.update(all => ({...all, [account.id]: ''}));
    // the server starts the import of the account here: it may take a while
    this.banking.setMoneyAccount(account.id, moneyAccount).pipe(timeout(SYNC_TIMEOUT_MS)).subscribe({
      next: () => {
        this.saving.set(null);
        this.savedAccount.set(account.id);
        this.newFor.set(null);
        this.newName = '';
        if (moneyAccount && !this.moneyAccounts().includes(moneyAccount)) {
          this.moneyAccounts.update(names => [...names, moneyAccount].sort());
        }
        // the import of a newly linked account starts now: the balance and the last sync change
        this.importing.set(account.id);
        this.load(true);
      },
      error: (err: unknown) => {
        this.saving.set(null);
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
    this.confirmUnlink.set(null);
  }

  unlink(link: BankLink): void {
    this.unlinking.set(link.id);
    this.linkError.update(all => ({...all, [link.id]: ''}));
    this.banking.unlink(link.id).pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: () => {
        this.unlinking.set(null);
        this.confirmUnlink.set(null);
        this.links.update(links => (links ?? []).filter(l => l.id !== link.id));
      },
      error: (err: unknown) => {
        this.unlinking.set(null);
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

  /** the status as it is now: an ACTIVE link past its date is expired, even before the server notices */
  status(link: BankLink): string {
    const days = this.daysLeft(link);
    return link.status === 'ACTIVE' && days !== null && days < 0 ? 'EXPIRED' : link.status;
  }

  statusKey(link: BankLink): MessageKey {
    const key = `banks.status.${this.status(link)}`;
    return this.i18n.has(key) ? key : 'banks.status.unknown';
  }

  /** next to the words, never instead of them */
  statusIcon(link: BankLink): IconName {
    const status = this.status(link);
    return status === 'ACTIVE' ? 'ok' : status === 'EXPIRED' ? 'calendar' : 'warn';
  }

  expiresText(link: BankLink): string {
    const days = this.daysLeft(link);
    if (days === null || this.status(link) === 'REVOKED') {
      return '';
    }
    if (this.status(link) === 'EXPIRED' || days < 0) {
      return this.i18n.t('banks.expiredOn', {date: this.i18n.date(link.validUntil)});
    }
    const when = days === 0 ? this.i18n.t('banks.expiresToday')
      : days === 1 ? this.i18n.t('banks.expiresIn.one') : this.i18n.t('banks.expiresIn', {days});
    return `${when} (${this.i18n.t('banks.validUntil', {date: this.i18n.date(link.validUntil)})})`;
  }

  /** the "reconnect" banner: expired or withdrawn, or expiring within EXPIRY_WARNING_DAYS */
  warning(link: BankLink): string {
    const status = this.status(link);
    if (status === 'EXPIRED') {
      return this.i18n.t('banks.expired');
    }
    if (status === 'REVOKED') {
      return this.i18n.t('banks.revoked');
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
    const amount = this.i18n.t('banks.balance',
      {amount: this.i18n.money(balance.amount, balance.currency ?? account.currency)});
    const typeKey = `banks.balanceType.${balance.type}`;
    const type = this.i18n.has(typeKey) ? this.i18n.t(typeKey) : balance.type;
    const date = this.i18n.date(balance.date);
    return date ? `${amount} ${this.i18n.t('banks.balance.on', {type, date})}` : `${amount} (${type})`;
  }

  /** the server's code when it sends one, else the generic text of the action */
  private errorText(err: unknown, fallback: MessageKey): string {
    const code = errorCode(err);
    if (code && this.i18n.has(`banks.error.${code}`)) {
      return capitalized(this.errorCodeText(code));
    }
    if (err instanceof HttpErrorResponse && err.status === 429) {
      return this.i18n.t('banks.tooMany');
    }
    return code ? `${this.i18n.t(fallback)} (${code})` : this.i18n.t(fallback);
  }
}
