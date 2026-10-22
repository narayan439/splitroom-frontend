CREATE TABLE rent_cycles (
    rent_cycle_id BIGINT NOT NULL AUTO_INCREMENT,
    room_id BIGINT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (rent_cycle_id),
    CONSTRAINT uk_rent_cycle_room_start UNIQUE (room_id, start_date),
    CONSTRAINT fk_rent_cycle_room
        FOREIGN KEY (room_id) REFERENCES rooms (room_id)
);
