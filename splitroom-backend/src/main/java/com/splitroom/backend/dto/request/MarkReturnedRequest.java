package com.splitroom.backend.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class MarkReturnedRequest {

    @NotNull(message = "Return date is required")
    private LocalDate returnDate;
}
