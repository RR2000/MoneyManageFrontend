import {Component, OnInit} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import Chart from 'chart.js/auto';

interface TransactionDto {
  account: string;
  completedDate: string;
  cumulativeAmount: number;
}

@Component({
  selector: 'app-line-graph',
  templateUrl: './line-graph.component.html',
  standalone: true,
  styleUrls: ['./line-graph.component.css']
})
export class LineGraphComponent implements OnInit {
  public chart: any;
  public transactions: TransactionDto[] = [];

  constructor(private http: HttpClient) {
  }

  ngOnInit(): void {
    this.getDataAndRenderChart();
  }

  getDataAndRenderChart() {
    const fromTimestamp = '2024-03-01 00:00:00.000';
    const toTimestamp = '2024-03-29 23:59:59.999';
    const accountName = 'Revolut_Current'; // Add accountName here
    const apiUrl = `http://localhost:8080/api/transactions/${encodeURIComponent(fromTimestamp)}/${encodeURIComponent(toTimestamp)}?accountName=${accountName}`;

    this.http.get<TransactionDto[]>(apiUrl).subscribe((data) => {
      console.log("Data received:", data);
      this.transactions = data;
      this.renderChart();
    });
  }

  renderChart() {
    const labels = this.transactions.map(transaction => transaction.completedDate);
    const datasets = this.processDataForChart();
    console.log("Labels:", labels);
    this.updateChart(labels, datasets);
  }

  processDataForChart(): any[] {
    const datasets = [{
      label: 'Cumulative Amount',
      data: this.transactions.map(transaction => transaction.cumulativeAmount)
    }];
    return datasets;
  }

  updateChart(labels: string[], datasets: any[]) {
    console.log("updateChart labels:", labels);
    if (!this.chart) {
      this.chart = new Chart("MyChart", {
        type: 'line',
        data: {labels, datasets},
        options: {aspectRatio: 2.5}
      });
    } else {
      this.chart.data.labels = labels;
      this.chart.data.datasets = datasets;
      this.chart.update();
    }
  }
}
