import {TestBed} from '@angular/core/testing';
import {I18nService} from './i18n.service';
import {en} from './messages.en';
import {it as itMessages} from './messages.it';

describe('I18nService', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => vi.restoreAllMocks());

  it('is in English by default, and fills the parameters', () => {
    const i18n = TestBed.inject(I18nService);
    expect(i18n.lang()).toBe('en');
    expect(i18n.t('nav.banks')).toBe('Banks');
    expect(i18n.t('banks.expiresIn', {days: 3})).toBe('Expires in 3 days');
    expect(document.documentElement.lang).toBe('en');
  });

  it('switches to Italian at runtime and remembers it', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLang('it');
    expect(i18n.t('nav.banks')).toBe('Banche');
    expect(localStorage.getItem('lang')).toBe('it');
    expect(document.documentElement.lang).toBe('it');
    TestBed.resetTestingModule();
    expect(TestBed.inject(I18nService).lang()).toBe('it');
  });

  it('works without localStorage (private window, blocked storage)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const i18n = TestBed.inject(I18nService);
    expect(i18n.lang()).toBe('en');
    i18n.setLang('it');
    expect(i18n.lang()).toBe('it');
  });

  it('formats numbers, amounts and dates in the language', () => {
    const i18n = TestBed.inject(I18nService);
    expect(i18n.number(-1234.5)).toBe('-1,234.50');
    expect(i18n.money(1234.5, 'EUR')).toBe('€1,234.50');
    expect(i18n.money(2, 'XX1')).toBe('2.00\u00a0XX1');
    expect(i18n.date('2026-03-04')).toBe('4 Mar 2026');
    i18n.setLang('it');
    expect(i18n.number(-1234.5)).toBe('-1234,50');
    expect(i18n.money(1234.5, 'EUR')).toBe('1234,50\u00a0€');
    expect(i18n.date('2026-03-04')).toBe('4 mar 2026');
    expect(i18n.country('DE')).toBe('Germania');
    expect(i18n.date(null)).toBe('');
  });

  it('an amount never breaks across lines: no plain space, the sign joined to the rest', () => {
    const i18n = TestBed.inject(I18nService);
    for (const lang of ['en', 'it'] as const) {
      i18n.setLang(lang);
      for (const text of [i18n.money(-56.7, 'EUR'), i18n.money(2, 'XX1'), i18n.signedMoney(544, 'EUR', 0),
        i18n.signedMoney(-1000, 'USD'), i18n.money(1234567.8, null)]) {
        expect(text).not.toMatch(/ /);
        expect(text).toMatch(/^[0-9€$US]|^[-\u2212+]\u2060/);
      }
    }
    expect(i18n.signedMoney(544, 'EUR', 0)).toBe('+\u2060544\u00a0€');
  });

  it('has the same texts in both languages', () => {
    expect(Object.keys(itMessages).sort()).toEqual(Object.keys(en).sort());
    expect(Object.values(itMessages).every(text => text.trim() !== '')).toBe(true);
  });
});
