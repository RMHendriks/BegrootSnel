package nl.hend.rm.entities;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import io.quarkus.hibernate.orm.panache.PanacheEntity;
import io.quarkus.panache.common.Sort;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Transient;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Tracks every .TAB file that has been imported.
 * The actual transaction data lives in the Transaction table.
 *
 * hasGap is a transient (non-persisted) field set by UploadFileService
 * when building the list response. It tells the frontend whether to show
 * a gap warning before this file in the timeline.
 *
 * gapDismissed is persisted. It is true when:
 *  - the file is the oldest uploaded (no predecessor → no possible gap)
 *  - the predecessor's date range is adjacent to / overlaps this file's startDate
 *  - the user explicitly dismissed the gap warning in the frontend (PUT /uploads/{id}/acknowledge)
 */
@Entity
public class UploadedFile extends PanacheEntity {

    @Column(nullable = false)
    public String filename;

    @ManyToOne
    @JoinColumn(name = "account_id")
    public BankAccount account;

    /** Earliest transaction date found in the imported file. */
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    public LocalDate startDate;

    /** Latest transaction date found in the imported file. */
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    public LocalDate endDate;

    /** Number of new transactions added to the Transaction table. */
    public int transactionCount;

    /** Number of lines skipped because the transaction already existed (unique constraint). */
    public int duplicateCount;

    @JsonFormat(
        shape = JsonFormat.Shape.STRING,
        pattern = "yyyy-MM-dd'T'HH:mm:ss"
    )
    public LocalDateTime uploadedAt;

    /**
     * Persisted flag. True = no unacknowledged gap before this file.
     * See class-level javadoc for the three cases.
     */
    public boolean gapDismissed;

    /**
     * Computed by UploadFileService, NOT stored in the database.
     * True = the frontend should display a gap warning before this file card.
     * Value = actualGap && !gapDismissed
     */
    @Transient
    public boolean hasGap;

    @JsonIgnore
    @ManyToMany(mappedBy = "uploadedFiles")
    public List<Transaction> transactions = new ArrayList<>();

    // ── Panache queries ──────────────────────────────────────────────────────

    public static List<UploadedFile> listAllSortedByStartDate() {
        return listAll(Sort.ascending("startDate").and("endDate"));
    }

    /** Returns all files sorted by account, then startDate. */
    public static List<UploadedFile> listAllSortedByAccountAndStartDate() {
        return listAll(Sort.ascending("account.id").and("startDate"));
    }

    /** Finds the most-recent file whose endDate is strictly before the given date. */
    public static UploadedFile findPredecessor(LocalDate startDate) {
        return find(
            "endDate < ?1 order by endDate desc",
            startDate
        ).firstResult();
    }

    /** Finds the most-recent file for a specific account whose endDate is strictly before the given date. */
    public static UploadedFile findPredecessorForAccount(
        LocalDate startDate,
        Long accountId
    ) {
        return find(
            "account.id = ?1 and endDate < ?2 order by endDate desc",
            accountId,
            startDate
        ).firstResult();
    }
}
