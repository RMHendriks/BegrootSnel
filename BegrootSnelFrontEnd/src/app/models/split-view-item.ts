import { TransactionSplit } from "./transaction-split";

export interface SplitViewItem {
  transactionSplit: TransactionSplit;
  transactionId: number;
  mutation: number;
  transactionDate: string;
  prettyTitle: string;
  description: string;
  otherSplits: TransactionSplit[];
  isExpanded: boolean;
}