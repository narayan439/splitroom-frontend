package com.splitroom.backend.repository;

import com.splitroom.backend.entity.InvitationStatus;
import com.splitroom.backend.entity.RoomInvitation;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RoomInvitationRepository
        extends JpaRepository<RoomInvitation, Long> {

    boolean existsByRoom_RoomIdAndInvitedUser_UserIdAndStatus(
            Long roomId,
            Long invitedUserId,
            InvitationStatus status
    );

    @Query("""
            SELECT invitation
            FROM RoomInvitation invitation
            JOIN FETCH invitation.room
            JOIN FETCH invitation.invitedBy inviter
            JOIN FETCH inviter.user
            JOIN FETCH invitation.invitedUser
            WHERE invitation.room.roomId = :roomId
              AND (:status IS NULL OR invitation.status = :status)
            ORDER BY invitation.createdAt DESC, invitation.invitationId DESC
            """)
    List<RoomInvitation> findRoomInvitations(
            @Param("roomId") Long roomId,
            @Param("status") InvitationStatus status
    );

    @Query("""
            SELECT invitation
            FROM RoomInvitation invitation
            JOIN FETCH invitation.room
            JOIN FETCH invitation.invitedBy inviter
            JOIN FETCH inviter.user
            JOIN FETCH invitation.invitedUser
            WHERE invitation.invitedUser.userId = :userId
            ORDER BY invitation.createdAt DESC, invitation.invitationId DESC
            """)
    List<RoomInvitation> findAllByInvitedUserId(
            @Param("userId") Long userId
    );

    @Query("""
            SELECT invitation
            FROM RoomInvitation invitation
            JOIN FETCH invitation.room
            JOIN FETCH invitation.invitedBy inviter
            JOIN FETCH inviter.user
            JOIN FETCH invitation.invitedUser
            WHERE invitation.invitationId = :invitationId
            """)
    Optional<RoomInvitation> findWithDetailsByInvitationId(
            @Param("invitationId") Long invitationId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT invitation
            FROM RoomInvitation invitation
            WHERE invitation.invitationId = :invitationId
            """)
    Optional<RoomInvitation> findByInvitationIdForUpdate(
            @Param("invitationId") Long invitationId
    );
}
