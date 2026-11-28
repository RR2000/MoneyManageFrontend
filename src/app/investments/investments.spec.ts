import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {InvestmentsPageComponent} from './investments-page.component';
import {AllocationComponent} from './allocation.component';
import {gapKind, Portfolio, Position} from './investments.service';
import {I18nService} from '../i18n/i18n.service';

// made-up data only
function position(overrides: Partial<Position> = {}): Position {
  return {isin: 'XX0000000001', name: 'ETF Mondo (esempio)', currency: 'EUR', inTotal: true, excluded: null,
    quantity: 15, averagePrice: 110.2, invested: 1653, lastPrice: 140, lastDate: '2026-11-26', value: 2100, gain: 447,
    gainShare: 447 / 1653, tax: 116.22, netGain: 330.78, realized: 97, portfolioShare: 1, targetPercent: 60,
    ...overrides};
}

function portfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    currency: 'EUR', today: '2026-11-28', taxRate: 0.26,
    positions: [position(), position({isin: 'US0000000009', name: 'Azione (esempio)', currency: 'USD', inTotal: false,
      excluded: 'CURRENCY', value: 510, gain: 60, gainShare: 0.13, tax: 15.6, netGain: 44.4, realized: 0,
      portfolioShare: null, targetPercent: 15})],
    closed: 0,
    totals: {invested: 1653, value: 2100, gain: 447, gainShare: 447 / 1653, tax: 116.22, netGain: 330.78, realized: 97,
      fees: 6, bought: 2204, sold: 648},
    performance: {since: '2025-10-24', days: 400, xirr: 0.2412, simpleGain: 544, simple: 544 / 2204, twr: 0.3,
      twrYearly: 0.27},
    allocation: {slices: [{isin: 'XX0000000001', name: 'ETF Mondo (esempio)', value: 2100, actualPercent: 100,
      targetPercent: 60, gap: -840}], assignedPercent: 75, unassignedPercent: 25},
    history: [
      {date: '2025-10-24', value: 1000, invested: 1002, byIsin: {XX0000000001: 1000}},
      {date: '2025-10-31', value: 1010, invested: 1002, byIsin: {XX0000000001: 1010}},
      {date: '2026-11-28', value: 2100, invested: 1556, byIsin: {XX0000000001: 2100}}
    ],
    excluded: {instruments: 1, currencies: ['USD'], withoutPrice: 0},
    ...overrides
  };
}

describe('Investments', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const buttons = (el: HTMLElement, text: string) =>
    Array.from(el.querySelectorAll('button')).filter(b => b.textContent?.trim() === text);

  function open(data: Portfolio | null = portfolio()) {
    const fixture = TestBed.createComponent(InvestmentsPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-load-state [role=status]')).toBeTruthy();
    http.expectOne('/api/instruments').flush({instruments: [], alphaVantage: false, alphaVantageLeftToday: 0});
    if (data) {
      http.expectOne('/api/investments').flush(data);
      fixture.detectChanges();
    }
    return fixture;
  }

  it('value, gain, gain after the 26% tax and the returns, with their method written out', () => {
    const el: HTMLElement = open().nativeElement;
    expect(el.querySelector('app-figure')?.textContent).toContain('€2,100');
    const tiles = Array.from(el.querySelectorAll('.tile')).map(t => t.textContent ?? '');
    expect(tiles[0]).toContain('€1,653');
    expect(tiles[1]).toContain('+€447.00');
    expect(tiles[1]).toContain('+27% on the invested');
    expect(tiles[1]).toContain('+€97.00 already taken with sales');
    expect(tiles[2]).toContain('+€330.78');
    expect(tiles[2]).toContain('taxes at 26% on the gain, estimate: €116.22');
    expect(tiles[3]).toContain('+24.1%');
    expect(tiles[3]).toContain('money-weighted (XIRR)');
    expect(tiles[4]).toContain('+27%');
    expect(tiles[4]).toContain('+30% over the whole period');
    // up and down are said by the sign and an arrow, not only by the colour
    expect(el.querySelectorAll('.tile .value.up app-icon').length).toBe(4);
    expect(el.textContent).toContain('Returns computed on your real trades, fees included');
    expect(el.textContent).toContain('Simple gain: +€544 (+24.7%) on €2,204 of purchases');
    expect(el.textContent).toContain('A security in USD is not in the totals: nothing is converted.');
    expect(el.querySelector('details')?.textContent).toContain('Time-weighted (TWR)');
  });

  it('positions: a table and a list, the security in dollars flagged and left out', () => {
    const el: HTMLElement = open().nativeElement;
    const rows = el.querySelectorAll('table.tbl tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('ETF Mondo (esempio)');
    expect(rows[0].textContent).toContain('€110.20');
    expect(rows[0].textContent).toContain('+€447.00');
    expect(rows[0].textContent).toContain('+€330.78');
    expect(rows[0].textContent).toContain('100%');
    expect(rows[1].classList).toContain('out');
    expect(rows[1].textContent).toContain('in USD, not in the totals');
    expect(rows[1].textContent).toContain('$510.00');
    const items = el.querySelectorAll('.plist li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('15 shares');
    expect(items[1].querySelector('.chip.warn')?.textContent).toContain('in USD');
  });

  it('the chart: value and money put in dashed, or one line per security', () => {
    const fixture = open();
    const page = fixture.componentInstance;
    expect(page.chart().series.map(s => s.name)).toEqual(['Value', 'Put in (purchases minus sales)']);
    expect(page.chart().series[1].dash).toBe(1);
    expect(page.chart().series[1].values).toEqual([1002, 1002, 1556]);
    const el: HTMLElement = fixture.nativeElement;
    buttons(el, 'By security')[0].click();
    fixture.detectChanges();
    expect(page.chart().series.map(s => s.name)).toEqual(['ETF Mondo (esempio)']);
    expect(page.chart().series[0].values).toEqual([1000, 1010, 2100]);
  });

  it('a failure says so with Retry; nothing yet leads to the import', () => {
    const fixture = open(null);
    const el: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/investments').flush('', {status: 500, statusText: 'Server Error'});
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Retry');
    buttons(el, 'Retry')[0].click();
    http.expectOne('/api/investments').flush(portfolio({positions: [], closed: 0, history: []}));
    fixture.detectChanges();
    expect(el.textContent).toContain('No investment yet: import the transactions of your broker.');
    expect(el.querySelector('app-load-state a')?.getAttribute('href')).toBe('/import');
  });

  it('is in Italian with the words of the page', () => {
    TestBed.inject(I18nService).setLang('it');
    const el: HTMLElement = open().nativeElement;
    expect(el.textContent).toContain('tasse al 26% sul guadagno, stima');
    expect(el.textContent).toContain('ponderato per il denaro (XIRR)');
    expect(el.textContent).toContain('ora 100% · obiettivo 60%');
  });
});

describe('Allocation', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function open(data = portfolio()) {
    const fixture = TestBed.createComponent(AllocationComponent);
    fixture.componentRef.setInput('portfolio', data);
    fixture.detectChanges();
    return fixture;
  }

  it('the share now and the target in words, a mark at the target and what to do', () => {
    const el: HTMLElement = open().nativeElement;
    expect(el.querySelector('.nums')?.textContent).toContain('now 100%');
    expect(el.querySelector('.nums')?.textContent).toContain('target 60%');
    expect(el.querySelector('.mark')).toBeTruthy();
    expect(el.querySelector('.gap')?.textContent).toContain('€840 over the target');
    expect(el.textContent).toContain('Not assigned: 25%.');

    const buy = open(portfolio({allocation: {slices: [{isin: 'XX0000000001', name: 'ETF', value: 2100,
      actualPercent: 50, targetPercent: 70, gap: 840}], assignedPercent: 70, unassignedPercent: 30}})).nativeElement;
    expect(buy.querySelector('.gap.buy')?.textContent).toContain('buy about €840 to get back to the target');
  });

  it('sets the targets, keeps the one of a security in another currency, refuses more than 100', () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    let changed = 0;
    fixture.componentInstance.changed.subscribe(() => changed++);
    (Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Set targets')) as HTMLButtonElement).click();
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.draft['XX0000000001'] = 101;
    component.touch();
    fixture.detectChanges();
    expect(el.querySelector('.sum.bad')?.textContent).toContain('Assigned 101%');
    expect((el.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true);

    component.draft['XX0000000001'] = 70.5;
    component.touch();
    fixture.detectChanges();
    expect(el.querySelector('.sum')?.textContent).toContain('Assigned 70.5% · not assigned 29.5%');
    component.save();
    const req = http.expectOne('/api/investments/targets');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({targets: [{isin: 'XX0000000001', percent: 70.5},
      {isin: 'US0000000009', percent: 15}]});
    req.flush({targets: [], unassignedPercent: 14.5});
    fixture.detectChanges();
    expect(changed).toBe(1);
    expect(el.querySelector('[role=status]')?.textContent).toContain('Targets saved.');
  });

  it('shows the reason of a refused target', () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    fixture.componentInstance.edit();
    fixture.detectChanges();
    fixture.componentInstance.save();
    http.expectOne('/api/investments/targets').flush({message: 'TARGET_SUM'}, {status: 400, statusText: 'Bad Request'});
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Together the targets go over 100%.');
  });

  it('in line within 1% of the portfolio', () => {
    expect(gapKind(null, 1000)).toBeNull();
    expect(gapKind(5, 1000)).toBe('ok');
    expect(gapKind(-9.9, 1000)).toBe('ok');
    expect(gapKind(20, 1000)).toBe('buy');
    expect(gapKind(-20, 1000)).toBe('over');
  });
});
