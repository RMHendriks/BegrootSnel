package nl.hend.rm.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.io.File;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import nl.hend.rm.dto.FileDeleteResult;
import nl.hend.rm.dto.ParseResult;
import nl.hend.rm.entities.BankAccount;
import nl.hend.rm.entities.Transaction;
import nl.hend.rm.entities.UploadedFile;

@ApplicationScoped
public class UploadFileService {

    @Inject
    TransactionService transactionService;

    @Inject
    BankAccountService bankAccountService;

    // ── Upload ────────────────────────────────────────────────────────────────

    /**
     * Processes an uploaded TAB file:
     * 1. Parses transactions and persists new ones (duplicates are skipped).
     * 2. Computes the initial gapDismissed flag based on the current uploads.
     * 3. Persists the UploadedFile record and returns it.
     *
     * @param uploadedFilePath path to the temp file written by RESTEasy Reactive
     * @param originalFilename original filename reported by the browser
     */
    @Transactional
    public UploadedFile processUpload(
        Path uploadedFilePath,
        String originalFilename
    ) {
        File file = uploadedFilePath.toFile();

        // 1. Pre-create the upload record so we can link transactions to it
        UploadedFile uf = new UploadedFile();
        uf.filename = originalFilename;
        uf.uploadedAt = LocalDateTime.now();
        uf.persist();

        // 2. Parse and persist transactions, linking them to this file (even duplicates)
        ParseResult result = transactionService.parseTransactionsFromFile(
            file,
            uf
        );

        if (result.isEmpty()) {
            throw new IllegalArgumentException(
                "The uploaded file contained no parseable transactions."
            );
        }

        // 3. Look up the account first (needed for account-aware gap detection)
        BankAccount account = bankAccountService.findOrCreate(
            result.accountNumber
        );

        // 4. Determine whether there is a gap before this file in the timeline (same account only)
        boolean gapDismissed = computeInitialGapDismissed(
            result.startDate,
            account.id
        );

        // 5. Update the record with parsing metadata
        uf.account = account;
        uf.startDate = result.startDate;
        uf.endDate = result.endDate;
        uf.transactionCount = result.newTransactionCount;
        uf.duplicateCount = result.duplicateCount;
        uf.gapDismissed = gapDismissed;

        uf.hasGap = false; // freshly uploaded — gap is only shown for subsequent files

        // Refresh the account balance from the latest transaction
        bankAccountService.refreshBalance(account.id);

        return uf;
    }

    /**
     * Determines the initial gapDismissed flag for a newly uploaded file.
     * Only considers predecessor files belonging to the same account.
     *
     * True (= no gap warning needed) when:
     *  - There is no predecessor file for this account (this is the oldest one)
     *  - The predecessor's endDate is adjacent to or overlaps this file's startDate
     *
     * False (= gap warning should be shown) when there is a real gap between
     * the predecessor's end and this file's start.
     */
    private boolean computeInitialGapDismissed(
        java.time.LocalDate startDate,
        Long accountId
    ) {
        UploadedFile predecessor = UploadedFile.findPredecessorForAccount(
            startDate,
            accountId
        );

        if (predecessor == null) {
            return true; // oldest file for this account — no gap possible before it
        }

        // Adjacent or overlapping: predecessor.endDate + 1 day >= startDate
        return !predecessor.endDate.plusDays(1).isBefore(startDate);
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    /**
     * Returns all uploaded files sorted by account then startDate, with the
     * hasGap field computed per account: gaps are only detected between
     * consecutive files belonging to the same BankAccount.
     */
    public List<UploadedFile> getAllWithGapStatus() {
        List<UploadedFile> files =
            UploadedFile.listAllSortedByAccountAndStartDate();

        Long currentAccountId = null;
        UploadedFile previousInAccount = null;

        for (UploadedFile file : files) {
            Long fileAccountId = file.account != null ? file.account.id : null;

            if (
                currentAccountId == null ||
                !currentAccountId.equals(fileAccountId)
            ) {
                // Switched to a new account — first file in this group
                currentAccountId = fileAccountId;
                previousInAccount = null;
            }

            if (previousInAccount == null) {
                file.hasGap = false;
            } else {
                boolean actualGap = previousInAccount.endDate
                    .plusDays(1)
                    .isBefore(file.startDate);
                file.hasGap = actualGap && !file.gapDismissed;
            }

            previousInAccount = file;
        }

        return files;
    }

    /**
     * Returns uploaded files for a specific account with gap status computed
     * within that account only.
     */
    public List<UploadedFile> getAllWithGapStatusByAccount(Long accountId) {
        List<UploadedFile> files = UploadedFile.find(
            "account.id = ?1 order by startDate asc",
            accountId
        ).list();

        for (int i = 0; i < files.size(); i++) {
            UploadedFile file = files.get(i);
            if (i == 0) {
                file.hasGap = false;
            } else {
                UploadedFile predecessor = files.get(i - 1);
                boolean actualGap = predecessor.endDate
                    .plusDays(1)
                    .isBefore(file.startDate);
                file.hasGap = actualGap && !file.gapDismissed;
            }
        }

        return files;
    }

    // ── Acknowledge gap ───────────────────────────────────────────────────────

    /**
     * Called when the user presses X on a gap warning in the frontend.
     * Sets gapDismissed = true so the warning is no longer shown.
     */
    @Transactional
    public UploadedFile acknowledgeGap(Long id) {
        UploadedFile file = UploadedFile.findById(id);
        if (file == null) throw new jakarta.ws.rs.NotFoundException(
            "UploadedFile not found: " + id
        );
        file.gapDismissed = true;
        file.hasGap = false;
        return file;
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @Transactional
    public FileDeleteResult delete(Long id) {
        UploadedFile file = UploadedFile.findById(id);
        if (file == null) throw new jakarta.ws.rs.NotFoundException(
            "UploadedFile not found: " + id
        );

        Long accountId = file.account != null ? file.account.id : null;

        // Clear join-table associations before deleting the file.
        // Transaction owns the M:N relationship, so we must remove the file
        // from each transaction's uploadedFiles list.
        List<Transaction> linkedTransactions = Transaction.find(
            "?1 member of uploadedFiles",
            file
        ).list();
        for (Transaction t : linkedTransactions) {
            t.uploadedFiles.remove(file);
        }

        // Flush to persist join-table removals before the file delete
        Transaction.flush();

        file.delete();

        FileDeleteResult result = new FileDeleteResult();
        result.deleted = file;

        // Recalculate counts and gaps for remaining files of this account
        if (accountId != null) {
            result.updatedFiles = recalculateCountsAndGaps(accountId);
            result.orphanedTransactions = buildOrphanedSummary(accountId);
        } else {
            result.updatedFiles = new ArrayList<>();
            result.orphanedTransactions =
                FileDeleteResult.OrphanedSummary.empty();
        }

        return result;
    }

    /**
     * Recalculates transactionCount and duplicateCount for every remaining
     * file of the given account, then recomputes gap status.
     *
     * transactionCount = transactions that exist ONLY in this file
     * duplicateCount  = total linked transactions - transactionCount
     */
    private List<UploadedFile> recalculateCountsAndGaps(Long accountId) {
        List<UploadedFile> files = UploadedFile.find(
            "account.id = ?1 order by startDate asc",
            accountId
        ).list();

        for (UploadedFile f : files) {
            // Count transactions where this file is the ONLY association
            long uniqueCount = Transaction.count(
                "?1 member of uploadedFiles and size(uploadedFiles) = 1",
                f
            );
            // Count all transactions linked to this file
            long totalLinked = Transaction.count(
                "?1 member of uploadedFiles",
                f
            );
            f.transactionCount = (int) uniqueCount;
            f.duplicateCount = (int) (totalLinked - uniqueCount);
        }

        // Recompute gap status per account
        for (int i = 0; i < files.size(); i++) {
            UploadedFile f = files.get(i);
            if (i == 0) {
                f.hasGap = false;
            } else {
                UploadedFile predecessor = files.get(i - 1);
                boolean actualGap = predecessor.endDate
                    .plusDays(1)
                    .isBefore(f.startDate);
                f.hasGap = actualGap && !f.gapDismissed;
            }
        }

        return files;
    }

    /**
     * Builds a summary of orphaned transactions (uploadedFiles is empty)
     * for the given account.
     */
    private FileDeleteResult.OrphanedSummary buildOrphanedSummary(
        Long accountId
    ) {
        List<Transaction> orphans = Transaction.find(
            "account.id = ?1 and size(uploadedFiles) = 0 order by transactionDate asc",
            accountId
        ).list();

        if (orphans.isEmpty()) {
            return FileDeleteResult.OrphanedSummary.empty();
        }

        BankAccount account = orphans.get(0).account;
        FileDeleteResult.OrphanedSummary summary =
            new FileDeleteResult.OrphanedSummary();
        summary.count = orphans.size();
        summary.firstDate = orphans.get(0).transactionDate;
        summary.lastDate = orphans.get(orphans.size() - 1).transactionDate;
        summary.accountId = account.id;
        summary.accountName = account.name;
        summary.accountNumber = account.accountNumber;
        return summary;
    }
}
