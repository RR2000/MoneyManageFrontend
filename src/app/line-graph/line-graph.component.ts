import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import Chart from 'chart.js/auto';
import {GraphPointsDto} from "../../models/graph-points.dto";

@Component({
  selector: 'app-line-graph',
  templateUrl: './line-graph.component.html',
  standalone: true,
  styleUrls: ['./line-graph.component.css']
})
export class LineGraphComponent implements OnChanges {
  public chart: any;
  @Input() graphPoints: GraphPointsDto = <GraphPointsDto>{};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['graphPoints'] && this.graphPoints && Object.keys(this.graphPoints).length > 0) {
      console.log(JSON.stringify(this.graphPoints.data["Revolut_Current"]));
      this.renderChart();
    }
  }

  public renderChart() {
    const labels = this.graphPoints.xlabels;
    const datasets = this.processDataForChart();

    this.updateChart(labels, datasets);
  }

  private processDataForChart(): any[] {
    const datasets = [];

    for (const lineName of this.graphPoints.lineNames) {
      const dataPoints = [];

      for (const label of this.graphPoints.xlabels) {
        dataPoints.push(this.graphPoints.data[lineName][label] || null);
      }

      datasets.push({
        label: lineName,
        data: dataPoints
      });
    }

    return datasets;
  }

  private updateChart(labels: string[], datasets: any[]) {
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
