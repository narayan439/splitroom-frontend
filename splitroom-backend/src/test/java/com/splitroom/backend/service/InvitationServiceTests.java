package com.splitroom.backend.service;

import com.splitroom.backend.entity.InvitationStatus;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.entity.RoomInvitation;
import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.User;
import com.splitroom.backend.entity.UserRole;
import com.splitroom.backend.exception.ConflictException;
import com.splitroom.backend.exception.ForbiddenException;
import com.splitroom.backend.repository.RoomInvitationRepository;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import com.splitroom.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class InvitationServiceTests {

    @Test
    void decliningInvitationUpdatesStatusForInvitee() {
        InvitationFixture fixture = invitationFixture();

        var response = fixture.service().declineInvitation(30L);

        assertEquals(InvitationStatus.DECLINED, response.status());
        assertNotNull(fixture.invitation().getRespondedAt());
    }

    @Test
    void cancellingInvitationUpdatesStatusForRoomAdmin() {
        InvitationFixture fixture = invitationFixture();
        when(fixture.authorizationService().requireAdmin(10L))
                .thenReturn(fixture.inviterMembership());

        var response = fixture.service().cancelInvitation(30L);

        assertEquals(InvitationStatus.CANCELLED, response.status());
        assertNotNull(fixture.invitation().getRespondedAt());
    }

    @Test
    void creatingInvitationRejectsAnExistingRoomMember() {
        InvitationFixture fixture = invitationFixture();
        when(fixture.userRepository().findByEmail("jordan@example.com"))
                .thenReturn(Optional.of(fixture.invitedUser()));
        RoomMember existingMembership = new RoomMember();
        existingMembership.setRoom(fixture.invitation().getRoom());
        when(fixture.memberRepository()
                .findByUser_UserIdForUpdate(20L))
                .thenReturn(Optional.of(existingMembership));

        assertThrows(
                ConflictException.class,
                () -> fixture.service().createInvitation(
                        10L,
                        null,
                        "jordan@example.com"
                )
        );
    }

    @Test
    void creatingInvitationRejectsAnExistingPendingInvitation() {
        InvitationFixture fixture = invitationFixture();
        when(fixture.userRepository().findByEmail("jordan@example.com"))
                .thenReturn(Optional.of(fixture.invitedUser()));
        when(fixture.invitationRepository()
                .existsByRoom_RoomIdAndInvitedUser_UserIdAndStatus(
                        10L,
                        20L,
                        InvitationStatus.PENDING
                ))
                .thenReturn(true);

        assertThrows(
                ConflictException.class,
                () -> fixture.service().createInvitation(
                        10L,
                        null,
                        "jordan@example.com"
                )
        );
    }

    @Test
    void nonAdminCannotCreateInvitation() {
        InvitationFixture fixture = invitationFixture();
        when(fixture.authorizationService().requireAdmin(10L))
                .thenThrow(new ForbiddenException("Admin access required"));

        assertThrows(
                ForbiddenException.class,
                () -> fixture.service().createInvitation(
                        10L,
                        20L,
                        null
                )
        );
    }

    @Test
    void creatingInvitationResolvesRegisteredUserByEmail() {
        Room room = new Room();
        room.setRoomId(10L);
        room.setRoomName("Maple House");

        User invitedUser = new User();
        invitedUser.setUserId(20L);
        invitedUser.setName("Jordan");
        invitedUser.setEmail("jordan@example.com");

        User adminUser = new User();
        adminUser.setUserId(21L);
        adminUser.setName("Alex");
        RoomMember adminMembership = new RoomMember();
        adminMembership.setRoomMemberId(40L);
        adminMembership.setUser(adminUser);

        RoomRepository roomRepository = mock(RoomRepository.class);
        RoomMemberRepository memberRepository =
                mock(RoomMemberRepository.class);
        RoomInvitationRepository invitationRepository =
                mock(RoomInvitationRepository.class);
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        UserRepository userRepository = mock(UserRepository.class);
        RoomAuthorizationService authorizationService =
                mock(RoomAuthorizationService.class);

        when(roomRepository.findByRoomIdForUpdate(10L))
                .thenReturn(Optional.of(room));
        when(authorizationService.requireAdmin(10L))
                .thenReturn(adminMembership);
        when(userRepository.findByEmail("jordan@example.com"))
                .thenReturn(Optional.of(invitedUser));
        when(userRepository.findByUserIdForUpdate(20L))
                .thenReturn(Optional.of(invitedUser));
        when(memberRepository.findByUser_UserIdForUpdate(20L))
                .thenReturn(Optional.empty());
        when(invitationRepository.save(any(RoomInvitation.class)))
                .thenAnswer(invocationCall -> invocationCall.getArgument(0));

        InvitationService service = new InvitationService(
                roomRepository,
                memberRepository,
                invitationRepository,
                userRepository,
                currentUserService,
                authorizationService
        );

        var response = service.createInvitation(
                10L,
                null,
                "  JORDAN@example.com "
        );

        assertEquals(20L, response.invitedUserId());
        assertEquals("jordan@example.com", response.invitedUserEmail());
        assertEquals(InvitationStatus.PENDING, response.status());
        verify(memberRepository).findByUser_UserIdForUpdate(20L);
        verify(invitationRepository)
                .existsByRoom_RoomIdAndInvitedUser_UserIdAndStatus(
                        10L,
                        20L,
                        InvitationStatus.PENDING
                );
    }

    @Test
    void acceptingInvitationCreatesMemberAndPreservesInvitation() {
        Room room = new Room();
        room.setRoomId(10L);
        room.setRoomName("Maple House");

        User invitedUser = new User();
        invitedUser.setUserId(20L);
        invitedUser.setName("Jordan");

        User inviterUser = new User();
        inviterUser.setUserId(21L);
        inviterUser.setName("Alex");
        RoomMember inviterMembership = new RoomMember();
        inviterMembership.setRoomMemberId(40L);
        inviterMembership.setUser(inviterUser);

        RoomInvitation invitation = new RoomInvitation();
        invitation.setInvitationId(30L);
        invitation.setRoom(room);
        invitation.setInvitedBy(inviterMembership);
        invitation.setInvitedUser(invitedUser);
        invitation.setStatus(InvitationStatus.PENDING);

        RoomRepository roomRepository = mock(RoomRepository.class);
        RoomMemberRepository memberRepository =
                mock(RoomMemberRepository.class);
        RoomInvitationRepository invitationRepository =
                mock(RoomInvitationRepository.class);
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        UserRepository userRepository = mock(UserRepository.class);

        when(invitationRepository.findWithDetailsByInvitationId(30L))
                .thenReturn(Optional.of(invitation));
        when(roomRepository.findByRoomIdForUpdate(10L))
                .thenReturn(Optional.of(room));
        when(invitationRepository.findByInvitationIdForUpdate(30L))
                .thenReturn(Optional.of(invitation));
        when(currentUserService.getRequiredUser()).thenReturn(invitedUser);
        when(userRepository.findByUserIdForUpdate(20L))
                .thenReturn(Optional.of(invitedUser));
        when(memberRepository.findByUser_UserIdForUpdate(20L))
                .thenReturn(Optional.empty());
        when(memberRepository.existsByRoom_RoomIdAndUser_UserId(10L, 20L))
                .thenReturn(false);
        when(memberRepository.save(any(RoomMember.class)))
                .thenAnswer(invocationCall ->
                        invocationCall.getArgument(0));
        when(invitationRepository.save(invitation)).thenReturn(invitation);

        InvitationService service = new InvitationService(
                roomRepository,
                memberRepository,
                invitationRepository,
                userRepository,
                currentUserService,
                mock(RoomAuthorizationService.class)
        );

        var response = service.acceptInvitation(30L);

        assertEquals(InvitationStatus.ACCEPTED, response.status());
        assertEquals(10L, response.roomId());
        assertEquals(20L, response.invitedUserId());
        assertEquals(InvitationStatus.ACCEPTED, invitation.getStatus());
        verify(memberRepository).save(org.mockito.ArgumentMatchers.argThat(
                member -> member.getRoom() == room
                        && member.getUser() == invitedUser
                        && member.getRole() == UserRole.MEMBER
        ));
        verify(invitationRepository).save(invitation);
        verify(userRepository).findByUserIdForUpdate(20L);
        verify(memberRepository).findByUser_UserIdForUpdate(20L);
    }

    @Test
    void acceptingInvitationRejectsUserWhoJoinedAnotherRoomAfterInvitation() {
        InvitationFixture fixture = invitationFixture();
        Room otherRoom = new Room();
        otherRoom.setRoomId(99L);
        RoomMember existingMembership = new RoomMember();
        existingMembership.setRoom(otherRoom);
        when(fixture.memberRepository().findByUser_UserIdForUpdate(20L))
                .thenReturn(Optional.of(existingMembership));

        ConflictException exception = assertThrows(
                ConflictException.class,
                () -> fixture.service().acceptInvitation(30L)
        );

        org.junit.jupiter.api.Assertions.assertTrue(
                exception.getMessage().contains("another room")
        );
        verify(fixture.memberRepository(),
                org.mockito.Mockito.never()).save(any(RoomMember.class));
    }

    @Test
    void acceptingInvitationReportsAlreadyMemberOfInvitedRoom() {
        InvitationFixture fixture = invitationFixture();
        RoomMember existingMembership = new RoomMember();
        existingMembership.setRoom(fixture.invitation().getRoom());
        when(fixture.memberRepository().findByUser_UserIdForUpdate(20L))
                .thenReturn(Optional.of(existingMembership));

        assertThrows(
                ConflictException.class,
                () -> fixture.service().acceptInvitation(30L)
        );
        verify(fixture.memberRepository(),
                org.mockito.Mockito.never()).save(any(RoomMember.class));
    }

    private InvitationFixture invitationFixture() {
        Room room = new Room();
        room.setRoomId(10L);
        room.setRoomName("Maple House");

        User invitedUser = new User();
        invitedUser.setUserId(20L);
        invitedUser.setName("Jordan");
        invitedUser.setEmail("jordan@example.com");

        User adminUser = new User();
        adminUser.setUserId(21L);
        adminUser.setName("Alex");
        RoomMember inviterMembership = new RoomMember();
        inviterMembership.setRoomMemberId(40L);
        inviterMembership.setUser(adminUser);

        RoomInvitation invitation = new RoomInvitation();
        invitation.setInvitationId(30L);
        invitation.setRoom(room);
        invitation.setInvitedBy(inviterMembership);
        invitation.setInvitedUser(invitedUser);
        invitation.setStatus(InvitationStatus.PENDING);

        RoomRepository roomRepository = mock(RoomRepository.class);
        RoomMemberRepository memberRepository =
                mock(RoomMemberRepository.class);
        RoomInvitationRepository invitationRepository =
                mock(RoomInvitationRepository.class);
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        UserRepository userRepository = mock(UserRepository.class);
        RoomAuthorizationService authorizationService =
                mock(RoomAuthorizationService.class);

        when(roomRepository.findByRoomIdForUpdate(10L))
                .thenReturn(Optional.of(room));
        when(invitationRepository.findWithDetailsByInvitationId(30L))
                .thenReturn(Optional.of(invitation));
        when(invitationRepository.findByInvitationIdForUpdate(30L))
                .thenReturn(Optional.of(invitation));
        when(currentUserService.getRequiredUser()).thenReturn(invitedUser);
        when(userRepository.findByUserIdForUpdate(20L))
                .thenReturn(Optional.of(invitedUser));
        when(memberRepository.findByUser_UserIdForUpdate(20L))
                .thenReturn(Optional.empty());
        when(memberRepository.existsByRoom_RoomIdAndUser_UserId(10L, 20L))
                .thenReturn(false);
        when(invitationRepository.save(any(RoomInvitation.class)))
                .thenAnswer(invocationCall -> invocationCall.getArgument(0));

        InvitationService service = new InvitationService(
                roomRepository,
                memberRepository,
                invitationRepository,
                userRepository,
                currentUserService,
                authorizationService
        );
        return new InvitationFixture(
                service,
                invitation,
                invitedUser,
                inviterMembership,
                memberRepository,
                invitationRepository,
                userRepository,
                authorizationService
        );
    }

    private record InvitationFixture(
            InvitationService service,
            RoomInvitation invitation,
            User invitedUser,
            RoomMember inviterMembership,
            RoomMemberRepository memberRepository,
            RoomInvitationRepository invitationRepository,
            UserRepository userRepository,
            RoomAuthorizationService authorizationService
    ) {
    }
}
