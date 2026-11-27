import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ActivatedRoute, convertToParamMap, provideRouter, Router} from '@angular/router';
import {BanksComponent} from './banks.component';
import {BankLink, REDIRECT} from './banking.service';
import {I18nService} from '../i18n/i18n.service';

// made-up data only
const NOW = new Date('2026-06-01T10:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function link(overrides: Partial<BankLink> = {}): BankLink {
  return {
    id: 'l1', aspsp: 'Banca Finta', country: 'IT', status: 'ACTIVE',
    validUntil: new Date(NOW + 60 * DAY).toISOString(), lastSync: '2026-06-01T06:00:00Z', lastError: null,
    accounts: [{id: 'a1', iban: 'IT** **** **** 0000', currency: 'EUR', moneyAccount: 'Conto finto',
      balance: {amount: 1234.5, type: 'CLAV', date: '2026-05-31'}}],
    ...overrides
  };
}

describe('BanksComponent', () => {
  let http: HttpTestingController;
  let redirect: ReturnType<typeof vi.fn>;
  let query: Record<string, string>;

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    redirect = vi.fn();
    query = {};
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        {provide: REDIRECT, useValue: redirect},
        {provide: ActivatedRoute, useFactory: () => ({snapshot: {queryParamMap: convertToParamMap(query)}})}
      ]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  function open(links: BankLink[] = [link()], moneyAccounts = ['Conto finto', 'Risparmi']) {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BanksComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=status] .spinner')).not.toBeNull();
    http.expectOne('/api/banking/links').flush(links);
    http.expectOne('/api/banks/transactions/accounts').flush(moneyAccounts);
    fixture.detectChanges();
    return {fixture, page: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, navigate};
  }

  const buttons = (el: HTMLElement, text: string) =>
    Array.from(el.querySelectorAll('button')).filter(b => b.textContent?.trim() === text);

  it('shows each link: status in words, expiry, last sync, the accounts with balance and money account', async () => {
    const {fixture, el} = open();
    await fixture.whenStable();
    expect(el.querySelector('h2')?.textContent).toBe('Banca Finta');
    expect(el.querySelector('.status')?.textContent).toContain('Active');
    expect(el.textContent).toContain('Expires in 60 days');
    expect(el.querySelector('.banner-warning')).toBeNull();
    expect(el.textContent).toContain('Last sync: 1 Jun 2026');
    expect(el.querySelector('.iban')?.textContent).toContain('IT** **** **** 0000');
    expect(el.textContent).toContain('Balance €1,234.50 (available, 31 May 2026)');
    expect((el.querySelector('.money-account select') as HTMLSelectElement).value).toBe('Conto finto');
  });

  it('warns 14 days before the consent expires, and says the last error in words', () => {
    const {el} = open([link({validUntil: new Date(NOW + 10 * DAY + 3600_000).toISOString(), lastError: 'ASPSP_UNAVAILABLE'}),
      link({id: 'l2', aspsp: 'Altra Banca', status: 'ERROR', lastError: 'SOMETHING_NEW', validUntil: null})]);
    const warnings = el.querySelectorAll('.banner-warning');
    expect(warnings.length).toBe(1);
    expect(warnings[0].textContent).toContain('The consent expires in 10 days');
    expect(warnings[0].textContent).toContain('Reconnect');
    expect(el.textContent).toContain('Last error: the bank is not answering right now');
    expect(el.textContent).toContain('Last error: unexpected error (code SOMETHING_NEW).');
    expect(el.querySelectorAll('.status')[1].textContent).toContain('Error');
  });

  it('an expired consent says so, also when the status was not updated yet', () => {
    const {el} = open([link({validUntil: new Date(NOW - 2 * DAY).toISOString()})]);
    expect(el.querySelector('.status')?.textContent).toContain('Expired');
    expect(el.querySelector('.banner-warning')?.textContent).toContain('The consent expired');
  });

  it('the page is in Italian when the language is Italian', () => {
    TestBed.inject(I18nService).setLang('it');
    const {el} = open([link({validUntil: new Date(NOW + 5 * DAY + 3600_000).toISOString()})]);
    expect(el.querySelector('h1')?.textContent).toBe('Banche');
    expect(el.textContent).toContain('Scade tra 5 giorni');
    expect(el.textContent).toContain('Saldo 1234,50');
    expect(buttons(el, 'Sincronizza ora').length).toBe(1);
  });

  it('shows the outcome of the bank\'s redirect once, and removes it from the address', () => {
    query = {result: 'error'};
    const {el, navigate} = open([]);
    expect(el.querySelector('.banner-error')?.textContent).toContain('The bank was not linked');
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({queryParams: {result: null}, replaceUrl: true}));
    expect(el.textContent).toContain('No bank linked yet.');
  });

  it('a 404 means the feature is off: back to the dashboard', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BanksComponent);
    fixture.detectChanges();
    http.expectOne('/api/banking/links').flush('', {status: 404, statusText: 'Not Found'});
    http.expectOne('/api/banks/transactions/accounts').flush([]);
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('links a bank: country, filter by name, then the browser goes to the bank', () => {
    const {fixture, page, el} = open([]);
    buttons(el, 'Link a bank')[0].click();
    fixture.detectChanges();
    expect(el.querySelector('.picker [role=status]')?.textContent).toContain('Loading the banks');
    http.expectOne(r => r.url === '/api/banking/aspsps' && r.params.get('country') === 'IT')
      .flush([{name: 'Banca Uno', country: 'IT'}, {name: 'Crédit Finto', country: 'IT', logo: 'https://logo.example.com/c.png'}]);
    fixture.detectChanges();
    expect(el.querySelectorAll('.aspsps button').length).toBe(2);

    page.setFilter('credit');
    fixture.detectChanges();
    const found = el.querySelectorAll('.aspsps button');
    expect(found.length).toBe(1);
    expect(found[0].textContent).toContain('Crédit Finto');

    page.setCountry('LT');
    http.expectOne(r => r.url === '/api/banking/aspsps' && r.params.get('country') === 'LT')
      .flush([{name: 'Credit Online', country: 'LT'}]);
    fixture.detectChanges();
    (el.querySelector('.aspsps button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.picker [role=status]')?.textContent).toContain('Opening Credit Online');
    expect((el.querySelector('.aspsps button') as HTMLButtonElement).disabled).toBe(true);
    const start = http.expectOne('/api/banking/links');
    expect(start.request.body).toEqual({aspsp: 'Credit Online', country: 'LT'});
    start.flush({url: 'https://bank.example.com/consent?x=1'});
    expect(redirect).toHaveBeenCalledWith('https://bank.example.com/consent?x=1');
  });

  it('a long list shows the first banks and "Show all"', () => {
    const {fixture, page, el} = open([]);
    page.openPicker();
    http.expectOne(r => r.url === '/api/banking/aspsps')
      .flush(Array.from({length: 45}, (_, i) => ({name: `Banca ${String(i).padStart(2, '0')}`, country: 'IT'})));
    fixture.detectChanges();
    expect(el.querySelectorAll('.aspsps button').length).toBe(30);
    expect(el.textContent).toContain('Showing 30 of 45');
    buttons(el, 'Show all (45)')[0].click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.aspsps button').length).toBe(45);
  });

  it('"Reconnect" asks a new consent for the same bank', () => {
    const {el} = open();
    buttons(el, 'Reconnect')[0].click();
    const start = http.expectOne('/api/banking/links');
    expect(start.request.method).toBe('POST');
    expect(start.request.body).toEqual({aspsp: 'Banca Finta', country: 'IT'});
    start.flush('', {status: 502, statusText: 'Bad Gateway'});
  });

  it('links an account to an existing money account, or to a new one', async () => {
    const {fixture, page, el} = open([link({accounts: [{id: 'a1', iban: null, currency: 'EUR', balance: null, moneyAccount: null}]})]);
    expect(el.textContent).toContain('not imported until you choose an account');
    const account = page.links()![0].accounts[0];

    page.choose(account, 'Risparmi');
    fixture.detectChanges();
    expect(el.querySelector('.account [role=status]')?.textContent).toContain('Saving');
    const put = http.expectOne('/api/banking/accounts/a1');
    expect(put.request.body).toEqual({moneyAccount: 'Risparmi'});
    put.flush('', {status: 500, statusText: 'Server Error'});
    fixture.detectChanges();
    expect(el.querySelector('.account [role=alert]')?.textContent).toContain('Could not save the account');
    expect(page.selectValue(account)).toBe('');

    page.choose(account, page.NEW_ACCOUNT);
    fixture.detectChanges();
    page.newName = '  Conto nuovo ';
    page.createNew(account);
    http.expectOne('/api/banking/accounts/a1').flush({});
    http.expectOne('/api/banking/links').flush([link({accounts: [{...account, moneyAccount: 'Conto nuovo'}]})]);
    fixture.detectChanges();
    expect(page.moneyAccounts()).toContain('Conto nuovo');
    expect(el.querySelector('.account .ok')?.textContent).toContain('Saved.');
    await fixture.whenStable();
    expect((el.querySelector('.money-account select') as HTMLSelectElement).value).toBe('Conto nuovo');
  });

  it('"Sync now" waits visibly, then reads the links again', () => {
    const {fixture, el} = open();
    buttons(el, 'Sync now')[0].click();
    fixture.detectChanges();
    expect(buttons(el, 'Syncing...')[0].disabled).toBe(true);
    http.expectOne('/api/banking/sync').flush(null);
    http.expectOne('/api/banking/links').flush([link({lastSync: '2026-06-01T09:59:00Z'})]);
    fixture.detectChanges();
    expect(el.textContent).toContain('Sync done.');
  });

  it('"Unlink" asks first, then removes the link', () => {
    const {fixture, el} = open();
    buttons(el, 'Unlink')[0].click();
    fixture.detectChanges();
    expect(el.querySelector('.banner-warning')?.textContent).toContain('Unlink Banca Finta? The movements already imported stay.');
    buttons(el, 'Keep it')[0].click();
    fixture.detectChanges();
    http.expectNone('/api/banking/links/l1');

    buttons(el, 'Unlink')[0].click();
    fixture.detectChanges();
    buttons(el, 'Yes, unlink')[0].click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Unlinking...');
    const del = http.expectOne('/api/banking/links/l1');
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    fixture.detectChanges();
    expect(el.querySelector('.link')).toBeNull();
    expect(el.textContent).toContain('No bank linked yet.');
  });
});
