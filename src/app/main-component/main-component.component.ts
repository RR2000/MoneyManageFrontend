import {Component, OnInit} from '@angular/core';
import {LineGraphComponent} from "../line-graph/line-graph.component";
import {CommonModule, NgIf} from "@angular/common";
import {TransactionsTableComponent} from "../transactions-table/transactions-table.component";
import {TransactionDto} from "../../models/transaction.dto";
import {HttpClient} from "@angular/common/http";
import {GraphPointsDto} from "../../models/graph-points.dto";
import {MatTableModule} from "@angular/material/table";
import {MatTab, MatTabContent, MatTabGroup} from "@angular/material/tabs";
import {LineGraph2Component} from "../broker-worth-graph/broker-worth-graph.component";

@Component({
  selector: 'app-main-component',
  standalone: true,
  imports: [
    LineGraphComponent,
    NgIf,
    TransactionsTableComponent,
    MatTableModule,
    CommonModule,
    MatTab,
    MatTabGroup,
    LineGraph2Component,
    MatTabContent
  ],
  templateUrl: './main-component.component.html',
  styleUrl: './main-component.component.css'
})
export class MainComponentComponent implements OnInit {
  accountsData: { [account: string]: TransactionDto[] } = {};
  graphPoints: GraphPointsDto = <GraphPointsDto>{};
  brokerGraph: GraphPointsDto = <GraphPointsDto>{};

  constructor(private http: HttpClient) {
  }

  ngOnInit(): void {
    this.getDataAndRenderComponents();
  }

  getDataAndRenderComponents() {
    const fromTimestamp = '2024-02-01 00:00:00.000';
    const toTimestamp = '2024-03-20 23:59:59.999';
    const apiUrlPrefix = 'http://localhost:8080/api/banks/transactions/';
    const graphDataApi = `${apiUrlPrefix}graph/${encodeURIComponent(fromTimestamp)}/${encodeURIComponent(toTimestamp)}`;
    const brokerGraph: string = "http://localhost:8080/api/brokers/transactions/worth/graph";
    const accountsListApi = `${apiUrlPrefix}accounts`;

    this.http.get<GraphPointsDto>(graphDataApi).subscribe((data: GraphPointsDto) => {
      this.graphPoints = data;
    });

    this.http.get<GraphPointsDto>(brokerGraph).subscribe((data: GraphPointsDto) => {
      this.brokerGraph = data;
    });

    this.http.get<string[]>(accountsListApi).subscribe((accountNames: string[]) => {
      accountNames.forEach(accountName => {
        const accountTableApi = `${apiUrlPrefix}table/${encodeURIComponent(fromTimestamp)}/${encodeURIComponent(toTimestamp)}?accountName=${accountName}`;
        this.http.get<TransactionDto[]>(accountTableApi).subscribe((data: TransactionDto[]) => {
          this.accountsData = {
            ...this.accountsData,
            [accountName]: data
          };
        });
      });
    })
  }
}
