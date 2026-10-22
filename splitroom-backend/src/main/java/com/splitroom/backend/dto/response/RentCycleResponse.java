package com.splitroom.backend.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record RentCycleResponse(
        LocalDate startDate,
        LocalDate endDate,
        boolean currentCycle,
        BigDecimal rentAmount,
        BigDecimal expenseTotal,
        String rentPaymentStatus,
        List<ExpenseSummaryResponse> expenses,
        List<MemberCycleSummary> members
) {
    public record MemberCycleSummary(
            Long memberId,
            String memberName,
            BigDecimal shareAmount,
            BigDecimal paidAmount,
            BigDecimal netBalance,
            BigDecimal completedSettlementsSent,
            BigDecimal completedSettlementsReceived
    ) {
    }
}
