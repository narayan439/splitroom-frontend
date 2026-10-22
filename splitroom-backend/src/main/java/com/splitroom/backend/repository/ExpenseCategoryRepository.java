package com.splitroom.backend.repository;

import com.splitroom.backend.entity.ExpenseCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface ExpenseCategoryRepository
        extends JpaRepository<ExpenseCategory, Long> {

    Optional<ExpenseCategory> findByCategoryIdAndRoom_RoomId(
            Long categoryId,
            Long roomId
    );

    List<ExpenseCategory> findAllByCategoryIdInAndRoom_RoomId(
            List<Long> categoryIds,
            Long roomId
    );

    List<ExpenseCategory> findAllByRoom_RoomIdOrderByCategoryName(
            Long roomId
    );
}
