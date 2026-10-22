package com.splitroom.backend.service;

import com.splitroom.backend.entity.Room;
import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.User;
import com.splitroom.backend.entity.UserRole;
import com.splitroom.backend.exception.ConflictException;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import com.splitroom.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RoomServiceTests {

    @Test
    void createsRoomAndMakesCreatorAnAdminMember() {
        User creator = user(1L);
        RoomRepository rooms = mock(RoomRepository.class);
        RoomMemberRepository members = mock(RoomMemberRepository.class);
        UserRepository users = mock(UserRepository.class);
        CurrentUserService currentUser = mock(CurrentUserService.class);
        when(currentUser.getRequiredUser()).thenReturn(creator);
        when(users.findByUserIdForUpdate(1L)).thenReturn(Optional.of(creator));
        when(members.findByUser_UserIdForUpdate(1L))
                .thenReturn(Optional.empty());
        when(rooms.save(any(Room.class))).thenAnswer(invocation -> {
            Room room = invocation.getArgument(0);
            room.setRoomId(11L);
            room.setCreatedAt(LocalDateTime.now());
            return room;
        });

        RoomService service = new RoomService(
                rooms,
                members,
                users,
                mock(RoomAuthorizationService.class),
                currentUser
        );

        var response = service.createRoom("Maple House");

        assertEquals(11L, response.roomId());
        verify(members).save(org.mockito.ArgumentMatchers.argThat(
                membership -> membership.getRoom().getRoomId().equals(11L)
                        && membership.getUser().equals(creator)
                        && membership.getRole() == UserRole.ADMIN
        ));
        verify(users).findByUserIdForUpdate(1L);
        verify(members).findByUser_UserIdForUpdate(1L);
    }

    @Test
    void rejectsRoomCreationWhenCreatorAlreadyHasMembership() {
        User creator = user(1L);
        RoomMember existingMembership = new RoomMember();
        Room existingRoom = new Room();
        existingRoom.setRoomId(12L);
        existingMembership.setRoom(existingRoom);

        RoomRepository rooms = mock(RoomRepository.class);
        RoomMemberRepository members = mock(RoomMemberRepository.class);
        UserRepository users = mock(UserRepository.class);
        CurrentUserService currentUser = mock(CurrentUserService.class);
        when(currentUser.getRequiredUser()).thenReturn(creator);
        when(users.findByUserIdForUpdate(1L)).thenReturn(Optional.of(creator));
        when(members.findByUser_UserIdForUpdate(1L))
                .thenReturn(Optional.of(existingMembership));

        RoomService service = new RoomService(
                rooms,
                members,
                users,
                mock(RoomAuthorizationService.class),
                currentUser
        );

        assertThrows(
                ConflictException.class,
                () -> service.createRoom("Second room")
        );
        verify(rooms, never()).save(any(Room.class));
    }

    @Test
    void adminCannotAddUserWhoBelongsToAnotherRoom() {
        User admin = user(1L);
        User target = user(2L);
        Room room = new Room();
        room.setRoomId(11L);
        Room otherRoom = new Room();
        otherRoom.setRoomId(12L);
        RoomMember membership = new RoomMember();
        membership.setRoom(otherRoom);

        RoomRepository rooms = mock(RoomRepository.class);
        RoomMemberRepository members = mock(RoomMemberRepository.class);
        UserRepository users = mock(UserRepository.class);
        RoomAuthorizationService authorization =
                mock(RoomAuthorizationService.class);
        CurrentUserService currentUser = mock(CurrentUserService.class);
        when(rooms.findByRoomIdForUpdate(11L)).thenReturn(Optional.of(room));
        when(authorization.requireAdmin(11L)).thenReturn(new RoomMember());
        when(users.findByUserIdForUpdate(2L)).thenReturn(Optional.of(target));
        when(members.findByUser_UserIdForUpdate(2L))
                .thenReturn(Optional.of(membership));

        RoomService service = new RoomService(
                rooms,
                members,
                users,
                authorization,
                currentUser
        );

        assertThrows(
                ConflictException.class,
                () -> service.addMemberToRoom(11L, 2L)
        );
        verify(members, never()).save(any(RoomMember.class));
    }

    private User user(Long id) {
        User user = new User();
        user.setUserId(id);
        user.setName("Test User " + id);
        user.setEmail("user" + id + "@example.com");
        return user;
    }
}
