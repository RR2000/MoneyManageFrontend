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
import {MonteCarloComponent} from "../monte-carlo/monte-carlo.component";
import {environment} from "../../environments/environment";

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
    MatTabContent,
    MonteCarloComponent
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

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  private startOfDay(date: Date): string {
    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())} 00:00:00.000`;
  }

  private endOfDay(date: Date): string {
    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())} 23:59:59.999`;
  }

  getDataAndRenderComponents() {
    const today = new Date();
    const from = new Date(today);
    from.setMonth(from.getMonth() - 6);

    const fromTimestamp = this.startOfDay(from);
    const toTimestamp = this.endOfDay(today);
    const apiUrlPrefix = `${environment.apiBaseUrl}/api/banks/transactions/`;
    const graphDataApi = `${apiUrlPrefix}graph/${encodeURIComponent(fromTimestamp)}/${encodeURIComponent(toTimestamp)}`;
    const brokerGraph: string = `${environment.apiBaseUrl}/api/brokers/transactions/worth/graph`;
    const accountsListApi = `${apiUrlPrefix}accounts`;

    this.http.get<GraphPointsDto>(graphDataApi).subscribe({
      next: (data: GraphPointsDto) => {
        this.graphPoints = data;
      },
      error: (err) => console.error('Failed to load bank graph data', err)
    });

    this.http.get<GraphPointsDto>(brokerGraph).subscribe({
      next: (data: GraphPointsDto) => {
        this.brokerGraph = data;
      },
      error: (err) => console.error('Failed to load broker graph data', err)
    });

    this.http.get<string[]>(accountsListApi).subscribe({
      next: (accountNames: string[]) => {
        accountNames.forEach(accountName => {
          const accountTableApi = `${apiUrlPrefix}table/${encodeURIComponent(fromTimestamp)}/${encodeURIComponent(toTimestamp)}?accountName=${accountName}`;
          this.http.get<TransactionDto[]>(accountTableApi).subscribe({
            next: (data: TransactionDto[]) => {
              this.accountsData = {
                ...this.accountsData,
                [accountName]: data
              };
            },
            error: (err) => console.error(`Failed to load transactions for ${accountName}`, err)
          });
        });
      },
      error: (err) => console.error('Failed to load account list', err)
    });
  }
}
