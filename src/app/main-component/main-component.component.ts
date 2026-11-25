import {Component, OnDestroy, OnInit, signal} from '@angular/core';
import {LineGraphComponent} from "../line-graph/line-graph.component";
import {RouterLink} from "@angular/router";
import {TransactionsTableComponent} from "../transactions-table/transactions-table.component";
import {TransactionDto} from "../../models/transaction.dto";
import {HttpClient} from "@angular/common/http";
import {GraphPointsDto} from "../../models/graph-points.dto";
import {MatTab, MatTabContent, MatTabGroup} from "@angular/material/tabs";
import {RealEstateComponent} from "../real-estate/real-estate.component";
import {MonteCarloComponent} from "../monte-carlo/monte-carlo.component";
import {interval, Subscription} from "rxjs";

const BROKER_GRAPH_REFRESH_MS = 5 * 60 * 1000;

@Component({
  selector: 'app-main-component',
  imports: [
    LineGraphComponent,
    TransactionsTableComponent,
    RouterLink,
    MatTab,
    MatTabGroup,
    MatTabContent,
    RealEstateComponent,
    MonteCarloComponent
  ],
  templateUrl: './main-component.component.html',
  styleUrl: './main-component.component.css'
})
export class MainComponentComponent implements OnInit, OnDestroy {
  accountsData = signal<{ [account: string]: TransactionDto[] }>({});
  graphPoints = signal(<GraphPointsDto>{});
  brokerGraph = signal(<GraphPointsDto>{});
  accountNames = signal<string[]>([]);
  loaded = signal(false);
  sampleLoading = signal(false);

  private brokerRefreshSubscription?: Subscription;

  constructor(private http: HttpClient) {
  }

  ngOnInit(): void {
    this.getDataAndRenderComponents();
    this.brokerRefreshSubscription = interval(BROKER_GRAPH_REFRESH_MS).subscribe(() => {
      this.refreshBrokerGraph();
    });
  }

  ngOnDestroy(): void {
    this.brokerRefreshSubscription?.unsubscribe();
  }

  refreshBrokerGraph() {
    this.http.get<GraphPointsDto>(`/api/brokers/transactions/worth/graph`).subscribe({
      next: (data: GraphPointsDto) => {
        this.brokerGraph.set(data);
      },
      error: (err) => console.error('Failed to refresh broker graph', err)
    });
  }

  loadSampleData() {
    this.sampleLoading.set(true);
    this.http.post('/api/sample-data', null).subscribe({
      next: () => {
        this.sampleLoading.set(false);
        this.getDataAndRenderComponents();
      },
      error: (err) => {
        this.sampleLoading.set(false);
        console.error('Failed to load sample data', err);
      }
    });
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
    const apiUrlPrefix = `/api/banks/transactions/`;
    const graphDataApi = `${apiUrlPrefix}graph/${encodeURIComponent(fromTimestamp)}/${encodeURIComponent(toTimestamp)}`;
    const accountsListApi = `${apiUrlPrefix}accounts`;

    this.http.get<GraphPointsDto>(graphDataApi).subscribe({
      next: (data: GraphPointsDto) => {
        this.graphPoints.set(data);
      },
      error: (err) => console.error('Failed to load bank graph data', err)
    });

    this.refreshBrokerGraph();

    this.http.get<string[]>(accountsListApi).subscribe({
      next: (accountNames: string[]) => {
        this.accountNames.set(accountNames);
        this.loaded.set(true);
        accountNames.forEach(accountName => {
          const accountTableApi = `${apiUrlPrefix}table/${encodeURIComponent(fromTimestamp)}/${encodeURIComponent(toTimestamp)}?accountName=${encodeURIComponent(accountName)}`;
          this.http.get<TransactionDto[]>(accountTableApi).subscribe({
            next: (data: TransactionDto[]) => {
              this.accountsData.update(all => ({...all, [accountName]: data}));
            },
            error: (err) => console.error(`Failed to load transactions for ${accountName}`, err)
          });
        });
      },
      error: (err) => console.error('Failed to load account list', err)
    });
  }
}
