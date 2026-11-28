import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, timeout} from 'rxjs';
import {CALL_TIMEOUT_MS} from '../accounts/accounts.service';

/**
 * One position (ISIN) of GET /api/investments. Amounts in `currency`; `invested` is the cost of what is held (weighted
 * average cost, with the fees); `gainShare` and `portfolioShare` are fractions (0.12 = 12%), `targetPercent` a percent.
 * `excluded`: why it is not in the totals (another currency, no price), null when it is.
 */
export interface Position {
  isin: string;
  name: string;
  currency: string;
  inTotal: boolean;
  excluded: 'CURRENCY' | 'NO_PRICE' | null;
  quantity: number;
  averagePrice: number;
  invested: number;
  lastPrice: number | null;
  lastDate: string | null;
  value: number | null;
  gain: number | null;
  gainShare: number | null;
  tax: number | null;
  netGain: number | null;
  realized: number;
  portfolioShare: number | null;
  targetPercent: number | null;
}

export interface PortfolioTotals {
  invested: number;
  value: number;
  gain: number;
  gainShare: number | null;
  tax: number;
  netGain: number;
  realized: number;
  fees: number;
  bought: number;
  sold: number;
}

/** xirr: money-weighted, a year; twr: time-weighted (whole period, and a year); simple: on what was spent buying */
export interface Performance {
  since: string | null;
  days: number;
  xirr: number | null;
  simpleGain: number;
  simple: number | null;
  twr: number | null;
  twrYearly: number | null;
}

/** one ISIN against its target, in percent of the portfolio; gap > 0: buy about that much */
export interface Slice {
  isin: string;
  name: string;
  value: number;
  actualPercent: number;
  targetPercent: number | null;
  gap: number | null;
}

export interface Allocation {
  slices: Slice[];
  assignedPercent: number;
  unassignedPercent: number;
}

/** end of a month (or today): worth, money put in (purchases minus sales), worth by ISIN */
export interface PortfolioPoint {
  date: string;
  value: number;
  invested: number;
  byIsin: Record<string, number>;
}

export interface Portfolio {
  currency: string;
  today: string;
  taxRate: number;
  positions: Position[];
  /** ISINs sold out */
  closed: number;
  totals: PortfolioTotals;
  performance: Performance;
  allocation: Allocation;
  history: PortfolioPoint[];
  excluded: { instruments: number; currencies: string[]; withoutPrice: number };
}

export interface Target {
  isin: string;
  percent: number;
}

export interface Targets {
  targets: Target[];
  unassignedPercent: number;
}

@Injectable({providedIn: 'root'})
export class InvestmentsService {
  private http = inject(HttpClient);

  portfolio(): Observable<Portfolio> {
    return this.http.get<Portfolio>('/api/investments').pipe(timeout(CALL_TIMEOUT_MS));
  }

  /** replaces every target (0: none) */
  saveTargets(targets: Target[]): Observable<Targets> {
    return this.http.put<Targets>('/api/investments/targets', {targets}).pipe(timeout(CALL_TIMEOUT_MS));
  }
}

/** the gap of a slice in words: what to buy, how much it is over, or in line (within 1% of the portfolio) */
export function gapKind(gap: number | null, total: number): 'buy' | 'over' | 'ok' | null {
  if (gap === null) {
    return null;
  }
  if (Math.abs(gap) <= Math.max(1, total * 0.01)) {
    return 'ok';
  }
  return gap > 0 ? 'buy' : 'over';
}
