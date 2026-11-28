import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting, TestRequest} from '@angular/common/http/testing';
import {provideRouter, Router} from '@angular/router';
import {vi} from 'vitest';
import {PlanPageComponent, RECALC_DELAY_MS} from './plan-page.component';
import {
  configOf, MoneyInputs, monthIndex, newDraft, PlanDraft, PlansOverview, PlanView, Projection, tableRows, Tracking,
  validate
} from './plan.service';

// made-up data only
const TODAY = '2026-11-28';

function money(overrides: Partial<MoneyInputs> = {}): MoneyInputs {
  return {date: TODAY, currency: 'EUR', value: 61200, invested: 48000, monthly: 735, monthlyMonths: 12,
    historicalRate: 5.4, since: '2023-03-03', ...overrides};
}

function projection(overrides: Partial<Projection> = {}): Projection {
  return {from: TODAY, targetDate: '2028-11-28', months: 24, years: 2, currency: 'EUR',
    scenarios: [
      {key: 'PRUDENT', rate: 3, gross: 10609, invested: 10000, tax: 158.34, afterTax: 10450.66, real: 10044.85},
      {key: 'BASE', rate: 5, gross: 11025, invested: 10000, tax: 266.5, afterTax: 10758.5, real: 10340.73},
      {key: 'OPTIMISTIC', rate: 7, gross: 11449, invested: 10000, tax: 376.74, afterTax: 11072.26, real: 10642.31}],
    labels: Array.from({length: 25}, (_, k) => `${2026 + Math.floor((10 + k) / 12)}-${String((10 + k) % 12 + 1).padStart(2, '0')}`),
    prudent: Array.from({length: 25}, (_, k) => 10000 + 25 * k),
    base: Array.from({length: 25}, (_, k) => 10000 + 42 * k),
    optimistic: Array.from({length: 25}, (_, k) => 10000 + 60 * k),
    invested: Array.from({length: 25}, () => 10000),
    monteCarlo: null, ...overrides};
}

function tracking(overrides: Partial<Tracking> = {}): Tracking {
  return {version: 2, savedOn: '2026-06-28', status: 'BELOW', month: '2026-10', planned: 58000, actual: 52000,
    gap: -6000, gapShare: -0.1034, nextCheck: '2026-12-01',
    points: [{month: '2026-06', planned: 50000, actual: 50000}, {month: '2026-07', planned: 52000, actual: 51000},
      {month: '2026-10', planned: 58000, actual: 52000}], ...overrides};
}

function view(overrides: Partial<PlanView> = {}): PlanView {
  return {id: 7, name: 'Piano di prova',
    version: {number: 2, savedAt: '2026-06-28T19:00:00Z', savedOn: '2026-06-28', moneyValue: 50000, historicalRate: 5.1,
      config: {targetDate: '2028-11-28', startValue: 50000, startValueOwn: false, invested: 40000, investedOwn: false,
        monthly: 400, monthlyOwn: true, inflation: 2, taxRate: 26, ratePrudent: 3, rateBase: 5, rateOptimistic: 7,
        events: [{kind: 'ONE_OFF', date: '2027-09-01', amount: -15000, label: 'Auto di prova'}]}},
    latest: true,
    versions: [
      {number: 2, savedAt: '2026-06-28T19:00:00Z', savedOn: '2026-06-28', targetDate: '2028-11-28', monthly: 400,
        monthlyOwn: true, rateBase: 5, events: 1},
      {number: 1, savedAt: '2025-11-28T19:00:00Z', savedOn: '2025-11-28', targetDate: '2028-11-28', monthly: 300,
        monthlyOwn: true, rateBase: 5, events: 0}],
    money: money(), projection: projection(), tracking: tracking(), ...overrides};
}

function draft(overrides: Partial<PlanDraft> = {}): PlanDraft {
  return {...newDraft('Prova', money(), TODAY), ...overrides};
}

describe('Plan: the rules of the form', () => {
  it('months between two days, like the server', () => {
    expect(monthIndex(TODAY, '2026-12-01')).toBe(1);
    expect(monthIndex(TODAY, '2045-06-30')).toBe(223);
    expect(monthIndex(TODAY, '2026-11-01')).toBe(0);
  });

  it('a new plan starts from money: 20 years ahead, the default rates, no events', () => {
    const d = newDraft('Il mio piano', money(), TODAY);
    expect(d.targetDate).toBe('2046-12-31');
    expect([d.startValue, d.invested, d.monthly]).toEqual([61200, 48000, 735]);
    expect([d.startValueOwn, d.investedOwn, d.monthlyOwn]).toEqual([false, false, false]);
    expect([d.ratePrudent, d.rateBase, d.rateOptimistic, d.inflation, d.taxRate]).toEqual([3, 5, 7, 2, 26]);
    expect(validate(d, TODAY)).toEqual({fields: {}, events: []});
  });

  it('every error next to its field, with the same limits as the server', () => {
    const e = validate(draft({name: ' ', targetDate: '2026-11-30', monthly: -1, startValue: 1.234, inflation: 21,
      taxRate: null, events: [
        {kind: 'ONE_OFF', date: '2026-11-30', amount: 0, label: ''},
        {kind: 'MONTHLY', date: '2027-02-01', amount: 250, label: 'x'.repeat(61)}]}), TODAY);
    expect(e.fields).toEqual({name: 'plan.error.name', targetDate: 'plan.error.target', monthly: 'plan.error.amount',
      startValue: 'plan.error.amount', inflation: 'plan.error.inflation', taxRate: 'plan.error.tax'});
    expect(e.events[0]).toEqual({date: 'plan.error.eventDate', amount: 'plan.error.eventAmount'});
    expect(e.events[1]).toEqual({label: 'plan.error.nameLong'});
    expect(validate(draft({rateBase: 8}), TODAY).fields).toEqual({rates: 'plan.error.rateOrder'});
    expect(validate(draft({rateBase: 31}), TODAY).fields).toEqual({rateBase: 'plan.error.rate'});
    // an event after the target date does not count: it is an error
    expect(validate(draft({targetDate: '2027-06-30', events: [{kind: 'ONE_OFF', date: '2027-07-01', amount: -5,
        label: ''}]}), TODAY).events[0]).toEqual({date: 'plan.error.eventDate'});
  });

  it('the config the server takes', () => {
    const c = configOf(draft({monthly: 800, monthlyOwn: true, events: [{kind: 'ONE_OFF', date: '2027-09-01',
      amount: -18000, label: '  Auto   nuova '}]}));
    expect(c.monthly).toBe(800);
    expect(c.monthlyOwn).toBe(true);
    expect(c.events).toEqual([{kind: 'ONE_OFF', date: '2027-09-01', amount: -18000, label: 'Auto nuova'}]);
  });

  it('the rows of the table: about five, the target always last', () => {
    expect(tableRows(223)).toEqual([0, 48, 96, 144, 192, 223]);
    expect(tableRows(24)).toEqual([0, 6, 12, 18, 24]);
    expect(tableRows(60)).toEqual([0, 12, 24, 36, 48, 60]);
  });
});

describe('Plan page', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]});
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const button = (el: HTMLElement, label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(b => text(b) === label)!;
  const type = (input: HTMLInputElement | null, value: string) => {
    input!.value = value;
    input!.dispatchEvent(new Event('input'));
  };
  const overview = (plans: PlansOverview['plans'] = []): PlansOverview => ({money: money(), plans});
  const summary = {id: 7, name: 'Piano di prova', versions: 2, savedAt: '2026-06-28T19:00:00Z',
    targetDate: '2028-11-28', tracking: tracking()};

  function open() {
    const fixture = TestBed.createComponent(PlanPageComponent);
    fixture.componentInstance.today = TODAY;
    fixture.detectChanges();
    return fixture;
  }

  it('no plan yet: says what money knows and "Create the plan" fills the form from it, then saves', async () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-load-state [role=status]')).toBeTruthy();
    http.expectOne('/api/plans').flush(overview());
    fixture.detectChanges();
    expect(text(el.querySelector('app-load-state'))).toContain('No plan yet. Start from what money knows: €61,200 invested today, €735 a month');

    button(el, 'Create the plan').click();
    fixture.detectChanges();
    const call = http.expectOne('/api/plans/projection');
    expect(call.request.body.monteCarlo).toBe(false);
    expect(call.request.body.config).toMatchObject({startValue: 61200, startValueOwn: false, monthly: 735,
      rateBase: 5, targetDate: '2046-12-31'});
    expect(text(el.querySelector('app-plan-results .recalc'))).toBe('Recalculating...');
    call.flush(projection());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text(el.querySelector('app-page-header h1'))).toBe('My plan');
    expect(text(el.querySelector('app-page-header .sub'))).toBe('Not saved yet');
    const tags = Array.from(el.querySelectorAll('label .from')).map(text);
    expect(tags).toEqual(['from money', 'from money', 'from money', 'yours']);
    const tiles = Array.from(el.querySelectorAll('app-plan-results .tile')).map(t => Array.from(t.children).map(text).join(' | '));
    expect(tiles[0]).toBe('On 28 Nov 2028 | €11,025 | base scenario 5%, before taxes');
    expect(tiles[1]).toBe('After taxes | €10,759 | 26% on the gain of €1,025');
    expect(tiles[2]).toBe('In euro of today | €10,341 | with 2% inflation a year, over 2 years');
    expect(el.querySelector('app-plan-projection app-chart canvas')).toBeTruthy();
    const rows = Array.from(el.querySelectorAll('app-plan-projection tbody tr')).map(r => Array.from(r.children).map(text).join(' '));
    expect(rows[0]).toBe('Today €10,000 €10,000 €10,000 €10,000');
    expect(rows.length).toBe(5);

    button(el, 'Save the plan').click();
    const save = http.expectOne(r => r.method === 'POST' && r.url === '/api/plans');
    expect(save.request.body.name).toBe('My plan');
    expect(save.request.body.config.startValueOwn).toBe(false);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    save.flush(view({versions: [view().versions[1]], version: {...view().version, number: 1}}));
    fixture.detectChanges();
    expect(text(el.querySelector('.saved'))).toBe('Saved: version 1. The versions before stay.');
    expect(navigate).toHaveBeenCalledWith(['/plan', 7], {replaceUrl: true});
  });

  it('a plan: inputs from money or yours, typing makes it yours, the numbers come back after a pause', async () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/plans').flush(overview([summary]));
    http.expectOne(r => r.url === '/api/plans/7').flush(view());
    fixture.detectChanges();

    expect(text(el.querySelector('app-page-header h1'))).toBe('Piano di prova');
    expect(text(el.querySelector('app-page-header .sub'))).toBe('Version 2, saved on 28 Jun 2026');
    const start = el.querySelector<HTMLInputElement>('#p-startValue')!;
    // the fields join the form a moment later
    await fixture.whenStable();
    fixture.detectChanges();
    vi.useFakeTimers();
    // the version in use takes today's value from money
    expect(fixture.componentInstance.form!.startValue).toBe(61200);
    expect(text(el.querySelector('label[for=p-monthly] .from'))).toBe('yours');
    expect(text(el.querySelector('#p-monthly-hint'))).toBe('Use money\'s value (€735)');
    expect(text(el.querySelector('#p-startValue-hint'))).toBe('Value at the last prices, 28 Nov 2026');
    expect(text(el.querySelector('.readonly'))).toBe('5.4% a year (XIRR since March 2023)');
    expect(button(el, 'Save the plan').disabled).toBe(true);

    type(start, '70000');
    fixture.detectChanges();
    expect(text(el.querySelector('label[for=p-startValue] .from'))).toBe('yours');
    expect(text(el.querySelector('app-plan-results .recalc'))).toBe('Recalculating...');
    expect(text(el.querySelector('app-page-header .sub'))).toBe('Version 2, saved on 28 Jun 2026 · changes not saved');
    http.expectNone('/api/plans/projection');
    vi.advanceTimersByTime(RECALC_DELAY_MS);
    const call = http.expectOne('/api/plans/projection');
    expect(call.request.body.config).toMatchObject({startValue: 70000, startValueOwn: true, monthly: 400});
    call.flush(projection());
    fixture.detectChanges();
    expect(text(el.querySelector('app-plan-results .recalc'))).toBe('');

    // back to money's value
    button(el, 'Use money\'s value (€61,200)').click();
    fixture.detectChanges();
    expect(text(el.querySelector('label[for=p-startValue] .from'))).toBe('from money');
    vi.advanceTimersByTime(RECALC_DELAY_MS);
    http.expectOne('/api/plans/projection').flush(projection());

    // an error stops the numbers and says it next to the field
    type(el.querySelector<HTMLInputElement>('#p-rateBase'), '9');
    fixture.detectChanges();
    expect(text(el.querySelector('#p-rates-err'))).toBe('Prudent, base and optimistic go from the lowest to the highest');
    expect(text(el.querySelector('app-plan-results .recalc'))).toBe('Fix the fields marked to see the new numbers.');
    vi.advanceTimersByTime(RECALC_DELAY_MS * 2);
    http.expectNone('/api/plans/projection');
  });

  it('planned against real, the versions, an older version, Monte Carlo', async () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/plans').flush(overview([summary, {...summary, id: 8, name: 'Altro piano'}]));
    http.expectOne(r => r.url === '/api/plans/7').flush(view());
    fixture.detectChanges();

    expect(el.querySelector('.switch select')).toBeTruthy();
    expect(text(el.querySelector('app-plan-tracking .status'))).toBe('Below the plan by €6,000 (−10.3%) at the end of October 2026');
    expect(el.querySelector('app-plan-tracking .status app-icon')).toBeTruthy();
    const versions = Array.from(el.querySelectorAll('app-plan-versions li'))
      .map(li => Array.from(li.children).map(text).join(' | '));
    expect(versions[0]).toBe('Version 2 saved on 28 Jun 2026 | In useOn screen | target 28 Nov 2028 · €400 a month · base 5% · 1 event');
    expect(versions[1]).toBe('Version 1 saved on 28 Nov 2025 | Open Version 1 | target 28 Nov 2028 · €300 a month · base 5%');

    // the events of the version
    await fixture.whenStable();
    expect(el.querySelectorAll('.event-list li').length).toBe(1);
    expect(el.querySelector<HTMLInputElement>('#e-label-0')!.value).toBe('Auto di prova');

    button(el.querySelector('app-plan-versions')!, 'Open Version 1').click();
    const v1 = http.expectOne(r => r.url === '/api/plans/7' && r.params.get('version') === '1');
    v1.flush(view({latest: false, version: {...view().version, number: 1, savedOn: '2025-11-28',
      config: {...view().version.config, monthly: 300, events: []}}}));
    fixture.detectChanges();
    expect(text(el.querySelector('.old'))).toContain('You are looking at version 1, saved on 28 Nov 2025');
    // an older version keeps the values it was saved with
    expect(fixture.componentInstance.form!.startValue).toBe(50000);

    // Monte Carlo: asked when chosen
    button(el, 'Monte Carlo').click();
    fixture.detectChanges();
    const mc = http.expectOne('/api/plans/projection');
    expect(mc.request.body.monteCarlo).toBe(true);
    mc.flush(projection({monteCarlo: {available: false, reason: 'HISTORY_TOO_SHORT', historyMonths: 4, yearlyMean: null,
      yearlyVolatility: null, simulations: 0, p5: null, p50: null, p95: null}}));
    fixture.detectChanges();
    expect(text(el.querySelector('app-plan-projection .note'))).toBe('Monte Carlo needs at least 6 complete months of investments (now 4).');
    button(el, 'Scenarios').click();
    fixture.detectChanges();
    expect(el.querySelector('app-plan-projection .note')).toBeNull();
  });

  it('a refused save says why next to the field; a failed load has Retry; delete asks first', async () => {
    const fixture = open();
    const el: HTMLElement = fixture.nativeElement;
    http.expectOne('/api/plans').flush('no', {status: 500, statusText: 'Error'});
    fixture.detectChanges();
    button(el, 'Retry').click();
    http.expectOne('/api/plans').flush(overview([summary]));
    http.expectOne(r => r.url === '/api/plans/7').flush(view());
    fixture.detectChanges();
    await fixture.whenStable();

    type(el.querySelector<HTMLInputElement>('#p-name'), 'Nuovo nome');
    fixture.detectChanges();
    button(el, 'Save the plan').click();
    const save: TestRequest = http.expectOne(r => r.method === 'PUT' && r.url === '/api/plans/7');
    expect(save.request.body.name).toBe('Nuovo nome');
    save.flush({message: 'RATE_ORDER'}, {status: 400, statusText: 'Bad Request'});
    fixture.detectChanges();
    expect(text(el.querySelector('#p-rates-err'))).toBe('Prudent, base and optimistic go from the lowest to the highest');
    expect(text(el.querySelector('.alert'))).toBe('Some fields are not right: they are marked in the form.');

    const versions = el.querySelector<HTMLElement>('app-plan-versions')!;
    button(versions, 'Delete the plan').click();
    fixture.detectChanges();
    expect(text(versions.querySelector('.confirm .q'))).toBe('Delete "Piano di prova" and its 2 versions?');
    button(versions, 'Cancel').click();
    fixture.detectChanges();
    expect(versions.querySelector('.confirm')).toBeNull();
    http.match('/api/plans/projection').forEach(r => r.flush(projection()));
  });
});
