package com.splitroom.backend.repository;

import com.splitroom.backend.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

public interface RoomRepository extends JpaRepository<Room, Long> {

    List<Room> findByRoomNameContainingIgnoreCase(String roomName);

    @Query("SELECT r FROM Room r JOIN FETCH r.createdBy ORDER BY r.createdAt DESC")
    List<Room> findAllWithCreator();

    @Query("SELECT r FROM Room r JOIN FETCH r.createdBy WHERE r.roomId = :roomId")
    Optional<Room> findWithCreatorByRoomId(@Param("roomId") Long roomId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Room r WHERE r.roomId = :roomId")
    Optional<Room> findByRoomIdForUpdate(@Param("roomId") Long roomId);
}