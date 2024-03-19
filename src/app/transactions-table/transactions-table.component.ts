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
export class TransactionsTableComponent implements OnChanges  {
  @Input() accountsData: { [key: string]: TransactionDto[] } = {};
  columns: string[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accountsData'] && this.accountsData) {
      console.log("changed:" + Object.keys(this.accountsData));
      this.generateColumns();
    }
  }

  generateColumns(): void {
    const uniqueAccounts = new Set<string>();
    Object.keys(this.accountsData).forEach(accountName => {
      this.accountsData[accountName].forEach(transaction => {
        uniqueAccounts.add(transaction.account);
      });
    });
    this.columns = Array.from(uniqueAccounts);
  }

  protected readonly Object = Object;
}
