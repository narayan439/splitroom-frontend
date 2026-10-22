-- Allow expenses that are split across the room without an individual payer.
-- Apply this migration before deploying the backend entity change.
ALTER TABLE expenses
    MODIFY COLUMN paid_by_member_id BIGINT NULL;
