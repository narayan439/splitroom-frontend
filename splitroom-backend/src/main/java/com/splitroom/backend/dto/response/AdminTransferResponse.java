package com.splitroom.backend.dto.response;

public record AdminTransferResponse(
        Long roomId,
        Long previousAdminUserId,
        Long newAdminUserId,
        String message
) {
}
