export interface GraphPointsDto {
  graphData: { [graph: string]: { [label: string]: number | null } };
  uniqueLabels: string[];
  uniqueGraphNames: string[];
}
