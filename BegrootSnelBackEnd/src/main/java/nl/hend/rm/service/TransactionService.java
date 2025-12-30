package nl.hend.rm.service;

import com.fasterxml.jackson.core.io.BigDecimalParser;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import nl.hend.rm.entities.Transaction;

import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.regex.Pattern;


@ApplicationScoped
public class TransactionService {

    @Transactional
    public void parseTransactionsFromFile(File file) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            reader.lines().forEach(this::processLine);
        } catch (IOException e) {
            throw new RuntimeException("Error streaming input", e);
        }
    }

    private void processLine(String line) {
        String[] columns = line.split("\t", -1);

        if (columns.length < 5) {
            throw new RuntimeException("File line has the incorrect length");
        }

        DateTimeFormatter bankFormatter = DateTimeFormatter.ofPattern("yyyyMMdd");

        String bankAccount = columns[0];
        String currency = columns[1];
        BigDecimal oldBalance = BigDecimalParser.parse(columns[3].replace(",", "."));
        BigDecimal newBalance =  BigDecimalParser.parse(columns[4].replace(",", "."));
        LocalDate date = LocalDate.parse(columns[5], bankFormatter);
        BigDecimal mutation = BigDecimalParser.parse(columns[6].replace(",", "."));
        String description = columns[7];
        String prettyTitle = createPrettyTitle(description);

        Transaction tr = new Transaction(bankAccount, currency, oldBalance, newBalance, date,
                                         mutation, prettyTitle, description);
        tr.persist();

    }

    private String createPrettyTitle(String rawDescription) {
        if (rawDescription.isBlank()) {
            return "Transactie beschrijving ontbreekt";
        }

        // SEPA betalingen
        if (rawDescription.contains("/NAME/")) {
            String name = Pattern.compile("/NAME/([^/]+)").matcher(rawDescription).results()
                    .map(m -> m.group(1).trim()).findFirst().orElse("Overige Transactie");

            String description = Pattern.compile("/REMI/.*?OMSCHRIJVING\\s+([^/]+)", Pattern.CASE_INSENSITIVE).matcher(rawDescription).results()
                    .map(m -> m.group(1).trim()).findFirst().orElse("");

            return description.isEmpty() ? name : name + " - " + description;
        }

        // PIN betlalingen
        if (rawDescription.contains("BEA,")) {
            String shop = Pattern.compile("\\*(.*?)(?=,|\\sNR:|\\d{2}\\.\\d{2})").matcher(rawDescription).results()
                    .map(m -> m.group(1).trim()).findFirst().orElse("PIN Betaling");

            String[] parts = rawDescription.split(",");
            String locationPart = parts.length > 0 ? parts[parts.length - 1].trim() : "";

            String city = locationPart.replaceAll("\\d{2}\\.\\d{2}\\.\\d{2}(/\\d{2}:\\d{2})?", "").trim();

            return city.isEmpty() ? shop : shop + " - " + city;
        }

        return rawDescription.substring(0, 45);
    }

    @Transactional
    public Transaction updateTransaction(long id, Transaction transaction) {
        Transaction transactionFromDB = Transaction.findById(id);
        transactionFromDB.updateTransaction(transaction);
        Transaction.flush();
        return transactionFromDB;
    }

    public List<Transaction> getAll() {
        return Transaction.listAll(Sort.descending("transactionDate").and("id").direction(Sort.Direction.Descending));
    }

}
