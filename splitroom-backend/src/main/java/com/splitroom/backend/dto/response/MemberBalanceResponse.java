package com.splitroom.backend.dto.response;

import java.math.BigDecimal;
import java.math.RoundingMode;

public record MemberBalanceResponse(
        Long roomId,
        String roomName,
        Long memberId,
        String memberName,
        BigDecimal totalPaid,
        BigDecimal totalShare,
        BigDecimal netBalance
) {
    private static final BigDecimal ZERO_MONEY = new BigDecimal("0.00");

    public MemberBalanceResponse(
            Long roomId,
            String roomName,
            Long memberId,
            String memberName,
            BigDecimal totalPaid,
            BigDecimal totalShare
    ) {
        this(
                roomId,
                roomName,
                memberId,
                memberName,
                normalize(totalPaid),
                normalize(totalShare),
                normalize(totalPaid).subtract(normalize(totalShare))
        );
    }

    public MemberBalanceResponse(
            Long roomId,
            String roomName,
            Long memberId,
            String memberName,
            BigDecimal totalPaid,
            BigDecimal totalShare,
            BigDecimal completedSettlementsSent,
            BigDecimal completedSettlementsReceived
    ) {
        this(
                roomId,
                roomName,
                memberId,
                memberName,
                normalize(totalPaid),
                normalize(totalShare),
                normalize(totalPaid)
                        .subtract(normalize(totalShare))
                        .add(normalize(completedSettlementsSent))
                        .subtract(normalize(completedSettlementsReceived))
        );
    }

    public MemberBalanceResponse {
        totalPaid = normalize(totalPaid);
        totalShare = normalize(totalShare);
        netBalance = normalize(netBalance);
    }

    private static BigDecimal normalize(BigDecimal amount) {
        return amount == null
                ? ZERO_MONEY
                : amount.setScale(2, RoundingMode.UNNECESSARY);
    }
}
