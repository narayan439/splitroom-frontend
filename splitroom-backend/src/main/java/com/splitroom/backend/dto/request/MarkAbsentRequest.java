package com.splitroom.backend.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class MarkAbsentRequest {

    @NotNull(message = "Departure date is required")
    private LocalDate departureDate;

    @Size(max = 255, message = "Reason must not exceed 255 characters")
    private String reason;
}
