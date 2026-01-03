package nl.hend.rm.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import nl.hend.rm.entities.TransactionSplit;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record SplitCategoryDto(
        TransactionSplit transactionSplit,
        long transactionId,
        BigDecimal mutation,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
        LocalDate transactionDate,
        String prettyTitle,
        String description,
        List<TransactionSplit> otherSplits
) {}
