package nl.hend.rm.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Savings analysis response containing net savings per month,
 * trend data, and current balance for a savings account.
 */
public record SavingsAnalysisDto(
    Long accountId,
    String accountName,
    String accountNumber,
    BigDecimal currentBalance,
    LocalDateTime balanceDate,
    List<MonthlySavingsSnapshot> monthlySnapshots,
    MonthOverMonthDelta monthOverMonthDelta
) {

    public record MonthlySavingsSnapshot(
        int year,
        int month,
        BigDecimal deposits,      // positive mutation = money INTO savings
        BigDecimal withdrawals,    // negative mutation = money OUT of savings
        BigDecimal net             // deposits - withdrawals (positive = saved this month)
    ) {}

    public record MonthOverMonthDelta(
        BigDecimal previousMonthNet,
        BigDecimal currentMonthNet,
        BigDecimal absoluteDelta,  // currentMonthNet - previousMonthNet
        boolean increased          // true if saving more than previous month
    ) {}
}
