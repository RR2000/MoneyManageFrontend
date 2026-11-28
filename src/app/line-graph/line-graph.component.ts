import {Component, computed, EventEmitter, Input, Output, signal} from '@angular/core';
import {GraphPointsDto} from "../../models/graph-points.dto";
import {ChartComponent, ChartSeries} from '../ui/chart.component';
import {LoadState, LoadStateComponent} from '../ui/load-state.component';

/**
 * Line chart of a GraphPointsDto (one line per graph name, one point per label) on the app's only chart component.
 * While the data is on its way a skeleton shows at once; a failed call says so with "Retry" (never an empty chart that
 * looks like no data).
 */
@Component({
  selector: 'app-line-graph',
  imports: [ChartComponent, LoadStateComponent],
  template: `
    @if (state() === 'ready') {
      <app-chart [labels]="labels()" [series]="series()" [height]="320" [ariaLabel]="ariaLabel"/>
    } @else {
      <app-load-state [state]="state()" shape="chart" [errorText]="error" [emptyText]="emptyText" (retry)="retry.emit()"/>
    }`,
  styles: [':host { display: block; padding-top: 8px; }']
})
export class LineGraphComponent {
  private readonly points = signal<GraphPointsDto>(<GraphPointsDto>{});
  private readonly loadingSig = signal(false);
  private readonly errorSig = signal('');

  @Input() set graphPoints(value: GraphPointsDto) {
    this.points.set(value ?? <GraphPointsDto>{});
  }

  /** '' : the generic "no data" */
  @Input() emptyText = '';

  @Input() set loading(value: boolean) {
    this.loadingSig.set(value);
  }

  /** the call failed: this text is shown instead of the chart, with "Retry" */
  @Input() set error(value: string) {
    this.errorSig.set(value ?? '');
  }

  get error(): string {
    return this.errorSig();
  }

  @Input() ariaLabel = '';
  @Output() retry = new EventEmitter<void>();

  readonly labels = computed(() => [...(this.points().uniqueLabels ?? [])]);
  readonly series = computed<ChartSeries[]>(() => {
    const p = this.points();
    return (p.uniqueGraphNames ?? []).map(name => ({
      name,
      values: this.labels().map(label => p.graphData?.[name]?.[label] ?? null),
      width: name.startsWith('Total') ? 2.5 : 1.5
    }));
  });

  readonly state = computed<LoadState>(() => {
    if (this.loadingSig()) {
      return 'loading';
    }
    if (this.errorSig()) {
      return 'error';
    }
    return this.series().length && this.labels().length ? 'ready' : 'empty';
  });
}
