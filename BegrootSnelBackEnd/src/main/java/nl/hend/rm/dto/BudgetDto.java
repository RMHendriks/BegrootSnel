package nl.hend.rm.dto;

import nl.hend.rm.entities.Category;

import java.math.BigDecimal;

public record BudgetDto(Category category, Long budgetId, BigDecimal amount, long year, long month) {}
