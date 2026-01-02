package nl.hend.rm.service;

import jakarta.enterprise.context.ApplicationScoped;
import nl.hend.rm.dto.TransactionCategoryGroupDto;
import nl.hend.rm.dto.TransactionPeriodReportDto;
import nl.hend.rm.dto.TransactionSplitDto;
import nl.hend.rm.entities.Category;
import nl.hend.rm.entities.Transaction;
import nl.hend.rm.entities.TransactionSplit;
import nl.hend.rm.util.DateUtil;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class ReportService {

    public TransactionPeriodReportDto getReportByMonthYear(int year, int month) {
        LocalDate startDate = DateUtil.getFirstDayOfMonth(year, month);
        LocalDate endDate = DateUtil.getLastDayOfMonth(startDate);

        return getReportByDates(startDate, endDate);
    }

    public TransactionPeriodReportDto getReportByDates(LocalDate startDate, LocalDate endDate) {

        List<Category> categoryList = Category.getAssignableCategories();
        List<TransactionCategoryGroupDto> transactionCategoryGroupDtoList = new ArrayList<>();

        for (Category category: categoryList) {
            List<TransactionSplitDto> transactionSplitDtoList = getTransactionSplitDtoByCategoryAndDate(category, startDate, endDate);
            BigDecimal budgetedAmount = BigDecimal.valueOf(0); // TODO Implement the budgeting
            TransactionCategoryGroupDto dto = new TransactionCategoryGroupDto(category, transactionSplitDtoList, budgetedAmount);
            transactionCategoryGroupDtoList.add(dto);
        }

        return new TransactionPeriodReportDto(startDate, endDate, transactionCategoryGroupDtoList);
    }

    private List<TransactionSplitDto> getTransactionSplitDtoByCategoryAndDate(Category category,
                                                                     LocalDate startDate, LocalDate endDate) {
        List<TransactionSplit> dbQueryList = Transaction.findTransactionListByDateAndCategory(category, startDate, endDate);

        return dbQueryList.stream()
                .map(this::mapToTransactionSplitDto)
                .toList();

    }

    private TransactionSplitDto mapToTransactionSplitDto(TransactionSplit s) {
        var t = s.transaction;

        List<TransactionSplit> othersSplits = t.splits.stream()
                .filter(other -> !other.id.equals(s.id))
                .toList();

        return new TransactionSplitDto(
                s.id,                           // splitId
                s.amount,                       // splitAmount
                s.percentage,                   // splitPercentage
                s.category,                     // category
                t.id,                           // transactionId
                t.transactionDate,              // date
                t.prettyTitle,                  // title
                t.description,                  // rawDescription
                t.mutation,                     // totalMutation
                t.bankAccount,                  // bankAccount
                othersSplits                    // otherSplitList
        );
    }

}
