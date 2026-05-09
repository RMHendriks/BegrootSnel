package nl.hend.rm.entities;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonProperty.Access;
import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "recurring_transaction")
public class RecurringTransaction extends PanacheEntity {

    @JsonIgnore
    @JsonIgnoreProperties({ "parent", "children" })
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    public BankAccount account;

    @Column(name = "counterparty_name")
    public String counterpartyName;

    @Column(name = "display_name")
    public String displayName;

    @Column(name = "description_pattern")
    public String descriptionPattern;

    @JsonIgnoreProperties({ "parent", "children" })
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    public Category category;

    @Column(name = "expected_amount", nullable = false)
    public BigDecimal expectedAmount;

    @Column(name = "amount_tolerance")
    public BigDecimal amountTolerance = new BigDecimal("0.05");

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    @Enumerated(EnumType.STRING)
    @Column(name = "frequency", nullable = false)
    public RecurrenceFrequency frequency = RecurrenceFrequency.MONTHLY;

    @Column(name = "expected_day_of_month")
    public Integer expectedDayOfMonth;

    @Column(name = "auto_budget", nullable = false)
    public boolean autoBudget = true;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    public RecurringStatus status = RecurringStatus.DETECTED;

    @Column(name = "occurrence_count")
    public int occurrenceCount;

    @Column(name = "confidence_score")
    public BigDecimal confidenceScore;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @Column(name = "last_seen_date")
    public LocalDate lastSeenDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    @Column(name = "first_seen_date")
    public LocalDate firstSeenDate;

    @Column(name = "is_income")
    public boolean isIncome;

    @JsonProperty("account_id")
    public Long getAccountId() {
        return account != null ? account.id : null;
    }

    @JsonProperty("category_id")
    public Long getCategoryId() {
        return category != null ? category.id : null;
    }

    public static java.util.List<RecurringTransaction> findByStatus(
        RecurringStatus status
    ) {
        return list("status", status);
    }

    public static java.util.List<RecurringTransaction> findByAccountAndStatus(
        BankAccount account,
        RecurringStatus status
    ) {
        return list(
            "account = ?1 and status = ?2 order by confidenceScore desc",
            account,
            status
        );
    }

    public static java.util.List<RecurringTransaction> findAllOrdered() {
        return list("order by status asc, confidenceScore desc");
    }
}
