import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, timeout} from 'rxjs';
import {MovementSource} from '../ui/source-tag.component';
import {BankLink} from '../banks/banking.service';

export const CALL_TIMEOUT_MS = 30 * 1000;

/** A money account (GET /api/money-accounts): rows by source, first and last day, a bank importing into it. */
export interface MoneyAccount {
  /** id of its page, a hash of the name: the name never goes in a URL */
  id: string;
  name: string;
  rows: number;
  fileRows: number;
  manualRows: number;
  bankRows: number;
  firstDate: string | null;
  lastDate: string | null;
  linked: boolean;
  balance: number | null;
  currency: string;
}

/** GET /api/money-accounts/{id} */
export interface AccountDetail {
  id: string;
  name: string;
  currency: string;
  balance: number | null;
  balanceDate: string | null;
  monthIn: number;
  monthOut: number;
  rows: number;
  firstDate: string | null;
  lastDate: string | null;
  linked: boolean;
}

export interface Movement {
  id: number;
  datetime: string;
  description: string;
  amount: number;
  currency: string | null;
  source: MovementSource;
  balance: number | null;
  /** its account and the id of its page */
  accountId?: string;
  account?: string;
  /** its category, null: none; who gave it */
  categoryId?: number | null;
  category?: string | null;
  categorySource?: 'RULE' | 'MANUAL' | null;
}

export interface MovementPage {
  items: Movement[];
  hasMore: boolean;
}

export type MovementKind = 'ALL' | 'IN' | 'OUT';

export interface MovementQuery {
  q?: string;
  kind?: MovementKind;
  /** only the ones without a category */
  uncategorized?: boolean;
  offset?: number;
  limit?: number;
}

export interface BalancePoint {
  date: string;
  balance: number;
}

/** The bank link of a money account, when a bank imports into it. */
export interface AccountBank {
  link: BankLink;
  accountId: number | string;
}

@Injectable({providedIn: 'root'})
export class AccountsService {
  private http = inject(HttpClient);

  list(): Observable<MoneyAccount[]> {
    return this.http.get<MoneyAccount[]>('/api/money-accounts').pipe(timeout(CALL_TIMEOUT_MS));
  }

  detail(id: string): Observable<AccountDetail> {
    return this.http.get<AccountDetail>(`/api/money-accounts/${encodeURIComponent(id)}`).pipe(timeout(CALL_TIMEOUT_MS));
  }

  balances(id: string, from: string | null): Observable<BalancePoint[]> {
    return this.http.get<BalancePoint[]>(`/api/money-accounts/${encodeURIComponent(id)}/balances`,
      from ? {params: {from}} : {}).pipe(timeout(CALL_TIMEOUT_MS));
  }

  /** the search travels in the body: descriptions and amounts never go in a URL; `id` empty: every account */
  movements(id: string, query: MovementQuery): Observable<MovementPage> {
    const url = id ? `/api/money-accounts/${encodeURIComponent(id)}/movements` : '/api/money-accounts/movements';
    return this.http.post<MovementPage>(url, query).pipe(timeout(CALL_TIMEOUT_MS));
  }

  delete(name: string, confirm: string): Observable<{ name: string; rows: number }> {
    return this.http.post<{ name: string; rows: number }>('/api/money-accounts/delete', {name, confirm})
      .pipe(timeout(CALL_TIMEOUT_MS));
  }
}

/** whole days before a consent ends (0: today), null without a date */
export function consentDaysLeft(link: BankLink, now = new Date()): number | null {
  if (!link.validUntil) {
    return null;
  }
  const end = new Date(link.validUntil);
  if (isNaN(end.getTime())) {
    return null;
  }
  return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 86400000));
}
