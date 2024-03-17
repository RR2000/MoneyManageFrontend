import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import Chart from 'chart.js/auto';

interface ValueDatePair {
  date: string;
  value: number;
}

interface AccountSummary {
  accountName: string;
  summary: ValueDatePair[];
}

@Component({
  selector: 'app-line-graph',
  templateUrl: './line-graph.component.html',
  standalone: true,
  styleUrls: ['./line-graph.component.css']
})
export class LineGraphComponent implements OnInit {
  public chart: any;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    // Make API request and update chart
    this.getDataAndRenderChart();
  }

  getDataAndRenderChart() {
    const fromTimestamp = '2024-02-27 00:00:00.000';
    const toTimestamp = '2024-03-19 23:59:59.999';
    const apiUrl = `http://localhost:8080/api/transactions/${encodeURIComponent(fromTimestamp)}/${encodeURIComponent(toTimestamp)}`;

    this.http.get<AccountSummary[]>(apiUrl).subscribe((data) => {
      console.log("Data received:", data);
      const labels = data[0].summary.map(item => item.date); // Assuming all summaries have the same dates
      const datasets = this.processDataForChart(data);
      console.log("Labels:", labels);
      this.updateChart(labels, datasets);
    });
  }

  processDataForChart(data: AccountSummary[]): any[] {
    const datasets = [];
    const accounts = ["Revolut_Current", "Revolut_Savings", "Revolut_Pocket"];

    for (const account of accounts) {
      const dataPoints = data.find(summary => summary.accountName === account)?.summary.map(pair => pair.value) || [];
      const dataset = {
        label: account,
        data: dataPoints
      };
      datasets.push(dataset);
    }

    return datasets;
  }

  updateChart(labels: string[], datasets: any[]) {
    console.log("updateChart labels:", labels);
    if (!this.chart) {
      this.chart = new Chart("MyChart", {
        type: 'line',
        data: { labels, datasets },
        options: { aspectRatio: 2.5 }
      });
    } else {
      this.chart.data.labels = labels;
      this.chart.data.datasets = datasets;
      this.chart.update();
    }
  }
}
