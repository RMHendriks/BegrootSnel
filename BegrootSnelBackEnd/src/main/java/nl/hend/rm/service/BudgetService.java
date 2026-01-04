package nl.hend.rm.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import nl.hend.rm.dto.BudgetDto;
import nl.hend.rm.entities.Budget;
import nl.hend.rm.entities.Category;
import org.jboss.jandex.ClassType;

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

    private BudgetDto mapToBudgetDto(Category category, Budget budget, int year, int month) {
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

    @Transactional
    public Budget postBudget(BudgetDto dto) {
        Budget budget = new Budget(dto.category(), dto.amount(), dto.year(), dto.month());
        Budget.persist(budget);
        return budget;
    }

    @Transactional
    public Budget putBudget(BudgetDto dto) {
        Budget dbBudget = Budget.findById(dto.budgetId());

        if (dbBudget == null) {
            throw new WebApplicationException("Budget not found", 404);
        }

        dbBudget.category = dto.category();
        dbBudget.amount = dto.amount();
        dbBudget.year = dto.year();
        dbBudget.month = dto.month();

        return dbBudget;
    }
}
