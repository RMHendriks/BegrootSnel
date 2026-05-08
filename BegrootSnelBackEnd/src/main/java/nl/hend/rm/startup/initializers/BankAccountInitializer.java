package nl.hend.rm.startup.initializers;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import java.util.List;
import nl.hend.rm.entities.AccountType;
import nl.hend.rm.entities.BankAccount;

/**
 * One-time migration: migrates the old {@code bankAccount} String column
 * on Transaction and UploadedFile to the new {@code account_id} FK referencing
 * the BankAccount table.
 *
 * Safe to keep in the codebase — it only runs when unmigrated rows exist
 * (transactions with null account_id but having the old bankAccount column).
 */
@ApplicationScoped
public class BankAccountInitializer {

    @Inject
    EntityManager em;

    @Transactional
    void onStart(@Observes StartupEvent ev) {
        Number unmigrated = (Number) em
            .createNativeQuery(
                "SELECT COUNT(*) FROM Transaction WHERE account_id IS NULL"
            )
            .getSingleResult();

        if (unmigrated.intValue() == 0) {
            return;
        }

        System.out.println(
            "[BankAccountInitializer] Migrating " +
                unmigrated +
                " transactions..."
        );

        // Collect distinct bankAccount values
        @SuppressWarnings("unchecked")
        List<String> accountNumbers = em
            .createNativeQuery(
                "SELECT DISTINCT bankAccount FROM Transaction WHERE bankAccount IS NOT NULL AND account_id IS NULL"
            )
            .getResultList();

        @SuppressWarnings("unchecked")
        List<String> ufAccountNumbers = em
            .createNativeQuery(
                "SELECT DISTINCT bankAccount FROM UploadedFile WHERE bankAccount IS NOT NULL"
            )
            .getResultList();

        for (String an : ufAccountNumbers) {
            if (!accountNumbers.contains(an)) {
                accountNumbers.add(an);
            }
        }

        for (String accountNumber : accountNumbers) {
            BankAccount account = BankAccount.findByAccountNumber(
                accountNumber
            ).orElse(null);
            if (account == null) {
                account = new BankAccount();
                account.accountNumber = accountNumber;
                account.name = "Rekening " + accountNumber;
                account.type = AccountType.PAYMENT;
                account.active = true;
                account.persist();
                System.out.println(
                    "[BankAccountInitializer] Created account: " + accountNumber
                );
            }

            int updated = em
                .createNativeQuery(
                    "UPDATE Transaction SET account_id = ?1 WHERE bankAccount = ?2 AND account_id IS NULL"
                )
                .setParameter(1, account.id)
                .setParameter(2, accountNumber)
                .executeUpdate();

            if (updated > 0) {
                System.out.println(
                    "[BankAccountInitializer] Updated " +
                        updated +
                        " transactions for account " +
                        accountNumber
                );
            }
        }

        // Update uploaded_files
        for (String accountNumber : accountNumbers) {
            BankAccount account = BankAccount.findByAccountNumber(
                accountNumber
            ).orElse(null);
            if (account != null) {
                em
                    .createNativeQuery(
                        "UPDATE UploadedFile SET account_id = ?1 WHERE bankAccount = ?2 AND account_id IS NULL"
                    )
                    .setParameter(1, account.id)
                    .setParameter(2, accountNumber)
                    .executeUpdate();
            }
        }

        System.out.println("[BankAccountInitializer] Migration complete.");
    }
}
