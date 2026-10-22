package com.splitroom.backend.repository;

import com.splitroom.backend.entity.RoomMember;
import com.splitroom.backend.entity.Room;
import com.splitroom.backend.entity.UserRole;
import com.splitroom.backend.dto.response.MemberBalanceResponse;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RoomMemberRepository
        extends JpaRepository<RoomMember, Long> {

    boolean existsByRoom_RoomIdAndUser_UserId(
            Long roomId,
            Long userId
    );

    @Query("""
            SELECT rm
            FROM RoomMember rm
            JOIN FETCH rm.user
            WHERE rm.room.roomId = :roomId
            ORDER BY rm.joinedAt
            """)
    List<RoomMember> findAllByRoomIdWithUser(@Param("roomId") Long roomId);

    List<RoomMember> findAllByRoom_RoomId(Long roomId);

    Optional<RoomMember> findByRoom_RoomIdAndUser_UserId(
            Long roomId,
            Long userId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT member FROM RoomMember member WHERE member.user.userId = :userId")
    Optional<RoomMember> findByUser_UserIdForUpdate(
            @Param("userId") Long userId
    );

    Optional<RoomMember> findByRoom_RoomIdAndRoomMemberId(
            Long roomId,
            Long roomMemberId
    );

    List<RoomMember> findAllByRoom_RoomIdAndRoomMemberIdIn(
            Long roomId,
            List<Long> roomMemberIds
    );

    long countByRoom_RoomId(Long roomId);

    long countByRoom_RoomIdAndRole(Long roomId, UserRole role);

    @Query("""
            SELECT r
            FROM RoomMember rm
            JOIN rm.room r
            JOIN FETCH r.createdBy
            WHERE rm.user.userId = :userId
            ORDER BY r.createdAt DESC
            """)
    List<Room> findRoomsJoinedByUserId(@Param("userId") Long userId);

    @Query("""
            SELECT new com.splitroom.backend.dto.response.MemberBalanceResponse(
                member.room.roomId,
                member.room.roomName,
                member.roomMemberId,
                member.user.name,
                (SELECT SUM(expense.amount)
                 FROM Expense expense
                 WHERE expense.room.roomId = member.room.roomId
                   AND expense.paidBy.roomMemberId = member.roomMemberId),
                (SELECT SUM(share.shareAmount)
                 FROM ExpenseShare share
                 WHERE share.expense.room.roomId = member.room.roomId
                   AND share.roomMember.roomMemberId = member.roomMemberId),
                (SELECT SUM(settlement.amount)
                 FROM Settlement settlement
                 WHERE settlement.room.roomId = member.room.roomId
                   AND settlement.fromMember.roomMemberId = member.roomMemberId
                   AND settlement.status = com.splitroom.backend.entity.SettlementStatus.COMPLETED),
                (SELECT SUM(settlement.amount)
                 FROM Settlement settlement
                 WHERE settlement.room.roomId = member.room.roomId
                   AND settlement.toMember.roomMemberId = member.roomMemberId
                   AND settlement.status = com.splitroom.backend.entity.SettlementStatus.COMPLETED)
            )
            FROM RoomMember member
            WHERE member.room.roomId = :roomId
            ORDER BY member.roomMemberId
            """)
    List<MemberBalanceResponse> findBalancesByRoomId(
            @Param("roomId") Long roomId
    );
}