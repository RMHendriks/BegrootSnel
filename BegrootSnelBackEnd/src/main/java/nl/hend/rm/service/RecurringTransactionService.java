package nl.hend.rm.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.ArrayList;
import java.util.stream.Collectors;
import nl.hend.rm.entities.*;

@ApplicationScoped
public class RecurringTransactionService {

    @Inject
    TransactionService transactionService;

    private static final BigDecimal MIN_CONFIDENCE = new BigDecimal("0.40");
    private static final MathContext MC = new MathContext(
        8,
        RoundingMode.HALF_UP
    );

    /**
     * Runs detection for all accounts. Returns list of newly detected
     * recurring transactions (status = DETECTED).
     */
    @Transactional
    public List<RecurringTransaction> scanAllAccounts() {
        List<BankAccount> accounts = BankAccount.listAll();
        List<RecurringTransaction> allDetected = new ArrayList<>();
        for (BankAccount account : accounts) {
            allDetected.addAll(scanAccount(account));
        }
        return allDetected;
    }

    /**
     * Runs detection for a single account. Returns newly detected entries.
     */
    @Transactional
    public List<RecurringTransaction> scanAccount(BankAccount account) {
        List<Transaction> transactions = Transaction.find(
            "account = ?1 and internalTransfer = false order by transactionDate asc",
            account
        ).list();

        if (transactions.size() < 2) return List.of();

        // Group by counterparty (or description as fallback)
        Map<String, List<Transaction>> groups = groupByCounterparty(
            transactions
        );

        List<RecurringTransaction> detected = new ArrayList<>();

        for (Map.Entry<String, List<Transaction>> entry : groups.entrySet()) {
            String key = entry.getKey();
            List<Transaction> group = entry.getValue();

            if (group.size() < 2) continue;

            // Sort by date (already sorted by query, but be safe)
            group.sort(Comparator.comparing(t -> t.transactionDate));

            // Only consider groups where most mutations have the same sign
            if (!hasConsistentSign(group)) continue;

            DetectionResult dr = analyzeGroup(group);

            if (dr.confidence.compareTo(MIN_CONFIDENCE) < 0) continue;

            // Check if we already have a recurring transaction for this counterparty+account
            RecurringTransaction existing = findExisting(account, key);
            if (existing != null) {
                // Update existing detection
                updateExisting(existing, dr, group);
            } else {
                RecurringTransaction rt = createFromDetection(
                    account,
                    key,
                    dr,
                    group
                );
                rt.persist();
                detected.add(rt);
            }
        }

        return detected;
    }

    // ── Grouping ────────────────────────────────────────────────────────────

    private Map<String, List<Transaction>> groupByCounterparty(
        List<Transaction> transactions
    ) {
        Map<String, List<Transaction>> groups = new LinkedHashMap<>();

        for (Transaction t : transactions) {
            // Prefer stored counterpartyName; if null, try extracting from
            // description (for transactions parsed before this field was added)
            String raw = t.counterpartyName;
            if (raw == null || raw.isBlank()) {
                raw = extractNameFromDescription(t.description);
            }
            if (raw == null || raw.isBlank()) {
                raw = t.prettyTitle;
            }
            if (raw == null || raw.isBlank()) {
                raw = t.description;
            }
            String key = normalizeKey(raw);

            if (key == null || key.isBlank()) continue;

            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(t);
        }

        return groups;
    }

    /**
     * Tries to extract a stable counterparty name from a raw description,
     * using the same /NAME/ and BEA patterns as TransactionService.
     * Returns null if no pattern matches.
     */
    private String extractNameFromDescription(String description) {
        if (description == null || description.isBlank()) return null;

        if (description.contains("/NAME/")) {
            return java.util.regex.Pattern.compile("/NAME/([^/]+)")
                .matcher(description)
                .results()
                .map(m -> m.group(1).trim())
                .findFirst()
                .orElse(null);
        }

        if (description.contains("BEA,")) {
            return java.util.regex.Pattern.compile(
                "\\*(.*?)(?=,|\\sNR:|\\d{2}\\.\\d{2})"
            )
                .matcher(description)
                .results()
                .map(m -> m.group(1).trim())
                .findFirst()
                .orElse(null);
        }

        return null;
    }

    private String normalizeKey(String raw) {
        if (raw == null) return null;
        // Lowercase, trim, collapse whitespace, remove special chars
        return raw
            .toLowerCase()
            .trim()
            .replaceAll("\\s+", " ")
            .replaceAll("[^a-z0-9 .\\-&]", "")
            .strip();
    }

    // ── Analysis ────────────────────────────────────────────────────────────

    private boolean hasConsistentSign(List<Transaction> group) {
        long positive = group
            .stream()
            .filter(t -> t.mutation.signum() > 0)
            .count();
        long negative = group
            .stream()
            .filter(t -> t.mutation.signum() < 0)
            .count();
        long total = group.size();
        // At least 75% must have the same sign
        return (
            (double) positive / total >= 0.75 ||
            (double) negative / total >= 0.75
        );
    }

    private DetectionResult analyzeGroup(List<Transaction> group) {
        // Determine dominant sign
        long positiveCount = group
            .stream()
            .filter(t -> t.mutation.signum() > 0)
            .count();
        boolean isIncome = positiveCount > group.size() / 2;

        // Use absolute amounts for analysis
        List<BigDecimal> amounts = group
            .stream()
            .map(t -> t.mutation.abs())
            .collect(Collectors.toList());

        // Amount statistics
        BigDecimal mean = mean(amounts);
        BigDecimal stddev = stddev(amounts, mean);
        BigDecimal cv =
            mean.compareTo(BigDecimal.ZERO) > 0
                ? stddev.divide(mean, MC)
                : BigDecimal.ZERO;

        // Interval regularity
        List<Long> intervals = new ArrayList<>();
        for (int i = 1; i < group.size(); i++) {
            long days = ChronoUnit.DAYS.between(
                group.get(i - 1).transactionDate,
                group.get(i).transactionDate
            );
            intervals.add(days);
        }

        long avgInterval = intervals.isEmpty()
            ? 0
            : (long) intervals
                  .stream()
                  .mapToLong(Long::longValue)
                  .average()
                  .orElse(0);
        double intervalStddev = intervals.isEmpty()
            ? 0
            : Math.sqrt(
                  intervals
                      .stream()
                      .mapToDouble(v -> Math.pow(v - avgInterval, 2))
                      .average()
                      .orElse(0)
              );

        // Determine frequency
        RecurrenceFrequency frequency = determineFrequency(avgInterval);
        int expectedDay = group.get(0).transactionDate.getDayOfMonth();

        // Confidence scoring
        BigDecimal amountConfidence = scoreAmountStability(cv);
        BigDecimal intervalConfidence = scoreIntervalRegularity(
            avgInterval,
            intervalStddev,
            frequency
        );
        BigDecimal occurrenceConfidence = scoreOccurrences(group.size());

        // Weighted confidence
        BigDecimal confidence = amountConfidence
            .multiply(new BigDecimal("0.35"))
            .add(intervalConfidence.multiply(new BigDecimal("0.35")))
            .add(occurrenceConfidence.multiply(new BigDecimal("0.30")))
            .setScale(2, RoundingMode.HALF_UP);

        return new DetectionResult(
            mean,
            isIncome,
            frequency,
            expectedDay,
            confidence,
            group.get(0).transactionDate,
            group.get(group.size() - 1).transactionDate,
            cv
        );
    }

    private RecurrenceFrequency determineFrequency(long avgIntervalDays) {
        if (
            avgIntervalDays >= 340 && avgIntervalDays <= 380
        ) return RecurrenceFrequency.YEARLY;
        if (
            avgIntervalDays >= 80 && avgIntervalDays <= 100
        ) return RecurrenceFrequency.QUARTERLY;
        return RecurrenceFrequency.MONTHLY; // default
    }

    private BigDecimal scoreAmountStability(BigDecimal cv) {
        // CV = coefficient of variation (stddev / mean)
        // Scored more leniently so naturally varying bills (water, energy) are detected
        if (cv.compareTo(new BigDecimal("0.05")) <= 0) return new BigDecimal(
            "1.00"
        );
        if (cv.compareTo(new BigDecimal("0.10")) <= 0) return new BigDecimal(
            "0.90"
        );
        if (cv.compareTo(new BigDecimal("0.20")) <= 0) return new BigDecimal(
            "0.70"
        );
        if (cv.compareTo(new BigDecimal("0.35")) <= 0) return new BigDecimal(
            "0.45"
        );
        return new BigDecimal("0.15");
    }

    private BigDecimal scoreIntervalRegularity(
        long avgInterval,
        double stddev,
        RecurrenceFrequency freq
    ) {
        // Check if the average interval matches the expected frequency
        boolean freqMatch = switch (freq) {
            case MONTHLY -> avgInterval >= 25 && avgInterval <= 35;
            case QUARTERLY -> avgInterval >= 80 && avgInterval <= 100;
            case YEARLY -> avgInterval >= 340 && avgInterval <= 380;
        };

        if (!freqMatch) return new BigDecimal("0.20");

        // Lower stddev relative to interval = more regular
        double cvInterval = avgInterval > 0 ? stddev / avgInterval : 1.0;
        if (cvInterval < 0.10) return new BigDecimal("1.00");
        if (cvInterval < 0.20) return new BigDecimal("0.85");
        if (cvInterval < 0.35) return new BigDecimal("0.60");
        if (cvInterval < 0.50) return new BigDecimal("0.35");
        return new BigDecimal("0.10");
    }

    private BigDecimal scoreOccurrences(int count) {
        if (count >= 12) return new BigDecimal("1.00");
        if (count >= 6) return new BigDecimal("0.90");
        if (count >= 4) return new BigDecimal("0.75");
        if (count >= 3) return new BigDecimal("0.55");
        return new BigDecimal("0.35"); // 2 occurrences
    }

    // ── Statistics helpers ──────────────────────────────────────────────────

    private BigDecimal mean(List<BigDecimal> values) {
        return values
            .stream()
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(new BigDecimal(values.size()), MC);
    }

    private BigDecimal stddev(List<BigDecimal> values, BigDecimal mean) {
        BigDecimal sumSq = values
            .stream()
            .map(v -> v.subtract(mean).pow(2))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new BigDecimal(
            Math.sqrt(
                sumSq.divide(new BigDecimal(values.size()), MC).doubleValue()
            )
        );
    }

    // ── Persistence helpers ─────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private RecurringTransaction findExisting(
        BankAccount account,
        String counterpartyKey
    ) {
        return (RecurringTransaction) RecurringTransaction.find(
            "account = ?1 and counterpartyName = ?2",
            account,
            counterpartyKey
        )
            .firstResultOptional()
            .orElse(null);
    }

    private void updateExisting(
        RecurringTransaction existing,
        DetectionResult dr,
        List<Transaction> group
    ) {
        existing.occurrenceCount = group.size();
        existing.confidenceScore = dr.confidence;
        existing.expectedAmount = dr.expectedAmount;
        existing.isIncome = dr.isIncome;
        existing.firstSeenDate = dr.firstSeen;
        existing.lastSeenDate = dr.lastSeen;
        existing.frequency = dr.frequency;
        existing.expectedDayOfMonth = dr.expectedDayOfMonth;

        // Don't overwrite status if already CONFIRMED
        // Don't overwrite category if already set
    }

    private RecurringTransaction createFromDetection(
        BankAccount account,
        String key,
        DetectionResult dr,
        List<Transaction> group
    ) {
        RecurringTransaction rt = new RecurringTransaction();
        rt.account = account;
        rt.counterpartyName = key;

        // Use the most common display name from the group
        rt.displayName = group
            .stream()
            .map(t ->
                t.counterpartyName != null
                    ? t.counterpartyName
                    : (t.prettyTitle != null ? t.prettyTitle : t.description)
            )
            .filter(Objects::nonNull)
            .reduce((a, b) -> b) // take the most recent
            .orElse(key);

        rt.expectedAmount = dr.expectedAmount;
        rt.amountTolerance = new BigDecimal("0.05");
        rt.frequency = dr.frequency;
        rt.expectedDayOfMonth = dr.expectedDayOfMonth;
        rt.autoBudget = true;
        rt.status = RecurringStatus.DETECTED;
        rt.occurrenceCount = group.size();
        rt.confidenceScore = dr.confidence;
        rt.firstSeenDate = dr.firstSeen;
        rt.lastSeenDate = dr.lastSeen;
        rt.isIncome = dr.isIncome;

        // Try to auto-assign category from existing splits
        rt.category = inferCategory(group);

        return rt;
    }

    /**
     * If all (or most) transactions in the group have splits with the same
     * category, auto-assign that category.
     */
    private Category inferCategory(List<Transaction> group) {
        Map<Long, Long> categoryVotes = new HashMap<>();

        for (Transaction t : group) {
            if (t.splits != null) {
                for (TransactionSplit split : t.splits) {
                    if (split.category != null) {
                        categoryVotes.merge(split.category.id, 1L, Long::sum);
                    }
                }
            }
        }

        if (categoryVotes.isEmpty()) return null;

        // Find category with most votes — must have at least 2 votes or >50%
        long totalVotes = categoryVotes
            .values()
            .stream()
            .mapToLong(Long::longValue)
            .sum();
        Map.Entry<Long, Long> best = categoryVotes
            .entrySet()
            .stream()
            .max(Map.Entry.comparingByValue())
            .orElse(null);

        if (
            best != null &&
            (best.getValue() >= 2 ||
                (double) best.getValue() / totalVotes > 0.5)
        ) {
            return Category.findById(best.getKey());
        }

        return null;
    }

    // ── CRUD operations ─────────────────────────────────────────────────────

    public List<RecurringTransaction> getAll() {
        return RecurringTransaction.findAllOrdered();
    }

    public List<RecurringTransaction> getByStatus(RecurringStatus status) {
        return RecurringTransaction.findByStatus(status);
    }

    public List<Transaction> getMatchingTransactions(Long recurringId) {
        RecurringTransaction rt = RecurringTransaction.findById(recurringId);
        if (rt == null) return List.of();
        List<Transaction> matches = findMatchingTransactions(rt);
        // Eagerly initialize lazy collections so Jackson can serialize them.
        for (Transaction t : matches) {
            if (t.uploadedFiles != null) {
                t.uploadedFiles.size();
            }
            if (t.splits != null) {
                t.splits.size();
            }
        }
        return matches;
    }

    public RecurringTransaction getById(Long id) {
        return RecurringTransaction.findById(id);
    }

    @Transactional
    public RecurringTransaction update(Long id, RecurringTransaction updated) {
        RecurringTransaction existing = RecurringTransaction.findById(id);
        if (existing == null) return null;

        if (updated.category != null && updated.category.id != null) {
            existing.category = Category.findById(updated.category.id);
            // If already confirmed, backfill this category to matching transactions
            if (
                existing.status == RecurringStatus.CONFIRMED &&
                existing.category != null
            ) {
                backfillCategory(existing);
            }
        }
        if (updated.expectedAmount != null) existing.expectedAmount =
            updated.expectedAmount;
        if (updated.amountTolerance != null) existing.amountTolerance =
            updated.amountTolerance;
        if (updated.frequency != null) existing.frequency = updated.frequency;
        if (updated.expectedDayOfMonth != null) existing.expectedDayOfMonth =
            updated.expectedDayOfMonth;
        // autoBudget is primitive boolean, we need to check if it was explicitly set
        existing.autoBudget = updated.autoBudget;
        if (updated.displayName != null) existing.displayName =
            updated.displayName;

        existing.persist();
        return existing;
    }

    @Transactional
    public boolean confirm(Long id) {
        RecurringTransaction rt = RecurringTransaction.findById(id);
        if (rt == null) return false;
        rt.status = RecurringStatus.CONFIRMED;
        rt.persist();

        // Backfill: assign the confirmed category to all matching past
        // transactions that don't yet have a split for this category.
        if (rt.category != null) {
            backfillCategory(rt);
        }

        return true;
    }

    private void backfillCategory(RecurringTransaction rt) {
        List<Transaction> matches = findMatchingTransactions(rt);
        for (Transaction t : matches) {
            if (
                t.splits != null &&
                t.splits
                    .stream()
                    .anyMatch(
                        s ->
                            s.category != null &&
                            s.category.id.equals(rt.category.id)
                    )
            ) {
                continue;
            }
            TransactionSplit split = new TransactionSplit();
            split.category = rt.category;
            split.amount = t.mutation.abs();
            split.percentage = new BigDecimal("100");
            split.transaction = t;
            split.persist();
            if (t.splits == null) {
                t.splits = new ArrayList<>();
            }
            t.splits.add(split);

            // If auto-budget is on, ensure a budget exists for this
            // transaction's month
            if (
                rt.autoBudget &&
                rt.category != null &&
                t.transactionDate != null
            ) {
                ensureBudget(
                    rt,
                    t.transactionDate.getYear(),
                    t.transactionDate.getMonthValue()
                );
            }
        }
    }

    private void ensureBudget(RecurringTransaction rt, int year, int month) {
        Budget existing = Budget.findByYearMonthAndCategory(
            year,
            month,
            rt.category.id
        ).orElse(null);
        if (existing == null) {
            Budget budget = new Budget(
                rt.category,
                rt.expectedAmount,
                year,
                month
            );
            budget.persist();
        }
    }

    private List<Transaction> findMatchingTransactions(
        RecurringTransaction rt
    ) {
        if (rt.account == null) {
            return List.of();
        }
        String name = rt.counterpartyName;
        if (name == null || name.isBlank()) {
            return List.of();
        }
        // Strategy 1: exact counterpartyName match, or LIKE on prettyTitle/description
        String pattern = "%" + name + "%";
        List<Transaction> results = Transaction.find(
            "account = ?1 and (lower(counterpartyName) = lower(?2) or lower(prettyTitle) like lower(?3) or lower(description) like lower(?4))",
            rt.account,
            name,
            pattern,
            pattern
        ).list();

        // Strategy 2: if no results, try matching with shorter word prefixes
        // The counterpartyName might be a long account name (from fallback during
        // detection); matching on the first 2-3 words catches more transactions.
        if (results.isEmpty() && name.contains(" ")) {
            String[] words = name.split("\s+");
            // Build a pattern from the first 3 words (or fewer if name is short)
            int wordCount = Math.min(words.length, 3);
            StringBuilder shortName = new StringBuilder();
            for (int i = 0; i < wordCount; i++) {
                if (words[i].length() > 2) {  // skip short noise words
                    if (shortName.length() > 0) shortName.append(" ");
                    shortName.append(words[i]);
                }
            }
            if (shortName.length() > 0) {
                String shortPattern = "%" + shortName.toString() + "%";
                results = Transaction.find(
                    "account = ?1 and (lower(counterpartyName) = lower(?2) or lower(prettyTitle) like lower(?3) or lower(description) like lower(?4))",
                    rt.account,
                    name,
                    shortPattern,
                    shortPattern
                ).list();
            }
        }

        // Strategy 3: if still no results, try the displayName too
        if (results.isEmpty() && rt.displayName != null && !rt.displayName.isBlank() && !rt.displayName.equals(name)) {
            String displayPattern = "%" + rt.displayName.toLowerCase() + "%";
            results = Transaction.find(
                "account = ?1 and (lower(counterpartyName) = lower(?2) or lower(prettyTitle) like lower(?3) or lower(description) like lower(?4))",
                rt.account,
                rt.displayName,
                displayPattern,
                displayPattern
            ).list();
        }

        return results;
    }

    /**
     * Checks a newly created transaction against all CONFIRMED recurring
     * patterns and auto-assigns the category if it matches.
     * Called from TransactionService during file import.
     */
    @Transactional
    public void autoAssignToTransaction(Transaction t) {
        // Only match if the transaction has a counterpartyName (set during parsing)
        if (t.counterpartyName == null || t.counterpartyName.isBlank()) return;

        // Find a confirmed recurring transaction with the same counterparty
        List<RecurringTransaction> confirmed = RecurringTransaction.find(
            "account = ?1 and status = ?2 and lower(counterpartyName) = lower(?3)",
            t.account,
            RecurringStatus.CONFIRMED,
            t.counterpartyName
        ).list();

        for (RecurringTransaction rt : confirmed) {
            if (rt.category == null) continue;

            // Auto-assign category if not already assigned
            if (
                t.splits == null ||
                t.splits
                    .stream()
                    .noneMatch(
                        s ->
                            s.category != null &&
                            s.category.id.equals(rt.category.id)
                    )
            ) {
                TransactionSplit split = new TransactionSplit();
                split.category = rt.category;
                split.amount = t.mutation.abs();
                split.percentage = new BigDecimal("100");
                split.transaction = t;
                split.persist();
                if (t.splits == null) {
                    t.splits = new ArrayList<>();
                }
                t.splits.add(split);
                break; // Only assign the first matching category
            }
        }
    }

    @Transactional
    public boolean dismiss(Long id) {
        RecurringTransaction rt = RecurringTransaction.findById(id);
        if (rt == null) return false;
        rt.status = RecurringStatus.DISMISSED;
        rt.persist();
        return true;
    }

    @Transactional
    public boolean delete(Long id) {
        return RecurringTransaction.deleteById(id);
    }

    // ── Budget suggestion ──────────────────────────────────────────────────

    /**
     * Returns confirmed recurring transactions that don't yet have a budget
     * for the given year/month. The dashboard can use this to prompt the user.
     */
    public List<RecurringTransaction> getMissingBudgets(int year, int month) {
        List<RecurringTransaction> confirmed =
            RecurringTransaction.findByStatus(RecurringStatus.CONFIRMED);
        List<RecurringTransaction> missing = new ArrayList<>();

        for (RecurringTransaction rt : confirmed) {
            if (!rt.autoBudget) continue;
            if (rt.category == null) continue;

            Budget existing = Budget.findByYearMonthAndCategory(
                year,
                month,
                rt.category.id
            ).orElse(null);
            if (existing == null) {
                missing.add(rt);
            }
        }

        return missing;
    }

    // ── Internal result class ───────────────────────────────────────────────

    private static class DetectionResult {

        final BigDecimal expectedAmount;
        final boolean isIncome;
        final RecurrenceFrequency frequency;
        final int expectedDayOfMonth;
        final BigDecimal confidence;
        final LocalDate firstSeen;
        final LocalDate lastSeen;
        final BigDecimal coefficientOfVariation;

        DetectionResult(
            BigDecimal expectedAmount,
            boolean isIncome,
            RecurrenceFrequency frequency,
            int expectedDayOfMonth,
            BigDecimal confidence,
            LocalDate firstSeen,
            LocalDate lastSeen,
            BigDecimal cv
        ) {
            this.expectedAmount = expectedAmount;
            this.isIncome = isIncome;
            this.frequency = frequency;
            this.expectedDayOfMonth = expectedDayOfMonth;
            this.confidence = confidence;
            this.firstSeen = firstSeen;
            this.lastSeen = lastSeen;
            this.coefficientOfVariation = cv;
        }
    }
}
