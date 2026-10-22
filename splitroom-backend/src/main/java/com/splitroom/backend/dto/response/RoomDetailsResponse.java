package com.splitroom.backend.dto.response;

import java.time.LocalDateTime;

public record RoomDetailsResponse(
        Long roomId,
        String roomName,
        CreatorDetails createdBy,
        LocalDateTime createdAt,
        long memberCount
) {
    public record CreatorDetails(
            Long userId,
            String name,
            String email
    ) {
    }
}
