import {Component, inject, OnInit, signal} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {Router, RouterLink} from '@angular/router';
import {timeout} from 'rxjs';
import {AuthService} from '../auth/auth.service';
import {I18nService} from '../i18n/i18n.service';
import {MessageKey} from '../i18n/messages.en';
import {TPipe} from '../i18n/t.pipe';
import {IconComponent} from '../ui/icon.component';
import {demoCode, DEMO_ERRORS, tokenExpiry} from './demo';
import {DemoService} from './demo.service';

/** a sandbox takes a few seconds (its schema and a year of made-up data) */
const START_TIMEOUT_MS = 60_000;

/**
 * /demo, the link of the CV and of raoulrondinella.dev: makes a sandbox with made-up data and goes in, without a
 * password or a sign-up. A browser already logged in (a sandbox still open, or a real account) just goes in.
 */
@Component({
  selector: 'app-demo-start',
  imports: [RouterLink, TPipe, IconComponent],
  template: `
    <div class="auth">
      <div class="brand"><span class="brand-mark" aria-hidden="true">m</span>Money Manage</div>
      <section class="panel" aria-labelledby="demo-title">
        <h1 id="demo-title">{{ 'demo.title' | t }}</h1>
        <div aria-live="polite">
          @if (error(); as e) {
            <p class="line bad" role="alert"><app-icon name="error"/><span>{{ e }}</span></p>
          } @else {
            <p class="line" role="status"><span class="spinner" aria-hidden="true"></span>
              <span>{{ 'demo.preparing' | t }}</span></p>
          }
        </div>
        <p class="hint">{{ 'demo.what' | t }}</p>
        @if (error()) {
          <div class="buttons">
            @if (canRetry()) {
              <button type="button" class="btn primary" (click)="create()">{{ 'common.retry' | t }}</button>
            }
            <a class="btn" routerLink="/login">{{ 'demo.toLogin' | t }}</a>
          </div>
        }
      </section>
    </div>`,
  styleUrls: ['../login/login.component.css'],
  styles: [`
    .buttons { display: grid; gap: 8px; }
    .btn { display: flex; align-items: center; justify-content: center; text-decoration: none; }
  `]
})
export class DemoStartComponent implements OnInit {
  private i18n = inject(I18nService);
  private auth = inject(AuthService);
  private demo = inject(DemoService);
  private router = inject(Router);
  readonly error = signal('');
  readonly canRetry = signal(false);

  ngOnInit(): void {
    const exp = tokenExpiry(this.auth.getToken());
    if (exp !== null && exp > Date.now() + 60_000) {
      // already in (a sandbox still open, or a real account): no new sandbox, the limit per address is kept for later
      this.router.navigate(['/'], {replaceUrl: true});
      return;
    }
    this.auth.logout();
    this.create();
  }

  create(): void {
    this.error.set('');
    this.demo.start().pipe(timeout(START_TIMEOUT_MS)).subscribe({
      next: () => this.router.navigate(['/'], {replaceUrl: true}),
      error: (err: unknown) => {
        const code = demoCode(err);
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        const key: MessageKey = code !== null ? DEMO_ERRORS[code]
          : status === 404 ? 'demo.error.off'
            : status === 0 || status >= 500 ? 'common.unreachable' : 'common.failed';
        // over the limit of this address it is pointless to try again now; the others may work in a while
        this.canRetry.set(code !== 'DEMO_LIMIT_IP' && status !== 404);
        this.error.set(this.i18n.t(key));
      }
    });
  }
}
