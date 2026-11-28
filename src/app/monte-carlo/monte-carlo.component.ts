import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {GraphPointsDto} from '../../models/graph-points.dto';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {ChartBand, ChartComponent, ChartSeries} from '../ui/chart.component';
import {LoadStateComponent} from '../ui/load-state.component';

/** Monte Carlo projection of the portfolio: median line, P25-P75 and P5-P95 as lines with their own dash. */
@Component({
  selector: 'app-monte-carlo',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, TPipe, ChartComponent, LoadStateComponent],
  templateUrl: './monte-carlo.component.html',
  styleUrl: './monte-carlo.component.css'
})
export class MonteCarloComponent {
  years = 10;
  simulations = 5000;
  loading = signal(false);
  error = signal('');
  readonly data = signal<GraphPointsDto | null>(null);

  private api = `/api/montecarlo`;
  private i18n = inject(I18nService);

  readonly labels = computed(() => [...(this.data()?.uniqueLabels ?? [])]);
  private values(name: string): (number | null)[] {
    const d = this.data();
    return this.labels().map(l => d?.graphData?.[name]?.[l] ?? null);
  }
  readonly series = computed<ChartSeries[]>(() => {
    if (!this.data()) {
      return [];
    }
    return [
      {name: 'P50 · ' + this.i18n.t('monteCarlo.median'), values: this.values('P50'), color: 0, dash: 0, width: 2.5},
      {name: 'P25', values: this.values('P25'), color: 1, dash: 1, width: 1.5},
      {name: 'P75', values: this.values('P75'), color: 2, dash: 1, width: 1.5},
      {name: 'P5', values: this.values('P5'), color: 3, dash: 2, width: 1.5},
      {name: 'P95', values: this.values('P95'), color: 4, dash: 2, width: 1.5}
    ];
  });
  readonly band = computed<ChartBand | null>(() => this.data()
    ? {name: 'P5–P95 · ' + this.i18n.t('monteCarlo.range'), lo: this.values('P5'), hi: this.values('P95')}
    : null);

  constructor(private http: HttpClient) {
  }

  run() {
    this.loading.set(true);
    this.error.set('');
    this.http.get<GraphPointsDto>(`${this.api}?years=${this.years}&simulations=${this.simulations}`).subscribe({
      next: (data) => {
        this.loading.set(false);
        if (!data.uniqueGraphNames?.length) {
          this.error.set(this.i18n.t('monteCarlo.tooShort'));
          return;
        }
        this.data.set(data);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.i18n.t('common.error', {message: err.error?.message ?? err.message}));
      }
    });
  }
}
