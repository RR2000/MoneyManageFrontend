import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {MainComponentComponent} from './main-component.component';

describe('MainComponentComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
  });

  function open() {
    const fixture = TestBed.createComponent(MainComponentComponent);
    fixture.componentInstance.getDataAndRenderComponents();
    return fixture.componentInstance;
  }

  const bankGraph = (r: { url: string }) => r.url.startsWith('/api/banks/transactions/graph/');
  const brokerGraph = '/api/brokers/transactions/worth/graph';

  it('a failed graph stops loading and says so; "Riprova" asks again', () => {
    const main = open();
    expect(main.brokerGraphLoading()).toBe(true);
    http.expectOne(brokerGraph).flush('', {status: 500, statusText: 'Server Error'});
    expect(main.brokerGraphLoading()).toBe(false);
    expect(main.brokerGraphError()).not.toBe('');

    main.refreshBrokerGraph();
    expect(main.brokerGraphLoading()).toBe(true);
    http.expectOne(brokerGraph).flush({uniqueGraphNames: ['X'], uniqueLabels: ['2026-01-01'], graphData: {X: {'2026-01-01': 1}}});
    expect(main.brokerGraphLoading()).toBe(false);
    expect(main.brokerGraphError()).toBe('');

    http.expectOne(bankGraph).flush('', {status: 504, statusText: 'Gateway Timeout'});
    expect(main.bankGraphLoading()).toBe(false);
    expect(main.bankGraphError()).not.toBe('');
    http.expectOne('/api/banks/transactions/accounts').flush('', {status: 500, statusText: 'Server Error'});
    expect(main.accountsError()).not.toBe('');
  });

  it('the periodic refresh keeps the chart on screen when it fails', () => {
    const main = open();
    http.expectOne(brokerGraph).flush({uniqueGraphNames: ['X'], uniqueLabels: ['2026-01-01'], graphData: {X: {'2026-01-01': 1}}});
    main.refreshBrokerGraph(true);
    expect(main.brokerGraphLoading()).toBe(false);
    http.expectOne(brokerGraph).flush('', {status: 500, statusText: 'Server Error'});
    expect(main.brokerGraphError()).toBe('');
    expect(main.brokerGraph().uniqueGraphNames).toEqual(['X']);
    http.expectOne(bankGraph).flush({});
    http.expectOne('/api/banks/transactions/accounts').flush([]);
  });
});
