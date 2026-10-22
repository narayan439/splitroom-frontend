package com.splitroom.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 100, message = "Name must not exceed 100 characters")
        String name,
        @NotBlank(message = "Email is required")
        @Email(message = "Email must be valid")
        @Size(max = 150, message = "Email must not exceed 150 characters")
        String email,
        @NotBlank(message = "Phone is required")
        @Pattern(
                regexp = "^(?:\\+[0-9]{7,14}|[0-9]{8,15})$",
                message = "Phone must contain 8 to 15 digits, optionally prefixed with +"
        )
        String phone
) {
}
