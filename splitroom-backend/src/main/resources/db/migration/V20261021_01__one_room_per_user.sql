-- Preflight: inspect conflicts before applying the unique constraint.
-- Resolve these manually with the product owner. Do not delete memberships,
-- expenses, expense shares, settlements, invitations, or absence history.
SELECT member.user_id, member.room_member_id, member.room_id, member.role,
       member.joined_at
FROM room_members member
JOIN (
    SELECT user_id
    FROM room_members
    GROUP BY user_id
    HAVING COUNT(*) > 1
) conflicts ON conflicts.user_id = member.user_id
ORDER BY member.user_id, member.joined_at, member.room_member_id;

-- Apply only after the preflight query returns no rows and the affected
-- membership history has been reconciled explicitly.
ALTER TABLE room_members
    ADD CONSTRAINT uk_room_member_user UNIQUE (user_id);
