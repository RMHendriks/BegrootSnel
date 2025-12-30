import { TransactionSplit } from "./transaction-split";

export interface Transaction {
  id: number;
  bankAccount: string;
  currency: string;
  
  oldBalance: number;
  newBalance: number;
  mutation: number;

  transactionDate: string;
  
  prettyTitle: string;
  description: string;

  splits: TransactionSplit[];
}