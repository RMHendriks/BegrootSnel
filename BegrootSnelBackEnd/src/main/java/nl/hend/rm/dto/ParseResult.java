package nl.hend.rm.dto;

import java.time.LocalDate;

/**
 * Mutable accumulator returned by TransactionService.parseTransactionsFromFile().
 * Contains the metadata extracted while parsing a TAB file.
 */
public class ParseResult {

    public String accountNumber;
    public LocalDate startDate;
    public LocalDate endDate;
    public int newTransactionCount;
    public int duplicateCount;

    /** True when the file was empty or could not be parsed at all. */
    public boolean isEmpty() {
        return startDate == null;
    }
}
