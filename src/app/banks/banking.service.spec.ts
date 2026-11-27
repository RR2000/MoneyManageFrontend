import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {HttpErrorResponse} from '@angular/common/http';
import {BankingService, errorCode} from './banking.service';

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

  it('the account says whether the feature is there for this user', () => {
    banking.checkAvailability();
    expect(banking.available()).toBeNull();
    http.expectOne('/api/account').flush({username: 'demo', email: null, emailLinks: false, banking: true});
    expect(banking.available()).toBe(true);
    banking.checkAvailability();
    http.expectNone('/api/account');

    localStorage.setItem('auth_token', 'token-2');
    banking.checkAvailability();
    http.expectOne('/api/account').flush({username: 'other', email: null, emailLinks: false, banking: false});
    expect(banking.available()).toBe(false);
    http.expectNone('/api/banking/links');

    localStorage.removeItem('auth_token');
    banking.checkAvailability();
    expect(banking.available()).toBeNull();
  });

  it('without the flag, a 404 on the links means off and any other answer on', () => {
    banking.checkAvailability();
    http.expectOne('/api/account').flush({username: 'demo', email: null, emailLinks: false});
    http.expectOne('/api/banking/links').flush('', {status: 404, statusText: 'Not Found'});
    expect(banking.available()).toBe(false);

    localStorage.setItem('auth_token', 'token-2');
    banking.checkAvailability();
    http.expectOne('/api/account').flush('', {status: 500, statusText: 'Server Error'});
    http.expectOne('/api/banking/links').flush('', {status: 500, statusText: 'Server Error'});
    expect(banking.available()).toBe(true);
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

    banking.setMoneyAccount(7, 'Conto nuovo').subscribe();
    const put = http.expectOne('/api/banking/accounts/7');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({moneyAccount: 'Conto nuovo'});
    put.flush({});

    banking.sync().subscribe();
    expect(http.expectOne('/api/banking/sync').request.method).toBe('POST');

    banking.unlink(3).subscribe();
    expect(http.expectOne('/api/banking/links/3').request.method).toBe('DELETE');
  });

  it('the list of links turns the menu off on a 404', () => {
    banking.links().subscribe({error: () => undefined});
    http.expectOne('/api/banking/links').flush('', {status: 404, statusText: 'Not Found'});
    expect(banking.available()).toBe(false);
  });

  it('reads the error code the backend puts in message, never a sentence', () => {
    const error = (body: unknown) => new HttpErrorResponse({status: 400, error: body});
    expect(errorCode(error({message: 'UNKNOWN_ASPSP'}))).toBe('UNKNOWN_ASPSP');
    expect(errorCode(error({message: 'Something went wrong'}))).toBeNull();
    expect(errorCode(error(null))).toBeNull();
    expect(errorCode(new Error('x'))).toBeNull();
  });
});
