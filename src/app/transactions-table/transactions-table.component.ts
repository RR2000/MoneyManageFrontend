import {Component, inject, Input, OnChanges} from '@angular/core';
import {TPipe} from '../i18n/t.pipe';
import {NumPipe} from '../i18n/num.pipe';
import {I18nService} from '../i18n/i18n.service';
import {TransactionDto} from "../../models/transaction.dto";

export interface TransactionRow {
  date: string;
  description: string;
  account: string;
  amount: number;
  /** sent by the bank (open banking) */
  fromBank: boolean;
}

/** Movements of all accounts in one list, newest first, one amount column per account. */
@Component({
  selector: 'app-transactions-table',
  templateUrl: './transactions-table.component.html',
  imports: [NumPipe, TPipe],
  styleUrls: ['./transactions-table.component.css']
})
export class TransactionsTableComponent implements OnChanges {
  readonly i18n = inject(I18nService);
  @Input() accountsData: { [account: string]: TransactionDto[] } = {};
  columns: string[] = [];
  rows: TransactionRow[] = [];

  ngOnChanges(): void {
    this.columns = Object.keys(this.accountsData ?? {}).sort();
    this.rows = Object.entries(this.accountsData ?? {})
      .flatMap(([account, txs]) => txs.map(tx => ({
        date: String(tx.datetime).substring(0, 10),
        description: tx.description,
        account,
        amount: tx.amount,
        fromBank: tx.source === 'BANK'
      })))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
}
