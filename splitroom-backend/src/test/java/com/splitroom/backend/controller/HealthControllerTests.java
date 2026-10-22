package com.splitroom.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HealthControllerTests {

    @Test
    void healthCheckConfirmsDatabaseConnectivity() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject("SELECT 1", Integer.class))
                .thenReturn(1);

        HealthController controller = new HealthController(jdbcTemplate);

        assertEquals("UP", controller.health().get("status"));
        verify(jdbcTemplate).queryForObject("SELECT 1", Integer.class);
    }
}
