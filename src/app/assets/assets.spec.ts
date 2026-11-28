import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {AssetsPageComponent} from './assets-page.component';
import {AssetsAnswer, Debt, duration, emptyDraft, payoffText, requestOf, validate} from './assets.service';
import {I18nService} from '../i18n/i18n.service';

// made-up data only
function debt(overrides: Partial<Debt> = {}): Debt {
  return {id: 7, name: 'Prestito auto (esempio)', balance: 6200, currency: 'EUR', annualRate: 5.9, monthlyPayment: 280,
    endDate: null, payoff: {kind: 'ESTIMATE', expectedEnd: '2028-11-28', monthsLeft: 24}, ...overrides};
}

function answer(overrides: Partial<AssetsAnswer> = {}): AssetsAnswer {
  return {
    currency: 'EUR', today: '2026-11-28',
    realEstates: [{id: 1, name: 'Bilocale (esempio)', address: 'Via dell\'Esempio 1, Milano', purchaseDate: '2019-06-15',
      purchasePrice: 145000, currentEstimatedValue: 168000, monthlyRent: 650, monthlyExpenses: 120, currency: 'EUR'}],
    otherAssets: [
      {id: 3, name: 'Auto (esempio)', kind: 'VEHICLE', value: 9500, currency: 'EUR', valuedOn: '2026-08-01'},
      {id: 4, name: 'Conto in dollari (esempio)', kind: 'CASH', value: 1000, currency: 'USD', valuedOn: null}
    ],
    debts: [debt(), debt({id: 8, name: 'Debito in dollari (esempio)', balance: 200, currency: 'USD', annualRate: null,
      monthlyPayment: null, payoff: {kind: 'UNKNOWN', expectedEnd: null, monthsLeft: null}})],
    totals: [
      {currency: 'EUR', realEstate: 168000, otherAssets: 9500, debts: -6200, net: 171300},
      {currency: 'USD', realEstate: 0, otherAssets: 1000, debts: -200, net: 800}
    ],
    ...overrides
  };
}

const EMPTY: Partial<AssetsAnswer> = {realEstates: [], otherAssets: [], debts: [],
  totals: [{currency: 'EUR', realEstate: 0, otherAssets: 0, debts: 0, net: 0}]};

describe('Assets', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const button = (el: HTMLElement, label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(b => text(b).startsWith(label))!;

  function open(data: AssetsAnswer | null = answer()) {
    const fixture = TestBed.createComponent(AssetsPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-load-state [role=status]')).toBeTruthy();
    if (data) {
      http.expectOne('/api/assets').flush(data);
      fixture.detectChanges();
    }
    return fixture;
  }

  function type(input: HTMLInputElement | HTMLSelectElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
  }

  it('totals in euro with their sign, other currencies apart, and the three lists', () => {
    const el: HTMLElement = open().nativeElement;
    expect(text(el.querySelector('h1'))).toBe('Assets');
    const tiles = Array.from(el.querySelectorAll('.tile')).map(t => text(t));
    expect(tiles[0]).toContain('Real estate');
    expect(tiles[0]).toContain('€168,000');
    expect(tiles[1]).toContain('€9,500');
    expect(tiles[2]).toContain('−€6,200');
    expect(tiles[3]).toContain('+€171,300');
    expect(tiles[3]).toContain('assets minus debts');
    expect(text(el.querySelector('.card p.note'))).toBe(
      'In USD, kept apart and not converted: other assets US$1,000, debts −US$200, net +US$800.');

    const lists = Array.from(el.querySelectorAll('ul.items'));
    expect(lists.length).toBe(3);
    const flat = lists[0].querySelector('li')!;
    expect(text(flat.querySelector('.name'))).toBe('Bilocale (esempio)');
    expect(text(flat.querySelector('.meta'))).toBe("Via dell'Esempio 1, Milano · bought on 15 Jun 2019");
    expect(text(flat.querySelector('.facts'))).toContain('Rent a month€650.00');
    const others = lists[1].querySelectorAll('li');
    expect(text(others[0].querySelector('.meta'))).toBe('Car or motorbike · estimate of 1 Aug 2026');
    expect(text(others[1])).toContain('in USD: kept apart, not in the euro total');
    expect(text(others[1])).toContain('no date of the estimate: counts on every day');
    const debts = lists[2].querySelectorAll('li');
    expect(text(debts[0].querySelector('.amount'))).toBe('−€6,200 left to pay');
    expect(text(debts[0].querySelector('.meta'))).toBe('payment €280.00 a month · rate 5.9% a year');
    expect(text(debts[0].querySelector('.payoff'))).toBe('Expected end November 2028, in 2 years (from the payment)');
    expect(text(debts[1].querySelector('.payoff'))).toBe('End not known: add the payment or the end date');
    // no wide table, ever
    expect(el.querySelector('table')).toBeNull();
  });

  it('nothing yet: says so, with the three ways to fill it; a failed call has Retry', () => {
    const fixture = open(answer(EMPTY));
    const el: HTMLElement = fixture.nativeElement;
    expect(text(el.querySelector('app-load-state'))).toContain('No property, asset or debt yet');
    expect(el.querySelectorAll('ul.items').length).toBe(0);
    button(el, 'Add debt').click();
    fixture.detectChanges();
    const checked = el.querySelector<HTMLInputElement>('app-asset-form input[type=radio]:checked')!;
    expect(checked.value).toBe('debt');
    expect(el.querySelector('app-asset-form [name=balance]')).toBeTruthy();

    const failing = TestBed.createComponent(AssetsPageComponent);
    failing.detectChanges();
    http.expectOne('/api/assets').flush('', {status: 500, statusText: 'Server Error'});
    failing.detectChanges();
    const retry = failing.nativeElement.querySelector('app-load-state [role=alert] button') as HTMLButtonElement;
    expect(text(retry)).toBe('Retry');
    retry.click();
    http.expectOne('/api/assets').flush(answer());
    failing.detectChanges();
    expect(failing.nativeElement.querySelectorAll('ul.items').length).toBe(3);
  });

  it('one form: the type shows its fields, errors are written next to the field, then it saves and reads again', async () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    button(el, 'Add').click();
    fixture.detectChanges();
    const form = () => el.querySelector('app-asset-form')!;
    expect(text(form().querySelector('h2'))).toBe('New property');
    expect(form().querySelector('[name=address]')).toBeTruthy();

    const other = form().querySelector<HTMLInputElement>('input[type=radio][value=other]')!;
    other.click();
    fixture.detectChanges();
    expect(text(form().querySelector('h2'))).toBe('New asset');
    expect(form().querySelector('[name=address]')).toBeNull();
    expect(form().querySelector('select[name=kind]')).toBeTruthy();
    // every field has its label
    for (const input of Array.from(form().querySelectorAll<HTMLInputElement>('input:not([type=radio]), select'))) {
      expect(form().querySelector(`label[for="${input.id}"]`), input.name).toBeTruthy();
    }

    // empty: the errors are under the fields, marked on the fields
    form().querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const name = form().querySelector<HTMLInputElement>('[name=name]')!;
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(text(document.getElementById(name.getAttribute('aria-describedby')!))).toBe('Write a name.');
    const value = form().querySelector<HTMLInputElement>('[name=value]')!;
    expect(text(document.getElementById(value.getAttribute('aria-describedby')!))).toBe('Write an amount.');
    http.expectNone('/api/assets/others');

    type(name, 'Oro (esempio)');
    type(form().querySelector<HTMLSelectElement>('[name=kind]')!, 'GOLD');
    type(value, '2400');
    type(form().querySelector<HTMLInputElement>('[name=currency]')!, 'eur');
    fixture.detectChanges();
    form().querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    fixture.detectChanges();
    const post = http.expectOne('/api/assets/others');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({name: 'Oro (esempio)', currency: 'EUR', kind: 'GOLD', value: 2400, valuedOn: null});
    post.flush({id: 9});
    http.expectOne('/api/assets').flush(answer());
    fixture.detectChanges();
    expect(el.querySelector('app-asset-form')).toBeNull();
    expect(text(el.querySelector('.status'))).toBe('Asset saved.');
  });

  it('a change keeps its type and its values; the server\'s refusal goes next to its field', async () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    const debtRow = el.querySelectorAll('ul.items')[2].querySelector('li')!;
    button(debtRow as HTMLElement, 'Edit').click();
    fixture.detectChanges();
    const form = el.querySelector('app-asset-form')!;
    expect(text(form.querySelector('h2'))).toBe('Edit debt');
    expect(form.querySelector('input[type=radio]')).toBeNull();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(form.querySelector<HTMLInputElement>('[name=name]')!.value).toBe('Prestito auto (esempio)');

    form.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    fixture.detectChanges();
    const put = http.expectOne('/api/assets/debts/7');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({name: 'Prestito auto (esempio)', currency: 'EUR', balance: 6200, annualRate: 5.9,
      monthlyPayment: 280, endDate: null});
    put.flush({status: 400, message: 'CURRENCY'}, {status: 400, statusText: 'Bad Request'});
    fixture.detectChanges();
    const currency = form.querySelector<HTMLInputElement>('[name=currency]')!;
    expect(currency.getAttribute('aria-invalid')).toBe('true');
    expect(text(form.querySelector('.ferr'))).toBe('A currency code of three letters, e.g. EUR.');

    button(form as HTMLElement, 'Cancel').click();
    fixture.detectChanges();
    expect(el.querySelector('app-asset-form')).toBeNull();
  });

  it('delete asks first, in the row', () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    const row = () => el.querySelectorAll('ul.items')[1].querySelector('li') as HTMLElement;
    button(row(), 'Delete').click();
    fixture.detectChanges();
    expect(text(row().querySelector('.confirm .q'))).toBe('Delete "Auto (esempio)"?');
    button(row(), 'Cancel').click();
    fixture.detectChanges();
    expect(row().querySelector('.confirm')).toBeNull();
    http.expectNone('/api/assets/others/3');

    button(row(), 'Delete').click();
    fixture.detectChanges();
    button(row(), 'Yes, delete').click();
    fixture.detectChanges();
    const del = http.expectOne('/api/assets/others/3');
    expect(del.request.method).toBe('DELETE');
    del.flush(null, {status: 204, statusText: 'No Content'});
    http.expectOne('/api/assets').flush(answer({otherAssets: []}));
    fixture.detectChanges();
    expect(text(el.querySelector('.status'))).toBe('"Auto (esempio)" deleted.');
  });

  it('the rules of the form, the same as the server\'s', () => {
    const today = '2026-11-28';
    const d = {...emptyDraft(), name: ' Casa ', value: 100000};
    expect(validate('realEstate', d, today)).toEqual({});
    expect(validate('realEstate', {...d, name: '  '}, today)).toEqual({name: 'assets.error.name'});
    expect(validate('realEstate', {...d, value: -1}, today)).toEqual({value: 'assets.error.negative'});
    expect(validate('realEstate', {...d, value: 1.005}, today)).toEqual({value: 'assets.error.amount'});
    expect(validate('realEstate', {...d, monthlyRent: -5, currency: 'EU'}, today))
      .toEqual({monthlyRent: 'assets.error.negative', currency: 'assets.error.currency'});
    expect(validate('other', {...d, valuedOn: '2026-11-29'}, today)).toEqual({valuedOn: 'assets.error.future'});
    expect(validate('other', {...d, valuedOn: '2026-11-28'}, today)).toEqual({});
    expect(validate('debt', {...d, balance: null}, today)).toEqual({balance: 'assets.error.required'});
    expect(validate('debt', {...d, balance: 5, annualRate: 100.5}, today)).toEqual({annualRate: 'assets.error.rate'});
    expect(validate('debt', {...d, balance: 5, annualRate: 2.125, endDate: '1899-12-31'}, today))
      .toEqual({endDate: 'assets.error.date'});
    expect(requestOf('realEstate', {...d, currency: 'chf'})).toEqual({name: 'Casa', currency: 'CHF', address: null,
      purchaseDate: null, purchasePrice: null, currentEstimatedValue: 100000, monthlyRent: null, monthlyExpenses: null});
  });

  it('the end of a debt in words', () => {
    const i18n = TestBed.inject(I18nService);
    expect(duration(i18n, 1)).toBe('1 month');
    expect(duration(i18n, 12)).toBe('1 year');
    expect(duration(i18n, 28)).toBe('2 years and 4 months');
    expect(payoffText(i18n, {kind: 'END_DATE', expectedEnd: '2029-03-01', monthsLeft: 28}))
      .toEqual({text: 'Ends in March 2029, in 2 years and 4 months', warn: false});
    expect(payoffText(i18n, {kind: 'END_DATE', expectedEnd: '2025-03-01', monthsLeft: -20}).warn).toBe(true);
    expect(payoffText(i18n, {kind: 'NEVER', expectedEnd: null, monthsLeft: null}).warn).toBe(true);
    expect(payoffText(i18n, {kind: 'PAID', expectedEnd: null, monthsLeft: null}).text).toBe('Paid off');
    i18n.setLang('it');
    expect(payoffText(i18n, {kind: 'ESTIMATE', expectedEnd: '2027-02-28', monthsLeft: 3}).text)
      .toBe('Fine prevista a febbraio 2027, tra 3 mesi (stimata dalla rata)');
    expect(duration(i18n, 13)).toBe('1 anno e 1 mese');
  });
});
