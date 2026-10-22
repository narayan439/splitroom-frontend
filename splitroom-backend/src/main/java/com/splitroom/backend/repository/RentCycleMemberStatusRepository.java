package com.splitroom.backend.repository;

import com.splitroom.backend.entity.RentCycleMemberStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RentCycleMemberStatusRepository
        extends JpaRepository<RentCycleMemberStatus, Long> {

    List<RentCycleMemberStatus> findAllByRoom_RoomIdAndStartDate(
            Long roomId,
            LocalDate startDate
    );

    Optional<RentCycleMemberStatus>
    findByRoom_RoomIdAndStartDateAndRoomMember_RoomMemberId(
            Long roomId,
            LocalDate startDate,
            Long roomMemberId
    );
}
