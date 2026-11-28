import {ChangeDetectionStrategy, Component, inject, output, signal} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {timeout} from 'rxjs';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {IconComponent} from './icon.component';

/** loading a year of made-up movements takes a few seconds on the server */
const SAMPLE_TIMEOUT_MS = 60 * 1000;

/**
 * "Load sample data", for an account that is still empty (e.g. one born from "Log in with GitHub"): a made-up year of
 * movements, investments, assets, categories and a plan (POST /api/sample-data). The wait is said at once; a failure is
 * said next to the button, which is also the way to try again. `loaded` fires when the data is there.
 */
@Component({
  selector: 'app-sample-data',
  imports: [TPipe, IconComponent],
  template: `
    <button type="button" class="btn" (click)="load()" [disabled]="busy()">
      <app-icon name="file"/>{{ (busy() ? 'sample.loading' : 'sample.load') | t }}</button>
    @if (busy()) {
      <span class="sr-only" role="status">{{ 'sample.loading' | t }}</span>
    }
    @if (error(); as e) {
      <p class="err" role="alert"><app-icon name="error"/><span>{{ e | t }}</span></p>
    }`,
  styles: [`
    :host { display: contents; }
    .err { flex-basis: 100%; display: flex; gap: 6px; align-items: flex-start; margin: 0; color: var(--bad);
      font-weight: 600; --icon-size: 16px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SampleDataComponent {
  private http = inject(HttpClient);
  readonly loaded = output<void>();
  readonly busy = signal(false);
  readonly error = signal<MessageKey | null>(null);

  load(): void {
    this.busy.set(true);
    this.error.set(null);
    this.http.post('/api/sample-data', null).pipe(timeout(SAMPLE_TIMEOUT_MS)).subscribe({
      next: () => {
        this.busy.set(false);
        this.loaded.emit();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        // 409: the account has data already (another tab loaded it, or an import): nothing to add
        this.error.set(err instanceof HttpErrorResponse && err.status === 409 ? 'sample.conflict' : 'sample.failed');
      }
    });
  }
}
