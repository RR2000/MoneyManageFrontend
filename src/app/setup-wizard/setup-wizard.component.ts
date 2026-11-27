import {Component, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {MatStepperModule} from '@angular/material/stepper';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatListModule} from '@angular/material/list';
import {RouterLink} from '@angular/router';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';

@Component({
  selector: 'app-setup-wizard',
  imports: [
    CommonModule,
    FormsModule,
    MatStepperModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatListModule,
    RouterLink,
    TPipe
  ],
  templateUrl: './setup-wizard.component.html',
  styleUrl: './setup-wizard.component.css'
})
export class SetupWizardComponent {
  private i18n = inject(I18nService);
  bankName: string = 'Revolut';
  bankFile: File | null = null;
  bankUploadResult = signal('');
  bankUploadLoading = signal(false);

  brokerFile: File | null = null;
  brokerUploadResult = signal('');
  brokerUploadLoading = signal(false);

  accounts = signal<string[]>([]);
  accountBalances: { [account: string]: string } = {};
  cumulativeResults = signal<{ [account: string]: string }>({});
  cumulativeLoading = signal(false);

  constructor(private http: HttpClient) {}

  onBankFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.bankFile = input.files?.[0] ?? null;
  }

  uploadBankCsv() {
    if (!this.bankFile) return;
    this.bankUploadLoading.set(true);
    const form = new FormData();
    form.append('multipartFile', this.bankFile);
    this.http.post<unknown[]>(`/api/banks/transactions/${this.bankName}/upload`, form).subscribe({
      next: (rows) => {
        this.bankUploadResult.set(this.i18n.t('setup.bankUploaded', {count: rows.length}));
        this.bankUploadLoading.set(false);
      },
      error: (err) => {
        this.bankUploadResult.set(this.i18n.t('common.error', {message: err.error?.message ?? err.message}));
        this.bankUploadLoading.set(false);
      }
    });
  }

  onBrokerFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.brokerFile = input.files?.[0] ?? null;
  }

  uploadBrokerCsv() {
    if (!this.brokerFile) return;
    this.brokerUploadLoading.set(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      this.http.post(`/api/brokers/transactions/upload`, csv, {
        headers: new HttpHeaders({'Content-Type': 'text/csv'}),
        responseType: 'text'
      }).subscribe({
        next: () => {
          this.brokerUploadResult.set(this.i18n.t('setup.brokerUploaded'));
          this.brokerUploadLoading.set(false);
        },
        error: (err) => {
          this.brokerUploadResult.set(this.i18n.t('common.error', {message: err.error?.message ?? err.message}));
          this.brokerUploadLoading.set(false);
        }
      });
    };
    reader.readAsText(this.brokerFile);
  }

  loadAccounts() {
    this.http.get<string[]>(`/api/banks/transactions/accounts`).subscribe(accounts => {
      this.accounts.set(accounts);
      accounts.forEach(a => this.accountBalances[a] = '');
    });
  }

  computeAll() {
    this.cumulativeLoading.set(true);
    let remaining = this.accounts().length;
    this.accounts().forEach(account => {
      const balance = this.accountBalances[account];
      if (!balance) {
        remaining--;
        if (remaining === 0) this.cumulativeLoading.set(false);
        return;
      }
      // the amount in the body, not in the URL: URLs end up in the access logs
      this.http.post(`/api/banks/transactions/accounts/${encodeURIComponent(account)}/balance`,
        {amountToday: Number(String(balance).replace(',', '.'))}).subscribe({
        next: () => {
          this.cumulativeResults.update(r => ({...r, [account]: 'OK'}));
          remaining--;
          if (remaining === 0) this.cumulativeLoading.set(false);
        },
        error: (err) => {
          this.cumulativeResults.update(r => ({...r, [account]: this.i18n.t('common.error', {message: err.error?.message ?? err.message})}));
          remaining--;
          if (remaining === 0) this.cumulativeLoading.set(false);
        }
      });
    });
  }
}
