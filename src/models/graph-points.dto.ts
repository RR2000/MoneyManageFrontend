export interface GraphPointsDto {
  graphData: { [key: string]: { [key: string]: number[] } };
  uniqueLabels: string[];
  uniqueGraphNames: string[];
}
