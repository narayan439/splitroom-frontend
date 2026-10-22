package com.splitroom.backend.dto.response;

import com.splitroom.backend.entity.SettlementStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record SettlementResponse(
        Long settlementId,
        Long roomId,
        MemberDetails fromMember,
        MemberDetails toMember,
        BigDecimal amount,
        LocalDate settlementDate,
        SettlementStatus status,
        LocalDateTime createdAt,
        LocalDateTime completedAt
) {
    public record MemberDetails(
            Long memberId,
            Long userId,
            String name
    ) {
    }
}
