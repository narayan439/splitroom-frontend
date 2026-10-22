package com.splitroom.backend.dto.request;

import com.splitroom.backend.entity.RentCycleMemberPaymentStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateRentCycleMemberStatusRequest {

    @NotNull(message = "Payment status is required")
    private RentCycleMemberPaymentStatus status;
}
