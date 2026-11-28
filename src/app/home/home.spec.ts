import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {HomeComponent} from './home.component';
import {daysSince, LatestMovement, NetWorth, NetWorthPoint} from './home.service';
import {BankingService, BankLink} from '../banks/banking.service';
import {Instrument} from '../instruments/instruments.component';
import {isoDay} from '../accounts/account-page.component';
import {I18nService} from '../i18n/i18n.service';
import {FixedCosts} from '../costs/costs.service';

// made-up data only
function point(date: string, cash: number, investments = 0, realEstate = 0, otherAssets = 0, debts = 0): NetWorthPoint {
  return {date, cash, investments, realEstate, otherAssets, debts, total: cash + investments + realEstate + otherAssets + debts};
}

function netWorth(overrides: Partial<NetWorth> = {}): NetWorth {
  const today = point(isoDay(new Date()), 10000, 20000, 150000);
  return {currency: 'EUR', from: '2025-11-28', today, before: point('2026-10-29', 9000, 19000, 150000),
    points: [point('2025-11-28', 5000, 10000, 150000), point('2026-05-31', 8000, 15000, 150000), today],
    accounts: 2, realEstates: 1, otherAssets: 0, debts: 0, instruments: 1,
    excluded: {accounts: 0, realEstates: 0, otherAssets: 0, debts: 0, currencies: []}, ...overrides};
}

function movement(id: number, description: string, amount: number, daysAgo = 0): LatestMovement {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {id, accountId: 'a1b2c3d4e5f6', account: 'Conto di prova', datetime: isoDay(d) + 'T10:00:00',
    description, amount, currency: 'EUR', source: 'BANK'};
}

function instrument(overrides: Partial<Instrument> = {}): Instrument {
  return {isin: 'XX0000000001', name: 'ETF di prova', symbol: null, manual: false, source: 'esempio',
    quoteCurrency: 'EUR', investmentCurrency: 'EUR', currencyWarning: false, lastPrice: 90, lastDate: isoDay(new Date()),
    prices: 10, ...overrides};
}

function costs(overrides: Partial<FixedCosts> = {}): FixedCosts {
  return {currency: 'EUR', months: 12, monthsUsed: 0, from: '2026-11-01', to: '2026-10-31', month: '2026-11', monthly: null,
    yearly: null, setAside: null, roundingStep: 10, thisMonth: 0, categories: [], upcoming: [], otherCurrencies: [],
    uncategorized: 0, ...overrides};
}

function link(overrides: Partial<BankLink> = {}): BankLink {
  return {id: 1, aspsp: 'Banca di prova', country: 'IT', status: 'ACTIVE',
    validUntil: new Date(Date.now() + 9.5 * 86400000).toISOString(), lastSyncAt: '2026-11-28T06:30:00Z', lastError: null,
    accounts: [], ...overrides};
}

describe('Home', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function open(banking: boolean | null = false) {
    TestBed.inject(BankingService).available.set(banking);
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    return fixture;
  }

  const netWorthCall = () => http.expectOne(r => r.url === '/api/net-worth');
  const latestCall = () => http.expectOne(r => r.url === '/api/money-accounts/movements/latest');
  const instrumentsCall = () => http.expectOne('/api/instruments');
  const flushInstruments = (list: Instrument[]) => instrumentsCall().flush({instruments: list, alphaVantage: false,
    alphaVantageLeftToday: 0});
  const costsCall = () => http.expectOne(r => r.url === '/api/fixed-costs');
  const flushCosts = (answer: FixedCosts = costs()) => costsCall().flush(answer);
  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('waits with skeletons, then net worth with its 30-day change, the parts, the latest movements', () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toBe('Overview');
    expect(el.querySelectorAll('app-load-state [role=status]').length).toBe(4);
    expect(el.querySelectorAll('.tile .skel').length).toBeGreaterThan(0);

    const call = netWorthCall();
    // one year by default
    expect(call.request.params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    call.flush(netWorth());
    latestCall().flush([movement(1, 'Spesa di prova', -64.2), movement(2, 'Stipendio di prova', 2400, 1)]);
    flushInstruments([instrument()]);
    flushCosts();
    fixture.detectChanges();

    expect(text(el.querySelector('app-figure .big'))).toBe('€180,000');
    expect(text(el.querySelector('app-figure .delta'))).toBe('+€2,000 in 30 days (+1.1%)');
    expect(el.querySelector('app-figure .delta app-icon')).toBeTruthy();
    expect(el.querySelector('app-chart canvas')?.getAttribute('aria-label')).toContain('Net worth from');

    const tiles = Array.from(el.querySelectorAll('.tiles .tile'));
    expect(tiles.map(t => text(t.querySelector('.label')))).toEqual(['Cash', 'Investments', 'Property and assets', 'Debts']);
    expect(text(tiles[0])).toContain('€10,000');
    expect(text(tiles[0])).toContain('2 accounts · 6% of the total');
    expect(tiles[1].getAttribute('href')).toBe('/investments');
    expect(text(tiles[2])).toContain('1 property, 0 assets');
    expect(tiles[2].getAttribute('href')).toBe('/assets');
    expect(text(tiles[3])).toContain('none recorded');
    expect(tiles[3].getAttribute('href')).toBe('/assets');

    const rows = Array.from(el.querySelectorAll('.rows li'));
    expect(text(rows[0])).toContain('Spesa di prova');
    expect(text(rows[0].querySelector('.amt'))).toBe('−€64.20');
    expect(text(rows[0].querySelector('.m'))).toContain('Today');
    expect(rows[0].querySelector('.m a')?.getAttribute('href')).toBe('/accounts/a1b2c3d4e5f6');
    expect(rows[0].querySelector('app-source-tag')).toBeTruthy();
    expect(text(rows[1].querySelector('.amt'))).toBe('+€2,400.00');
    expect(text(rows[1].querySelector('.m'))).toContain('Yesterday');

    // nothing to do: said in words, with an icon
    expect(text(el.querySelector('.all-good'))).toBe('Nothing to do: everything is up to date.');
    expect(el.querySelector('.all-good app-icon')).toBeTruthy();
    // without open banking: no "Sync now", no call to the bank links
    expect(Array.from(el.querySelectorAll('button')).some(b => text(b) === 'Sync now')).toBe(false);
    expect(el.querySelector('.classic a')?.getAttribute('href')).toBe('/classic');
  });

  it('a new period asks again from its date and keeps the figure on screen', () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    netWorthCall().flush(netWorth());
    latestCall().flush([]);
    flushInstruments([]);
    flushCosts();
    fixture.detectChanges();
    const all = Array.from(el.querySelectorAll<HTMLButtonElement>('.ranges button')).find(b => text(b) === 'All')!;
    all.click();
    fixture.detectChanges();
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('app-figure')).toBeTruthy();
    const call = netWorthCall();
    expect(call.request.params.has('from')).toBe(false);
    call.flush(netWorth());
    fixture.detectChanges();
    expect(el.querySelector('app-chart')).toBeTruthy();

    Array.from(el.querySelectorAll<HTMLButtonElement>('.ranges button')).find(b => text(b) === '6M')!.click();
    const six = netWorthCall();
    const from = new Date(six.request.params.get('from') + 'T00:00:00');
    expect(Math.round((Date.now() - from.getTime()) / 86400000)).toBeGreaterThan(170);
    six.flush(netWorth());
  });

  it('to do: consents about to end, failed syncs, prices that stopped; "Sync now" reloads', () => {
    const fixture = open(true);
    const el: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/banking/links').flush([link(), link({id: 2, aspsp: 'Altra banca', lastError: 'RATE_LIMIT',
      validUntil: new Date(Date.now() + 90 * 86400000).toISOString()}), link({id: 3, aspsp: 'Banca scaduta', status: 'EXPIRED'})]);
    netWorthCall().flush(netWorth());
    latestCall().flush([movement(1, 'Spesa di prova', -10)]);
    const old = new Date();
    old.setDate(old.getDate() - 20);
    flushInstruments([instrument(), instrument({isin: 'XX2', name: 'Fondo fermo', lastDate: isoDay(old)}),
      instrument({isin: 'XX3', name: 'Senza prezzo', lastDate: null, lastPrice: null})]);
    flushCosts();
    fixture.detectChanges();

    const items = Array.from(el.querySelectorAll('.todo li'));
    const titles = items.map(li => text(li.querySelector('.t')));
    expect(titles).toEqual([
      'Banca di prova: the consent ends in 9 days',
      'Altra banca: the last sync did not work',
      'Banca scaduta: the consent has ended',
      `Fondo fermo: price stuck since ${TestBed.inject(I18nService).date(isoDay(old))}`,
      'Senza prezzo: no price'
    ]);
    // never the colour alone: every line has its icon and an action
    items.forEach(li => {
      expect(li.querySelector('app-icon')).toBeTruthy();
      expect(li.querySelector('.act a')).toBeTruthy();
    });
    expect(items[0].classList).toContain('warn');
    expect(items[0].querySelector('.act a')?.getAttribute('href')).toBe('/banks');
    expect(text(items[0].querySelector('.act a'))).toBe('Renew');
    expect(items[3].querySelector('.act a')?.getAttribute('href')).toBe('/investments');
    expect(text(el.querySelector('.chip.synced'))).toContain('Synced');

    const sync = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(b => text(b) === 'Sync now')!;
    sync.click();
    fixture.detectChanges();
    expect(sync.disabled).toBe(true);
    http.expectOne('/api/banking/sync').flush({imported: 1, matched: 0, ambiguous: 0, links: [link()]});
    netWorthCall().flush(netWorth());
    latestCall().flush([movement(1, 'Spesa di prova', -10)]);
    flushCosts();
    fixture.detectChanges();
    expect(el.querySelectorAll('.todo li').length).toBe(3);
  });

  it('nothing yet: says so, with the way to import, also in "To do"', () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    netWorthCall().flush(netWorth({accounts: 0, realEstates: 0, instruments: 0, points: [point(isoDay(new Date()), 0)],
      today: point(isoDay(new Date()), 0), before: point('2026-10-29', 0)}));
    latestCall().flush([]);
    flushInstruments([]);
    flushCosts();
    fixture.detectChanges();
    expect(text(el.querySelector('app-load-state'))).toContain('Nothing here yet');
    expect(el.querySelector('.tiles')).toBeNull();
    const todo = el.querySelector('.todo li');
    expect(text(todo?.querySelector('.t'))).toBe('No data yet');
    expect(todo?.querySelector('a')?.getAttribute('href')).toBe('/import');
    expect(text(el.querySelectorAll('app-load-state')[1])).toContain('No movement yet.');
  });

  it('a failed call says so with Retry, card by card', () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    netWorthCall().flush('', {status: 500, statusText: 'Server Error'});
    latestCall().flush('', {status: 500, statusText: 'Server Error'});
    instrumentsCall().flush('', {status: 500, statusText: 'Server Error'});
    costsCall().flush('', {status: 500, statusText: 'Server Error'});
    fixture.detectChanges();
    const retries = Array.from(el.querySelectorAll<HTMLButtonElement>('app-load-state [role=alert] button'));
    expect(retries.length).toBe(4);
    retries.forEach(b => b.click());
    netWorthCall().flush(netWorth());
    latestCall().flush([]);
    flushInstruments([]);
    flushCosts();
    fixture.detectChanges();
    expect(el.querySelector('app-load-state [role=alert]')).toBeNull();
    expect(el.querySelector('app-figure')).toBeTruthy();
  });

  it('accounts in another currency are not in the total, and the page says it', () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    netWorthCall().flush(netWorth({excluded: {accounts: 1, realEstates: 0, otherAssets: 0, debts: 0, currencies: ['USD']}}));
    latestCall().flush([]);
    flushInstruments([]);
    flushCosts();
    fixture.detectChanges();
    expect(text(el.querySelector('.note'))).toBe('One item in USD is not in the total: nothing is converted.');
  });

  it('other assets and debts are in the tiles with their real values and lead to /assets', () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    const today = point(isoDay(new Date()), 10000, 20000, 150000, 12000, -6200);
    netWorthCall().flush(netWorth({today, points: [point('2025-11-28', 5000, 10000, 150000, 12000, -6200), today],
      otherAssets: 2, debts: 1,
      excluded: {accounts: 0, realEstates: 0, otherAssets: 1, debts: 1, currencies: ['CHF', 'USD']}}));
    latestCall().flush([]);
    flushInstruments([]);
    flushCosts();
    fixture.detectChanges();
    const tiles = Array.from(el.querySelectorAll('.tiles .tile'));
    expect(text(tiles[2])).toContain('€162,000');
    expect(text(tiles[2])).toContain('1 property, 2 assets');
    expect(text(tiles[3])).toContain('−€6,200');
    expect(text(tiles[3])).toContain('1 debt');
    expect(tiles[3].getAttribute('href')).toBe('/assets');
    expect(text(el.querySelector('.note'))).toBe('2 items in CHF, USD are not in the total: nothing is converted.');
  });

  it('fixed costs of this month against the average, what to set aside, movements without a category to assign', () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    netWorthCall().flush(netWorth());
    latestCall().flush([]);
    flushInstruments([]);
    flushCosts(costs({monthsUsed: 12, monthly: 612.4, yearly: 7348.8, setAside: 620, thisMonth: 418, uncategorized: 3,
      categories: [{id: 1, name: 'Casa di prova', total: 7348.8, monthly: 612.4, yearly: 7348.8, thisMonth: 418, movements: 12}]}));
    fixture.detectChanges();
    const card = el.querySelector('section.costs')!;
    expect(text(card.querySelector('h2'))).toBe('Fixed costs of November');
    expect(card.querySelector('.card-head a')?.getAttribute('href')).toBe('/costs');
    expect(text(card.querySelector('app-month-bar .line'))).toBe('€418 out of an average of €612 a month');
    // the bar has its words: as its label and written under it
    expect(card.querySelector('app-month-bar .bar')?.getAttribute('aria-label')).toBe('68% of the monthly average');
    expect(text(card.querySelector('app-month-bar .share'))).toBe('68% of the monthly average');
    expect(text(card.querySelector('.aside'))).toBe('To set aside: €620 a month');

    const todo = Array.from(el.querySelectorAll('.todo li')).find(li => text(li.querySelector('.t')) === '3 movements without a category')!;
    expect(todo.querySelector('app-icon')).toBeTruthy();
    expect(todo.querySelector('.act a')?.getAttribute('href')).toBe('/costs/uncategorized');
    expect(text(todo.querySelector('.act a'))).toBe('Assign');
  });

  it('no fixed cost yet: the card says how to start; above the average the bar says by how much', () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    netWorthCall().flush(netWorth());
    latestCall().flush([]);
    flushInstruments([]);
    flushCosts();
    fixture.detectChanges();
    const card = el.querySelector('section.costs')!;
    expect(text(card)).toContain('No fixed cost yet');
    expect(card.querySelector('app-load-state a')?.getAttribute('href')).toBe('/costs/rules');
    expect(el.querySelector('.all-good')).toBeTruthy();
  });

  it('days since a date', () => {
    const now = new Date(2026, 10, 28, 15, 0);
    expect(daysSince('2026-11-28', now)).toBe(0);
    expect(daysSince('2026-11-17T10:00:00', now)).toBe(11);
    expect(daysSince(null, now)).toBeNull();
  });
});
