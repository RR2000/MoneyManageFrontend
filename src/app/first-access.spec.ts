import {Type} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting, TestRequest} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {HomeComponent} from './home/home.component';
import {AccountsPageComponent} from './accounts/accounts-page.component';
import {InvestmentsPageComponent} from './investments/investments-page.component';
import {CostsPageComponent} from './costs/costs-page.component';
import {RulesPageComponent} from './costs/rules-page.component';
import {UncategorizedPageComponent} from './costs/uncategorized-page.component';
import {PlanPageComponent} from './plan/plan-page.component';
import {AssetsPageComponent} from './assets/assets-page.component';
import {ImportPageComponent} from './import/import-page.component';
import {SettingsPageComponent} from './settings/settings-page.component';
import {BankingService} from './banks/banking.service';

/**
 * The first access: every page with the answers the backend gives a user who has just registered (copied from the
 * backend, FirstAccessTests, user without sample data). Each page must settle on its "nothing yet" boxes: no error,
 * no skeleton left, no "NaN", "undefined" or "Infinity" on screen. Made-up data only.
 */
const TODAY = '2026-11-28';
const ZERO = {date: TODAY, cash: 0, investments: 0, realEstate: 0, otherAssets: 0, debts: 0, total: 0};
const EMPTY: Record<string, unknown> = {
  'GET /api/account': {emailLinks: false, email: null, username: 'prova', banking: false},
  'GET /api/auth/providers': {password: true, github: false, passwordReset: false, oidc: false},
  'GET /api/money-accounts': [],
  'GET /api/money-accounts/movements/latest': [],
  'POST /api/money-accounts/movements': {items: [], hasMore: false},
  'GET /api/banks/transactions/accounts': [],
  'GET /api/categories': {categories: [], rules: [], uncategorized: 0},
  'GET /api/fixed-costs': {currency: 'EUR', months: 12, monthsUsed: 0, from: '2026-11-01', to: '2026-10-31',
    month: '2026-11', monthly: null, yearly: null, setAside: null, roundingStep: 10, thisMonth: 0.0, categories: [],
    upcoming: [], otherCurrencies: [], uncategorized: 0},
  'GET /api/investments': {currency: 'EUR', today: TODAY, taxRate: 0.26, positions: [], closed: 0,
    totals: {invested: 0, value: 0, gain: 0, gainShare: null, tax: 0, netGain: 0, realized: 0.0, fees: 0.0, bought: 0.0,
      sold: 0.0},
    performance: {since: null, days: 0, xirr: null, simpleGain: 0, simple: null, twr: null, twrYearly: null,
      netInLastYear: 0.0},
    allocation: {slices: [], assignedPercent: 0, unassignedPercent: 100}, history: [],
    excluded: {instruments: 0, currencies: [], withoutPrice: 0}},
  'GET /api/net-worth': {currency: 'EUR', from: TODAY, today: ZERO, before: {...ZERO, date: '2026-10-29'}, points: [ZERO],
    accounts: 0, realEstates: 0, otherAssets: 0, debts: 0, instruments: 0,
    excluded: {accounts: 0, realEstates: 0, otherAssets: 0, debts: 0, currencies: []}},
  'GET /api/plans': {money: {date: TODAY, currency: 'EUR', value: 0, invested: 0, monthly: 0.0, monthlyMonths: 0,
    historicalRate: null, since: null}, plans: []},
  'GET /api/instruments': {alphaVantage: false, instruments: [], alphaVantageLeftToday: 25},
  'GET /api/assets': {currency: 'EUR', today: TODAY, realEstates: [], otherAssets: [], debts: [],
    totals: [{currency: 'EUR', realEstate: 0, otherAssets: 0, debts: 0, net: 0}]}
};

const PAGES: [string, Type<unknown>][] = [
  ['/', HomeComponent],
  ['/accounts', AccountsPageComponent],
  ['/investments', InvestmentsPageComponent],
  ['/costs', CostsPageComponent],
  ['/costs/rules', RulesPageComponent],
  ['/costs/uncategorized', UncategorizedPageComponent],
  ['/plan', PlanPageComponent],
  ['/assets', AssetsPageComponent],
  ['/import', ImportPageComponent],
  ['/settings', SettingsPageComponent]
];

describe('First access: every page of an empty account', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
    // as after GET /api/account in the shell: no open banking for a new user
    TestBed.inject(BankingService).available.set(false);
  });

  /** answers every call the page makes, as the backend does for an empty account, until the page asks nothing more */
  async function settle(fixture: ComponentFixture<unknown>, asked: string[]): Promise<void> {
    for (let round = 0; round < 10; round++) {
      fixture.detectChanges();
      await fixture.whenStable();
      const pending: TestRequest[] = http.match(() => true);
      if (pending.length === 0) {
        return;
      }
      for (const req of pending) {
        const key = `${req.request.method} ${req.request.url}`;
        asked.push(key);
        if (!(key in EMPTY)) {
          throw new Error('no empty answer for ' + key);
        }
        req.flush(EMPTY[key] as object);
      }
    }
  }

  for (const [path, page] of PAGES) {
    it(`${path} says "nothing yet" and nothing else`, async () => {
      const fixture = TestBed.createComponent(page);
      const asked: string[] = [];
      await settle(fixture, asked);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const text = el.textContent ?? '';
      expect(text).not.toMatch(/\bNaN\b|\bundefined\b|\bnull\b|Infinity|\[object Object\]/);
      expect(el.querySelector('.box.error, [role=alert]')).toBeNull();
      expect(el.querySelector('.skel')).toBeNull();
      if (path !== '/settings') {
        expect(asked.length).toBeGreaterThan(0);
        // a sentence that says what is missing, with the way to fill it
        expect(el.querySelector('app-load-state .box.empty')).not.toBeNull();
      }
      fixture.destroy();
    });
  }
});
