# SplitRoom

SplitRoom is a roommate expense-sharing application. The frontend is a
standalone-component Angular application, and the backend is a Spring Boot
REST API backed by MySQL. The backend owns authentication, room authorization,
expense-share calculations, balances, settlements, invitation state, and
absence rules.

## Implemented functionality

- Register and log in with JWT bearer authentication; logout clears the
  browser session.
- Create and view rooms. The creator becomes an `ADMIN` in that room, while
  room membership and `ADMIN`/`MEMBER` roles are scoped per room.
- Each user may have at most one room membership. Room creation, invitation
  acceptance, and administrator-added membership are checked by the backend
  and serialized on the user row; a database unique constraint is also
  provided.
- Invite registered users, accept/decline invitations, and manage room
  members from room details.
- Create and list room expenses, including expenses with no individual payer;
  those expenses are split equally across all current room members. The API
  also supports expense detail, update, and delete operations.
- Calculate balances and settlement suggestions in the backend, record
  pending settlements, and manage their lifecycle.
- View roommate absence history, mark members absent/returned, and configure
  category-specific absence rules. Existing expense shares are not
  recalculated when absence records or rules change.
- Review room expenses and member management from the authenticated user's
  rooms; the legacy global pages now load their data from room APIs.
- View room expenses across rooms the authenticated user belongs to. The
  backend does not currently expose a personal-only expense-share history.

## Known limitations

- Expense history lists room expense summaries, not an individual's shares;
  the backend does not expose a personal-only expense history endpoint.
- Detailed absence, invitation, balance, and settlement management is scoped
  to room details.
- For an expense with no individual payer, `paidByMemberId` is `null`; the
  backend stores a null payer and creates equal shares for every room member.
  Apply
  `splitroom-backend/src/main/resources/db/migration/V20261022_01__allow_unpaid_expenses.sql`
  to MySQL before deploying this feature. This repository does not have an
  automatic migration runner.
- There is no Flyway/Liquibase migration setup yet. Hibernate schema
  auto-update is not enabled by default; the production profile validates an
  existing schema. Create and evolve production schemas with reviewed,
  versioned migrations before deploying entity schema changes.
- Before enforcing one room per user on an existing database, inspect and
  resolve conflicts with the preflight query in
  `splitroom-backend/src/main/resources/db/migration/V20261021_01__one_room_per_user.sql`.
  Back up the database, review every returned user and room with the data
  owner, and decide which room remains active. Do not delete duplicate
  `RoomMember` rows when expenses, shares, settlements, invitations, or
  absences still reference them. If those old memberships must be retained,
  design and review an archival-membership schema and migrate all foreign-key
  references before applying the unique constraint. If history cannot be
  preserved safely, stop and leave the constraint unapplied until a
  non-destructive remediation is approved. The script itself does not change
  data and there is no automatic migration runner configured.
- Membership removal deletes the membership row. Foreign-key references from
  existing expenses, shares, settlements, invitations, or absences may prevent
  removing a member with historical records. A historical membership archive
  flow is not implemented.
- The backend context-load test requires an accessible MySQL database and
  valid database configuration; service-level tests do not need MySQL.

## Technology and prerequisites

- Node.js and npm (the project uses npm 11 and Angular 22)
- Java 17
- Maven (or the included Maven Wrapper)
- MySQL 8.x

## MySQL setup

Create a database and a dedicated application account. Use a password manager
or secrets manager to provide the password; do not store it in this repository.
For example, execute equivalent SQL as a MySQL administrator:

```sql
CREATE DATABASE splitroom_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'splitroom_app'@'localhost' IDENTIFIED BY '<choose-a-strong-password>';
GRANT SELECT, INSERT, UPDATE, DELETE
  ON splitroom_db.* TO 'splitroom_app'@'localhost';
```

Restrict the account host and privileges to the actual deployment topology;
replace `localhost` with the backend host as appropriate. Do not expose MySQL
publicly. The production runtime account should not have schema-altering
privileges. For local first-time development only, use a separate development
account with the DDL permissions needed by Hibernate and set
`SPRING_JPA_HIBERNATE_DDL_AUTO=update` for that run. The default is `validate`;
production always uses `validate`. Schema changes for production must be
delivered through reviewed database migrations (migration tooling is not
configured yet).

## Backend configuration and startup

The backend is in [`splitroom-backend/`](./splitroom-backend/). Configuration
uses environment variables; `application.properties` contains development
defaults for the local JDBC URL and username, but no database password or JWT
secret.

Required and optional variables:

| Variable                        | Purpose                                          | Development default                        |
| ------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| `SPRING_DATASOURCE_URL`         | MySQL JDBC URL                                   | `jdbc:mysql://localhost:3306/splitroom_db` |
| `SPRING_DATASOURCE_USERNAME`    | MySQL application user                           | `splitroom_app`                            |
| `SPRING_DATASOURCE_PASSWORD`    | MySQL application password                       | Empty                                      |
| `APP_JWT_SECRET`                | Base64-encoded random value of at least 32 bytes | Required                                   |
| `APP_JWT_EXPIRATION_SECONDS`    | JWT lifetime in seconds                          | `3600`                                     |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | Local schema action                              | `validate`                                 |
| `APP_CORS_ALLOWED_ORIGINS`      | Comma-separated exact frontend origins           | Localhost development origins              |
| `APP_SWAGGER_ENABLED`           | Expose Swagger/OpenAPI endpoints without login   | `false`                                    |

Generate a new JWT key for each environment. For example, with OpenSSL:

```powershell
$env:APP_JWT_SECRET = openssl rand -base64 32
$env:SPRING_DATASOURCE_URL = "jdbc:mysql://localhost:3306/splitroom_db"
$env:SPRING_DATASOURCE_USERNAME = "splitroom_app"
$env:SPRING_DATASOURCE_PASSWORD = "<local-database-password>"
$env:APP_CORS_ALLOWED_ORIGINS = "http://localhost:4200"
$env:SPRING_JPA_HIBERNATE_DDL_AUTO = "update"
.\splitroom-backend\mvnw.cmd -f splitroom-backend\pom.xml spring-boot:run
```

For an already initialized local database, omit the `update` override or set
it to `validate`. Spring Boot listens on port `8080` by default. The JWT key
must decode to at least 32 bytes. Never reuse a sample/test key in production.

## Frontend setup and startup

The Angular source is at the repository root:

```powershell
npm ci
npm run start:dev
```

Development points to `http://localhost:8080` in
[`src/environments/environment.ts`](./src/environments/environment.ts).
The authentication interceptor adds bearer tokens only to backend API
requests; login and registration remain public.

Run frontend checks:

```powershell
npm test -- --watch=false
npm run build
```

`npm run build` uses Angular's production configuration by default. Production uses a same-origin relative `/api` base URL unless the deployment
loads a runtime API URL. Render builds use `RENDER_BACKEND_URL` to generate
that public URL at build time. Do not place secrets in frontend configuration;
values shipped to the browser are public.

## Deploying to Render

The root [`render.yaml`](./render.yaml) Blueprint deploys only the Angular
frontend as a Node web service. The Spring Boot API is not deployed by this
Blueprint; deploy it separately to a host that can connect to your MySQL
database.

Before the first production deployment:

1. Deploy the API separately and configure its exact CORS allowlist to include
   the frontend HTTPS origin, such as
   `https://splitroom-frontend.onrender.com` (no trailing slash).
2. Create a Render Blueprint from this repository's `render.yaml`. Set
   `RENDER_BACKEND_URL` to the separately deployed API's HTTPS origin, without
   an `/api` suffix. The build script requires this value and writes it into
   the generated browser runtime config. Frontend environment values are
   public; never put credentials or JWT signing keys there.
3. Test registration, login, protected room and expense requests, and a direct
   refresh of nested frontend routes with a non-production account.

The frontend starts with `npm start`, which serves the production build on the
Render-assigned `PORT`. For local development, use `npm run start:dev` for
Angular's development server. The frontend must be rebuilt after changing
`RENDER_BACKEND_URL`. Render deployment has not been run from this workspace.

## API documentation

The REST API is under `/api`. Swagger UI is at
`/swagger-ui/index.html` and OpenAPI JSON at `/v3/api-docs`. Both are
authenticated by default; enabling `APP_SWAGGER_ENABLED=true` makes those
paths public, so do so only in an approved environment.

See [`splitroom-backend/README.md`](./splitroom-backend/README.md) for the
current endpoint list and business rules.
