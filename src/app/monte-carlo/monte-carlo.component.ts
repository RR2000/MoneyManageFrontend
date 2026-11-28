import {Component, effect, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import Chart from 'chart.js/auto';
import {GraphPointsDto} from '../../models/graph-points.dto';
import {I18nService} from '../i18n/i18n.service';
import {TPipe} from '../i18n/t.pipe';
import {ThemeService} from '../theme/theme.service';
import {chartColors, SERIES_DASH} from '../theme/chart-colors';

/** series index of each percentile (colour and dash from the theme): the median is the first, solid and thicker */
const PERCENTILE_SERIES: { [key: string]: number } = {P50: 0, P25: 1, P75: 2, P5: 3, P95: 4};

@Component({
  selector: 'app-monte-carlo',
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, TPipe],
  templateUrl: './monte-carlo.component.html',
  styleUrl: './monte-carlo.component.css'
})
export class MonteCarloComponent {
  years = 10;
  simulations = 5000;
  loading = signal(false);
  error = signal('');

  private chart: any;
  private api = `/api/montecarlo`;

  private i18n = inject(I18nService);
  private theme = inject(ThemeService);
  private lastData?: GraphPointsDto;

  constructor(private http: HttpClient) {
    // the axis title follows the language
    effect(() => {
      const title = this.i18n.t('monteCarlo.axis');
      if (this.chart) {
        this.chart.options.scales.y.title.text = title;
        this.chart.update();
      }
    });
    // colours from the theme: a new theme draws the chart again
    effect(() => {
      this.theme.dark();
      if (this.chart && this.lastData) {
        this.chart.destroy();
        this.chart = undefined;
        this.renderChart(this.lastData);
      }
    });
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
        this.renderChart(data);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.i18n.t('common.error', {message: err.error?.message ?? err.message}));
      }
    });
  }

  private renderChart(data: GraphPointsDto) {
    this.lastData = data;
    const colors = chartColors();
    const labels = data.uniqueLabels as unknown as string[];
    const datasets = data.uniqueGraphNames.map((name: string) => ({
      label: name,
      data: labels.map((l: string) => data.graphData[name]?.[l] ?? null),
      borderColor: colors.series[PERCENTILE_SERIES[name] ?? 0],
      borderDash: SERIES_DASH[PERCENTILE_SERIES[name] ?? 0],
      backgroundColor: 'transparent',
      borderWidth: name === 'P50' ? 2.5 : 1.5,
      pointRadius: 0,
      tension: 0.3,
    }));

    if (!this.chart) {
      this.chart = new Chart('MonteCarloChart', {
        type: 'line',
        data: {labels, datasets},
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          color: colors.muted,
          plugins: {legend: {display: true, labels: {color: colors.text}}},
          scales: {
            x: {ticks: {color: colors.muted}, grid: {color: colors.grid}},
            y: {
              title: {display: true, text: this.i18n.t('monteCarlo.axis'), color: colors.muted},
              ticks: {color: colors.muted}, grid: {color: colors.grid}
            }
          }
        }
      });
    } else {
      this.chart.data.labels = labels;
      this.chart.data.datasets = datasets;
      this.chart.update();
    }
  }
}
