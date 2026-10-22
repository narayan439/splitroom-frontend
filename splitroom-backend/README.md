# SplitRoom backend

## Authentication and configuration

The API uses stateless JWT bearer authentication. Only registration, login,
and (optionally) Swagger are public. Set these environment variables before
starting the application:

| Variable | Purpose | Default |
| --- | --- | --- |
| `APP_JWT_SECRET` | Base64-encoded random secret; must decode to at least 32 bytes | Required |
| `APP_JWT_EXPIRATION_SECONDS` | Access-token lifetime in seconds | `3600` |
| `APP_CORS_ALLOWED_ORIGINS` | Comma-separated exact browser origins | None |
| `APP_SWAGGER_ENABLED` | Expose Swagger endpoints publicly | `false` |
| `PORT` | HTTP port assigned by the hosting platform | `8080` |

Generate a signing secret with a secure random generator, for example:
`openssl rand -base64 32`. Do not commit the secret. The application fails to
start if the secret is absent, invalid, or too short.

The unauthenticated `/healthz` endpoint runs `SELECT 1` against the configured
database and is intended for the hosting platform's health check. It reports
healthy only when the application can reach MySQL.

The API does not use cookies for authentication. CSRF protection is disabled
for its stateless bearer-token transport. CORS does not allow credentials;
configure the exact frontend origins for each deployment (for local development, set
`APP_CORS_ALLOWED_ORIGINS=http://localhost:4200`). Swagger is protected
unless explicitly enabled for a development environment.

Passwords are stored with BCrypt. Registration does not accept a role; the
global `User.role` is set to `MEMBER`. Room authorization always uses the
role on `RoomMember`, so the same user can be an admin in one room and a member
in another.

## Authentication endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register with name, email, phone and password; returns a safe user DTO |
| `POST` | `/api/auth/login` | Verify credentials and return a signed bearer access token |

Include the token on protected API requests as
`Authorization: Bearer <accessToken>`. Login failures return a generic
`401 Unauthorized` response and do not disclose whether an email exists.

## Room API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/rooms` | List only rooms joined by the authenticated user |
| `GET` | `/api/rooms/my` | List only rooms joined by the authenticated user |
| `POST` | `/api/rooms` | Create a room; authenticated user becomes its first admin |
| `GET` | `/api/rooms/{roomId}` | Get details for a room the caller belongs to |
| `POST` | `/api/rooms/{roomId}/members/{userId}` | Add an existing user (room admin only) |
| `GET` | `/api/rooms/{roomId}/members` | List members (room member only) |
| `DELETE` | `/api/rooms/{roomId}/members/{userId}` | Remove a user (room admin only) |
| `PUT` | `/api/rooms/{roomId}/admin/{userId}` | Transfer admin to an existing member (room admin only) |

Room creation no longer accepts a creator ID. The creator is resolved from the
authenticated principal.

## Expenses, balances and settlements

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/rooms/{roomId}/expenses` | Create an expense; payer must be the caller's room membership |
| `GET` | `/api/rooms/{roomId}/expenses` | List expenses (room member only) |
| `GET` | `/api/rooms/{roomId}/expenses/{expenseId}` | Get details (room member only) |
| `PUT` | `/api/rooms/{roomId}/expenses/{expenseId}` | Update an expense (payer or room admin) |
| `DELETE` | `/api/rooms/{roomId}/expenses/{expenseId}` | Delete an expense (payer or room admin) |
| `GET` | `/api/rooms/{roomId}/balances` | Get room balances (room member only) |
| `GET` | `/api/rooms/{roomId}/rent-cycles` | Get persisted 7th-to-6th cycle history and cycle-scoped financial totals (room member only) |
| `GET` | `/api/rooms/{roomId}/rent-cycles/{startDate}/member-statuses` | Get saved `PENDING`/`CLEAR` member statuses for a cycle (room admin only) |
| `PUT` | `/api/rooms/{roomId}/rent-cycles/{startDate}/members/{memberId}/status` | Save a member's `PENDING`/`CLEAR` status without changing expenses or balances (room admin only) |
| `GET` | `/api/rooms/{roomId}/settlement-suggestions` | Suggest transfers (room member only) |
| `POST` | `/api/rooms/{roomId}/settlements` | Record a pending settlement; sender must be the caller |
| `GET` | `/api/rooms/{roomId}/settlements` | List permitted room settlement history |
| `GET` | `/api/rooms/{roomId}/settlements/{settlementId}` | View details (participant or room admin) |
| `PUT` | `/api/rooms/{roomId}/settlements/{settlementId}/complete` | Complete a pending payment (participant or admin) |
| `PUT` | `/api/rooms/{roomId}/settlements/{settlementId}/cancel` | Cancel a pending payment (room admin only) |

Expense split amounts use two decimal places and deterministic cent allocation.
Room balances use persisted expense shares and completed settlements.
Settlement completion locks the room before validating current balances.

Monthly rent-cycle records are stored in `rent_cycles`. Apply
`src/main/resources/db/migration/V20261022_02__create_rent_cycles.sql` to the
existing database before starting the updated application with
`spring.jpa.hibernate.ddl-auto=validate`. The records contain only each room's
7th-to-6th cycle dates; dashboard totals and member balances are always
calculated from the existing expenses, shares, and completed settlements.
Cycle member statuses are separate metadata and do not create settlements or
affect financial calculations. Apply
`src/main/resources/db/migration/V20261022_03__create_rent_cycle_member_statuses.sql`
after the rent-cycle migration and before starting with schema validation.

## Absences and invitations

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/rooms/{roomId}/members/{memberId}/absences` | Record an absence (room admin only) |
| `PUT` | `/api/rooms/{roomId}/members/{memberId}/absences/{absenceId}/return` | Record a return (room admin only) |
| `GET` | `/api/rooms/{roomId}/members/{memberId}/absences` | View absence history (room member only) |
| `PUT` | `/api/rooms/{roomId}/members/{memberId}/absences/{absenceId}/rules` | Configure category rules (room admin only) |
| `POST` | `/api/rooms/{roomId}/invitations` | Create a pending invitation (room admin only) |
| `GET` | `/api/rooms/{roomId}/invitations` | List invitations, optionally filtered by status (room admin only) |
| `GET` | `/api/users/me/invitations` | List invitations for the authenticated user |
| `PUT` | `/api/invitations/{invitationId}/accept` | Accept as a room member |
| `PUT` | `/api/invitations/{invitationId}/decline` | Decline an invitation |
| `PUT` | `/api/invitations/{invitationId}/cancel` | Cancel a pending invitation (room admin only) |

Absence rule `FULL` is the default, `EXCLUDED` removes the absent member from
an eligible new expense, and `DAILY` prorates by days present in the calendar
month containing the expense date. Existing expenses and settlements are not
rewritten when absence periods or rules change.

Invitation creation and responses lock the room in a transaction to prevent
concurrent duplicate invitations or memberships. Accepting an invitation
always creates a `MEMBER` room membership; room roles are never assigned on
the global user record.
