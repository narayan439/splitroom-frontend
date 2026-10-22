package com.splitroom.backend.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record ExpenseDetailsResponse(
        Long expenseId,
        String title,
        BigDecimal amount,
        LocalDate expenseDate,
        LocalDateTime createdAt,
        CategoryDetails category,
        MemberDetails paidBy,
        List<ParticipantShare> participants
) {
    public record CategoryDetails(Long categoryId, String categoryName) {
    }

    public record MemberDetails(
            Long roomMemberId,
            Long userId,
            String name,
            String email
    ) {
    }

    public record ParticipantShare(
            Long roomMemberId,
            Long userId,
            String name,
            String email,
            BigDecimal shareAmount
    ) {
    }
}
