package com.splitroom.backend.dto.response;

import com.splitroom.backend.entity.RentCycleMemberPaymentStatus;

public record RentCycleMemberStatusResponse(
        Long memberId,
        RentCycleMemberPaymentStatus status
) {
}
