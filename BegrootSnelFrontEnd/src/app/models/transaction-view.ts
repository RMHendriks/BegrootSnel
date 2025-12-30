import { TransactionSplit } from "./transaction-split";

export interface TransactionView {
  id: number;
  bankAccount: string;
  oldBalance: number;
  newBalance: number;
  transactionDate: string;
  prettyTitle: string;
  description: string;

  currency: string;
  mutation: number;

  splits: TransactionSplit[];

  isExpanded: boolean;
  isEditingSplits: boolean
}