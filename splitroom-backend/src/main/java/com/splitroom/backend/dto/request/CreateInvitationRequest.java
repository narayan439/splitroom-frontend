package com.splitroom.backend.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateInvitationRequest {

    @Positive(message = "Invited user ID must be positive")
    private Long invitedUserId;

    @Email(message = "Invited user email must be valid")
    private String invitedUserEmail;

    @AssertTrue(message = "Provide either an invited user ID or email")
    public boolean isInviteeProvided() {
        boolean hasUserId = invitedUserId != null;
        boolean hasEmail = invitedUserEmail != null
                && !invitedUserEmail.isBlank();
        return hasUserId != hasEmail;
    }
}
