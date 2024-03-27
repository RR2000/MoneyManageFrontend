import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { TransactionDto } from "../../models/transaction.dto";
import {CommonModule, NgForOf, NgIf} from "@angular/common";
import { MatTableModule } from '@angular/material/table'; // Import MatTableModule

import {
  MatCell,
  MatCellDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef, MatRow, MatRowDef,
  MatTable,
  MatColumnDef
} from "@angular/material/table";

@Component({
  selector: 'app-transactions-table',
  templateUrl: './transactions-table.component.html',
  standalone: true,
  imports: [
    CommonModule,
    NgForOf,
    NgIf,
    MatTable,
    MatHeaderCell,
    MatHeaderCellDef,
    MatCell,
    MatCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRowDef,
    MatRow,
    MatColumnDef,
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
  getHeaderColumns(): string[] {
    return ['datetime', 'description', ...this.columns];
  }

}
