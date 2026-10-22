package com.splitroom.backend.dto.response;

import com.splitroom.backend.entity.UserRole;

public record RoomMemberResponse(
        Long roomMemberId,
        Long userId,
        String name,
        String email,
        UserRole role
) {
}
