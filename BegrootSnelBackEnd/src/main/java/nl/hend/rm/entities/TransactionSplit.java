package nl.hend.rm.entities;

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

    public TransactionSplit() {}

    public TransactionSplit(Category category, BigDecimal amount, BigDecimal percentage) {
        this.category = category;
        this.amount = amount;
        this.percentage = percentage;
    }

}
