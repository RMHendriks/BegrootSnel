package nl.hend.rm.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.NotFoundException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import nl.hend.rm.dto.SavingsAnalysisDto;
import nl.hend.rm.dto.SavingsAnalysisDto.MonthOverMonthDelta;
import nl.hend.rm.dto.SavingsAnalysisDto.MonthlySavingsSnapshot;
import nl.hend.rm.entities.BankAccount;
import nl.hend.rm.entities.Transaction;

/**
 * Analyses savings account activity by looking at ALL transactions
 * (not just internal transfers).  Interest, fees, and direct deposits
 * all contribute to the monthly net savings figure.
 */
@ApplicationScoped
public class SavingsAnalysisService {

    /**
     * Build a savings analysis covering {@code months} calendar months
     * ending at {@code endYear}/{@code endMonth}.  When endYear/endMonth
     * are null the current month is used.
     */
    public SavingsAnalysisDto getSavingsAnalysis(
        Long accountId,
        int months,
        Integer endYear,
        Integer endMonth
    ) {
        BankAccount account = BankAccount.findById(accountId);
        if (account == null) {
            throw new NotFoundException("Account not found: " + accountId);
        }

        LocalDate now = LocalDate.now();
        int ey = endYear != null ? endYear : now.getYear();
        int em = endMonth != null ? endMonth : now.getMonthValue();

        // Last day of the end month is our cutoff
        LocalDate endDate = LocalDate.of(ey, em, 1).withDayOfMonth(
            LocalDate.of(ey, em, 1).lengthOfMonth()
        );

        // First day of the window
        LocalDate startDate = endDate.minusMonths(months - 1).withDayOfMonth(1);

        // Fetch ALL transactions for this account in the window
        List<Transaction> txns = Transaction.find(
            "account.id = ?1 and transactionDate >= ?2 and transactionDate <= ?3 " +
                "order by transactionDate asc, id asc",
            accountId,
            startDate,
            endDate
        ).list();

        // Pre-populate all months in range so we never return gaps
        Map<String, MonthlySavingsSnapshot> snapshotMap = new LinkedHashMap<>();
        LocalDate cursor = startDate;
        while (!cursor.isAfter(endDate)) {
            String key =
                cursor.getYear() +
                "-" +
                String.format("%02d", cursor.getMonthValue());
            snapshotMap.put(
                key,
                new MonthlySavingsSnapshot(
                    cursor.getYear(),
                    cursor.getMonthValue(),
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO
                )
            );
            cursor = cursor.plusMonths(1);
        }

        // Accumulate deposits and withdrawals per month
        for (Transaction t : txns) {
            String key =
                t.transactionDate.getYear() +
                "-" +
                String.format("%02d", t.transactionDate.getMonthValue());

            MonthlySavingsSnapshot existing = snapshotMap.get(key);
            if (existing != null) {
                BigDecimal deposits = existing.deposits();
                BigDecimal withdrawals = existing.withdrawals();

                if (t.mutation.compareTo(BigDecimal.ZERO) > 0) {
                    deposits = deposits.add(t.mutation);
                } else {
                    withdrawals = withdrawals.add(t.mutation.abs());
                }

                snapshotMap.put(
                    key,
                    new MonthlySavingsSnapshot(
                        existing.year(),
                        existing.month(),
                        deposits,
                        withdrawals,
                        deposits.subtract(withdrawals)
                    )
                );
            }
        }

        List<MonthlySavingsSnapshot> snapshots = new ArrayList<>(
            snapshotMap.values()
        );

        // Balance from the last transaction up to the end date
        Transaction lastInPeriod = Transaction.find(
            "account.id = ?1 and transactionDate <= ?2 ORDER BY transactionDate DESC, id DESC",
            accountId,
            endDate
        ).firstResult();

        BigDecimal currentBalance =
            lastInPeriod != null ? lastInPeriod.newBalance : BigDecimal.ZERO;
        java.time.LocalDateTime balanceDate =
            lastInPeriod != null
                ? lastInPeriod.transactionDate.atStartOfDay()
                : null;

        MonthOverMonthDelta momDelta = computeMonthOverMonthDelta(snapshots);

        return new SavingsAnalysisDto(
            account.id,
            account.name,
            account.accountNumber,
            currentBalance,
            balanceDate,
            snapshots,
            momDelta
        );
    }

    private MonthOverMonthDelta computeMonthOverMonthDelta(
        List<MonthlySavingsSnapshot> snapshots
    ) {
        if (snapshots.size() < 2) {
            return new MonthOverMonthDelta(
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                false
            );
        }

        MonthlySavingsSnapshot previous = snapshots.get(snapshots.size() - 2);
        MonthlySavingsSnapshot current = snapshots.get(snapshots.size() - 1);

        BigDecimal prevNet = previous.net();
        BigDecimal currNet = current.net();
        BigDecimal delta = currNet.subtract(prevNet);

        return new MonthOverMonthDelta(
            prevNet,
            currNet,
            delta,
            delta.compareTo(BigDecimal.ZERO) > 0
        );
    }
}
