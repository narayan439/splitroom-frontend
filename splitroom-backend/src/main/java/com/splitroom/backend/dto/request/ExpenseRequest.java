package com.splitroom.backend.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class ExpenseRequest {

    @NotNull(message = "Category ID is required")
    @Positive(message = "Category ID must be positive")
    private Long categoryId;

    @Positive(message = "Payer membership ID must be positive")
    private Long paidByMemberId;

    @NotBlank(message = "Expense title is required")
    @Size(max = 150, message = "Expense title must not exceed 150 characters")
    private String title;

    @NotNull(message = "Expense amount is required")
    @DecimalMin(value = "0.01", message = "Expense amount must be positive")
    @Digits(
            integer = 10,
            fraction = 2,
            message = "Expense amount supports up to 10 integer and 2 decimal digits"
    )
    private BigDecimal amount;

    @NotNull(message = "Expense date is required")
    private LocalDate expenseDate;

    @NotEmpty(message = "At least one split participant is required")
    private List<
            @NotNull(message = "Participant membership ID cannot be null")
            @Positive(message = "Participant membership ID must be positive")
            Long
            > splitBetweenMemberIds;
}
