import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {Instrument, InstrumentsComponent} from './instruments.component';
import {I18nService} from '../i18n/i18n.service';

describe('InstrumentsComponent', () => {
  let http: HttpTestingController;

  const iwda: Instrument = {
    isin: 'IE00B4L5Y983', name: 'iShares Core MSCI World', symbol: 'IWDA.LON', manual: false, source: 'alphavantage',
    quoteCurrency: 'USD', investmentCurrency: 'EUR', currencyWarning: true, lastPrice: 110.5, lastDate: '2026-11-20',
    prices: 800
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function open() {
    const fixture = TestBed.createComponent(InstrumentsComponent);
    fixture.detectChanges();
    http.expectOne('/api/instruments').flush({instruments: [iwda], alphaVantage: true, alphaVantageLeftToday: 20});
    fixture.detectChanges();
    return fixture;
  }

  it('shows symbol, source, last price and the warning on a currency that is not the euro', () => {
    const el: HTMLElement = open().nativeElement;
    expect(el.textContent).toContain('Symbol: IWDA.LON');
    expect(el.textContent).toContain('Source: Alpha Vantage');
    expect(el.textContent).toContain('Last price: 110.50 USD on 20 Nov 2026');
    expect(el.querySelector('.warning')?.textContent).toContain('quoted in USD');
    expect(el.textContent).toContain('requests left today: 20');
  });

  it('is in Italian, with Italian numbers and dates, when the language is Italian', () => {
    TestBed.inject(I18nService).setLang('it');
    const el: HTMLElement = open().nativeElement;
    expect(el.textContent).toContain('Simbolo: IWDA.LON');
    expect(el.textContent).toContain('Fonte: Alpha Vantage');
    expect(el.textContent).toContain('Ultimo prezzo: 110,50 USD del 20 nov 2026');
    expect(el.querySelector('.warning')?.textContent).toContain('quota in USD');
  });

  it('previews a symbol, then saves it and tells the graph', () => {
    const fixture = open();
    const page = fixture.componentInstance;
    let changed = 0;
    page.changed.subscribe(() => changed++);

    page.edit(iwda);
    page.symbol = 'IWDA.AMS';
    page.showPreview(iwda.isin);
    const preview = http.expectOne(r => r.url === '/api/instruments/preview');
    expect(preview.request.params.get('symbol')).toBe('IWDA.AMS');
    preview.flush({symbol: 'IWDA.AMS', name: 'iShares', currency: 'EUR', currencyWarning: false, lastPrice: 122.34,
      lastDate: '2026-11-25', weeks: 898});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('last price 122.34 EUR on 25 Nov 2026');

    page.save(iwda.isin);
    const put = http.expectOne('/api/instruments/IE00B4L5Y983/symbol');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({symbol: 'IWDA.AMS'});
    put.flush({...iwda, symbol: 'IWDA.AMS', manual: true, quoteCurrency: 'EUR', currencyWarning: false, lastPrice: 122.34});
    fixture.detectChanges();
    expect(changed).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Symbol: IWDA.AMS (chosen by hand)');
    expect(fixture.nativeElement.querySelector('.warning')).toBeNull();
  });

  it('shows why a preview failed', () => {
    const fixture = open();
    const page = fixture.componentInstance;
    page.edit(iwda);
    page.symbol = 'NOPE';
    page.showPreview(iwda.isin);
    http.expectOne(r => r.url === '/api/instruments/preview')
      .flush({message: 'Alpha Vantage non ha prezzi per questo simbolo'}, {status: 404, statusText: 'Not Found'});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')?.textContent).toContain('non ha prezzi');
    expect(page.busy()).toBe(false);
  });

  it('flags a quote in an unknown currency', () => {
    const fixture = TestBed.createComponent(InstrumentsComponent);
    fixture.detectChanges();
    http.expectOne('/api/instruments').flush({alphaVantage: true, alphaVantageLeftToday: 3,
      instruments: [{...iwda, symbol: 'SWDA.LON', quoteCurrency: null, currencyWarning: true}]});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.warning')?.textContent).toContain('an unknown currency');
  });

  it('a failed list says so, with "Retry"', () => {
    const fixture = TestBed.createComponent(InstrumentsComponent);
    fixture.detectChanges();
    http.expectOne('/api/instruments').flush('', {status: 500, statusText: 'Server Error'});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')?.textContent).toContain('Retry');
  });
});
