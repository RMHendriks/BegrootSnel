package nl.hend.rm.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.util.Optional;

@Entity
@Table(name = "budgets", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"category_id", "budget_year", "budget_month"})
})
public class Budget extends PanacheEntity {

    @ManyToOne
    @JoinColumn(name = "category_id", nullable = false)
    @JsonIgnore
    public Category category;

    @Column(nullable = false)
    public BigDecimal amount;

    @Column(name = "budget_year", nullable = false)
    public int year;

    @Column(name = "budget_month", nullable = false)
    public int month;

    public Budget() {}

    public Budget(Category category, BigDecimal amount, int year, int month) {
        this.category = category;
        this.amount = amount;
        this.year = year;
        this.month = month;
    }

    @JsonProperty("category_id")
    public long getCategoryId() {
        return category.id;
    }

    public static Optional<Budget> findByYearMonthAndCategory(int year, int month, long categoryId) {
        return find("year = ?1 and month = ?2 and category.id = ?3", year, month, categoryId)
                .firstResultOptional();
    }
}
