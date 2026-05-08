package nl.hend.rm.entities;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Entity
public class BankAccount extends PanacheEntity {

    @Column(unique = true, nullable = false)
    public String accountNumber;

    @Column(nullable = false)
    public String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public AccountType type;

    public String color;

    public Boolean active = true;

    /** Snapshot of the current balance. Auto-updated for savings accounts when
     *  internal transfers are detected. Manually editable by the user. */
    public BigDecimal currentBalance;

    @JsonFormat(
        shape = JsonFormat.Shape.STRING,
        pattern = "yyyy-MM-dd'T'HH:mm:ss"
    )
    public LocalDateTime balanceDate;

    public static Optional<BankAccount> findByAccountNumber(
        String accountNumber
    ) {
        return find("accountNumber", accountNumber).firstResultOptional();
    }

    public static List<BankAccount> listActive() {
        return list("active", true);
    }
}
