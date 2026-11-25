import {Component, Input, OnChanges} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {TransactionDto} from "../../models/transaction.dto";

export interface TransactionRow {
  date: string;
  description: string;
  account: string;
  amount: number;
}

/** Movements of all accounts in one list, newest first, one amount column per account. */
@Component({
  selector: 'app-transactions-table',
  templateUrl: './transactions-table.component.html',
  imports: [DecimalPipe],
  styleUrls: ['./transactions-table.component.css']
})
export class TransactionsTableComponent implements OnChanges {
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
        amount: tx.amount
      })))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
}
