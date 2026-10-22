package com.splitroom.backend.repository;

import com.splitroom.backend.entity.ExpenseShare;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ExpenseShareRepository
        extends JpaRepository<ExpenseShare, Long> {

    @Query("""
            SELECT share
            FROM ExpenseShare share
            JOIN FETCH share.roomMember member
            JOIN FETCH member.user
            WHERE share.expense.expenseId = :expenseId
            ORDER BY share.shareId
            """)
    List<ExpenseShare> findDetailsByExpenseId(
            @Param("expenseId") Long expenseId
    );

    @Query("""
            SELECT share
            FROM ExpenseShare share
            JOIN FETCH share.expense expense
            JOIN FETCH share.roomMember member
            JOIN FETCH member.user
            WHERE expense.room.roomId = :roomId
            ORDER BY expense.expenseDate DESC, share.shareId
            """)
    List<ExpenseShare> findAllDetailsByRoomId(
            @Param("roomId") Long roomId
    );

    List<ExpenseShare> findAllByExpense_ExpenseId(Long expenseId);

    long countByExpense_ExpenseId(Long expenseId);
}
