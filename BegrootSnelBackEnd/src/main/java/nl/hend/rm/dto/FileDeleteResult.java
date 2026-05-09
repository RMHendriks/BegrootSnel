package nl.hend.rm.dto;

import nl.hend.rm.entities.UploadedFile;

import java.time.LocalDate;
import java.util.List;

/**
 * Returned by DELETE /uploads/{id} after a file is removed.
 * Contains the deleted file, all remaining files for that account
 * with recalculated transaction/duplicate counts and gap status,
 * and a summary of orphaned transactions (if any).
 */
public class FileDeleteResult {

    public UploadedFile deleted;

    /** Remaining files for the same account, with recalculated counts and gap status. */
    public List<UploadedFile> updatedFiles;

    /** Summary of transactions that lost all file associations. */
    public OrphanedSummary orphanedTransactions;

    public static class OrphanedSummary {

        public int count;
        public LocalDate firstDate;
        public LocalDate lastDate;
        public Long accountId;
        public String accountName;
        public String accountNumber;

        public static OrphanedSummary empty() {
            OrphanedSummary s = new OrphanedSummary();
            s.count = 0;
            return s;
        }
    }
}
