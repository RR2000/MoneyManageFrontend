import {Component, Input, OnInit} from '@angular/core';
import {LineGraphComponent} from "../line-graph/line-graph.component";
import {NgIf} from "@angular/common";
import {TransactionsTableComponent} from "../transactions-table/transactions-table.component";
import {TransactionDto} from "../../models/transaction.dto";
import {HttpClient} from "@angular/common/http";
import {GraphPointsDto} from "../../models/graph-points.dto";

@Component({
  selector: 'app-main-component',
  standalone: true,
  imports: [
    LineGraphComponent,
    NgIf,
    TransactionsTableComponent
  ],
  templateUrl: './main-component.component.html',
  styleUrl: './main-component.component.css'
})
export class MainComponentComponent implements OnInit {
  accountsData: { [account: string]: TransactionDto[] } = {};
  graphPoints: GraphPointsDto = <GraphPointsDto>{};

  constructor(private http: HttpClient) {
  }

  ngOnInit(): void {
    this.getDataAndRenderComponents();
  }

  getDataAndRenderComponents() {
    const fromTimestamp = '2024-03-01 00:00:00.000';
    const toTimestamp = '2024-03-31 23:59:59.999';
    const accountNames = ['Revolut_Current', 'Revolut_Savings', 'Revolut_Pocket']; // Define all account names
    const apiUrlPrefix = 'http://localhost:8080/api/transactions/';
    const newApi = `${apiUrlPrefix}${encodeURIComponent(fromTimestamp)}/${encodeURIComponent(toTimestamp)}`;

    this.http.get<GraphPointsDto>(newApi).subscribe((data: GraphPointsDto) => {
      this.graphPoints = data;
    });

    /*
    accountNames.forEach(accountName => {
      const apiUrl = `${apiUrlPrefix}${encodeURIComponent(fromTimestamp)}/${encodeURIComponent(toTimestamp)}?accountName=${accountName}`;
      this.http.get<TransactionDto[]>(apiUrl).subscribe((data: TransactionDto[]) => {
        this.accountsData = {
          ...this.accountsData,
          [accountName]: data
        };
      });
    });*/
  }
}
