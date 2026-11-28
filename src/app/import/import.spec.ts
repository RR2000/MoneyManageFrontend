import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {ImportPageComponent, parseAmount} from './import-page.component';

// made-up data only
describe('Import', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const accountsCall = () => http.expectOne('/api/banks/transactions/accounts');

  function open() {
    const fixture = TestBed.createComponent(ImportPageComponent);
    fixture.detectChanges();
    return {fixture, page: fixture.componentInstance, el: fixture.nativeElement as HTMLElement};
  }

  it('three boxes with a real title; the accounts load at once, with a skeleton, and an empty account offers sample data', () => {
    const {fixture, el} = open();
    expect(text(el.querySelector('h1'))).toBe('Import files');
    expect(Array.from(el.querySelectorAll('h2')).map(text)).toEqual(
      ['1Movements of a bank', '2Transactions of the broker (Degiro)', "3Today's balances"]);
    expect(el.querySelector('app-load-state [role=status]')).toBeTruthy();
    accountsCall().flush([]);
    fixture.detectChanges();
    expect(text(el.querySelector('app-load-state'))).toContain('No account yet');
    expect(text(el.querySelector('.sample app-sample-data button'))).toBe('Load sample data');
    // every field has its label
    for (const input of Array.from(el.querySelectorAll('input, select'))) {
      expect(el.querySelector(`label[for="${input.id}"]`)).toBeTruthy();
    }
  });

  it('a bank file goes to the bank chosen, then the accounts are read again; a refusal says the server\'s reason', () => {
    const {fixture, page, el} = open();
    accountsCall().flush(['Conto di prova']);
    fixture.detectChanges();
    page.bankName = 'Unicredit';
    page.bankFile = new File(['a,b'], 'prova.csv', {type: 'text/csv'});
    page.uploadBank();
    fixture.detectChanges();
    expect(text(el.querySelector('[role=status]'))).toBe('Uploading...');
    const call = http.expectOne('/api/banks/transactions/Unicredit/upload');
    expect(call.request.body instanceof FormData).toBe(true);
    call.flush([{}, {}, {}]);
    accountsCall().flush(['Conto di prova', 'Unicredit']);
    fixture.detectChanges();
    expect(text(el.querySelector('.line.ok'))).toBe('3 movements uploaded.');
    expect(el.querySelectorAll('input[type=text]').length).toBe(2);

    page.uploadBank();
    http.expectOne('/api/banks/transactions/Unicredit/upload')
      .flush({message: 'Not a file of Unicredit'}, {status: 400, statusText: 'Bad Request'});
    fixture.detectChanges();
    expect(text(el.querySelector('[role=alert]'))).toBe('Error: Not a file of Unicredit');
  });

  it('today\'s balances: only the written ones, each checked and sent in the body, the outcome under each', () => {
    const {fixture, page, el} = open();
    accountsCall().flush(['Conto di prova', 'Risparmi di prova', 'Altro conto']);
    fixture.detectChanges();
    page.saveBalances();
    fixture.detectChanges();
    expect(text(el.querySelector('[role=alert]'))).toBe('Write the balance of at least one account.');

    page.rows()[0].value = '1.234,56';
    page.rows()[1].value = 'tanti';
    page.saveBalances();
    fixture.detectChanges();
    expect(el.querySelector('#import-balance-1')?.getAttribute('aria-invalid')).toBe('true');
    expect(text(el.querySelector('#import-balance-1-out'))).toBe('Write a number, e.g. 1234.56.');

    page.rows()[1].value = '-20';
    page.saveBalances();
    const first = http.expectOne('/api/banks/transactions/accounts/Conto%20di%20prova/balance');
    expect(first.request.body).toEqual({amountToday: 1234.56});
    first.flush({});
    http.expectOne('/api/banks/transactions/accounts/Risparmi%20di%20prova/balance')
      .flush({message: 'No movements'}, {status: 400, statusText: 'Bad Request'});
    fixture.detectChanges();
    expect(text(el.querySelector('#import-balance-0-out'))).toBe('Saved.');
    expect(text(el.querySelector('#import-balance-1-out'))).toBe('Error: No movements');
    expect(el.querySelector('#import-balance-2-out')).toBeNull();
    expect(text(el.querySelector('form [role=alert]'))).toBe('1 balance was not saved: see the reason under it.');
  });

  it('reads amounts written the Italian or the English way', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('-20')).toBe(-20);
    expect(parseAmount('12,5 €')).toBe(12.5);
    expect(parseAmount('dodici')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
});
