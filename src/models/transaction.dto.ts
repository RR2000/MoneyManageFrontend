export interface TransactionDto {
  account: string;
  datetime: string;
  description: string;
  cumulativeAmount: number;
  amount: number;
  fee: number;
  currency: string;
}
