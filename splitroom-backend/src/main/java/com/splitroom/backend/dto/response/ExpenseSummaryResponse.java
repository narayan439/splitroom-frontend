package com.splitroom.backend.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseSummaryResponse(
        Long expenseId,
        String title,
        BigDecimal amount,
        LocalDate expenseDate,
        String categoryName,
        String payerName,
        long participantCount
) {
}
