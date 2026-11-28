import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter, Router} from '@angular/router';
import {AccountsPageComponent} from './accounts-page.component';
import {AccountPageComponent} from './account-page.component';
import {AccountDetail, Movement, MoneyAccount} from './accounts.service';
import {MovementsComponent} from './movements.component';
import {DeleteAccountComponent} from './delete-account.component';
import {I18nService} from '../i18n/i18n.service';

// made-up data only
function account(overrides: Partial<MoneyAccount> = {}): MoneyAccount {
  return {id: 'a1b2c3d4e5f6', name: 'Conto vecchio', rows: 120, fileRows: 100, manualRows: 20, bankRows: 0,
    firstDate: '2024-01-02', lastDate: '2026-10-31', linked: false, balance: 1520.5, currency: 'EUR', ...overrides};
}

function detail(overrides: Partial<AccountDetail> = {}): AccountDetail {
  return {id: 'a1b2c3d4e5f6', name: 'Conto vecchio', currency: 'EUR', balance: 1520.5, balanceDate: '2026-11-27',
    monthIn: 2400, monthOut: -1912.3, rows: 120, firstDate: '2024-01-02', lastDate: '2026-11-27', linked: false, ...overrides};
}

function movement(id: number, datetime: string, description: string, amount: number,
                  source: Movement['source'] = 'FILE'): Movement {
  return {id, datetime, description, amount, currency: 'EUR', source, balance: null};
}

describe('Accounts', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const buttons = (el: HTMLElement, text: string) =>
    Array.from(el.querySelectorAll('button')).filter(b => b.textContent?.trim() === text);

  it('lists the accounts with balance and a link to their page; the total per currency', () => {
    const fixture = TestBed.createComponent(AccountsPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-load-state [role=status]')).toBeTruthy();
    http.expectOne('/api/money-accounts').flush([account(),
      account({id: '0123456789ab', name: 'Risparmi', balance: 8000, linked: true, rows: 1})]);
    fixture.detectChanges();
    const links = Array.from(el.querySelectorAll('.list a'));
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/accounts/a1b2c3d4e5f6', '/accounts/0123456789ab']);
    expect(links[0].textContent).toContain('€1,520.50');
    expect(links[0].textContent).toContain('120 movements');
    expect(links[1].textContent).toContain('bank');
    expect(links[1].textContent).toContain('1 movement');
    expect(el.querySelector('.tile')?.textContent).toContain('€9,520.50');
  });

  it('no account yet: says so with the way to import; a failure has Retry', () => {
    const fixture = TestBed.createComponent(AccountsPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/money-accounts').flush('', {status: 500, statusText: 'Server Error'});
    fixture.detectChanges();
    buttons(el, 'Retry')[0].click();
    http.expectOne('/api/money-accounts').flush([]);
    fixture.detectChanges();
    expect(el.textContent).toContain('No account yet.');
    expect(el.querySelector('app-load-state a')?.getAttribute('href')).toBe('/import');
  });

  it('the address of an account that is not there: says so and leads to the accounts, no Retry', () => {
    const fixture = TestBed.createComponent(AccountPageComponent);
    fixture.componentRef.setInput('id', '000000000000');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/money-accounts/000000000000').flush({status: 404}, {status: 404, statusText: 'Not Found'});
    fixture.detectChanges();
    expect(el.textContent).toContain('This account is not there');
    expect(el.querySelector('[role=alert]')).toBeNull();
    expect(buttons(el, 'Retry').length).toBe(0);
    expect(el.querySelector('app-load-state a')?.getAttribute('href')).toBe('/accounts');
    // any other failure is still an error with Retry
    const other = TestBed.createComponent(AccountPageComponent);
    other.componentRef.setInput('id', 'a1b2c3d4e5f6');
    other.detectChanges();
    http.expectOne('/api/money-accounts/a1b2c3d4e5f6').flush('', {status: 500, statusText: 'Server Error'});
    other.detectChanges();
    expect(buttons(other.nativeElement, 'Retry').length).toBe(1);
  });

  it('the page of an account: balance, month, chart by period, movements', () => {
    const fixture = TestBed.createComponent(AccountPageComponent);
    fixture.componentRef.setInput('id', 'a1b2c3d4e5f6');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/money-accounts/a1b2c3d4e5f6').flush(detail());
    fixture.detectChanges();
    expect(el.querySelector('h1')?.textContent).toBe('Conto vecchio');
    expect(el.querySelector('.crumb a')?.getAttribute('href')).toBe('/accounts');
    expect(el.querySelector('app-figure .big')?.textContent).toBe('€1,520.50');
    expect(el.querySelector('.sum3')?.textContent).toContain('+\u2060€2,400.00');
    expect(el.querySelector('.sum3')?.textContent).toContain('−\u2060€1,912.30');
    expect(el.querySelector('.sum3')?.textContent).toContain('+\u2060€487.70');

    const six = http.expectOne(r => r.url === '/api/money-accounts/a1b2c3d4e5f6/balances');
    expect(six.request.params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    six.flush([{date: '2026-11-20', balance: 1400}, {date: '2026-11-27', balance: 1520.5}]);
    http.expectOne('/api/money-accounts/a1b2c3d4e5f6/movements').flush({items: [], hasMore: false});
    fixture.detectChanges();
    expect(el.querySelector('app-chart canvas')).toBeTruthy();

    buttons(el, 'All')[0].click();
    const all = http.expectOne(r => r.url === '/api/money-accounts/a1b2c3d4e5f6/balances');
    expect(all.request.params.has('from')).toBe(false);
    all.flush([]);
    fixture.detectChanges();
    expect(el.textContent).toContain('No balance in this period.');
    // not linked: it can be deleted from here
    expect(buttons(el, 'Delete account...').length).toBe(1);
  });

  it('movements: a list by day with their origin, search in the body, filter and "load more"', async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    const fixture = TestBed.createComponent(MovementsComponent);
    fixture.componentRef.setInput('accountId', 'a1b2c3d4e5f6');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const first = http.expectOne('/api/money-accounts/a1b2c3d4e5f6/movements');
    expect(first.request.method).toBe('POST');
    expect(first.request.body).toEqual({q: '', kind: 'ALL', uncategorized: false, offset: 0, limit: 50});
    first.flush({items: [
      movement(3, '2026-11-27T19:00:00', 'Supermercato Esempio', -64.2, 'BANK'),
      movement(2, '2026-11-27T08:00:00', 'Stipendio', 2400, 'BANK'),
      movement(1, '2026-11-25T10:00:00', 'Cena', -35, 'MANUAL')], hasMore: true});
    fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('.day')).length).toBe(2);
    const rows = Array.from(el.querySelectorAll('.row'));
    expect(rows[0].textContent).toContain('−\u2060€64.20');
    expect(rows[0].textContent).toContain('bank');
    expect(rows[1].textContent).toContain('+\u2060€2,400.00');
    expect(rows[2].textContent).toContain('by hand');

    buttons(el, 'Load 50 more')[0].click();
    const more = http.expectOne('/api/money-accounts/a1b2c3d4e5f6/movements');
    expect(more.request.body.offset).toBe(3);
    more.flush({items: [movement(0, '2026-11-20T10:00:00', 'Farmacia', -18.9)], hasMore: false});
    fixture.detectChanges();
    expect(el.querySelectorAll('.row').length).toBe(4);
    expect(buttons(el, 'Load 50 more').length).toBe(0);

    const input = el.querySelector('input[type=search]') as HTMLInputElement;
    input.value = '64,20';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(400);
    const search = http.expectOne('/api/money-accounts/a1b2c3d4e5f6/movements');
    expect(search.request.body).toEqual({q: '64,20', kind: 'ALL', uncategorized: false, offset: 0, limit: 50});
    search.flush({items: [], hasMore: false});
    fixture.detectChanges();
    expect(el.textContent).toContain('No movement matches.');

    buttons(el, 'Money in')[0].click();
    const filtered = http.expectOne('/api/money-accounts/a1b2c3d4e5f6/movements');
    expect(filtered.request.body.kind).toBe('IN');
    filtered.flush({items: [], hasMore: false});
    vi.useRealTimers();
  });

  it('deletes an account only when its name is typed again', async () => {
    const fixture = TestBed.createComponent(DeleteAccountComponent);
    fixture.componentRef.setInput('name', 'Conto vecchio');
    fixture.componentRef.setInput('rows', 120);
    fixture.componentRef.setInput('firstDate', '2024-01-02');
    fixture.componentRef.setInput('lastDate', '2026-10-31');
    let done = '';
    fixture.componentInstance.deleted.subscribe(text => done = text);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    buttons(el, 'Delete account...')[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('.confirm')?.textContent)
      .toContain('120 movements (from 2 Jan 2024 to 31 Oct 2026) and their daily balances disappear');
    const yes = () => buttons(el, 'Delete for good')[0];
    const input = el.querySelector('.confirm input') as HTMLInputElement;
    input.value = 'conto vecchio';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(yes().disabled).toBe(true);
    input.value = 'Conto vecchio';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(yes().disabled).toBe(false);
    yes().click();
    const del = http.expectOne('/api/money-accounts/delete');
    expect(del.request.body).toEqual({name: 'Conto vecchio', confirm: 'Conto vecchio'});
    del.flush({name: 'Conto vecchio', rows: 120});
    expect(done).toBe('Conto vecchio deleted (120 movements).');
  });

  it('an error of the delete is said in words', async () => {
    const fixture = TestBed.createComponent(DeleteAccountComponent);
    fixture.componentRef.setInput('name', 'Conto vecchio');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    buttons(el, 'Delete account...')[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    const input = el.querySelector('.confirm input') as HTMLInputElement;
    input.value = 'Conto vecchio';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    buttons(el, 'Delete for good')[0].click();
    http.expectOne('/api/money-accounts/delete').flush({status: 409, error: 'Conflict', message: 'ACCOUNT_LINKED'},
      {status: 409, statusText: 'Conflict'});
    fixture.detectChanges();
    expect(el.querySelector('[role=alert].error-text')?.textContent).toContain('A bank imports into this account');
  });

  it('is in Italian when the language is Italian', () => {
    TestBed.inject(I18nService).setLang('it');
    const fixture = TestBed.createComponent(AccountsPageComponent);
    fixture.detectChanges();
    http.expectOne('/api/money-accounts').flush([account()]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toBe('Conti');
    expect(fixture.nativeElement.querySelector('.list')?.textContent).toContain('120 movimenti');
  });

  it('after a delete the list says what was deleted', async () => {
    const router = TestBed.inject(Router);
    router.resetConfig([{path: 'accounts', component: AccountsPageComponent}]);
    await router.navigate(['/accounts'], {state: {message: 'Conto vecchio deleted (120 movements).'}});
    const fixture = TestBed.createComponent(AccountsPageComponent);
    fixture.detectChanges();
    http.expectOne('/api/money-accounts').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.done')?.textContent).toContain('Conto vecchio deleted');
  });
});
