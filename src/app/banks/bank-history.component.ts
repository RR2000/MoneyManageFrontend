import {Component, computed, inject, input, output, signal} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {timeout} from 'rxjs';
import {BankAccount, BankingService, errorCode, ReplaceResult} from './banking.service';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {IconComponent} from '../ui/icon.component';

/** reading the whole history of a bank may take a while */
const READ_TIMEOUT_MS = 180 * 1000;
const CALL_TIMEOUT_MS = 60 * 1000;

/**
 * The bank's history of one money account: how far back it goes, and the two clean-ups, each with a preview and its
 * own confirmation: "replace with the bank's data" (from the bank's first day on only the bank's movements) and
 * "delete the older rows" (before the bank's first day). Nothing is deleted without the user's click on "Yes".
 */
@Component({
  selector: 'app-bank-history',
  imports: [TPipe, IconComponent],
  templateUrl: './bank-history.component.html',
  styleUrl: './banks.component.css'
})
export class BankHistoryComponent {
  readonly account = input.required<BankAccount>();
  /** the consent is active: the bank can be read */
  readonly active = input(true);
  /** something else on the page waits for the server */
  readonly disabled = input(false);
  /** rows were deleted or added: the page reads the links again */
  readonly changed = output<void>();

  readonly i18n = inject(I18nService);
  private banking = inject(BankingService);

  reading = signal(false);
  preview = signal<ReplaceResult | null>(null);
  replacing = signal(false);
  replaced = signal<ReplaceResult | null>(null);
  error = signal('');

  confirmOlder = signal(false);
  deletingOlder = signal(false);
  olderDeleted = signal<number | null>(null);

  readonly working = computed(() => this.reading() || this.replacing() || this.deletingOlder());

  askReplace(): void {
    this.reading.set(true);
    this.preview.set(null);
    this.replaced.set(null);
    this.olderDeleted.set(null);
    this.confirmOlder.set(false);
    this.error.set('');
    this.banking.replacePreview(this.account().id).pipe(timeout(READ_TIMEOUT_MS)).subscribe({
      next: preview => {
        this.reading.set(false);
        this.preview.set(preview);
      },
      error: (err: unknown) => {
        this.reading.set(false);
        this.error.set(this.errorText(err, 'banks.replace.error'));
      }
    });
  }

  cancelReplace(): void {
    this.preview.set(null);
  }

  replace(): void {
    const preview = this.preview();
    if (!preview?.token) {
      return;
    }
    this.replacing.set(true);
    this.error.set('');
    this.banking.replace(this.account().id, preview.token).pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: result => {
        this.replacing.set(false);
        this.preview.set(null);
        this.replaced.set(result);
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.replacing.set(false);
        this.preview.set(null);
        this.error.set(this.errorText(err, 'banks.replace.error'));
      }
    });
  }

  askOlder(): void {
    this.confirmOlder.set(true);
    this.olderDeleted.set(null);
    this.replaced.set(null);
    this.error.set('');
  }

  keepOlder(): void {
    this.confirmOlder.set(false);
  }

  deleteOlder(): void {
    const before = this.account().bankFrom;
    if (!before) {
      return;
    }
    this.deletingOlder.set(true);
    this.error.set('');
    this.banking.deleteOlder(this.account().id, before).pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: result => {
        this.deletingOlder.set(false);
        this.confirmOlder.set(false);
        this.olderDeleted.set(result.deleted);
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.deletingOlder.set(false);
        this.confirmOlder.set(false);
        this.error.set(this.errorText(err, 'banks.older.error'));
      }
    });
  }

  /** an amount of the preview in the account's currency, a dash when there is none */
  amount(value: number | null | undefined, currency: string | null | undefined): string {
    return value === null || value === undefined ? '-' : this.i18n.money(value, currency ?? this.account().currency);
  }

  private errorText(err: unknown, fallback: MessageKey): string {
    const code = errorCode(err);
    if (code && this.i18n.has(`banks.error.${code}`)) {
      const text = this.i18n.t(`banks.error.${code}` as MessageKey);
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
    if (err instanceof HttpErrorResponse && err.status === 429) {
      return this.i18n.t('banks.tooMany');
    }
    return code ? `${this.i18n.t(fallback)} (${code})` : this.i18n.t(fallback);
  }
}
