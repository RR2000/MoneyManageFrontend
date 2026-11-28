import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {CostsPageComponent} from './costs-page.component';
import {RulesPageComponent} from './rules-page.component';
import {CategoriesOverview, FixedCosts, suggestPattern} from './costs.service';
import {MovementsComponent} from '../accounts/movements.component';
import {Movement} from '../accounts/accounts.service';

// made-up data only
function costs(overrides: Partial<FixedCosts> = {}): FixedCosts {
  return {currency: 'EUR', months: 12, monthsUsed: 12, from: '2025-11-01', to: '2026-10-31', month: '2026-11',
    monthly: 612.4, yearly: 7348.8, setAside: 620, roundingStep: 10, thisMonth: 418,
    categories: [
      {id: 1, name: 'Casa di prova', total: 6000, monthly: 500, yearly: 6000, thisMonth: 400, movements: 12},
      {id: 2, name: 'Assicurazione di prova', total: 540, monthly: 45, yearly: 540, thisMonth: 0, movements: 1}],
    upcoming: [
      {categoryId: 1, category: 'Casa di prova', ruleId: 3, rule: 'affitto', currency: 'EUR', cadence: 'MONTHLY',
        expectedOn: '2026-12-01', amount: 500, last: '2026-11-01', payments: 12, late: false},
      {categoryId: 2, category: 'Assicurazione di prova', ruleId: 4, rule: 'assicurazione', currency: 'EUR', cadence: 'ANNUAL',
        expectedOn: '2026-11-15', amount: 540, last: '2025-11-15', payments: 2, late: true},
      {categoryId: 2, category: 'Assicurazione di prova', ruleId: null, rule: null, currency: 'EUR', cadence: 'UNKNOWN',
        expectedOn: null, amount: 30, last: '2026-06-03', payments: 1, late: false}],
    otherCurrencies: [], uncategorized: 3, ...overrides};
}

function overview(overrides: Partial<CategoriesOverview> = {}): CategoriesOverview {
  return {categories: [{id: 1, name: 'Casa di prova', fixed: true, movements: 12, rules: 1},
    {id: 2, name: 'Spesa di prova', fixed: false, movements: 40, rules: 0}],
    rules: [{id: 3, categoryId: 1, pattern: 'affitto', direction: 'OUT', accountId: 'a1b2c3d4e5f6', account: 'Conto di prova'}],
    uncategorized: 0, ...overrides};
}

function movement(id: number, description: string, amount: number, category: string | null = null): Movement {
  return {id, datetime: '2026-11-27T10:00:00', description, amount, currency: 'EUR', source: 'BANK', balance: null,
    accountId: 'a1b2c3d4e5f6', account: 'Conto di prova', categoryId: category ? 1 : null, category,
    categorySource: category ? 'RULE' : null};
}

describe('Fixed costs', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const button = (el: HTMLElement, label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(b => text(b) === label)!;
  const type = (input: HTMLInputElement | null, value: string) => {
    input!.value = value;
    input!.dispatchEvent(new Event('input'));
  };

  it('the page: a month, a year, set aside rounded up, a bar per category with its amount, what comes next', () => {
    const fixture = TestBed.createComponent(CostsPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-load-state [role=status]')).toBeTruthy();
    const call = http.expectOne(r => r.url === '/api/fixed-costs');
    expect(call.request.params.get('months')).toBe('12');
    call.flush(costs());
    fixture.detectChanges();

    expect(text(el.querySelector('app-page-header .sub'))).toBe('From November 2025 to October 2026');
    const tiles = Array.from(el.querySelectorAll('.sum3 .tile')).map(t => Array.from(t.children).map(text).join(' '));
    expect(tiles[0]).toBe('A month €612 average of 12 months');
    expect(tiles[1]).toBe('A year €7,349 2 fixed categories');
    expect(tiles[2]).toBe('Set aside €620 a month, rounded up to the next €10');
    expect(el.querySelector('a[href="/costs/rules"]')).toBeTruthy();
    expect(el.querySelector('.note.todo a')?.getAttribute('href')).toBe('/costs/uncategorized');

    const bars = Array.from(el.querySelectorAll('.hbar'));
    expect(text(bars[0].querySelector('.name'))).toBe('Casa di prova');
    expect(text(bars[0].querySelector('.amount'))).toBe('€500');
    expect((bars[0].querySelector('.track i') as HTMLElement).style.width).toBe('100%');
    expect((bars[1].querySelector('.track i') as HTMLElement).style.width).toBe('9%');
    expect(text(bars[1].querySelector('.sub'))).toBe('€540 a year · €0 this month');

    expect(text(el.querySelector('#costs-month'))).toBe('November so far');
    expect(text(el.querySelector('app-month-bar .share'))).toBe('68% of the monthly average');

    const next = Array.from(el.querySelectorAll('.rows li'));
    expect(text(next[0])).toContain('≈ €500.00');
    expect(text(next[0])).toContain('around 1 Dec 2026 · monthly');
    expect(text(next[0])).toContain('rule "affitto"');
    expect(next[1].classList).toContain('late');
    expect(text(next[1])).toContain('expected around 15 Nov 2026, not here yet · yearly');
    expect(next[1].querySelector('app-icon')).toBeTruthy();
    expect(text(next[2])).toContain('cadence not known · last on 3 Jun 2026');

    button(el, '24 months').click();
    const again = http.expectOne(r => r.url === '/api/fixed-costs');
    expect(again.request.params.get('months')).toBe('24');
    again.flush(costs({monthsUsed: 14, months: 24, from: '2025-09-01'}));
    fixture.detectChanges();
    expect(text(el.querySelector('p.note'))).toBe('The movements start in September 2025: the averages are over 14 months.');
  });

  it('nothing fixed yet: the way to create the first category; an error has Retry', () => {
    const fixture = TestBed.createComponent(CostsPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    http.expectOne(r => r.url === '/api/fixed-costs').flush('', {status: 500, statusText: 'Server Error'});
    fixture.detectChanges();
    button(el, 'Retry').click();
    http.expectOne(r => r.url === '/api/fixed-costs').flush(costs({categories: [], upcoming: [], uncategorized: 0}));
    fixture.detectChanges();
    expect(text(el)).toContain('No fixed cost yet.');
    expect(el.querySelector('app-load-state a')?.getAttribute('href')).toBe('/costs/rules');
  });

  it('rules page: a category with its error next to the field, a rule saved, delete asks first, apply after a preview', async () => {
    const fixture = TestBed.createComponent(RulesPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/categories').flush(overview());
    http.expectOne('/api/money-accounts').flush([]);
    fixture.detectChanges();
    const items = Array.from(el.querySelectorAll('.items li'));
    expect(text(items[0])).toContain('Casa di prova');
    expect(text(items[0].querySelector('.kind'))).toBe('fixed cost');
    expect(text(items[1].querySelector('.kind'))).toBe('not fixed');
    expect(text(items[0].querySelector('.meta'))).toBe('12 movements · 1 rule');
    expect(text(items[2].querySelector('.name'))).toBe('“affitto” →gives the category Casa di prova');
    expect(text(items[2].querySelector('.meta'))).toBe('Money out only · only Conto di prova');

    button(el, 'New category').click();
    fixture.detectChanges();
    await fixture.whenStable();
    type(el.querySelector('#cat-name'), 'casa DI prova');
    fixture.detectChanges();
    button(el, 'Save').click();
    fixture.detectChanges();
    expect(text(el.querySelector('#cat-name-err'))).toBe('There is already a category with this name.');
    expect(el.querySelector('#cat-name')?.getAttribute('aria-invalid')).toBe('true');
    type(el.querySelector('#cat-name'), 'Bollette di prova');
    fixture.detectChanges();
    button(el, 'Save').click();
    const created = http.expectOne('/api/categories');
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual({name: 'Bollette di prova', fixed: true});
    created.flush({id: 5, name: 'Bollette di prova', fixed: true, movements: 0, rules: 0});
    http.expectOne('/api/categories').flush(overview());
    fixture.detectChanges();
    expect(text(el.querySelector('.status'))).toBe('Category Bollette di prova created.');

    // a rule from the category row, refused by the server: the error goes next to its field
    Array.from(el.querySelectorAll<HTMLButtonElement>('.items li .acts button')).find(b => text(b).startsWith('New rule'))!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    type(el.querySelector('#rule-pattern'), 'affitto');
    fixture.detectChanges();
    button(el, 'Save').click();
    const rule = http.expectOne('/api/categories/rules');
    expect(rule.request.body).toEqual({categoryId: 1, pattern: 'affitto', direction: 'OUT', accountId: null});
    rule.flush({status: 400, message: 'RULE_EXISTS'}, {status: 400, statusText: 'Bad Request'});
    fixture.detectChanges();
    expect(text(el.querySelector('#rule-pattern-err'))).toBe('The same rule is already there.');
    button(el, 'Cancel').click();
    fixture.detectChanges();

    // delete asks in the row
    Array.from(el.querySelectorAll<HTMLButtonElement>('.items li .acts button')).find(b => text(b) === 'Delete affitto')!.click();
    fixture.detectChanges();
    expect(text(el.querySelector('.confirm .q'))).toContain('Delete the rule "affitto"?');
    el.querySelector<HTMLButtonElement>('.confirm .btn.danger')!.click();
    const del = http.expectOne('/api/categories/rules/3');
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    http.expectOne('/api/categories').flush(overview());
    fixture.detectChanges();

    // apply to all: first the counts, then the change
    button(el, 'See how many change').click();
    const preview = http.expectOne('/api/categories/apply');
    expect(preview.request.body).toEqual({dryRun: true});
    preview.flush({dryRun: true, categorized: 5, changed: 1, cleared: 0, total: 6, manualKept: 2});
    fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('.preview li')).map(text)).toEqual([
      '5 movements would get a category', '1 would change category', '2 chosen by hand stay as they are']);
    button(el, 'Apply to 6 movements').click();
    const apply = http.expectOne('/api/categories/apply');
    expect(apply.request.body).toEqual({dryRun: false});
    apply.flush({dryRun: false, categorized: 5, changed: 1, cleared: 0, total: 6, manualKept: 2});
    http.expectOne('/api/categories').flush(overview());
    fixture.detectChanges();
    expect(text(el.querySelector('.status'))).toBe('6 movements updated.');
  });

  it('movements: the category on every row, only the ones without one, a category by hand with a rule, then apply', async () => {
    const fixture = TestBed.createComponent(MovementsComponent);
    fixture.componentRef.setInput('accountId', '');
    fixture.componentRef.setInput('startUncategorized', true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const first = http.expectOne('/api/money-accounts/movements');
    expect(first.request.body).toEqual({q: '', kind: 'ALL', uncategorized: true, offset: 0, limit: 50});
    first.flush({items: [movement(7, 'ADDEBITO LUCE 12345678 DEL 03/11', -60), movement(8, 'Caffe', -1.2)], hasMore: false});
    fixture.detectChanges();
    const rows = Array.from(el.querySelectorAll('.row'));
    expect(rows[0].querySelector('.acc')?.getAttribute('href')).toBe('/accounts/a1b2c3d4e5f6');
    expect(text(rows[0].querySelector('.cat'))).toContain('No category');
    expect(button(el, 'Without category').getAttribute('aria-pressed')).toBe('true');

    rows[0].querySelector<HTMLButtonElement>('.cat')!.click();
    fixture.detectChanges();
    http.expectOne('/api/categories').flush(overview());
    fixture.detectChanges();
    await fixture.whenStable();
    const select = el.querySelector<HTMLSelectElement>('app-assign select')!;
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    const withRule = el.querySelector<HTMLInputElement>('app-assign input[name=withRule]')!;
    withRule.click();
    fixture.detectChanges();
    await fixture.whenStable();
    // the text starts from the description without the bank's numbers; money out from the sign
    expect(el.querySelector<HTMLInputElement>('app-assign input[name=pattern]')!.value).toBe('ADDEBITO LUCE DEL');
    type(el.querySelector('app-assign input[name=pattern]'), 'addebito luce');
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('app-assign button[type=submit]')!.click();
    const assign = http.expectOne('/api/movements/7/category');
    expect(assign.request.method).toBe('PUT');
    expect(assign.request.body).toEqual({categoryId: 1, rule: {pattern: 'addebito luce', direction: 'OUT', onlyThisAccount: false}});
    assign.flush({id: 7, categoryId: 1, category: 'Casa di prova', categorySource: 'MANUAL',
      rule: {id: 9, categoryId: 1, pattern: 'addebito luce', direction: 'OUT', accountId: null, account: null},
      preview: {dryRun: true, categorized: 4, changed: 0, cleared: 0, total: 4, manualKept: 1}});
    fixture.detectChanges();
    // in the list of the ones without a category it goes away; the offer says how many more the rule takes
    expect(el.querySelectorAll('.row').length).toBe(1);
    expect(text(el.querySelector('.status'))).toBe('Category saved: Casa di prova.');
    expect(text(el.querySelector('.offer .q'))).toBe('The new rule also matches 4 movements already there.');
    button(el, 'Apply to them (4)').click();
    http.expectOne('/api/categories/apply').flush({dryRun: false, categorized: 4, changed: 0, cleared: 0, total: 4,
      manualKept: 1});
    http.expectOne('/api/money-accounts/movements').flush({items: [], hasMore: false});
    fixture.detectChanges();
    expect(text(el.querySelector('.status'))).toBe('4 movements updated.');
    expect(el.querySelector('.offer')).toBeNull();
    expect(text(el)).toContain('Every movement has a category.');
  });

  it('a text for a rule out of a description', () => {
    expect(suggestPattern('  Bolletta   gas  ')).toBe('Bolletta gas');
    expect(suggestPattern('PAGAMENTO POS 1234 SUPERMERCATO 28/11/2026')).toBe('PAGAMENTO POS SUPERMERCATO');
    expect(suggestPattern('12345678')).toBe('12345678');
    expect(suggestPattern('a'.repeat(30) + ' ' + 'b'.repeat(30)).length).toBeLessThanOrEqual(40);
  });
});
