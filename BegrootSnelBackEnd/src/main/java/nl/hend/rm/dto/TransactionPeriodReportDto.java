package nl.hend.rm.dto;

import java.time.LocalDate;
import java.util.List;

public record TransactionPeriodReportDto(LocalDate startDate, LocalDate endDate,
                                         List<TransactionCategoryGroupDto> transactionCategoryGroupDtoList) {

}
