package nl.hend.rm.dto;

import nl.hend.rm.entities.Category;
import nl.hend.rm.entities.TransactionSplit;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record TransactionSplitDto(
        // Split details
        Long splitId,
        BigDecimal splitAmount,
        BigDecimal splitPercentage,

        // Category details
        Category category,

        // Parent Transaction context
        Long transactionId,
        LocalDate date,
        String title,
        String rawDescription,
        BigDecimal totalMutation,
        String bankAccount,

        // Other Splits
        List<TransactionSplit> otherSplitList) {}