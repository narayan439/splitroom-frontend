package com.splitroom.backend.repository;

import com.splitroom.backend.entity.RoommateAbsence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RoommateAbsenceRepository
        extends JpaRepository<RoommateAbsence, Long> {

    @Query("""
            SELECT CASE WHEN COUNT(absence) > 0 THEN TRUE ELSE FALSE END
            FROM RoommateAbsence absence
            WHERE absence.roomMember.roomMemberId = :roomMemberId
              AND (absence.returnDate IS NULL
                   OR absence.returnDate > :departureDate
                   OR absence.departureDate >= :departureDate)
            """)
    boolean existsOverlappingAbsence(
            @Param("roomMemberId") Long roomMemberId,
            @Param("departureDate") LocalDate departureDate
    );

    @Query("""
            SELECT absence
            FROM RoommateAbsence absence
            JOIN FETCH absence.roomMember member
            JOIN FETCH member.user
            WHERE member.room.roomId = :roomId
              AND member.roomMemberId = :roomMemberId
            ORDER BY absence.departureDate DESC, absence.absenceId DESC
            """)
    List<RoommateAbsence> findHistoryByRoomAndMember(
            @Param("roomId") Long roomId,
            @Param("roomMemberId") Long roomMemberId
    );

    @Query("""
            SELECT absence
            FROM RoommateAbsence absence
            WHERE absence.roomMember.room.roomId = :roomId
              AND absence.roomMember.roomMemberId IN :roomMemberIds
              AND absence.departureDate <= :expenseDate
              AND (absence.returnDate IS NULL OR absence.returnDate > :expenseDate)
            """)
    List<RoommateAbsence> findActiveAbsencesForExpenseDate(
            @Param("roomId") Long roomId,
            @Param("roomMemberIds") List<Long> roomMemberIds,
            @Param("expenseDate") LocalDate expenseDate
    );

    Optional<RoommateAbsence>
    findByAbsenceIdAndRoomMember_Room_RoomIdAndRoomMember_RoomMemberId(
            Long absenceId,
            Long roomId,
            Long roomMemberId
    );
}
