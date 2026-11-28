import {Component, inject, input, output, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {AccountsService} from './accounts.service';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {errorCode} from '../banks/banking.service';
import {IconComponent} from '../ui/icon.component';

/**
 * "Delete account": says what disappears (rows and period), and deletes only when the name is typed again, character
 * by character. An account where a bank imports cannot be deleted (the page says so instead of showing this).
 */
@Component({
  selector: 'app-delete-account',
  imports: [FormsModule, TPipe, IconComponent],
  template: `
    @if (!confirming()) {
      <button type="button" class="btn danger" (click)="ask()"><app-icon name="trash"/>{{ 'accounts.delete' | t }}</button>
    } @else {
      <form class="confirm" role="alert" (ngSubmit)="delete()">
        <p class="what"><app-icon name="warn"/>{{ 'accounts.delete.what' | t: {rows: rowsText(), period: period()} }}</p>
        <label>{{ 'accounts.delete.type' | t: {name: name()} }}
          <input name="typed" [(ngModel)]="typed" autocomplete="off" autocapitalize="off" spellcheck="false"
                 [disabled]="deleting()">
        </label>
        <div class="buttons">
          <button type="submit" class="btn danger" [disabled]="typed !== name() || deleting()">
            {{ (deleting() ? 'accounts.delete.working' : 'accounts.delete.yes') | t }}
          </button>
          <button type="button" class="btn" (click)="cancel()" [disabled]="deleting()">{{ 'common.cancel' | t }}</button>
        </div>
      </form>
      @if (error()) {
        <p class="error-text" role="alert"><app-icon name="error"/>{{ error() }}</p>
      }
    }`,
  styles: [`
    :host { display: grid; gap: 8px; }
    :host > .btn { justify-self: start; }
    .confirm { display: grid; gap: 10px; padding: 12px 14px; border-radius: 10px; background: var(--warn-bg);
      color: var(--fg); border: 1px solid var(--warn); }
    .what { margin: 0; display: flex; gap: 8px; font-weight: 600; color: var(--warn); }
    label { display: grid; gap: 4px; font-size: .9rem; }
    input { padding: 8px; min-height: 40px; width: 100%; max-width: 24rem; font-size: 16px; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; }
    .error-text { display: flex; gap: 6px; margin: 0; color: var(--bad); }
  `]
})
export class DeleteAccountComponent {
  readonly name = input.required<string>();
  readonly rows = input(0);
  readonly firstDate = input<string | null>(null);
  readonly lastDate = input<string | null>(null);
  /** the account is gone: the text to show ("X deleted (N movements).") */
  readonly deleted = output<string>();

  private i18n = inject(I18nService);
  private service = inject(AccountsService);
  readonly confirming = signal(false);
  readonly deleting = signal(false);
  readonly error = signal('');
  typed = '';

  rowsText(count = this.rows()): string {
    return count === 1 ? this.i18n.t('accounts.rows.one') : this.i18n.t('accounts.rows', {count});
  }

  period(): string {
    return this.i18n.t('accounts.period', {from: this.i18n.date(this.firstDate()), to: this.i18n.date(this.lastDate())});
  }

  ask(): void {
    this.confirming.set(true);
    this.typed = '';
    this.error.set('');
  }

  cancel(): void {
    this.confirming.set(false);
    this.typed = '';
    this.error.set('');
  }

  delete(): void {
    if (this.typed !== this.name()) {
      return;
    }
    this.deleting.set(true);
    this.error.set('');
    this.service.delete(this.name(), this.typed).subscribe({
      next: result => {
        this.deleting.set(false);
        this.confirming.set(false);
        this.deleted.emit(this.i18n.t('accounts.delete.done', {name: this.name(), rows: this.rowsText(result.rows)}));
      },
      error: (err: unknown) => {
        this.deleting.set(false);
        const code = errorCode(err);
        const key = `accounts.error.${code}`;
        this.error.set(code && this.i18n.has(key) ? this.i18n.t(key as MessageKey)
          : err instanceof HttpErrorResponse && err.status === 429 ? this.i18n.t('common.tooMany')
            : this.i18n.t('accounts.delete.error'));
      }
    });
  }
}
