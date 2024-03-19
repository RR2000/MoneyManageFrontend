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
  @Input() accountsData: { account: string; transactions: TransactionDto[] }[] = [];
  columns: string[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if ('accountsData' in changes) {
      console.log("Accounts data changed");
      this.generateColumns();
    }
  }

  generateColumns(): void {
    const uniqueAccounts = new Set<string>();
    Object.values(this.accountsData).forEach(txs => {
        uniqueAccounts.add(txs.account);
    });
    this.columns = Array.from(uniqueAccounts);
  }

  protected readonly Object = Object;
}
