import {inject, Injectable, InjectionToken, signal} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {Observable, tap} from 'rxjs';
import {AuthService} from '../auth/auth.service';

/** A bank that can be linked (GET /api/banking/aspsps). */
export interface Aspsp {
  name: string;
  country: string;
  logo?: string | null;
  /** longest consent the bank gives, in seconds */
  maximumConsentValidity?: number | null;
}

export interface BankBalance {
  amount: number;
  currency?: string | null;
  /** ISO 20022 balance type: CLAV, ITAV, CLBD, ITBD, XPCD... */
  type: string;
  date: string | null;
}

/** An account of a linked bank. */
export interface BankAccount {
  id: number | string;
  /** the name the bank gives the account, if any */
  name?: string | null;
  /** masked, e.g. IT **** 1234 */
  iban: string | null;
  currency: string | null;
  balance: BankBalance | null;
  /** the money account its movements go to, null: not imported */
  moneyAccount: string | null;
}

export type LinkStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

/** A consent given to a bank (GET /api/banking/links). */
export interface BankLink {
  id: number | string;
  aspsp: string;
  country: string;
  status: LinkStatus;
  validUntil: string | null;
  lastSyncAt: string | null;
  /** code of the last error, null if the last sync went well */
  lastError: string | null;
  /** movements of the last sync already there but in more rows than one: not added, not matched */
  lastAmbiguous?: number;
  accounts: BankAccount[];
}

/** Answer of "sync now": the counts, and the links as GET /links gives them. */
export interface SyncResult {
  imported: number;
  matched: number;
  ambiguous: number;
  links: BankLink[];
}

/** Where the browser goes to give the consent: a function, so tests do not leave the page. */
export const REDIRECT = new InjectionToken<(url: string) => void>('REDIRECT', {
  providedIn: 'root',
  factory: () => (url: string) => window.location.assign(url)
});

/**
 * Open banking: linking the accounts of a bank (the consent is given on the bank's site) and the movements it sends.
 * A 404 on the list of links means the feature is off, or not for this user: then the menu and the page are hidden.
 */
@Injectable({providedIn: 'root'})
export class BankingService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  /** null: not known yet */
  readonly available = signal<boolean | null>(null);
  /** the login the availability was checked for: another login checks again */
  private checkedFor: string | null = null;

  /**
   * Asks the server once per login whether the feature is there: `banking` of GET /api/account; when the account does
   * not say (an older backend, or the call failed), the list of links, where a 404 means no.
   */
  checkAvailability(): void {
    const token = this.auth.getToken();
    if (!token) {
      this.checkedFor = null;
      this.available.set(null);
      return;
    }
    if (token === this.checkedFor) {
      return;
    }
    this.checkedFor = token;
    this.available.set(null);
    this.http.get<{ banking?: boolean }>('/api/account').subscribe({
      next: account => typeof account?.banking === 'boolean'
        ? this.available.set(account.banking) : this.checkLinks(),
      // a 401 is the end of the login (the interceptor goes to the login page): nothing else to ask
      error: (err: unknown) => err instanceof HttpErrorResponse && err.status === 401 ? undefined : this.checkLinks()
    });
  }

  private checkLinks(): void {
    this.http.get<BankLink[]>('/api/banking/links').subscribe({
      next: () => this.available.set(true),
      error: (err: unknown) => this.available.set(!isNotFound(err))
    });
  }

  links(): Observable<BankLink[]> {
    return this.http.get<BankLink[]>('/api/banking/links').pipe(
      tap({next: () => this.available.set(true), error: err => isNotFound(err) && this.available.set(false)}));
  }

  aspsps(country: string): Observable<Aspsp[]> {
    return this.http.get<Aspsp[]>('/api/banking/aspsps', {params: {country}});
  }

  /** Starts a consent: the answer is the bank's page, where the browser goes. */
  startLink(aspsp: string, country: string): Observable<{ url: string }> {
    return this.http.post<{ url: string }>('/api/banking/links', {aspsp, country});
  }

  /**
   * The money account the movements of a bank account go to: a name that does not exist yet creates it, null stops the
   * import. Answers the account.
   */
  setMoneyAccount(accountId: number | string, moneyAccount: string | null): Observable<BankAccount> {
    return this.http.put<BankAccount>(`/api/banking/accounts/${encodeURIComponent(accountId)}`, {moneyAccount});
  }

  sync(): Observable<SyncResult> {
    return this.http.post<SyncResult>('/api/banking/sync', null);
  }

  /** Removes the link; the movements already imported stay. */
  unlink(linkId: number | string): Observable<unknown> {
    return this.http.delete(`/api/banking/links/${encodeURIComponent(linkId)}`);
  }
}

export function isNotFound(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 404;
}

/** The backend's errors carry a code in `message` (UNKNOWN_ASPSP, MONEY_ACCOUNT_TAKEN...), never a sentence. */
export function errorCode(err: unknown): string | null {
  const message = err instanceof HttpErrorResponse ? err.error?.message : undefined;
  return typeof message === 'string' && /^[A-Z][A-Z0-9_]*$/.test(message) ? message : null;
}
