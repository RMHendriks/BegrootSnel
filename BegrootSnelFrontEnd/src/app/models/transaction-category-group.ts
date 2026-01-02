import { Category } from "./category";
import { TransactionSplit } from "./transaction-split";

export interface TransactionCategoryGroup {
    category: Category,
    budgetedAmount: number,
    actualAmount: number,
    transactionList: TransactionSplit[];
}