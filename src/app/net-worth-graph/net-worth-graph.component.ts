import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import Chart from 'chart.js/auto';
import {GraphPointsDto} from "../../models/graph-points.dto";

@Component({
  selector: 'net-worth-graph',
  templateUrl: './net-worth-graph.component.html',
  standalone: true,
  styleUrls: ['./net-worth-graph.component.css']
})
export class LineGraph3Component implements OnChanges {
  public chart: any;
  @Input() graphPoints: GraphPointsDto = <GraphPointsDto>{};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['graphPoints'] && this.graphPoints && Object.keys(this.graphPoints).length > 0) {
      this.renderChart();
    }
  }

  public renderChart() {
    const labels = this.graphPoints.uniqueLabels;
    const datasets = this.processDataForChart();
    console.log(labels)
    this.updateChart(labels, datasets);

  }

  private processDataForChart(): any[] {
    const datasets = [];

    for (const lineName of this.graphPoints.uniqueGraphNames) {
      const dataPoints = [];

      for (const label of this.graphPoints.uniqueLabels) {
        dataPoints.push(this.graphPoints.graphData[lineName][label] || null);
      }

      datasets.push({
        label: lineName,
        data: dataPoints
      });
    }

    return datasets;
  }

  private updateChart(labels: string[], datasets: any[]) {
    // Apply pointRadius: 0 to each dataset to remove points from the graph
    const updatedDatasets = datasets.map(dataset => ({
      ...dataset,
      pointRadius: 0, // This line removes the points from the graph
    }));

    if (!this.chart) {
      this.chart = new Chart("NetWorthGraph", {
        type: 'line',
        data: {labels, datasets: updatedDatasets}, // Use updated datasets here
        options: {aspectRatio: 2.5}
      });
    } else {
      this.chart.data.labels = labels;
      this.chart.data.datasets = updatedDatasets; // Use updated datasets here
      this.chart.update();
    }
  }

}
