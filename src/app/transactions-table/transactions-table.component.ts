import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { TransactionDto } from "../../models/transaction.dto";
import {NgForOf, NgIf} from "@angular/common";

@Component({
  selector: 'app-transactions-table',
  templateUrl: './transactions-table.component.html',
  standalone: true,
  imports: [
    NgForOf,
    NgIf
  ],
  styleUrls: ['./transactions-table.component.css']
})
export class TransactionsTableComponent implements OnChanges {
  @Input() accountsData: { [key: string]: TransactionDto[] } = {};
  columns: string[] = [];
  sortedTransactions: TransactionDto[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accountsData'] && this.accountsData) {
      console.log("changed:" + Object.keys(this.accountsData));
      this.generateColumns();
      this.sortTransactionsByDatetime();
    }
  }

  generateColumns(): void {
    this.columns = Object.keys(this.accountsData);
  }

  sortTransactionsByDatetime(): void {
    // Flatten transactions from all accounts
    const allTransactions = Object.values(this.accountsData).reduce((acc, val) => acc.concat(val), []);
    // Sort transactions by datetime
    this.sortedTransactions = allTransactions.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    // Truncate datetime to just the date part
    this.sortedTransactions.forEach(transaction => {
      const date = new Date(transaction.datetime);
      transaction.datetime = date.toISOString().split('T')[0]; // Extract date part
    });
  }
}
