import { Category } from "./category";

export interface Budget {
    budgetId?: number | null;
    category: Category;
    amount: number;
    month: number;
    year: number;
}