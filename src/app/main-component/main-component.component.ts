import {Component, OnDestroy, OnInit, signal} from '@angular/core';
import {LineGraphComponent} from "../line-graph/line-graph.component";
import {RouterLink} from "@angular/router";
import {TransactionsTableComponent} from "../transactions-table/transactions-table.component";
import {TransactionDto} from "../../models/transaction.dto";
import {HttpClient} from "@angular/common/http";
import {GraphPointsDto} from "../../models/graph-points.dto";
import {MatTab, MatTabContent, MatTabGroup} from "@angular/material/tabs";
import {MonteCarloComponent} from "../monte-carlo/monte-carlo.component";
import {InstrumentsComponent} from "../instruments/instruments.component";
import {interval, Subscription, timeout} from "rxjs";
import {TPipe} from "../i18n/t.pipe";
import {MessageKey} from "../i18n/messages.en";

const BROKER_GRAPH_REFRESH_MS = 5 * 60 * 1000;
/** no call keeps the page waiting longer than this: then it says so, with "Retry" */
export const CALL_TIMEOUT_MS = 30 * 1000;
const FAILED: MessageKey = 'common.loadFailed';

@Component({
  selector: 'app-main-component',
  imports: [
    LineGraphComponent,
    TransactionsTableComponent,
    RouterLink,
    MatTab,
    MatTabGroup,
    MatTabContent,
    MonteCarloComponent,
    InstrumentsComponent,
    TPipe
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
  bankGraphLoading = signal(true);
  /** key of the text of the error, '' if none */
  bankGraphError = signal<MessageKey | ''>('');
  brokerGraphLoading = signal(true);
  brokerGraphError = signal<MessageKey | ''>('');
  accountsError = signal<MessageKey | ''>('');

  private brokerRefreshSubscription?: Subscription;

  constructor(private http: HttpClient) {
  }

  ngOnInit(): void {
    this.getDataAndRenderComponents();
    this.brokerRefreshSubscription = interval(BROKER_GRAPH_REFRESH_MS).subscribe(() => {
      this.refreshBrokerGraph(true);
    });
  }

  ngOnDestroy(): void {
    this.brokerRefreshSubscription?.unsubscribe();
  }

  /** `quiet`: the periodic refresh, which keeps the chart on screen instead of showing "Loading...". */
  refreshBrokerGraph(quiet = false) {
    if (!quiet) {
      this.brokerGraphLoading.set(true);
    }
    this.http.get<GraphPointsDto>(`/api/brokers/transactions/worth/graph`).pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: (data: GraphPointsDto) => {
        this.brokerGraph.set(data);
        this.brokerGraphError.set('');
        this.brokerGraphLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to refresh broker graph', err);
        this.brokerGraphLoading.set(false);
        // a failed background refresh leaves the chart that is already there
        if (!quiet || !this.brokerGraph().uniqueGraphNames?.length) {
          this.brokerGraphError.set(FAILED);
        }
      }
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

    this.bankGraphLoading.set(true);
    this.bankGraphError.set('');
    this.http.get<GraphPointsDto>(graphDataApi).pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: (data: GraphPointsDto) => {
        this.graphPoints.set(data);
        this.bankGraphLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load bank graph data', err);
        this.bankGraphLoading.set(false);
        this.bankGraphError.set(FAILED);
      }
    });

    this.brokerGraphError.set('');
    this.refreshBrokerGraph();

    this.accountsError.set('');
    this.http.get<string[]>(accountsListApi).pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
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
      error: (err) => {
        console.error('Failed to load account list', err);
        this.accountsError.set(FAILED);
      }
    });
  }
}
