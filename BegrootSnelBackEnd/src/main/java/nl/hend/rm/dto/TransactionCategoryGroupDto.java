package nl.hend.rm.dto;

import nl.hend.rm.entities.Category;

import java.math.BigDecimal;
import java.util.List;

public class TransactionCategoryGroupDto {

    private final Category category;
    private final List<TransactionSplitDto> transactionList;

    private final BigDecimal budgetedAmount;
    private final BigDecimal actualAmount;

    public TransactionCategoryGroupDto(Category category, List<TransactionSplitDto> transactionList, BigDecimal budgetedAmount) {
        this.category = category;
        this.transactionList = transactionList;

        this.budgetedAmount = budgetedAmount;
        this.actualAmount = calculateActualAmount();

    }

    private BigDecimal calculateActualAmount() {
        BigDecimal totalAmount = BigDecimal.valueOf(0);

        for (TransactionSplitDto transactionSplitDto : this.transactionList) {
            totalAmount = totalAmount.add(transactionSplitDto.splitAmount());
        }

        return totalAmount.abs();

    }

    public Category getCategory() {
        return category;
    }

    public List<TransactionSplitDto> getTransactionList() {
        return transactionList;
    }

    public BigDecimal getBudgetedAmount() {
        return budgetedAmount;
    }

    public BigDecimal getActualAmount() {
        return actualAmount;
    }
}
