import {AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild} from '@angular/core';
import Chart from 'chart.js/auto';
import {GraphPointsDto} from "../../models/graph-points.dto";
import {TPipe} from "../i18n/t.pipe";

/**
 * Line chart of a GraphPointsDto: one line per graph name, one point per label. While the data is on its way it says
 * so; if the call failed it says that too, with a button to try again (never an empty chart that looks like no data).
 */
@Component({
  selector: 'app-line-graph',
  imports: [TPipe],
  templateUrl: './line-graph.component.html',
  styleUrls: ['./line-graph.component.css']
})
export class LineGraphComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() graphPoints: GraphPointsDto = <GraphPointsDto>{};
  /** '' : the generic "no data" */
  @Input() emptyText = '';
  @Input() loading = false;
  /** the call failed: this text is shown instead of the chart, with "Retry" */
  @Input() error = '';
  @Output() retry = new EventEmitter<void>();
  @ViewChild('canvas') canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  hasData(): boolean {
    return !this.loading && !this.error && (this.graphPoints?.uniqueGraphNames?.length ?? 0) > 0 && (this.graphPoints?.uniqueLabels?.length ?? 0) > 0;
  }

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnChanges(): void {
    this.render();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private render(): void {
    if (!this.canvas || !this.hasData()) {
      return;
    }
    const labels = [...this.graphPoints.uniqueLabels];
    const datasets = this.graphPoints.uniqueGraphNames.map(name => ({
      label: name,
      data: labels.map(label => this.graphPoints.graphData[name]?.[label] ?? null),
      pointRadius: 0,
      borderWidth: name.startsWith('Total') ? 2.5 : 1.5,
      spanGaps: true
    }));
    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.data.datasets = datasets as any;
      this.chart.update();
      return;
    }
    this.chart = new Chart(this.canvas.nativeElement, {
      type: 'line',
      data: {labels, datasets: datasets as any},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {mode: 'index', intersect: false},
        plugins: {legend: {position: 'bottom'}}
      }
    });
  }
}
