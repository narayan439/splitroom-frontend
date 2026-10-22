package com.splitroom.backend.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.BadCredentialsException;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTests {

    @Test
    void loginFailuresUseOneGenericMessageRegardlessOfAccountExistence() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        HttpServletRequest request = new MockHttpServletRequest(
                "POST",
                "/api/auth/login"
        );

        var response = handler.handleAuthenticationFailure(
                new BadCredentialsException(
                        "No account exists for private@example.com"
                ),
                request
        );

        assertEquals(401, response.getStatusCode().value());
        assertEquals("Invalid email or password", response.getBody().message());
    }
}
