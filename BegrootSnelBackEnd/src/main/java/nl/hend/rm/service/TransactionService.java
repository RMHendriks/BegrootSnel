package nl.hend.rm.service;

import com.fasterxml.jackson.core.io.BigDecimalParser;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import nl.hend.rm.dto.ParseResult;
import nl.hend.rm.dto.SplitCategoryDto;
import nl.hend.rm.entities.BankAccount;
import nl.hend.rm.entities.Transaction;
import nl.hend.rm.entities.TransactionSplit;
import nl.hend.rm.entities.UploadedFile;

@ApplicationScoped
public class TransactionService {

    @Inject
    BankAccountService bankAccountService;

    private static final DateTimeFormatter BANK_DATE_FORMAT =
        DateTimeFormatter.ofPattern("yyyyMMdd");

    // ── File parsing ─────────────────────────────────────────────────────────

    /**
     * Parses a TAB-separated bank-export file, persists new transactions,
     * and returns metadata about what was found and imported.
     *
     * Duplicate transactions (same bankAccount + date + mutation + description)
     * are silently skipped; they are counted in ParseResult.duplicateCount.
     */
    @Transactional
    public ParseResult parseTransactionsFromFile(File file) {
        return parseTransactionsFromFile(file, null);
    }

    @Transactional
    public ParseResult parseTransactionsFromFile(File file, UploadedFile uf) {
        ParseResult result = new ParseResult();

        try (
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(
                    new FileInputStream(file),
                    StandardCharsets.UTF_8
                )
            )
        ) {
            reader
                .lines()
                .forEach(line -> processLineWithResult(line, result, uf));
        } catch (IOException e) {
            throw new RuntimeException(
                "Error reading TAB file: " + file.getName(),
                e
            );
        }

        // After importing all lines, try to pair any remaining unpaired transfers
        pairInternalTransfers();

        return result;
    }

    private void processLineWithResult(
        String line,
        ParseResult result,
        UploadedFile uf
    ) {
        String[] columns = line.split("\t", -1);

        // TAB format requires at least 8 columns (indices 0-7 are used)
        if (columns.length < 8) {
            return; // header row or malformed line — skip silently
        }

        try {
            String bankAccount = columns[0];
            String currency = columns[1];
            BigDecimal oldBalance = BigDecimalParser.parse(
                columns[3].replace(",", ".")
            );
            BigDecimal newBalance = BigDecimalParser.parse(
                columns[4].replace(",", ".")
            );
            LocalDate date = LocalDate.parse(columns[5], BANK_DATE_FORMAT);
            BigDecimal mutation = BigDecimalParser.parse(
                columns[6].replace(",", ".")
            );
            String description = columns[7];
            String prettyTitle = createPrettyTitle(description);

            // Accumulate date-range metadata
            if (result.accountNumber == null) result.accountNumber =
                bankAccount;

            // Look up or create the BankAccount entity
            BankAccount account = bankAccountService.findOrCreate(bankAccount);
            if (
                result.startDate == null || date.isBefore(result.startDate)
            ) result.startDate = date;
            if (
                result.endDate == null || date.isAfter(result.endDate)
            ) result.endDate = date;

            // Duplicate check using the same columns as the unique constraint
            Transaction existing = Transaction.find(
                "account.accountNumber = ?1 and transactionDate = ?2 and mutation = ?3 and description = ?4",
                bankAccount,
                date,
                mutation,
                description
            ).firstResult();

            if (existing == null) {
                Transaction t = new Transaction(
                    account,
                    currency,
                    oldBalance,
                    newBalance,
                    date,
                    mutation,
                    prettyTitle,
                    description
                );
                if (uf != null) {
                    t.uploadedFiles.add(uf);
                }

                // Detect internal transfers by extracting counterparty account
                // number from the description and checking if it's a known account.
                String counterpartyNumber = extractCounterpartyAccountNumber(
                    description,
                    bankAccount
                );
                if (counterpartyNumber != null) {
                    t.counterpartyAccountNumber = counterpartyNumber;
                    BankAccount.findByAccountNumber(
                        counterpartyNumber
                    ).ifPresent(ca -> {
                        t.internalTransfer = true;
                    });
                }

                t.persist();

                // Attempt to pair with an existing opposite leg immediately.
                if (t.internalTransfer && t.transferGroupId == null) {
                    pairSingleTransaction(t);
                }
                result.newTransactionCount++;
            } else {
                if (uf != null && !existing.uploadedFiles.contains(uf)) {
                    existing.uploadedFiles.add(uf);
                }
                result.duplicateCount++;
            }
        } catch (Exception e) {
            // Malformed data in a single line should not abort the whole import
            System.err.println(
                "[TransactionService] Skipping malformed line: " +
                    e.getMessage()
            );
        }
    }

    /**
     * Tries to find a counterparty account number in the description that
     * is different from the user's own account number.
     *
     * Looks for Dutch IBAN patterns (NLddLLLLdddddddddd) first, then falls
     * back to sequences of 9+ consecutive digits.
     */
    private String extractCounterpartyAccountNumber(
        String description,
        String ownAccountNumber
    ) {
        // 1. Dutch IBAN: NL + 2 digits + 4 uppercase letters + 10 digits
        Pattern ibanPattern = Pattern.compile("NL\\d{2}[A-Z]{4}\\d{10}");
        Matcher ibanMatcher = ibanPattern.matcher(description);
        while (ibanMatcher.find()) {
            String iban = ibanMatcher.group();
            if (!iban.equals(ownAccountNumber)) {
                return iban;
            }
        }

        // 2. Fallback: any sequence of 9 or more digits
        Pattern digitPattern = Pattern.compile("\\d{9,}");
        Matcher digitMatcher = digitPattern.matcher(description);
        while (digitMatcher.find()) {
            String digits = digitMatcher.group();
            if (!digits.equals(ownAccountNumber)) {
                return digits;
            }
        }

        return null;
    }

    private String createPrettyTitle(String rawDescription) {
        if (rawDescription.isBlank()) {
            return "Transactie beschrijving ontbreekt";
        }

        if (rawDescription.contains("/NAME/")) {
            String name = Pattern.compile("/NAME/([^/]+)")
                .matcher(rawDescription)
                .results()
                .map(m -> m.group(1).trim())
                .findFirst()
                .orElse("Overige Transactie");

            String description = Pattern.compile(
                "/REMI/.*?OMSCHRIJVING\\s+([^/]+)",
                Pattern.CASE_INSENSITIVE
            )
                .matcher(rawDescription)
                .results()
                .map(m -> m.group(1).trim())
                .findFirst()
                .orElse("");

            return description.isEmpty() ? name : name + " - " + description;
        }

        if (rawDescription.contains("BEA,")) {
            String shop = Pattern.compile(
                "\\*(.*?)(?=,|\\sNR:|\\d{2}\\.\\d{2})"
            )
                .matcher(rawDescription)
                .results()
                .map(m -> m.group(1).trim())
                .findFirst()
                .orElse("PIN Betaling");

            String[] parts = rawDescription.split(",");
            String locationPart =
                parts.length > 0 ? parts[parts.length - 1].trim() : "";
            String city = locationPart
                .replaceAll("\\d{2}\\.\\d{2}\\.\\d{2}(/\\d{2}:\\d{2})?", "")
                .trim();

            return city.isEmpty() ? shop : shop + " - " + city;
        }

        return rawDescription.substring(
            0,
            Math.min(45, rawDescription.length())
        );
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    @Transactional
    public Transaction updateTransaction(long id, Transaction transaction) {
        Transaction fromDb = Transaction.findById(id);
        fromDb.updateTransaction(transaction);
        Transaction.flush();
        // Initialize lazy collections before the transaction boundary closes,
        // otherwise Jackson serialization fails with LazyInitializationException.
        fromDb.uploadedFiles.size();
        if (fromDb.splits != null) {
            fromDb.splits.size();
        }
        return fromDb;
    }

    public List<Transaction> getAll() {
        return Transaction.listAll(
            Sort.descending("transactionDate")
                .and("id")
                .direction(Sort.Direction.Descending)
        );
    }

    public List<Transaction> getByAccount(Long accountId) {
        return Transaction.find(
            "account.id = ?1 order by transactionDate desc, id desc",
            accountId
        ).list();
    }

    public List<SplitCategoryDto> getTransactionsByYearMonthAndCategoryId(
        int year,
        int month,
        long categoryId
    ) {
        List<Transaction> list =
            Transaction.findTransactionsByYearMonthAndCategoryId(
                year,
                month,
                categoryId
            );
        List<SplitCategoryDto> result = new ArrayList<>();
        for (Transaction t : list)
            result.add(mapToSplitCategoryDto(t, categoryId));
        return result;
    }

    private SplitCategoryDto mapToSplitCategoryDto(
        Transaction transaction,
        long categoryId
    ) {
        TransactionSplit mainSplit = transaction.splits
            .stream()
            .filter(s -> s.category.id == categoryId)
            .findFirst()
            .orElseThrow();

        List<TransactionSplit> otherSplits =
            transaction.splits.size() > 1
                ? transaction.splits
                      .stream()
                      .filter(s -> s.category.id != categoryId)
                      .toList()
                : new ArrayList<>();

        return new SplitCategoryDto(
            mainSplit,
            transaction.id,
            transaction.mutation,
            transaction.transactionDate,
            transaction.prettyTitle,
            transaction.description,
            otherSplits
        );
    }

    // ── Transfer pairing ────────────────────────────────────────────────────

    /**
     * After importing new transactions, scan for unpaired internal transfers
     * and link them with a shared transferGroupId.
     *
     * Matching criteria:
     * - Both have internalTransfer = true and transferGroupId IS NULL
     * - Opposite mutation amounts (same absolute value, opposite sign)
     * - Cross-referencing account numbers and counterparty numbers
     * - Dates within 2 days of each other
     */
    @Transactional
    public int pairInternalTransfers() {
        List<Transaction> unpaired = Transaction.find(
            "internalTransfer = true and transferGroupId IS NULL order by transactionDate asc"
        ).list();

        int paired = 0;
        for (int i = 0; i < unpaired.size(); i++) {
            Transaction a = unpaired.get(i);
            if (a.transferGroupId != null) continue;

            for (int j = i + 1; j < unpaired.size(); j++) {
                Transaction b = unpaired.get(j);
                if (b.transferGroupId != null) continue;

                if (isMatchingTransfer(a, b)) {
                    String groupId = UUID.randomUUID().toString();
                    a.transferGroupId = groupId;
                    b.transferGroupId = groupId;
                    paired += 2;
                    break;
                }
            }
        }
        return paired;
    }

    /** Try to pair a single newly-persisted transaction with an existing unpaired leg. */
    private void pairSingleTransaction(Transaction t) {
        if (t.transferGroupId != null) return;

        List<Transaction> candidates = Transaction.find(
            "internalTransfer = true and transferGroupId IS NULL and id != ?1 " +
                "order by transactionDate asc",
            t.id
        ).list();

        for (Transaction other : candidates) {
            if (isMatchingTransfer(t, other)) {
                String groupId = UUID.randomUUID().toString();
                t.transferGroupId = groupId;
                other.transferGroupId = groupId;
                return;
            }
        }
    }

    private boolean isMatchingTransfer(Transaction a, Transaction b) {
        // Mutations must be non-zero and opposite sign
        if (
            a.mutation.compareTo(BigDecimal.ZERO) == 0 ||
            b.mutation.compareTo(BigDecimal.ZERO) == 0
        ) {
            return false;
        }
        if (a.mutation.signum() == b.mutation.signum()) {
            return false;
        }
        // Same absolute value
        if (a.mutation.abs().compareTo(b.mutation.abs()) != 0) {
            return false;
        }
        // Both must have counterparty set
        if (
            a.counterpartyAccountNumber == null ||
            b.counterpartyAccountNumber == null
        ) {
            return false;
        }
        String aAcct = a.account != null ? a.account.accountNumber : null;
        String bAcct = b.account != null ? b.account.accountNumber : null;
        if (aAcct == null || bAcct == null) return false;

        // Cross-reference: A's counterparty == B's account, B's counterparty == A's account
        boolean crossMatch =
            a.counterpartyAccountNumber.equals(bAcct) &&
            b.counterpartyAccountNumber.equals(aAcct);
        if (!crossMatch) return false;

        // Dates within 2 days of each other (handles weekend processing delays)
        long daysDiff = Math.abs(
            a.transactionDate.toEpochDay() - b.transactionDate.toEpochDay()
        );
        return daysDiff <= 2;
    }
}
