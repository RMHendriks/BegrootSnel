package nl.hend.rm.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;

import java.math.BigDecimal;

@Entity
public class TransactionSplit extends PanacheEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    public Category category;

    public BigDecimal amount;
    public BigDecimal percentage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id")
    @JsonIgnore
    public Transaction transaction;

    public TransactionSplit() {}

    public TransactionSplit(Category category, BigDecimal amount, BigDecimal percentage, Transaction transaction) {
        this.category = category;
        this.amount = amount;
        this.percentage = percentage;
        this.transaction = transaction;
    }

}
