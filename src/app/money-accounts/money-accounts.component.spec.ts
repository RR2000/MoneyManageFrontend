import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {MoneyAccount, MoneyAccountsComponent} from './money-accounts.component';
import {I18nService} from '../i18n/i18n.service';

// made-up data only
function account(overrides: Partial<MoneyAccount> = {}): MoneyAccount {
  return {name: 'Conto vecchio', rows: 120, fileRows: 100, manualRows: 20, bankRows: 0, firstDate: '2024-01-02',
    lastDate: '2026-10-31', linked: false, ...overrides};
}

describe('MoneyAccountsComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function open(list: MoneyAccount[] = [account(), account({name: 'Banca', rows: 5, fileRows: 0, manualRows: 0,
    bankRows: 5, linked: true})]) {
    const fixture = TestBed.createComponent(MoneyAccountsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=status] .spinner')).not.toBeNull();
    http.expectOne('/api/money-accounts').flush(list);
    fixture.detectChanges();
    return {fixture, el: fixture.nativeElement as HTMLElement};
  }

  const buttons = (el: HTMLElement, text: string) =>
    Array.from(el.querySelectorAll('button')).filter(b => b.textContent?.trim() === text);

  it('lists the accounts with where their rows come from, in words', () => {
    const {el} = open();
    const items = el.querySelectorAll('.link');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('h2')?.textContent).toBe('Conto vecchio');
    expect(items[0].textContent).toContain('120 movements, from 2 Jan 2024 to 31 Oct 2026');
    expect(items[0].textContent).toContain('from a file: 100');
    expect(items[0].textContent).toContain('typed in: 20');
    expect(items[0].textContent).not.toContain('from the bank');
    expect(items[1].textContent).toContain('A bank imports here');
    expect(items[1].textContent).toContain('from the bank: 5');
    expect(buttons(items[1] as HTMLElement, 'Delete account...').length).toBe(0);
    expect(items[1].querySelector('a')?.getAttribute('href')).toBe('/banks');
  });

  it('deletes an account only when its name is typed again', async () => {
    const {fixture, el} = open();
    buttons(el, 'Delete account...')[0].click();
    fixture.detectChanges();
    expect(el.querySelector('.confirm')?.textContent)
      .toContain('120 movements (from 2 Jan 2024 to 31 Oct 2026) and their daily balances disappear');
    const yes = () => buttons(el, 'Delete for good')[0];
    expect(yes().disabled).toBe(true);
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
    expect(yes().disabled).toBe(false);
    yes().click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Deleting...');
    const del = http.expectOne('/api/money-accounts/delete');
    expect(del.request.body).toEqual({name: 'Conto vecchio', confirm: 'Conto vecchio'});
    del.flush({name: 'Conto vecchio', rows: 120});
    fixture.detectChanges();
    expect(el.querySelector('.banner-ok')?.textContent).toContain('Conto vecchio deleted (120 movements).');
    expect(el.querySelectorAll('.link').length).toBe(1);
  });

  it('an error of the server is said in words and nothing disappears', async () => {
    const {fixture, el} = open([account()]);
    buttons(el, 'Delete account...')[0].click();
    fixture.detectChanges();
    const input = el.querySelector('.confirm input') as HTMLInputElement;
    input.value = 'Conto vecchio';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    buttons(el, 'Delete for good')[0].click();
    http.expectOne('/api/money-accounts/delete').flush({status: 409, error: 'Conflict', message: 'ACCOUNT_LINKED'},
      {status: 409, statusText: 'Conflict'});
    fixture.detectChanges();
    expect(el.querySelector('[role=alert].error-text')?.textContent).toContain('A bank imports into this account');
    expect(el.querySelectorAll('.link').length).toBe(1);
  });

  it('is in Italian when the language is Italian', () => {
    TestBed.inject(I18nService).setLang('it');
    const {el} = open([account()]);
    expect(el.querySelector('h1')?.textContent).toBe('Conti');
    expect(el.textContent).toContain('da file: 100');
    expect(buttons(el, 'Elimina conto...').length).toBe(1);
  });
});
