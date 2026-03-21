import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import Chart from 'chart.js/auto';
import {GraphPointsDto} from '../../models/graph-points.dto';

const API = 'http://localhost:8080/api/montecarlo';

const PERCENTILE_COLORS: { [key: string]: string } = {
  'P5':  'rgba(244, 67, 54, 0.8)',
  'P25': 'rgba(255, 152, 0, 0.8)',
  'P50': 'rgba(33, 150, 243, 1)',
  'P75': 'rgba(76, 175, 80, 0.8)',
  'P95': 'rgba(156, 39, 176, 0.8)',
};

@Component({
  selector: 'app-monte-carlo',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './monte-carlo.component.html',
  styleUrl: './monte-carlo.component.css'
})
export class MonteCarloComponent {
  years = 10;
  simulations = 5000;
  loading = false;
  error = '';

  private chart: any;

  constructor(private http: HttpClient) {}

  run() {
    this.loading = true;
    this.error = '';
    this.http.get<GraphPointsDto>(`${API}?years=${this.years}&simulations=${this.simulations}`).subscribe({
      next: (data) => {
        this.loading = false;
        this.renderChart(data);
      },
      error: (err) => {
        this.loading = false;
        this.error = `Errore: ${err.message}`;
      }
    });
  }

  private renderChart(data: GraphPointsDto) {
    const labels = data.uniqueLabels as unknown as string[];
    const datasets = data.uniqueGraphNames.map((name: string) => ({
      label: name,
      data: labels.map((l: string) => data.graphData[name]?.[l] ?? null),
      borderColor: PERCENTILE_COLORS[name] ?? 'rgba(100,100,100,0.8)',
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
          aspectRatio: 2.5,
          plugins: {legend: {display: true}},
          scales: {y: {title: {display: true, text: 'Valore portafoglio (€)'}}}
        }
      });
    } else {
      this.chart.data.labels = labels;
      this.chart.data.datasets = datasets;
      this.chart.update();
    }
  }
}
