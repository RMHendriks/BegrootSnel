package nl.hend.rm.service;

import jakarta.enterprise.context.ApplicationScoped;
import nl.hend.rm.dto.BudgetDto;
import nl.hend.rm.entities.Budget;
import nl.hend.rm.entities.Category;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class BudgetService {

    public List<BudgetDto> getBudgetByYearAndMonth(int year, int month) {
        List<Category> categoryList = Category.getAssignableCategories();
        List<BudgetDto> budgetDtoList = new ArrayList<>();

        for (Category category: categoryList) {
            Budget budget = Budget.findByYearMonthAndCategory(year, month, category.id).orElse(null);
            budgetDtoList.add(mapToBudgetDto(category, budget, year, month));
        }

        return budgetDtoList;
    }

    private BudgetDto mapToBudgetDto(Category category, Budget budget, long year, long month) {
        if (budget == null) {
            return new BudgetDto(category, null, BigDecimal.valueOf(0), year, month);
        }

        return new BudgetDto(category, budget.id, budget.amount, year, month);
    }

    public BudgetDto getBudgetByYearMonthAndCategory(int year, int month, long categoryId) {
        Category category = Category.findById(categoryId);
        Budget budget = Budget.findByYearMonthAndCategory(year, month, categoryId).orElse(null);
        return mapToBudgetDto(category, budget, year, month);
    }
}
