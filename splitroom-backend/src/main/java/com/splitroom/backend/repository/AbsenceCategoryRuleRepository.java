package com.splitroom.backend.repository;

import com.splitroom.backend.entity.AbsenceCategoryRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AbsenceCategoryRuleRepository
        extends JpaRepository<AbsenceCategoryRule, Long> {

    @Query("""
            SELECT rule
            FROM AbsenceCategoryRule rule
            JOIN FETCH rule.category
            WHERE rule.absence.absenceId IN :absenceIds
            """)
    List<AbsenceCategoryRule> findAllWithCategoryByAbsenceIds(
            @Param("absenceIds") List<Long> absenceIds
    );

    List<AbsenceCategoryRule> findAllByAbsence_AbsenceId(Long absenceId);
}
