package com.splitroom.backend.dto.response;

import com.splitroom.backend.entity.InvitationStatus;

import java.time.LocalDateTime;

public record RoomInvitationResponse(
        Long invitationId,
        Long roomId,
        String roomName,
        Long invitedUserId,
        String invitedUserName,
        String invitedUserEmail,
        Long invitedByMemberId,
        Long invitedByUserId,
        String invitedByName,
        InvitationStatus status,
        LocalDateTime createdAt,
        LocalDateTime respondedAt
) {
}
