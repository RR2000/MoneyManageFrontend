import {afterNextRender, Component, ElementRef, inject, Injector, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {timeout} from 'rxjs';
import {Account, AuthService, linkReturn} from '../auth/auth.service';
import {I18nService, Lang} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {ThemeSwitchComponent} from '../theme/theme-switch.component';
import {PageHeaderComponent} from '../ui/page-header.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';
import {IconComponent} from '../ui/icon.component';
import {CALL_TIMEOUT_MS} from '../accounts/accounts.service';
import {MessageKey} from '../i18n/messages.en';

/** The codes of /settings#oidc-link-error=code (the backend's OidcLinks and SecurityConfig) and their texts. */
const LINK_ERRORS: Record<string, MessageKey> = {
  'expired': 'sso.error.expired',
  'already-linked': 'sso.error.already-linked',
  'other-subject': 'sso.error.other-subject',
  'unavailable': 'sso.error.unavailable',
  'failed': 'sso.error.failed'
};

/**
 * /settings: the account (username, the email a forgotten password is reset with, confirmed from a link), the link to
 * raoulrondinella.dev (the single sign-on, when the server has it), the language and the theme, and log out.
 */
@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, TPipe, ThemeSwitchComponent, PageHeaderComponent, LoadStateComponent, IconComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'nav.settings' | t"/>

      <section class="card" aria-labelledby="settings-account">
        <h2 id="settings-account">{{ 'account.title' | t }}</h2>
        @if (state() === 'ready' && account(); as a) {
          <dl class="facts">
            <div><dt>{{ 'settings.username' | t }}</dt><dd>{{ a.username }}</dd></div>
            <div><dt>{{ 'settings.email' | t }}</dt><dd>{{ a.email || ('settings.email.none' | t) }}</dd></div>
          </dl>
          <p class="hint">{{ (a.email ? 'account.loginHint.email' : 'account.loginHint') | t }}
            @if (a.emailLinks && a.email) {
              {{ 'account.noPasswordHint' | t }}
            }
          </p>
        } @else {
          <app-load-state [state]="state()" [errorText]="'account.unavailable' | t" (retry)="load()"/>
        }
        <div class="buttons">
          <button type="button" class="btn" (click)="logout()"><app-icon name="logout"/>{{ 'nav.logout' | t }}</button>
        </div>
      </section>

      @if (state() === 'ready' && account()?.oidc || linkMessage()) {
        <section class="card" aria-labelledby="settings-sso">
          <h2 id="settings-sso">raoulrondinella.dev</h2>
          <div aria-live="polite">
            @if (linkMessage(); as m) {
              <p class="line" [class.ok]="m.ok" [class.bad]="!m.ok" [attr.role]="m.ok ? 'status' : 'alert'">
                <app-icon [name]="m.ok ? 'ok' : 'error'"/><span>{{ m.text }}</span></p>
            }
          </div>
          @if (state() === 'ready' && account(); as a) {
            @if (a.oidcLinked) {
              <p class="line ok sso-state"><span class="sso-mark" aria-hidden="true">r</span>
                <span>{{ 'sso.linked' | t }}</span></p>
              <p class="hint">{{ (a.oidcCanUnlink ? 'sso.linked.hint' : 'sso.onlyLogin') | t }}</p>
              @if (a.oidcCanUnlink) {
                @if (confirmUnlink()) {
                  <div class="confirm" role="group" aria-labelledby="settings-sso-ask">
                    <p class="q" id="settings-sso-ask">{{ 'sso.unlink.ask' | t }}</p>
                    <div class="buttons">
                      <button type="button" class="btn danger yes" [disabled]="linkBusy()" (click)="unlink()">
                        {{ (linkBusy() ? 'common.wait' : 'sso.unlink.yes') | t }}</button>
                      <button type="button" class="btn no" [disabled]="linkBusy()" (click)="cancelUnlink()">
                        {{ 'common.cancel' | t }}</button>
                    </div>
                  </div>
                } @else {
                  <div class="buttons">
                    <button type="button" class="btn unlink" (click)="askUnlink()">{{ 'sso.unlink' | t }}</button>
                  </div>
                }
              }
            } @else {
              <p class="hint">{{ 'sso.hint' | t }}</p>
              <div class="buttons">
                <button type="button" class="btn primary sso-button" [disabled]="linkBusy()" (click)="link()">
                  <span class="sso-mark" aria-hidden="true">r</span>{{ 'sso.link' | t }}</button>
              </div>
            }
            <div aria-live="polite">
              @if (linkBusy()) {
                <p class="line" role="status"><span class="spinner" aria-hidden="true"></span>
                  <span>{{ (a.oidcLinked ? 'common.wait' : 'sso.opening') | t }}</span></p>
              } @else if (linkError()) {
                <p class="line bad" role="alert"><app-icon name="error"/><span>{{ linkError() }}</span></p>
              }
            </div>
          }
        </section>
      }

      @if (state() === 'ready' && account()?.emailLinks) {
        <section class="card" aria-labelledby="settings-email">
          <h2 id="settings-email">{{ (account()?.email ? 'account.changeEmail' : 'account.addEmail') | t }}</h2>
          <p class="hint" id="settings-email-hint">{{ 'account.emailHint' | t }}</p>
          <form class="form" novalidate (ngSubmit)="submit()">
            <div class="field">
              <label for="settings-email-input">{{ 'account.emailLabel' | t }}</label>
              <input id="settings-email-input" name="email" type="email" [(ngModel)]="email" autocomplete="email"
                     aria-describedby="settings-email-hint" [attr.aria-invalid]="!!error()">
            </div>
            <div class="buttons">
              <button type="submit" class="btn primary" [disabled]="busy() || !email.trim()">
                {{ (busy() ? 'common.wait' : 'account.submit') | t }}</button>
            </div>
            <div aria-live="polite">
              @if (busy()) {
                <p class="line" role="status"><span class="spinner" aria-hidden="true"></span>{{ 'common.wait' | t }}</p>
              } @else if (sentTo()) {
                <p class="line ok" role="status"><app-icon name="ok"/><span>{{ 'account.sent' | t: {email: sentTo()} }}</span></p>
              } @else if (error()) {
                <p class="line bad" role="alert"><app-icon name="error"/><span>{{ error() }}</span></p>
              }
            </div>
          </form>
        </section>
      }

      <section class="card" aria-labelledby="settings-display">
        <h2 id="settings-display">{{ 'settings.display' | t }}</h2>
        <div class="form">
          <div class="field">
            <label for="settings-lang">{{ 'account.language' | t }}</label>
            <select id="settings-lang" name="lang" [ngModel]="i18n.lang()" (ngModelChange)="setLang($event)">
              <option value="en" lang="en">English</option>
              <option value="it" lang="it">Italiano</option>
            </select>
          </div>
          <div class="field">
            <span class="label-like" id="settings-theme">{{ 'theme.label' | t }}</span>
            <app-theme-switch aria-labelledby="settings-theme"/>
            <p class="hint">{{ 'settings.theme.hint' | t }}</p>
          </div>
        </div>
      </section>
    </div>`,
  styles: [`
    .page { display: grid; gap: 16px; }
    app-page-header { margin-bottom: 0; }
    .facts { display: grid; gap: 6px; margin: 0; }
    .facts div { display: flex; flex-wrap: wrap; gap: 4px 10px; }
    .facts dt { color: var(--muted); min-width: 7rem; }
    .facts dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; min-width: 0; }
    .hint { margin: 0; font-size: .85rem; color: var(--muted); }
    .form { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: 12px 16px;
      align-items: start; }
    .form > div:last-child:empty { display: none; }
    .field { display: grid; gap: 6px; align-content: start; min-width: 0; }
    label, .label-like { font-size: .84rem; font-weight: 600; }
    select, input { width: 100%; min-width: 0; min-height: 44px; padding: 8px 10px; font-size: 1rem; border-radius: 8px; }
    input[aria-invalid="true"] { border-color: var(--bad); border-width: 2px; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
    .line { display: flex; gap: 6px; align-items: flex-start; margin: 0; overflow-wrap: anywhere; --icon-size: 16px; }
    .line.ok { color: var(--good); font-weight: 600; }
    .line.bad { color: var(--bad); font-weight: 600; }
    .sso-mark { width: 24px; height: 24px; border-radius: 6px; flex: none; display: grid; place-items: center;
      background: var(--accent-fg); color: var(--accent); font-weight: 800; font-size: .9rem; }
    .sso-state .sso-mark { background: var(--accent); color: var(--accent-fg); }
    .sso-state { align-items: center; }
    .confirm { display: grid; gap: 8px; }
    .confirm .q { margin: 0; font-weight: 600; }
    .spinner { display: inline-block; flex: none; width: 1em; height: 1em; border: 2px solid currentColor;
      border-right-color: transparent; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 2.4s; } }
  `]
})
export class SettingsPageComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private auth = inject(AuthService);
  readonly account = signal<Account | null>(null);
  readonly state = signal<LoadState>('loading');
  email = '';
  readonly sentTo = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  /** the answer of raoulrondinella.dev after a link (from the fragment), shown once */
  readonly linkMessage = signal<{ ok: boolean, text: string } | null>(null);
  readonly linkBusy = signal(false);
  readonly linkError = signal('');
  readonly confirmUnlink = signal(false);
  private host = inject(ElementRef<HTMLElement>);
  private injector = inject(Injector);

  ngOnInit(): void {
    this.readLinkReturn();
    this.load();
  }

  /** Back from raoulrondinella.dev after "Link": the result is in the fragment, which is then removed from the address. */
  private readLinkReturn(): void {
    const back = linkReturn(window.location.hash);
    if (!back) {
      return;
    }
    history.replaceState(null, '', '/settings');
    if (back.linked) {
      if (back.idToken) {
        this.auth.acceptIdToken(back.idToken);
      }
      this.linkMessage.set({ok: true, text: this.i18n.t('sso.done')});
    } else {
      const code = back.error ?? '';
      this.linkMessage.set({ok: false, text: this.i18n.t(Object.hasOwn(LINK_ERRORS, code) ? LINK_ERRORS[code] : 'sso.error.failed')});
    }
  }

  /** "Link to raoulrondinella.dev": the server gives the address of the link request, the browser goes there. */
  link(): void {
    this.linkError.set('');
    this.linkMessage.set(null);
    this.linkBusy.set(true);
    this.auth.startOidcLink().pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      // stays busy: the page is left for raoulrondinella.dev
      next: r => this.auth.leaveTo(r.url),
      error: (err: HttpErrorResponse) => {
        this.linkBusy.set(false);
        if (err.status === 409) {
          // linked meanwhile (another tab): show it
          this.load();
          return;
        }
        this.linkError.set(this.i18n.t(err.status === 404 ? 'sso.error.off'
          : err.status === 0 ? 'common.unreachable' : 'common.failed'));
      }
    });
  }

  askUnlink(): void {
    this.linkError.set('');
    this.linkMessage.set(null);
    this.confirmUnlink.set(true);
    afterNextRender(() => (this.host.nativeElement.querySelector('.confirm .no') as HTMLElement | null)?.focus(),
      {injector: this.injector});
  }

  cancelUnlink(): void {
    this.confirmUnlink.set(false);
    afterNextRender(() => (this.host.nativeElement.querySelector('button.unlink') as HTMLElement | null)?.focus(),
      {injector: this.injector});
  }

  unlink(): void {
    this.linkError.set('');
    this.linkBusy.set(true);
    this.auth.unlinkOidc().pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: () => {
        this.linkBusy.set(false);
        this.confirmUnlink.set(false);
        this.linkMessage.set({ok: true, text: this.i18n.t('sso.unlinked')});
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.linkBusy.set(false);
        this.linkError.set(this.i18n.t(err.status === 409 ? 'sso.onlyLogin'
          : err.status === 0 ? 'common.unreachable' : 'common.failed'));
      }
    });
  }

  load(): void {
    this.state.set('loading');
    this.auth.account().pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: a => {
        this.account.set(a);
        this.state.set('ready');
      },
      error: () => this.state.set('error')
    });
  }

  setLang(lang: Lang): void {
    this.i18n.setLang(lang);
  }

  submit(): void {
    this.error.set('');
    this.sentTo.set('');
    const email = this.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error.set(this.i18n.t('account.invalidEmail'));
      return;
    }
    this.busy.set(true);
    this.auth.changeEmail(email).subscribe({
      next: () => {
        this.busy.set(false);
        this.sentTo.set(email);
        this.email = '';
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.i18n.t(err.status === 429 ? 'common.tooMany'
          : err.status === 400 ? 'account.invalidEmail' : 'common.failed'));
      }
    });
  }

  logout(): void {
    this.auth.signOut();
  }
}
