package nl.hend.rm.entities;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
    uniqueConstraints = {
        @jakarta.persistence.UniqueConstraint(
            columnNames = {
                "account_id", "transactionDate", "mutation", "description",
            }
        ),
    }
)
public class Transaction extends PanacheEntity {

    @ManyToOne
    @JoinColumn(name = "account_id")
    public BankAccount account;

    public String currency;

    public BigDecimal oldBalance;
    public BigDecimal newBalance;
    public BigDecimal mutation;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    public LocalDate transactionDate;

    public String prettyTitle;

    @Column(columnDefinition = "TEXT")
    public String description;

    public String counterpartyAccountNumber;

    public String counterpartyName;

    public boolean internalTransfer;

    @ManyToMany
    @JoinTable(
        name = "transaction_uploadedfile",
        joinColumns = @JoinColumn(name = "transaction_id"),
        inverseJoinColumns = @JoinColumn(name = "uploadedfile_id")
    )
    public List<UploadedFile> uploadedFiles = new ArrayList<>();

    @OneToMany(
        cascade = CascadeType.ALL,
        orphanRemoval = true,
        fetch = FetchType.LAZY
    )
    @JoinColumn(name = "transaction_id")
    public List<TransactionSplit> splits;

    public Transaction() {}

    public Transaction(
        BankAccount account,
        String currency,
        BigDecimal oldBalance,
        BigDecimal newBalance,
        LocalDate transactionDate,
        BigDecimal mutation,
        String prettyTitle,
        String description
    ) {
        this.account = account;
        this.currency = currency;
        this.oldBalance = oldBalance;
        this.newBalance = newBalance;
        this.mutation = mutation;
        this.transactionDate = transactionDate;
        this.prettyTitle = prettyTitle;
        this.description = description;
    }

    public void updateTransaction(Transaction other) {
        if (other.splits == null) {
            this.splits.clear();
            return;
        }

        this.splits.removeIf(existingSplit ->
            other.splits
                .stream()
                .noneMatch(
                    newSplit ->
                        newSplit.id != null &&
                        newSplit.id.equals(existingSplit.id)
                )
        );

        for (TransactionSplit newSplit : other.splits) {
            if (newSplit.id != null) {
                this.splits.stream()
                    .filter(existing -> existing.id.equals(newSplit.id))
                    .findFirst()
                    .ifPresent(existing -> {
                        existing.category = newSplit.category;
                        existing.amount = newSplit.amount;
                        existing.percentage = newSplit.percentage;
                    });
            } else {
                // New split from the frontend: set the back-reference so
                // Hibernate knows which transaction owns this split.
                newSplit.transaction = this;
                this.splits.add(newSplit);
            }
        }
    }

    public static List<TransactionSplit> findTransactionListByDateAndCategory(
        Category cat,
        LocalDate start,
        LocalDate end
    ) {
        return find(
            "from TransactionSplit s " +
                "join fetch s.transaction t " +
                "where s.category = ?1 " +
                "and t.transactionDate between ?2 and ?3",
            cat,
            start,
            end
        ).list();
    }

    public static List<Transaction> findTransactionsByYearMonthAndCategoryId(
        int year,
        int month,
        long categoryId
    ) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.withDayOfMonth(start.lengthOfMonth());

        return find(
            "select distinct t from Transaction t " +
                "join t.splits s " +
                "left join fetch t.splits " +
                "where s.category.id = ?1 " +
                "and t.transactionDate between ?2 and ?3 " +
                "order by t.transactionDate desc",
            categoryId,
            start,
            end
        ).list();
    }
}
