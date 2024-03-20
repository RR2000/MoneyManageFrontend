export interface GraphPointsDto {
  xlabels: string[];
  lineNames: string[];
  data: { [key: string]: { [key: string]: number[] } };
}
