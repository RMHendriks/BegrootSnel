import { TransactionCategoryGroup } from "./transaction-category-group";

export interface Report {
    startDate: string;
    endDate: string;
    transactionCategoryGroupDtoList: TransactionCategoryGroup[];
}