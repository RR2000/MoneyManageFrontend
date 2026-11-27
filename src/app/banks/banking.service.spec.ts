import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {BankingService} from './banking.service';

describe('BankingService', () => {
  let http: HttpTestingController;
  let banking: BankingService;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('auth_token', 'token-1');
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
    banking = TestBed.inject(BankingService);
  });

  afterEach(() => http.verify());

  it('a 404 on the links means the feature is off: hidden', () => {
    banking.checkAvailability();
    expect(banking.available()).toBeNull();
    http.expectOne('/api/banking/links').flush('', {status: 404, statusText: 'Not Found'});
    expect(banking.available()).toBe(false);
  });

  it('any other answer shows it, and it is asked once per login', () => {
    banking.checkAvailability();
    http.expectOne('/api/banking/links').flush([]);
    expect(banking.available()).toBe(true);
    banking.checkAvailability();
    http.expectNone('/api/banking/links');

    localStorage.setItem('auth_token', 'token-2');
    banking.checkAvailability();
    http.expectOne('/api/banking/links').flush('', {status: 500, statusText: 'Server Error'});
    expect(banking.available()).toBe(true);

    localStorage.removeItem('auth_token');
    banking.checkAvailability();
    expect(banking.available()).toBeNull();
  });

  it('calls the endpoints of the contract', () => {
    banking.aspsps('FI').subscribe();
    const aspsps = http.expectOne(r => r.url === '/api/banking/aspsps');
    expect(aspsps.request.params.get('country')).toBe('FI');
    aspsps.flush([]);

    let url = '';
    banking.startLink('Banca Finta', 'IT').subscribe(a => url = a.url);
    const start = http.expectOne('/api/banking/links');
    expect(start.request.method).toBe('POST');
    expect(start.request.body).toEqual({aspsp: 'Banca Finta', country: 'IT'});
    start.flush({url: 'https://bank.example.com/consent'});
    expect(url).toBe('https://bank.example.com/consent');

    banking.setMoneyAccount('acc 1', 'Conto nuovo').subscribe();
    const put = http.expectOne('/api/banking/accounts/acc%201');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({moneyAccount: 'Conto nuovo'});
    put.flush({});

    banking.sync().subscribe();
    expect(http.expectOne('/api/banking/sync').request.method).toBe('POST');

    banking.unlink('l1').subscribe();
    expect(http.expectOne('/api/banking/links/l1').request.method).toBe('DELETE');
  });

  it('the list of links turns the menu off on a 404', () => {
    banking.links().subscribe({error: () => undefined});
    http.expectOne('/api/banking/links').flush('', {status: 404, statusText: 'Not Found'});
    expect(banking.available()).toBe(false);
  });
});
