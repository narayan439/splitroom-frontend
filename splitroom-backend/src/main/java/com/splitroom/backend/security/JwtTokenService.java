package com.splitroom.backend.security;

import com.splitroom.backend.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtTokenService {

    private final String encodedSecret;
    private final long expirationSeconds;
    private SecretKey signingKey;

    public JwtTokenService(
            @Value("${app.jwt.secret:}") String encodedSecret,
            @Value("${app.jwt.expiration-seconds:3600}") long expirationSeconds
    ) {
        this.encodedSecret = encodedSecret;
        this.expirationSeconds = expirationSeconds;
    }

    @PostConstruct
    void initializeSigningKey() {
        byte[] keyBytes;
        try {
            keyBytes = Decoders.BASE64.decode(encodedSecret);
        } catch (RuntimeException exception) {
            throw new IllegalStateException(
                    "APP_JWT_SECRET must be a Base64-encoded secret of at least 32 bytes",
                    exception
            );
        }
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "APP_JWT_SECRET must decode to at least 32 bytes"
            );
        }
        if (expirationSeconds <= 0) {
            throw new IllegalStateException(
                    "APP_JWT_EXPIRATION_SECONDS must be positive"
            );
        }
        signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public String createToken(User user) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plusSeconds(expirationSeconds);
        return Jwts.builder()
                .subject(user.getEmail())
                .claim("uid", user.getUserId())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(signingKey)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public long getExpirationSeconds() {
        return expirationSeconds;
    }
}
