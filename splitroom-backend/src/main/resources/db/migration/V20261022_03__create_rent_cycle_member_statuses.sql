CREATE TABLE rent_cycle_member_statuses (
    rent_cycle_member_status_id BIGINT NOT NULL AUTO_INCREMENT,
    room_id BIGINT NOT NULL,
    room_member_id BIGINT NOT NULL,
    start_date DATE NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    PRIMARY KEY (rent_cycle_member_status_id),
    CONSTRAINT uk_rent_cycle_member_status
        UNIQUE (room_id, start_date, room_member_id),
    CONSTRAINT fk_rent_cycle_member_status_room
        FOREIGN KEY (room_id) REFERENCES rooms (room_id),
    CONSTRAINT fk_rent_cycle_member_status_member
        FOREIGN KEY (room_member_id) REFERENCES room_members (room_member_id),
    CONSTRAINT fk_rent_cycle_member_status_cycle
        FOREIGN KEY (room_id, start_date)
        REFERENCES rent_cycles (room_id, start_date),
    CONSTRAINT chk_rent_cycle_member_status
        CHECK (status IN ('PENDING', 'CLEAR'))
);
