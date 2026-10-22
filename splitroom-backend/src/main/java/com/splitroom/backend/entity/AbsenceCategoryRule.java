package com.splitroom.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "absence_category_rules",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_absence_category",
                        columnNames = {"absence_id", "category_id"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
public class AbsenceCategoryRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "rule_id")
    private Long ruleId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "absence_id", nullable = false)
    private RoommateAbsence absence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private ExpenseCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "rule_type", nullable = false)
    private AbsenceRuleType ruleType;
}