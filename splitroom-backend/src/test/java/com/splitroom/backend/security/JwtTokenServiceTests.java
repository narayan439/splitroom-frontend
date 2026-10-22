package com.splitroom.backend.security;

import com.splitroom.backend.entity.User;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.Test;

import java.security.SecureRandom;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class JwtTokenServiceTests {

    @Test
    void signsTokenWithUserIdentityAndRejectsTampering() {
        byte[] keyBytes = new byte[32];
        new SecureRandom().nextBytes(keyBytes);
        JwtTokenService service = new JwtTokenService(
                Base64.getEncoder().encodeToString(keyBytes),
                3600
        );
        service.initializeSigningKey();

        User user = new User();
        user.setUserId(42L);
        user.setEmail("narayan@example.com");
        String token = service.createToken(user);

        var claims = service.parseToken(token);
        assertEquals("narayan@example.com", claims.getSubject());
        assertEquals(42, claims.get("uid", Number.class).intValue());
        assertEquals(3600, service.getExpirationSeconds());
        assertThrows(
                JwtException.class,
                () -> service.parseToken(token.substring(0, token.length() - 2)
                        + "xx")
        );
    }
}
