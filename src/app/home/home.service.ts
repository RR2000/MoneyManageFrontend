import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {map, Observable, timeout} from 'rxjs';
import {CALL_TIMEOUT_MS} from '../accounts/accounts.service';
import {MovementSource} from '../ui/source-tag.component';
import {Instrument, InstrumentsAnswer} from '../instruments/instruments.component';

/** The parts of the net worth on one day (debts are negative). */
export interface NetWorthPoint {
  date: string;
  cash: number;
  investments: number;
  realEstate: number;
  /** a car, gold, money in another currency... from the day of their estimate */
  otherAssets: number;
  /** what is left today, also on the days before */
  debts: number;
  total: number;
}

/** GET /api/net-worth: from `from`, the end of every month and today; only euro, the rest counted in `excluded`. */
export interface NetWorth {
  currency: string;
  from: string;
  today: NetWorthPoint;
  /** 30 days ago, for the change */
  before: NetWorthPoint;
  points: NetWorthPoint[];
  accounts: number;
  realEstates: number;
  otherAssets: number;
  debts: number;
  instruments: number;
  excluded: { accounts: number; realEstates: number; otherAssets: number; debts: number; currencies: string[] };
}

/** GET /api/money-accounts/movements/latest: a movement of any account, with its account. */
export interface LatestMovement {
  id: number;
  accountId: string;
  account: string;
  datetime: string;
  description: string;
  amount: number;
  currency: string | null;
  source: MovementSource;
}

/** a price older than this is "stuck": the worth of the investment uses it anyway */
export const STALE_PRICE_DAYS = 10;
export const LATEST_MOVEMENTS = 6;

@Injectable({providedIn: 'root'})
export class HomeService {
  private http = inject(HttpClient);

  netWorth(from: string | null): Observable<NetWorth> {
    return this.http.get<NetWorth>('/api/net-worth', from ? {params: {from}} : {}).pipe(timeout(CALL_TIMEOUT_MS));
  }

  latest(limit = LATEST_MOVEMENTS): Observable<LatestMovement[]> {
    return this.http.get<LatestMovement[]>('/api/money-accounts/movements/latest', {params: {limit}})
      .pipe(timeout(CALL_TIMEOUT_MS));
  }

  instruments(): Observable<Instrument[]> {
    return this.http.get<InstrumentsAnswer>('/api/instruments').pipe(timeout(CALL_TIMEOUT_MS),
      map(answer => answer.instruments ?? []));
  }
}

/** whole days since an ISO date (0: today), null without a date */
export function daysSince(iso: string | null, now = new Date()): number | null {
  if (!iso) {
    return null;
  }
  const day = new Date(iso.substring(0, 10) + 'T00:00:00');
  if (isNaN(day.getTime())) {
    return null;
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - day.getTime()) / 86400000);
}
