export interface RealEstateDto {
  id?: number;
  name: string;
  address: string;
  purchaseDate: string;
  purchasePrice: number;
  currentEstimatedValue: number;
  monthlyRent: number;
  monthlyExpenses: number;
  currency: string;
}
