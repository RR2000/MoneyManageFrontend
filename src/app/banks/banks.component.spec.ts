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
    id: 1, aspsp: 'Banca Finta', country: 'IT', status: 'ACTIVE',
    validUntil: new Date(NOW + 60 * DAY).toISOString(), lastSyncAt: '2026-06-01T06:00:00Z', lastError: null,
    lastAmbiguous: 0,
    accounts: [{id: 11, name: 'Conto di prova', iban: 'IT **** 0000', currency: 'EUR', moneyAccount: 'Conto finto',
      balance: {amount: 1234.5, currency: 'EUR', type: 'CLBD', date: '2026-05-31'}}],
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
    expect(el.querySelector('.account-name')?.textContent).toBe('Conto di prova');
    expect(el.querySelector('.iban')?.textContent).toContain('IT **** 0000');
    expect(el.textContent).toContain('Balance €1,234.50 (booked, 31 May 2026)');
    expect((el.querySelector('.money-account select') as HTMLSelectElement).value).toBe('Conto finto');
  });

  it('warns 14 days before the consent expires, and says the last error in words', () => {
    const {el} = open([link({validUntil: new Date(NOW + 10 * DAY + 3600_000).toISOString(), lastError: 'UNREACHABLE',
      lastAmbiguous: 2}),
      link({id: 2, aspsp: 'Altra Banca', status: 'REVOKED', lastError: 'SOMETHING_NEW', validUntil: null})]);
    const warnings = el.querySelectorAll('.banner-warning');
    expect(warnings.length).toBe(2);
    expect(warnings[0].textContent).toContain('The consent expires in 10 days');
    expect(warnings[0].textContent).toContain('Reconnect');
    expect(warnings[1].textContent).toContain('The consent was withdrawn');
    expect(el.textContent).toContain('Last error: the bank could not be reached');
    expect(el.textContent).toContain('2 movements were already there in more than one row');
    expect(el.textContent).toContain('Last error: unexpected error (code SOMETHING_NEW).');
    expect(el.querySelectorAll('.status')[1].textContent).toContain('Withdrawn');
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

  it('a logo that does not load becomes the initial of the bank', () => {
    const {fixture, page, el} = open([]);
    page.openPicker();
    http.expectOne(r => r.url === '/api/banking/aspsps')
      .flush([{name: 'Banca Uno', country: 'IT', logo: 'https://logo.example.com/uno.png'},
        {name: 'élan Finto', country: 'IT', logo: 'https://logo.example.com/elan.png'}]);
    fixture.detectChanges();
    const logos = el.querySelectorAll<HTMLImageElement>('.aspsps img');
    // the name is written next to the logo in the same button: a screen reader must not read it twice
    expect([...logos].map(img => img.getAttribute('alt'))).toEqual(['', '']);
    expect(el.querySelector('.logo-fallback')).toBeNull();

    logos[1].dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelectorAll('.aspsps img').length).toBe(1);
    const fallback = el.querySelector('.aspsps .logo-fallback');
    expect(fallback?.textContent?.trim()).toBe('É');
    expect(fallback?.getAttribute('aria-hidden')).toBe('true');
    expect(fallback?.getAttribute('role')).toBeNull();
    expect(fallback?.closest('button')?.textContent).toContain('élan Finto');
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

  it('"Not imported" stops the import of an account', () => {
    const {page} = open();
    page.choose(page.links()![0].accounts[0], page.NO_ACCOUNT);
    const put = http.expectOne('/api/banking/accounts/11');
    expect(put.request.body).toEqual({moneyAccount: null});
    put.flush({});
    http.expectOne('/api/banking/links').flush([]);
  });

  it('links an account to an existing money account, or to a new one', async () => {
    const {fixture, page, el} = open([link({accounts: [{id: 11, iban: null, currency: 'EUR', balance: null, moneyAccount: null}]})]);
    expect(el.textContent).toContain('not imported until you choose an account');
    const account = page.links()![0].accounts[0];

    page.choose(account, 'Risparmi');
    fixture.detectChanges();
    expect(el.querySelector('.account [role=status]')?.textContent).toContain('Saving');
    const put = http.expectOne('/api/banking/accounts/11');
    expect(put.request.body).toEqual({moneyAccount: 'Risparmi'});
    put.flush({status: 409, error: 'Conflict', message: 'MONEY_ACCOUNT_TAKEN'}, {status: 409, statusText: 'Conflict'});
    fixture.detectChanges();
    expect(el.querySelector('.account [role=alert]')?.textContent)
      .toContain('Another account of the same bank already goes to this money account');
    expect(page.selectValue(account)).toBe(page.NO_ACCOUNT);

    page.choose(account, page.NEW_ACCOUNT);
    fixture.detectChanges();
    page.newName = '  Conto nuovo ';
    page.createNew(account);
    http.expectOne('/api/banking/accounts/11').flush({});
    fixture.detectChanges();
    expect(el.querySelector('.account [role=status]')?.textContent).toContain('reading the movements again');
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
    http.expectOne('/api/banking/sync').flush({imported: 3, matched: 1, ambiguous: 0,
      links: [link({lastSyncAt: '2026-06-01T09:59:00Z'})]});
    fixture.detectChanges();
    expect(el.textContent).toContain('Sync done: 3 new movements.');
    expect(el.textContent).toContain('Last sync: 1 Jun 2026');
  });

  it('"Unlink" asks first, then removes the link', () => {
    const {fixture, el} = open();
    buttons(el, 'Unlink')[0].click();
    fixture.detectChanges();
    expect(el.querySelector('.banner-warning')?.textContent).toContain('Unlink Banca Finta? The movements already imported stay.');
    buttons(el, 'Keep it')[0].click();
    fixture.detectChanges();
    http.expectNone('/api/banking/links/1');

    buttons(el, 'Unlink')[0].click();
    fixture.detectChanges();
    buttons(el, 'Yes, unlink')[0].click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Unlinking...');
    const del = http.expectOne('/api/banking/links/1');
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    fixture.detectChanges();
    expect(el.querySelector('.link')).toBeNull();
    expect(el.textContent).toContain('No bank linked yet.');
  });

  function historyLink(): BankLink {
    return link({accounts: [{id: 11, name: 'Conto di prova', iban: 'IT **** 0000', currency: 'EUR',
      moneyAccount: 'Conto finto', balance: {amount: 1234.5, currency: 'EUR', type: 'CLBD', date: '2026-05-31'},
      bankFrom: '2026-03-01', firstDate: '2025-01-10', extraRows: 7, olderRows: 40}]});
  }

  const preview = {token: 'tok-finto', bankFrom: '2026-03-01', deleted: 7, added: 3, matched: 50, otherCurrency: 0,
    older: 40, currency: 'EUR', todayBefore: 1234.5, todayAfter: 1234.5, startBefore: 900, startAfter: 880.25};

  it('says how far back the bank\'s history goes, and what is left from files', () => {
    const {el} = open([historyLink()]);
    expect(el.textContent).toContain('History from the bank since 1 Mar 2026.');
    expect(el.textContent).toContain('Oldest movement of the account: 10 Jan 2025.');
    expect(el.textContent).toContain('7 rows from a file or typed in since 1 Mar 2026 are not movements of the bank');
  });

  it('"Replace with the bank\'s data" shows a preview, then replaces only after "Yes"', () => {
    const {fixture, el} = open([historyLink()]);
    buttons(el, 'Replace with the bank\'s data')[0].click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Reading the history...');
    expect(el.textContent).toContain('Nothing changes yet.');
    http.expectOne('/api/banking/accounts/11/replace/preview').flush(preview);
    fixture.detectChanges();
    const summary = el.querySelector('.confirm')?.textContent ?? '';
    expect(summary).toContain('Replace the movements of Conto finto with the bank\'s, from 1 Mar 2026 on');
    expect(summary).toContain('7 rows from a file or typed in are deleted');
    expect(summary).toContain('3 movements of the bank are added');
    expect(summary).toContain('50 rows from a file are movements of the bank and stay');
    expect(summary).toContain('40 rows before 1 Mar 2026 stay');
    expect(summary).toContain('Balance today: €1,234.50 before, €1,234.50 after');
    expect(summary).toContain('Balance the day before 1 Mar 2026: €900.00 before, €880.25 after');

    // cancel: nothing sent
    buttons(el, 'Cancel')[0].click();
    fixture.detectChanges();
    http.expectNone('/api/banking/accounts/11/replace');
    expect(el.querySelector('.confirm')).toBeNull();

    buttons(el, 'Replace with the bank\'s data')[0].click();
    http.expectOne('/api/banking/accounts/11/replace/preview').flush(preview);
    fixture.detectChanges();
    buttons(el, 'Yes, replace')[0].click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Replacing...');
    const replace = http.expectOne('/api/banking/accounts/11/replace');
    expect(replace.request.body).toEqual({token: 'tok-finto'});
    replace.flush({...preview, token: null});
    fixture.detectChanges();
    expect(el.textContent).toContain('Done: 7 rows deleted, 3 movements added, balances computed again.');
    http.expectOne('/api/banking/links').flush([historyLink()]);
  });

  it('an old preview says so, in words', () => {
    const {fixture, el} = open([historyLink()]);
    buttons(el, 'Replace with the bank\'s data')[0].click();
    http.expectOne('/api/banking/accounts/11/replace/preview').flush(preview);
    fixture.detectChanges();
    buttons(el, 'Yes, replace')[0].click();
    http.expectOne('/api/banking/accounts/11/replace').flush({status: 409, error: 'Conflict', message: 'PREVIEW_EXPIRED'},
      {status: 409, statusText: 'Conflict'});
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('The preview is too old or the data changed');
  });

  it('the older rows are deleted apart, with their own confirmation', () => {
    const {fixture, el} = open([historyLink()]);
    buttons(el, 'Delete also the 40 older rows (before 1 Mar 2026)...')[0].click();
    fixture.detectChanges();
    expect(el.querySelector('.confirm')?.textContent)
      .toContain('Delete from Conto finto the 40 rows from a file or typed in before 1 Mar 2026?');
    buttons(el, 'Yes, delete them')[0].click();
    const del = http.expectOne('/api/banking/accounts/11/delete-older');
    expect(del.request.body).toEqual({before: '2026-03-01'});
    del.flush({deleted: 40});
    fixture.detectChanges();
    expect(el.textContent).toContain('40 older rows deleted.');
    http.expectOne('/api/banking/links').flush([historyLink()]);
  });

  it('without an active consent the replacement waits for a reconnect', () => {
    const {el} = open([{...historyLink(), status: 'EXPIRED'}]);
    expect(buttons(el, 'Replace with the bank\'s data')[0].disabled).toBe(true);
    expect(el.textContent).toContain('It needs an active consent');
  });

  it('"Reconnect and import the whole history" asks the consent with fullHistory', () => {
    const {el} = open();
    expect(el.textContent).toContain('Revolut gives the whole history only in the first 5 minutes');
    buttons(el, 'Reconnect and import the whole history')[0].click();
    const start = http.expectOne('/api/banking/links');
    expect(start.request.body).toEqual({aspsp: 'Banca Finta', country: 'IT', fullHistory: true});
    start.flush({url: 'https://bank.example.com/consent'});
    expect(redirect).toHaveBeenCalledWith('https://bank.example.com/consent');
  });

  it('an account not imported yet of a consent older than 5 minutes: the history may be short', () => {
    const fresh = link({createdAt: new Date(NOW - 2 * 60 * 1000).toISOString(),
      accounts: [{id: 11, iban: null, currency: 'EUR', balance: null, moneyAccount: null}]});
    const late = link({id: 2, aspsp: 'Altra Banca', createdAt: new Date(NOW - 10 * 60 * 1000).toISOString(),
      accounts: [{id: 12, iban: null, currency: 'EUR', balance: null, moneyAccount: null}]});
    const {el} = open([fresh, late]);
    const items = el.querySelectorAll('.link');
    expect(items[0].textContent).not.toContain('only the last 90 days');
    expect(items[1].textContent).toContain('some banks (Revolut) now give only the last 90 days');
  });
});
