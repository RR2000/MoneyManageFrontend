export interface TransactionDto {
  account: string;
  completedDate: string;
  description: string;
  cumulativeAmount: number;
  amount: number;
  fee: number;
  currency: string;
}
