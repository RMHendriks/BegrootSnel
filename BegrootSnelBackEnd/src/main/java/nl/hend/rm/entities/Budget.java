package nl.hend.rm.entities;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;

import java.math.BigDecimal;

@Entity
@Table(name = "budgets", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"category_id", "budget_year", "budget_month"})
})
public class Budget extends PanacheEntity {

    @ManyToOne
    @JoinColumn(name = "category_id", nullable = false)
    public Category category;

    @Column(nullable = false)
    public BigDecimal amount;

    @Column(name = "budget_month", nullable = false)
    public int month;

    @Column(name = "budget_year", nullable = false)
    public int year;

    public Budget() {}
}
