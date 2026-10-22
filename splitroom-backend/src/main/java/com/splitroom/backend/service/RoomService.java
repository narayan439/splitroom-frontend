package com.splitroom.backend.service;

import com.splitroom.backend.dto.response.AdminTransferResponse;
import com.splitroom.backend.dto.response.RoomDetailsResponse;
import com.splitroom.backend.dto.response.RoomMemberResponse;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.User;
import com.splitroom.backend.entity.UserRole;
import com.splitroom.backend.exception.ConflictException;
import com.splitroom.backend.exception.ResourceNotFoundException;
import com.splitroom.backend.repository.RoomMemberRepository;
import com.splitroom.backend.repository.RoomRepository;
import com.splitroom.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final UserRepository userRepository;
    private final RoomAuthorizationService roomAuthorizationService;
    private final CurrentUserService currentUserService;

    @Transactional
    public RoomDetailsResponse createRoom(String roomName) {
        User authenticatedUser = currentUserService.getRequiredUser();
        User creator = lockUser(authenticatedUser.getUserId());
        ensureUserHasNoRoom(creator.getUserId());

        Room room = new Room();
        room.setRoomName(roomName);
        room.setCreatedBy(creator);

        Room savedRoom = roomRepository.save(room);

        RoomMember creatorMembership = new RoomMember();
        creatorMembership.setRoom(savedRoom);
        creatorMembership.setUser(creator);
        creatorMembership.setRole(UserRole.ADMIN);
        roomMemberRepository.save(creatorMembership);

        return toRoomDetails(savedRoom, 1);
    }

    @Transactional(readOnly = true)
    public List<RoomDetailsResponse> getAllRooms() {
        User user = currentUserService.getRequiredUser();
        return roomMemberRepository.findRoomsJoinedByUserId(user.getUserId()).stream()
                .map(this::toRoomDetails)
                .toList();
    }

    @Transactional(readOnly = true)
    public RoomDetailsResponse getRoomById(Long roomId) {
        roomAuthorizationService.requireMember(roomId);
        Room room = roomRepository.findWithCreatorByRoomId(roomId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Room not found: " + roomId
                ));
        return toRoomDetails(room);
    }

    @Transactional(readOnly = true)
    public List<RoomDetailsResponse> getRoomsByCurrentUser() {
        User user = currentUserService.getRequiredUser();
        return roomMemberRepository.findRoomsJoinedByUserId(user.getUserId()).stream()
                .map(this::toRoomDetails)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RoomMemberResponse> getRoomMembers(Long roomId) {
        roomAuthorizationService.requireMember(roomId);
        return roomMemberRepository.findAllByRoomIdWithUser(roomId).stream()
                .map(this::toRoomMemberResponse)
                .toList();
    }

    @Transactional
    public RoomMemberResponse addMemberToRoom(Long roomId, Long userId) {
        Room room = findRoomForUpdate(roomId);
        roomAuthorizationService.requireAdmin(roomId);
        User user = lockUser(userId);

        var existingMembership =
                roomMemberRepository.findByUser_UserIdForUpdate(userId);
        if (existingMembership.isPresent()) {
            if (existingMembership.get().getRoom().getRoomId()
                    .equals(roomId)) {
                throw new ConflictException(
                        "User is already a member of this room"
                );
            }
            throw new ConflictException(
                    "User already belongs to another room and must leave it before joining this room"
            );
        }

        RoomMember member = new RoomMember();
        member.setRoom(room);
        member.setUser(user);
        member.setRole(UserRole.MEMBER);

        return toRoomMemberResponse(roomMemberRepository.save(member));
    }

    @Transactional
    public void removeMemberFromRoom(Long roomId, Long userId) {
        Room room = findRoomForUpdate(roomId);
        roomAuthorizationService.requireAdmin(roomId);
        RoomMember member = roomMemberRepository
                .findByRoom_RoomIdAndUser_UserId(roomId, userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Membership not found for user " + userId
                                + " in room " + roomId
                ));

        if (room.getCreatedBy().getUserId().equals(userId)) {
            throw new ConflictException(
                    "The room creator cannot be removed from the room"
            );
        }

        if (member.getRole() == UserRole.ADMIN
                && roomMemberRepository.countByRoom_RoomIdAndRole(
                        roomId, UserRole.ADMIN
                ) <= 1) {
            throw new ConflictException(
                    "Transfer admin rights before removing the last room admin"
            );
        }

        roomMemberRepository.delete(member);
    }

    @Transactional
    public AdminTransferResponse transferAdmin(Long roomId, Long newAdminUserId) {
        findRoomForUpdate(roomId);
        roomAuthorizationService.requireAdmin(roomId);
        List<RoomMember> members =
                roomMemberRepository.findAllByRoom_RoomId(roomId);

        RoomMember newAdmin = members.stream()
                .filter(member -> member.getUser().getUserId()
                        .equals(newAdminUserId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User " + newAdminUserId
                                + " is not a member of room " + roomId
                ));

        Long previousAdminUserId = members.stream()
                .filter(member -> member.getRole() == UserRole.ADMIN)
                .map(member -> member.getUser().getUserId())
                .findFirst()
                .orElse(null);

        members.forEach(member -> member.setRole(UserRole.MEMBER));
        newAdmin.setRole(UserRole.ADMIN);
        roomMemberRepository.saveAll(members);

        return new AdminTransferResponse(
                roomId,
                previousAdminUserId,
                newAdminUserId,
                "Room admin role transferred successfully"
        );
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

    private User lockUser(Long userId) {
        return userRepository.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found: " + userId
                ));
    }

    private void ensureUserHasNoRoom(Long userId) {
        if (roomMemberRepository.findByUser_UserIdForUpdate(userId).isPresent()) {
            throw new ConflictException(
                    "You already belong to a room. Leave your current room before creating another."
            );
        }
    }

    private RoomDetailsResponse toRoomDetails(Room room) {
        return toRoomDetails(
                room,
                roomMemberRepository.countByRoom_RoomId(room.getRoomId())
        );
    }

    private RoomDetailsResponse toRoomDetails(Room room, long memberCount) {
        User creator = room.getCreatedBy();
        return new RoomDetailsResponse(
                room.getRoomId(),
                room.getRoomName(),
                new RoomDetailsResponse.CreatorDetails(
                        creator.getUserId(),
                        creator.getName(),
                        creator.getEmail()
                ),
                room.getCreatedAt(),
                memberCount
        );
    }

    private RoomMemberResponse toRoomMemberResponse(RoomMember member) {
        User user = member.getUser();
        return new RoomMemberResponse(
                member.getRoomMemberId(),
                user.getUserId(),
                user.getName(),
                user.getEmail(),
                member.getRole()
        );
    }
}
