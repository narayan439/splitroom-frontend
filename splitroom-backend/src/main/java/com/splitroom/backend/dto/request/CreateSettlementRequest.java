package com.splitroom.backend.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class CreateSettlementRequest {

    @NotNull(message = "Sender member ID is required")
    @Positive(message = "Sender member ID must be positive")
    private Long fromMemberId;

    @NotNull(message = "Receiver member ID is required")
    @Positive(message = "Receiver member ID must be positive")
    private Long toMemberId;

    @NotNull(message = "Settlement amount is required")
    @DecimalMin(value = "0.01", message = "Settlement amount must be positive")
    @Digits(
            integer = 10,
            fraction = 2,
            message = "Settlement amount supports up to 10 integer and 2 decimal digits"
    )
    private BigDecimal amount;

    @NotNull(message = "Settlement date is required")
    private LocalDate settlementDate;
}
