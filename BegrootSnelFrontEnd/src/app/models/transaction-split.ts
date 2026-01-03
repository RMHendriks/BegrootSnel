import { Category } from "./category";

export interface TransactionSplit {
  category: Category | null;
  amount: number;
  percentage: number;
  usePercentage?: boolean;
  parentId: number;
}