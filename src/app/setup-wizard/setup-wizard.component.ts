import {Component} from '@angular/core';
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
import {environment} from '../../environments/environment';

@Component({
  selector: 'app-setup-wizard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatStepperModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatListModule,
    RouterLink
  ],
  templateUrl: './setup-wizard.component.html',
  styleUrl: './setup-wizard.component.css'
})
export class SetupWizardComponent {
  bankName: string = 'Revolut';
  bankFile: File | null = null;
  bankUploadResult: string = '';
  bankUploadLoading = false;

  brokerFile: File | null = null;
  brokerUploadResult: string = '';
  brokerUploadLoading = false;

  accounts: string[] = [];
  accountBalances: { [account: string]: string } = {};
  cumulativeResults: { [account: string]: string } = {};
  cumulativeLoading = false;

  private api = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  onBankFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.bankFile = input.files?.[0] ?? null;
  }

  uploadBankCsv() {
    if (!this.bankFile) return;
    this.bankUploadLoading = true;
    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      this.http.post(`${this.api}/api/banks/transactions/${this.bankName}/upload`, csv, {
        headers: new HttpHeaders({'Content-Type': 'text/csv'}),
        responseType: 'text'
      }).subscribe({
        next: () => {
          this.bankUploadResult = 'Upload completato con successo.';
          this.bankUploadLoading = false;
        },
        error: (err) => {
          this.bankUploadResult = `Errore: ${err.message}`;
          this.bankUploadLoading = false;
        }
      });
    };
    reader.readAsText(this.bankFile);
  }

  onBrokerFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.brokerFile = input.files?.[0] ?? null;
  }

  uploadBrokerCsv() {
    if (!this.brokerFile) return;
    this.brokerUploadLoading = true;
    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      this.http.post(`${this.api}/api/brokers/transactions/upload`, csv, {
        headers: new HttpHeaders({'Content-Type': 'text/csv'}),
        responseType: 'text'
      }).subscribe({
        next: () => {
          this.brokerUploadResult = 'Upload completato con successo.';
          this.brokerUploadLoading = false;
        },
        error: (err) => {
          this.brokerUploadResult = `Errore: ${err.message}`;
          this.brokerUploadLoading = false;
        }
      });
    };
    reader.readAsText(this.brokerFile);
  }

  loadAccounts() {
    this.http.get<string[]>(`${this.api}/api/banks/transactions/accounts`).subscribe(accounts => {
      this.accounts = accounts;
      accounts.forEach(a => this.accountBalances[a] = '');
    });
  }

  computeAll() {
    this.cumulativeLoading = true;
    let remaining = this.accounts.length;
    this.accounts.forEach(account => {
      const balance = this.accountBalances[account];
      if (!balance) {
        remaining--;
        if (remaining === 0) this.cumulativeLoading = false;
        return;
      }
      this.http.get(`${this.api}/api/banks/transactions/accounts/${account}/computeCumulativeAmount/${balance}`).subscribe({
        next: () => {
          this.cumulativeResults[account] = 'OK';
          remaining--;
          if (remaining === 0) this.cumulativeLoading = false;
        },
        error: (err) => {
          this.cumulativeResults[account] = `Errore: ${err.message}`;
          remaining--;
          if (remaining === 0) this.cumulativeLoading = false;
        }
      });
    });
  }
}
