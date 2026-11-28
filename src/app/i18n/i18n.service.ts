import {computed, Injectable, signal} from '@angular/core';
import {en, MessageKey} from './messages.en';
import {it} from './messages.it';

export type Lang = 'en' | 'it';
export const LANGS: readonly Lang[] = ['en', 'it'];

const MESSAGES: Record<Lang, Record<MessageKey, string>> = {en, it};
const STORAGE_KEY = 'lang';
/** locales for numbers and dates: British English (day/month/year, like the rest of Europe) and Italian */
const LOCALES: Record<Lang, string> = {en: 'en-GB', it: 'it-IT'};

/** The language chosen on this browser, or null; localStorage may be missing or throw (private window, blocked). */
export function storedLang(): Lang | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'en' || value === 'it' ? value : null;
  } catch {
    return null;
  }
}

function storeLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // the choice lasts for this visit only
  }
}

/**
 * The texts of the app in English (the default) and Italian, switched at runtime without a second build.
 * Texts are looked up by key with `t()` (or the `t` pipe in templates); `{name}` in a text is replaced by `params.name`.
 */
@Injectable({providedIn: 'root'})
export class I18nService {
  readonly lang = signal<Lang>(storedLang() ?? 'en');
  /** BCP 47 locale of the language, for Intl */
  readonly locale = computed(() => LOCALES[this.lang()]);
  /**
   * First visit from a browser in Italian: the app stays in English (the default) and offers Italian once; either
   * answer is remembered.
   */
  readonly suggestItalian = signal(storedLang() === null && browserLang().startsWith('it'));

  constructor() {
    this.applyToDocument();
  }

  setLang(lang: Lang): void {
    this.lang.set(lang);
    this.suggestItalian.set(false);
    storeLang(lang);
    this.applyToDocument();
  }

  /** the other language, for the switch */
  other(): Lang {
    return this.lang() === 'en' ? 'it' : 'en';
  }

  t(key: MessageKey, params?: Record<string, string | number>): string {
    let text = MESSAGES[this.lang()][key] ?? en[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.split(`{${name}}`).join(String(value));
      }
    }
    return text;
  }

  /** `key` only if it is a known text: for codes coming from the server, which may be new */
  has(key: string): key is MessageKey {
    return key in en;
  }

  number(value: number, decimals = 2, maxDecimals = decimals): string {
    return new Intl.NumberFormat(this.locale(), {minimumFractionDigits: decimals, maximumFractionDigits: maxDecimals})
      .format(value);
  }

  /** an amount with its currency; an unknown currency code is written after the number */
  money(value: number, currency: string | null | undefined, decimals?: number): string {
    if (currency) {
      try {
        const digits = decimals === undefined ? {} : {minimumFractionDigits: decimals, maximumFractionDigits: decimals};
        return new Intl.NumberFormat(this.locale(), {style: 'currency', currency, ...digits}).format(value);
      } catch {
        return `${this.number(value, decimals ?? 2)} ${currency}`;
      }
    }
    return this.number(value, decimals ?? 2);
  }

  /**
   * An amount with its sign always written: "+1.234,00 €" for money in, "−56,70 €" (minus sign) for money out, so the
   * direction is said by the text and not only by a colour.
   */
  signedMoney(value: number, currency: string | null | undefined, decimals?: number): string {
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return sign + this.money(Math.abs(value), currency, decimals);
  }

  /** a share: 0.123 -> "12,3 %" in Italian, "12.3%" in English */
  percent(value: number, decimals = 1): string {
    return new Intl.NumberFormat(this.locale(), {style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: decimals})
      .format(value);
  }

  /** a month: "novembre 2026" (long) or "nov 26" */
  month(iso: string | null | undefined, long = true): string {
    const date = parse(iso && /^\d{4}-\d{2}$/.test(iso) ? iso + '-01' : iso);
    return date ? new Intl.DateTimeFormat(this.locale(), long ? {month: 'long', year: 'numeric'} : {month: 'short', year: '2-digit'})
      .format(date) : '';
  }

  /** a day as a heading of a list: "Today", "Yesterday", "Thursday 27 November" (the year only when not this year) */
  dayHeading(iso: string | null | undefined, today = new Date()): string {
    const date = parse(iso ? iso.substring(0, 10) : iso);
    if (!date) {
      return '';
    }
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const days = Math.round((start.getTime() - date.getTime()) / 86400000);
    if (days === 0) {
      return this.t('day.today');
    }
    if (days === 1) {
      return this.t('day.yesterday');
    }
    const text = new Intl.DateTimeFormat(this.locale(), {weekday: 'long', day: 'numeric', month: 'long',
      ...(date.getFullYear() === today.getFullYear() ? {} : {year: 'numeric'})}).format(date);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /** a day, from an ISO date or date-time */
  date(iso: string | null | undefined): string {
    const date = parse(iso);
    return date ? new Intl.DateTimeFormat(this.locale(), {dateStyle: 'medium'}).format(date) : '';
  }

  /** a day in digits (31/01/2026), for tables */
  shortDate(iso: string | null | undefined): string {
    const date = parse(iso);
    return date ? new Intl.DateTimeFormat(this.locale(), {dateStyle: 'short'}).format(date) : '';
  }

  /** a day and the time */
  dateTime(iso: string | null | undefined): string {
    const date = parse(iso);
    return date ? new Intl.DateTimeFormat(this.locale(), {dateStyle: 'medium', timeStyle: 'short'}).format(date) : '';
  }

  /** a country's name in the language, from its ISO code */
  country(code: string): string {
    try {
      return new Intl.DisplayNames([this.locale()], {type: 'region'}).of(code) ?? code;
    } catch {
      return code;
    }
  }

  private applyToDocument(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = this.lang();
    }
  }
}

function browserLang(): string {
  return typeof navigator !== 'undefined' ? (navigator.language ?? '').toLowerCase() : '';
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) {
    return null;
  }
  // a bare date is a day, not midnight UTC (which would be the day before west of Greenwich)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}
