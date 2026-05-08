package nl.hend.rm.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import nl.hend.rm.entities.AccountType;
import nl.hend.rm.entities.BankAccount;
import nl.hend.rm.entities.Transaction;

@ApplicationScoped
public class BankAccountService {

    public List<BankAccount> listActive() {
        List<BankAccount> accounts = BankAccount.listActive();
        accounts.forEach(this::populateBalance);
        return accounts;
    }

    public List<BankAccount> listAll() {
        List<BankAccount> accounts = BankAccount.listAll();
        accounts.forEach(this::populateBalance);
        return accounts;
    }

    /**
     * Sets currentBalance and balanceDate from the most recent transaction
     * for this account. The newBalance in a bank statement line is the
     * balance AFTER that transaction settled.
     */
    private void populateBalance(BankAccount account) {
        Transaction latest = Transaction.find(
            "account.id = ?1 ORDER BY transactionDate DESC, id DESC",
            account.id
        ).firstResult();

        if (latest != null) {
            account.currentBalance = latest.newBalance;
            account.balanceDate = latest.transactionDate.atStartOfDay();
        }
    }

    /**
     * Forces a balance refresh for a single account. Call after importing
     * new transactions so the balance reflects the latest state.
     */
    @Transactional
    public void refreshBalance(Long accountId) {
        BankAccount account = BankAccount.findById(accountId);
        if (account != null) {
            populateBalance(account);
        }
    }

    @Transactional
    public BankAccount create(BankAccount account) {
        // Check for duplicate account number
        Optional<BankAccount> existing = BankAccount.findByAccountNumber(
            account.accountNumber
        );
        if (existing.isPresent()) {
            throw new IllegalArgumentException(
                "Account with number " +
                    account.accountNumber +
                    " already exists"
            );
        }
        if (account.name == null || account.name.isBlank()) {
            throw new IllegalArgumentException("Account name is required");
        }
        if (account.type == null) {
            throw new IllegalArgumentException("Account type is required");
        }
        account.active = true;
        account.id = null; // Force new entity (frontend sends id=0 for new accounts)
        account.persist();
        return account;
    }

    @Transactional
    public BankAccount update(Long id, BankAccount updated) {
        BankAccount existing = BankAccount.findById(id);
        if (existing == null) {
            throw new NotFoundException("BankAccount not found: " + id);
        }
        if (updated.name != null && !updated.name.isBlank()) {
            existing.name = updated.name;
        }
        if (updated.type != null) {
            existing.type = updated.type;
        }
        if (updated.color != null) {
            existing.color = updated.color;
        }
        if (updated.active != null) {
            // Boolean, can be null
            existing.active = updated.active;
        }
        return existing;
    }

    @Transactional
    public void delete(Long id) {
        BankAccount account = BankAccount.findById(id);
        if (account == null) {
            throw new NotFoundException("BankAccount not found: " + id);
        }
        // Check if there are transactions linked to this account
        long txCount = nl.hend.rm.entities.Transaction.count("account.id", id);
        if (txCount > 0) {
            throw new IllegalArgumentException(
                "Cannot delete account with " +
                    txCount +
                    " linked transactions. Deactivate it instead."
            );
        }
        account.delete();
    }

    /**
     * Finds an existing account by number, or creates a new one with
     * a sensible default name and type = PAYMENT.
     */
    @Transactional
    public BankAccount findOrCreate(String accountNumber) {
        if (accountNumber == null || accountNumber.isBlank()) {
            return null;
        }
        return BankAccount.findByAccountNumber(accountNumber).orElseGet(() -> {
            BankAccount acc = new BankAccount();
            acc.accountNumber = accountNumber;
            acc.name = "Rekening " + accountNumber;
            acc.type = AccountType.PAYMENT;
            acc.active = true;
            acc.persist();
            return acc;
        });
    }
}
