export interface TransactionDto {
  account: string;
  datetime: string;
  description: string;
  cumulativeAmount: number;
  amount: number;
  fee: number;
  currency: string;
  /** where it comes from: an imported file, written by hand, or sent by the bank (open banking) */
  source?: 'FILE' | 'MANUAL' | 'BANK' | null;
}
