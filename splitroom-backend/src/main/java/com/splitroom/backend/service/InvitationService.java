package com.splitroom.backend.service;

import com.splitroom.backend.dto.response.RoomInvitationResponse;
import com.splitroom.backend.entity.InvitationStatus;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.entity.RoomInvitation;
import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.User;
import com.splitroom.backend.entity.UserRole;
import com.splitroom.backend.exception.ConflictException;
import com.splitroom.backend.exception.ForbiddenException;
import com.splitroom.backend.exception.ResourceNotFoundException;
import com.splitroom.backend.repository.RoomInvitationRepository;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import com.splitroom.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class InvitationService {

    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final RoomInvitationRepository invitationRepository;
    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;
    private final RoomAuthorizationService roomAuthorizationService;

    @Transactional
    public RoomInvitationResponse createInvitation(
            Long roomId,
            Long invitedUserId
    ) {
        return createInvitation(roomId, invitedUserId, null);
    }

    @Transactional
    public RoomInvitationResponse createInvitation(
            Long roomId,
            Long invitedUserId,
            String invitedUserEmail
    ) {
        Room room = findRoomForUpdate(roomId);
        RoomMember inviterMembership =
                roomAuthorizationService.requireAdmin(roomId);

        User invitedUser = invitedUserId != null
                ? findUser(invitedUserId)
                : findUserByEmail(invitedUserEmail);
        Long resolvedUserId = invitedUser.getUserId();
        invitedUser = userRepository.findByUserIdForUpdate(resolvedUserId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found: " + resolvedUserId
                ));
        var existingMembership = roomMemberRepository
                .findByUser_UserIdForUpdate(resolvedUserId);
        if (existingMembership.isPresent()) {
            String message = existingMembership.get().getRoom().getRoomId()
                    .equals(roomId)
                    ? "The invited user is already a member of this room"
                    : "The invited user already belongs to another room";
            throw new ConflictException(message);
        }
        if (invitationRepository
                .existsByRoom_RoomIdAndInvitedUser_UserIdAndStatus(
                        roomId,
                        resolvedUserId,
                        InvitationStatus.PENDING
                )) {
            throw new ConflictException(
                    "A pending invitation already exists for this user"
            );
        }

        RoomInvitation invitation = new RoomInvitation();
        invitation.setRoom(room);
        invitation.setInvitedBy(inviterMembership);
        invitation.setInvitedUser(invitedUser);
        invitation.setStatus(InvitationStatus.PENDING);
        return toResponse(invitationRepository.save(invitation));
    }

    @Transactional(readOnly = true)
    public List<RoomInvitationResponse> getRoomInvitations(
            Long roomId,
            InvitationStatus status
    ) {
        findRoom(roomId);
        roomAuthorizationService.requireAdmin(roomId);

        return invitationRepository.findRoomInvitations(roomId, status)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RoomInvitationResponse> getUserInvitations() {
        User requester = currentUserService.getRequiredUser();
        return invitationRepository
                .findAllByInvitedUserId(requester.getUserId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public RoomInvitationResponse acceptInvitation(Long invitationId) {
        RoomInvitation invitation = findInvitation(invitationId);
        Room room = findRoomForUpdate(invitation.getRoom().getRoomId());
        invitation = findInvitationForUpdate(invitationId);
        User requester = currentUserService.getRequiredUser();
        requireInvitedUser(invitation, requester);
        requirePending(invitation);

        Long roomId = room.getRoomId();
        User lockedRequester = userRepository
                .findByUserIdForUpdate(requester.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found: " + requester.getUserId()
                ));
        var existingMembership = roomMemberRepository
                .findByUser_UserIdForUpdate(requester.getUserId());
        if (existingMembership.isPresent()) {
            if (existingMembership.get().getRoom().getRoomId().equals(roomId)) {
                throw new ConflictException(
                        "The invited user is already a member of this room"
                );
            }
            throw new ConflictException(
                    "You already belong to another room. Leave your current room before accepting this invitation."
            );
        }

        RoomMember membership = new RoomMember();
        membership.setRoom(room);
        membership.setUser(lockedRequester);
        membership.setRole(UserRole.MEMBER);
        roomMemberRepository.save(membership);

        invitation.setStatus(InvitationStatus.ACCEPTED);
        invitation.setRespondedAt(LocalDateTime.now());
        return toResponse(invitationRepository.save(invitation));
    }

    @Transactional
    public RoomInvitationResponse declineInvitation(Long invitationId) {
        RoomInvitation invitation = findInvitation(invitationId);
        findRoomForUpdate(invitation.getRoom().getRoomId());
        invitation = findInvitationForUpdate(invitationId);
        User requester = currentUserService.getRequiredUser();
        requireInvitedUser(invitation, requester);
        requirePending(invitation);

        invitation.setStatus(InvitationStatus.DECLINED);
        invitation.setRespondedAt(LocalDateTime.now());
        return toResponse(invitationRepository.save(invitation));
    }

    @Transactional
    public RoomInvitationResponse cancelInvitation(Long invitationId) {
        RoomInvitation invitation = findInvitation(invitationId);
        Long roomId = invitation.getRoom().getRoomId();
        findRoomForUpdate(roomId);
        invitation = findInvitationForUpdate(invitationId);

        roomAuthorizationService.requireAdmin(roomId);
        requirePending(invitation);

        invitation.setStatus(InvitationStatus.CANCELLED);
        invitation.setRespondedAt(LocalDateTime.now());
        return toResponse(invitationRepository.save(invitation));
    }

    private Room findRoom(Long roomId) {
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room not found: " + roomId
                ));
    }

    private Room findRoomForUpdate(Long roomId) {
        return roomRepository.findByRoomIdForUpdate(roomId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room not found: " + roomId
                ));
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found: " + userId
                ));
    }

    private User findUserByEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException(
                    "Invited user email is required"
            );
        }
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        return userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No registered user was found for this email"
                ));
    }

    private RoomInvitation findInvitation(Long invitationId) {
        return invitationRepository
                .findWithDetailsByInvitationId(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Invitation not found: " + invitationId
                ));
    }

    private RoomInvitation findInvitationForUpdate(Long invitationId) {
        return invitationRepository.findByInvitationIdForUpdate(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Invitation not found: " + invitationId
                ));
    }

    private void requireInvitedUser(RoomInvitation invitation, User requester) {
        if (!invitation.getInvitedUser().getUserId()
                .equals(requester.getUserId())) {
            throw new ForbiddenException(
                    "Only the invited user may respond to this invitation"
            );
        }
    }

    private void requirePending(RoomInvitation invitation) {
        if (invitation.getStatus() != InvitationStatus.PENDING) {
            throw new ConflictException(
                    "Only a pending invitation may be changed"
            );
        }
    }

    private RoomInvitationResponse toResponse(RoomInvitation invitation) {
        RoomMember inviterMembership = invitation.getInvitedBy();
        User inviter = inviterMembership.getUser();
        User invitedUser = invitation.getInvitedUser();
        Room room = invitation.getRoom();
        return new RoomInvitationResponse(
                invitation.getInvitationId(),
                room.getRoomId(),
                room.getRoomName(),
                invitedUser.getUserId(),
                invitedUser.getName(),
                invitedUser.getEmail(),
                inviterMembership.getRoomMemberId(),
                inviter.getUserId(),
                inviter.getName(),
                invitation.getStatus(),
                invitation.getCreatedAt(),
                invitation.getRespondedAt()
        );
    }
}
