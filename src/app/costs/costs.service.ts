import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, timeout} from 'rxjs';
import {CALL_TIMEOUT_MS} from '../accounts/accounts.service';
import {MessageKey} from '../i18n/messages.en';

/** A category of movements; `fixed`: a fixed cost, counted on the fixed costs page. */
export interface Category {
  id: number;
  name: string;
  fixed: boolean;
  /** movements with this category */
  movements: number;
  rules: number;
}

export type Direction = 'IN' | 'OUT';

/** A description that contains `pattern` (any case) gets the category; only money in/out, only one account. */
export interface Rule {
  id: number;
  categoryId: number;
  pattern: string;
  direction: Direction | null;
  accountId: string | null;
  account: string | null;
}

/** GET /api/categories */
export interface CategoriesOverview {
  categories: Category[];
  rules: Rule[];
  /** movements of every account without a category */
  uncategorized: number;
}

/** what "apply to all" does or would do */
export interface Applied {
  dryRun: boolean;
  categorized: number;
  changed: number;
  cleared: number;
  manualKept: number;
  total: number;
}

/** PUT /api/movements/{id}/category */
export interface Assigned {
  id: number;
  categoryId: number | null;
  category: string | null;
  categorySource: 'RULE' | 'MANUAL' | null;
  rule: Rule | null;
  /** what "apply to all" would change after the new rule */
  preview: Applied | null;
}

export interface NewRule {
  pattern: string;
  direction: Direction | null;
  onlyThisAccount: boolean;
}

export type Cadence = 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'UNKNOWN';

export interface CategoryCost {
  id: number;
  name: string;
  total: number;
  monthly: number | null;
  yearly: number | null;
  thisMonth: number;
  movements: number;
}

export interface Upcoming {
  categoryId: number;
  category: string;
  ruleId: number | null;
  rule: string | null;
  currency: string;
  cadence: Cadence;
  expectedOn: string | null;
  amount: number;
  last: string;
  payments: number;
  late: boolean;
}

export interface OtherCurrencyCost {
  currency: string;
  total: number;
  monthly: number | null;
  yearly: number | null;
  thisMonth: number;
}

/** GET /api/fixed-costs: over the last complete months; only euro, the other currencies apart */
export interface FixedCosts {
  currency: string;
  months: number;
  monthsUsed: number;
  from: string;
  to: string;
  /** this month, yyyy-MM */
  month: string;
  monthly: number | null;
  yearly: number | null;
  setAside: number | null;
  roundingStep: number;
  thisMonth: number;
  categories: CategoryCost[];
  upcoming: Upcoming[];
  otherCurrencies: OtherCurrencyCost[];
  uncategorized: number;
}

export const CADENCE_LABELS: Record<Cadence, MessageKey> = {
  MONTHLY: 'costs.cadence.MONTHLY',
  BIMONTHLY: 'costs.cadence.BIMONTHLY',
  QUARTERLY: 'costs.cadence.QUARTERLY',
  SEMIANNUAL: 'costs.cadence.SEMIANNUAL',
  ANNUAL: 'costs.cadence.ANNUAL',
  UNKNOWN: 'costs.cadence.UNKNOWN'
};

/** the codes of a 400 and where they go: next to a field (`field`) or under the form */
export const SERVER_ERRORS: Record<string, { key: MessageKey; field?: 'name' | 'pattern' | 'category' | 'account' }> = {
  NAME_REQUIRED: {key: 'costs.error.nameRequired', field: 'name'},
  NAME_TOO_LONG: {key: 'costs.error.nameTooLong', field: 'name'},
  NAME_TAKEN: {key: 'costs.error.nameTaken', field: 'name'},
  PATTERN_REQUIRED: {key: 'costs.error.patternRequired', field: 'pattern'},
  PATTERN_TOO_SHORT: {key: 'costs.error.patternTooShort', field: 'pattern'},
  PATTERN_TOO_LONG: {key: 'costs.error.patternTooLong', field: 'pattern'},
  RULE_EXISTS: {key: 'costs.error.ruleExists', field: 'pattern'},
  CATEGORY: {key: 'costs.error.category', field: 'category'},
  ACCOUNT: {key: 'costs.error.account', field: 'account'},
  DIRECTION: {key: 'common.failed'},
  TOO_MANY: {key: 'costs.error.tooMany'}
};

export const MAX_NAME = 60;
export const MIN_PATTERN = 2;
export const MAX_PATTERN = 100;

/** the same checks as the server, so the error is written next to the field before sending */
export function checkName(name: string): MessageKey | null {
  const clean = name.trim().replace(/\s+/g, ' ');
  return !clean ? 'costs.error.nameRequired' : clean.length > MAX_NAME ? 'costs.error.nameTooLong' : null;
}

export function checkPattern(pattern: string): MessageKey | null {
  const clean = pattern.trim().replace(/\s+/g, ' ');
  return !clean ? 'costs.error.patternRequired' : clean.length < MIN_PATTERN ? 'costs.error.patternTooShort'
    : clean.length > MAX_PATTERN ? 'costs.error.patternTooLong' : null;
}

/** a text for a rule out of a description: without the long numbers and dates the bank adds, at most 40 characters */
export function suggestPattern(description: string): string {
  const words = description.replace(/\s+/g, ' ').trim().split(' ')
    .filter(w => !/\d{3,}|\d+[/.-]\d+/.test(w));
  const text = (words.length ? words : description.trim().split(' ')).join(' ');
  return text.length > 40 ? text.substring(0, 40).replace(/\s+\S*$/, '') || text.substring(0, 40) : text;
}

@Injectable({providedIn: 'root'})
export class CostsService {
  private http = inject(HttpClient);

  overview(): Observable<CategoriesOverview> {
    return this.http.get<CategoriesOverview>('/api/categories').pipe(timeout(CALL_TIMEOUT_MS));
  }

  createCategory(name: string, fixed: boolean): Observable<Category> {
    return this.http.post<Category>('/api/categories', {name, fixed}).pipe(timeout(CALL_TIMEOUT_MS));
  }

  updateCategory(id: number, name: string, fixed: boolean): Observable<Category> {
    return this.http.put<Category>(`/api/categories/${id}`, {name, fixed}).pipe(timeout(CALL_TIMEOUT_MS));
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`/api/categories/${id}`).pipe(timeout(CALL_TIMEOUT_MS));
  }

  saveRule(id: number | null, rule: { categoryId: number; pattern: string; direction: Direction | null;
    accountId: string | null }): Observable<Rule> {
    return (id === null ? this.http.post<Rule>('/api/categories/rules', rule)
      : this.http.put<Rule>(`/api/categories/rules/${id}`, rule)).pipe(timeout(CALL_TIMEOUT_MS));
  }

  deleteRule(id: number): Observable<void> {
    return this.http.delete<void>(`/api/categories/rules/${id}`).pipe(timeout(CALL_TIMEOUT_MS));
  }

  /** `dryRun`: only how many movements would change */
  apply(dryRun: boolean): Observable<Applied> {
    return this.http.post<Applied>('/api/categories/apply', {dryRun}).pipe(timeout(CALL_TIMEOUT_MS));
  }

  /** the category of one movement by hand (null: none), optionally with a rule made from it */
  assign(movementId: number, categoryId: number | null, rule: NewRule | null): Observable<Assigned> {
    return this.http.put<Assigned>(`/api/movements/${movementId}/category`, {categoryId, rule})
      .pipe(timeout(CALL_TIMEOUT_MS));
  }

  fixedCosts(months = 12): Observable<FixedCosts> {
    return this.http.get<FixedCosts>('/api/fixed-costs', {params: {months}}).pipe(timeout(CALL_TIMEOUT_MS));
  }
}

/** the name of a month alone, "November" / "novembre", from yyyy-MM */
export function monthOnly(locale: string, yearMonth: string): string {
  const date = new Date(yearMonth.substring(0, 7) + '-01T00:00:00');
  return isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale, {month: 'long'}).format(date);
}
