import {Component, OnDestroy, OnInit, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {interval, Subscription, timeout} from 'rxjs';
import {LineGraphComponent} from '../line-graph/line-graph.component';
import {InstrumentsComponent} from '../instruments/instruments.component';
import {GraphPointsDto} from '../../models/graph-points.dto';
import {PageHeaderComponent} from '../ui/page-header.component';
import {TPipe} from '../i18n/t.pipe';
import {MessageKey} from '../i18n/messages.en';
import {CALL_TIMEOUT_MS} from '../main-component/main-component.component';

const REFRESH_MS = 5 * 60 * 1000;

/** /investments: worth of the portfolio over time and the instruments with their prices. */
@Component({
  selector: 'app-investments-page',
  imports: [PageHeaderComponent, LineGraphComponent, InstrumentsComponent, TPipe],
  template: `
    <div class="page">
      <app-page-header [title]="'nav.investments' | t"/>
      <app-line-graph [graphPoints]="graph()" [loading]="loading()" [error]="error() | t" (retry)="load()"
                      [emptyText]="'dashboard.noInvestments' | t"></app-line-graph>
      <app-instruments (changed)="load()"></app-instruments>
    </div>`
})
export class InvestmentsPageComponent implements OnInit, OnDestroy {
  readonly graph = signal(<GraphPointsDto>{});
  readonly loading = signal(true);
  readonly error = signal<MessageKey | ''>('');
  private refresh?: Subscription;

  constructor(private http: HttpClient) {
  }

  ngOnInit(): void {
    this.load();
    this.refresh = interval(REFRESH_MS).subscribe(() => this.load(true));
  }

  ngOnDestroy(): void {
    this.refresh?.unsubscribe();
  }

  /** `quiet`: the periodic refresh keeps the chart on screen, also when it fails */
  load(quiet = false): void {
    if (!quiet) {
      this.loading.set(true);
      this.error.set('');
    }
    this.http.get<GraphPointsDto>('/api/brokers/transactions/worth/graph').pipe(timeout(CALL_TIMEOUT_MS)).subscribe({
      next: data => {
        this.graph.set(data);
        this.error.set('');
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        if (!quiet || !this.graph().uniqueGraphNames?.length) {
          this.error.set('common.loadFailed');
        }
      }
    });
  }
}
