package com.splitroom.backend.repository;

import com.splitroom.backend.entity.RentCycle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RentCycleRepository extends JpaRepository<RentCycle, Long> {

    List<RentCycle> findAllByRoom_RoomIdOrderByStartDateDesc(Long roomId);

    Optional<RentCycle> findByRoom_RoomIdAndStartDate(
            Long roomId,
            LocalDate startDate
    );
}
