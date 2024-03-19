import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import Chart from 'chart.js/auto';
import {TransactionDto} from "../../models/transaction.dto";

@Component({
  selector: 'app-line-graph',
  templateUrl: './line-graph.component.html',
  standalone: true,
  styleUrls: ['./line-graph.component.css']
})
export class LineGraphComponent implements OnChanges {
  public chart: any;
  @Input() accountsData: { account: string; transactions: TransactionDto[] }[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accountsData'] && this.accountsData) {
      console.log("changed in graph: " + JSON.stringify(changes['accountsData']));
      this.renderChart();
    }
  }

  public renderChart() {
    const labels = this.getLabels();
    const datasets = this.processDataForChart();
    console.log("Labels:", labels);
    console.log("Datasets:", datasets);
    this.updateChart(labels, datasets);
  }

  private getLabels(): string[] {
    const labelsSet = new Set<string>();
    Object.values(this.accountsData).forEach(transactions => {
      transactions.transactions.forEach(transaction => {
        labelsSet.add(transaction.completedDate.substring(0, 10));
      });
    });
    return Array.from(labelsSet);
  }

  private processDataForChart(): any[] {
    const datasets: any[] = [];
    let i = 0;
    Object.values(this.accountsData).forEach(transactions => {
      const dataPoints = transactions.transactions.map(transaction => transaction.cumulativeAmount)
      datasets.push({
        label: transactions.account,
        data: dataPoints
      });
    });
    return datasets;
  }

  private updateChart(labels: string[], datasets: any[]) {
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
