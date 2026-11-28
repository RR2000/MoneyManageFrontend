import {computed, Injectable, signal} from '@angular/core';

/** 'system' follows the device; 'light' and 'dark' are a choice of the user, remembered in this browser. */
export type ThemeMode = 'system' | 'light' | 'dark';
export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

const STORAGE_KEY = 'theme';

/** The theme chosen on this browser, or 'system'; localStorage may be missing or throw (private window, blocked). */
export function storedTheme(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Light or dark theme. The colours are CSS tokens (styles.scss); this only puts data-theme="light|dark" on <html>
 * when the user picked one, and says which theme is on screen (for the charts, which draw on a canvas).
 */
@Injectable({providedIn: 'root'})
export class ThemeService {
  readonly mode = signal<ThemeMode>(storedTheme());
  private readonly systemDark = signal(prefersDark());
  /** the theme on screen now */
  readonly dark = computed(() => this.mode() === 'dark' || (this.mode() === 'system' && this.systemDark()));

  constructor() {
    applyTheme(this.mode());
    if (typeof matchMedia === 'function') {
      try {
        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => this.systemDark.set(e.matches));
      } catch {
        // old browsers: the system theme is read once
      }
    }
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      if (mode === 'system') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, mode);
      }
    } catch {
      // the choice lasts for this visit only
    }
    applyTheme(mode);
  }
}

/** Also called before the app starts (main.ts), so a saved theme shows from the first frame. */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (mode === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', mode);
  }
}

function prefersDark(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** The value of a colour token (e.g. '--s1') as the page has it now, for what is drawn on a canvas. */
export function token(name: string, fallback = '#000'): string {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
