package com.splitroom.backend.service;

import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.User;
import com.splitroom.backend.entity.UserRole;
import com.splitroom.backend.exception.ForbiddenException;
import com.splitroom.backend.exception.ResourceNotFoundException;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RoomAuthorizationService {

    private final CurrentUserService currentUserService;
    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;

    @Transactional(readOnly = true)
    public RoomMember requireMember(Long roomId) {
        ensureRoomExists(roomId);
        User user = currentUserService.getRequiredUser();
        return roomMemberRepository
                .findByRoom_RoomIdAndUser_UserId(roomId, user.getUserId())
                .orElseThrow(() -> new ForbiddenException(
                        "The authenticated user is not a member of room "
                                + roomId
                ));
    }

    @Transactional(readOnly = true)
    public RoomMember requireAdmin(Long roomId) {
        RoomMember membership = requireMember(roomId);
        if (membership.getRole() != UserRole.ADMIN) {
            throw new ForbiddenException(
                    "Only a room admin may perform this operation"
            );
        }
        return membership;
    }

    @Transactional(readOnly = true)
    public RoomMember requireOwnMembership(Long roomId, Long memberId) {
        RoomMember currentMembership = requireMember(roomId);
        if (!currentMembership.getRoomMemberId().equals(memberId)) {
            throw new ForbiddenException(
                    "The authenticated user can act only as their own room membership"
            );
        }
        return currentMembership;
    }

    @Transactional(readOnly = true)
    public User getCurrentUser() {
        return currentUserService.getRequiredUser();
    }

    private void ensureRoomExists(Long roomId) {
        if (!roomRepository.existsById(roomId)) {
            throw new ResourceNotFoundException(
                    "Room not found: " + roomId
            );
        }
    }
}
