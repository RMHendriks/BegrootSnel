package nl.hend.rm.entities;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Entity
@Table(uniqueConstraints = {
    @jakarta.persistence.UniqueConstraint(columnNames = {"bankAccount", "transactionDate", "mutation", "description"})
})
public class Transaction extends PanacheEntity {

    public String bankAccount;
    public String currency;

    public BigDecimal oldBalance;
    public BigDecimal newBalance;
    public BigDecimal mutation;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    public LocalDate transactionDate;

    public String prettyTitle;
    public String description;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id")
    public List<TransactionSplit> splits;

    public Transaction() {};

    public Transaction(String bankAccount, String currency, BigDecimal oldBalance,
                       BigDecimal newBalance, LocalDate transactionDate, BigDecimal mutation, String prettyTitle,
                       String description) {
        this.bankAccount = bankAccount;
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
                other.splits.stream().noneMatch(newSplit -> newSplit.id != null && newSplit.id.equals(existingSplit.id))
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
                this.splits.add(newSplit);
            }
        }
    }

}
