package com.splitroom.backend.dto.response;

public record UserResponse(
        Long userId,
        String name,
        String email,
        String phone
) {
}
