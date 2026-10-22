package com.splitroom.backend.service;

import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.User;
import com.splitroom.backend.entity.UserRole;
import com.splitroom.backend.exception.ForbiddenException;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RoomAuthorizationServiceTests {

    @Test
    void roomMemberRoleDeterminesRoomAdminAuthorization() {
        User user = new User();
        user.setUserId(8L);

        RoomMember membership = new RoomMember();
        membership.setRoomMemberId(18L);
        membership.setUser(user);
        membership.setRole(UserRole.MEMBER);

        CurrentUserService currentUserService = mock(CurrentUserService.class);
        RoomRepository roomRepository = mock(RoomRepository.class);
        RoomMemberRepository memberRepository =
                mock(RoomMemberRepository.class);
        when(roomRepository.existsById(4L)).thenReturn(true);
        when(currentUserService.getRequiredUser()).thenReturn(user);
        when(memberRepository.findByRoom_RoomIdAndUser_UserId(4L, 8L))
                .thenReturn(Optional.of(membership));

        RoomAuthorizationService authorization =
                new RoomAuthorizationService(
                        currentUserService,
                        roomRepository,
                        memberRepository
                );

        assertEquals(membership, authorization.requireMember(4L));
        assertThrows(
                ForbiddenException.class,
                () -> authorization.requireAdmin(4L)
        );

        membership.setRole(UserRole.ADMIN);
        assertEquals(membership, authorization.requireAdmin(4L));
    }

    @Test
    void userWithoutMembershipCannotAccessRoom() {
        User user = new User();
        user.setUserId(8L);
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        RoomRepository roomRepository = mock(RoomRepository.class);
        RoomMemberRepository memberRepository =
                mock(RoomMemberRepository.class);
        when(roomRepository.existsById(4L)).thenReturn(true);
        when(currentUserService.getRequiredUser()).thenReturn(user);
        when(memberRepository.findByRoom_RoomIdAndUser_UserId(4L, 8L))
                .thenReturn(Optional.empty());

        RoomAuthorizationService authorization =
                new RoomAuthorizationService(
                        currentUserService,
                        roomRepository,
                        memberRepository
                );

        assertThrows(
                ForbiddenException.class,
                () -> authorization.requireMember(4L)
        );
    }
}
