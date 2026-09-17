# Design: MCP API-Key Authentication

## Technical Approach

Add a dedicated `api-keys` backend module and a combined authentication boundary. Browser routes keep `JwtAuthGuard`; only routes annotated with API-key scope metadata accept `thk_` bearer keys. The verifier loads one indexed public identifier, checks HMAC-SHA-256(secret, versioned server pepper), user activity, expiry, revocation, project binding, and route scope on every request. MCP becomes static-token-only; Admin/web email/password, JWT access, refresh rotation, and existing sessions remain unchanged.

## Architecture Decisions

| Decision | Choice | Rejected / rationale |
|---|---|---|
| Credential | `thk_<publicId>_<secret>`; 32 random bytes for each component; persist only `publicId`, prefix, verifier, `hashVersion`, metadata. | JWT: unnecessary claims and slower revocation. bcrypt: expensive for every API request; high-entropy secret plus HMAC is sufficient. |
| Identity | `RequestIdentity { user, authType, keyId, projectId, scopes }`; route decorator declares required scope and project resolver. | Inferring project from user membership permits cross-project leakage. |
| Lifecycle | 30/90/180/365-day expiry; revoke immediately; replace atomically (old key revoked, new key returned once); no overlap. | Recovery/grace windows weaken compromise response. |
| Audit/limits | Reuse `SecurityEventService`: lifecycle, denied management, and invalid/expired/revoked use are full events; successful calls update `lastUsedAt` only. Approved defaults: 10 active keys/user, 3 active keys/user/project, 50 active keys/project, 60 requests/minute/key, 300/user, 1,000/project, optional 10 requests/10 seconds/key, and at least 365 days of audit retention. | Full success-request events create high-volume sensitive telemetry. |

## Approved Policy — User Approval (2026-09-14)

The following defaults are explicitly approved and binding for implementation. They are not unresolved design questions.

- **Scope catalog:** `tasks:read`, `tasks:write`, `comments:read`, `comments:write`, `notifications:read`, `notifications:write`, `activity:read`, `search:read`, `projects:read`, `projects:write`, `project-members:read`, `project-members:write`, `project-modules:read`, `project-modules:write`, `task-statuses:read`, `task-statuses:write`, `organizations:read`, `invitations:read`, `invitations:write`.
- **Scope rules:** Default `tasks:read`; maximum 6 scopes/key; no wildcard or implied scopes.
- **Project/tool boundary:** Deny project-independent MCP operations except metadata-only `taskhub_whoami`. Deny missing, ambiguous, or cross-project context, global list/create, organization-wide operations, and unfiltered search operations.
- **Limits:** 10 active keys/user; 3 active keys/user/project; 50 active keys/project; 60 requests/minute/key, 300/user, 1,000/project; optional 10 requests/10 seconds/key. Use Redis atomic counters and return `429 Retry-After`.
- **Audit:** Retain audit data for at least 365 days. Record lifecycle, denials, invalid/expired/revoked use, scope/project denials, and rate-limit violations. Never record secrets, verifier, pepper, `Authorization` header, raw query/body, or token-bearing configuration.
- **Pepper:** Use versioned HMAC-SHA-256 in the production secret manager; keep current plus previous during rotation and retire the previous after 30 days. Fail closed when missing or invalid; no JWT fallback.
- **Feature flags:** `taskhub.mcp_api_key_management` and `taskhub.mcp_api_key_authentication`; use additive rollout, management before authentication, and an environment-level emergency disable.
- **Production migrations:** Use a compiled TypeORM DataSource with explicit pre-deploy `migration:run`; never run migrations at startup, in the seeder, or on replicas. Rollback disables flags and retains additive key/audit data; never automatically destructively reverts.
- **Repository scope:** Migrate `taskhub-mcp` and `taskboard-plugin` in this change. Keep `taskboard-tui` as a separate follow-up before retiring legacy JWT-file credentials. Every repository has its own PR targeting `main`.

**Conflict reconciliation:** The approved limits supersede the earlier draft proposal of 20 keys/user and 120 requests/minute/key. The earlier provisional scope-gating and “TUI remains unchanged/out of scope” wording is narrowed by this policy: the TUI remains unmodified in this change but requires the stated follow-up, and project-independent denials are now binding. The migration shorthand below is expanded by the explicit production runner and rollback rules above.

## Data Flow

`Bearer` → `CombinedAuthGuard` → `ApiKeyService` → `RequestIdentity` → `Scope/ProjectGuard` → controller/service → redacted audit.

`mcp_api_keys` has UUID id, ownerId, exactly one projectId, name, publicId (unique indexed), prefix, verifier, hashVersion, scopes `text[]`, expiresAt, revokedAt/by/reason, replacedById, lastUsedAt, createdAt, updatedAt. A TypeORM migration creates the table and indexes; production uses the compiled DataSource and explicit pre-deploy `migration:run`, never synchronize, startup, seeder, or replica migrations. User/superadmin management endpoints are JWT-only: `GET/POST /api-keys`, `GET/PATCH-or-action /api-keys/:id`, `POST /api-keys/:id/revoke`, `POST /api-keys/:id/replace`. Creation validates membership and the approved scope catalog; responses return secret only from create/replace.

Endpoint/tool registry: `tasks:read/write` → `/tasks*`; `projects:read/write` → bound project detail/status/module/member operations; `comments:read/write`, `notifications:read/write`, `activity:read`, `search:read`, `organizations:read`, `invitations:read/write` map to their existing MCP calls. Every resolver constrains IDs to the bound project; cross-project, organization creation, and project creation are rejected for API-key identity by the approved policy. `taskhub_whoami` is metadata-only; `taskhub_login` is removed.

## File Changes

| Repository | Files / action |
|---|---|
| `backend` | Create `modules/api-keys/{entity,dto,guards,decorators,strategies,service,controller,module}` and migration; modify `app.module.ts`, auth boundary, security event enum/config, Swagger. |
| `admin` | Create `modules/api-keys/{types,composables}`, `pages/api-keys/index.vue`; register personal module. JWT cookies and login remain. |
| `taskhub-mcp` | Replace `auth.ts` disk/JWT flow with env-only token; remove `tools/auth.ts` login; make `api-client.ts` classify 401/403; remove cached user-scope authority; update README, tests, package smoke test. |
| `taskboard-plugin` | Read explicit `process.env.TASKHUB_API_TOKEN` only; never read `~/.taskhub/credentials.json`; update README. `taskboard-tui` remains unchanged/out of scope. |
| Docs/config | Add portable npm, Claude `.mcp.json`, and OpenCode `opencode.json` examples; document migration and redaction. |

## Interfaces / Contracts

```json
// Claude .mcp.json
{"mcpServers":{"taskhub":{"command":"npx","args":["-y","taskhub-mcp"],"env":{"TASKHUB_API_URL":"https://api.example.com/api","TASKHUB_API_TOKEN":"${TASKHUB_API_TOKEN}"}}}}
// OpenCode opencode.json
{"mcp":{"taskhub":{"type":"local","command":["npx","-y","taskhub-mcp"],"environment":{"TASKHUB_API_URL":"https://api.example.com/api","TASKHUB_API_TOKEN":"{env:TASKHUB_API_TOKEN}"}}}}
```

Errors remain the standard envelope: `401 API_KEY_INVALID` plus RFC-6750 `invalid_token`; `403 INSUFFICIENT_SCOPE` or generic project denial. No token, password, verifier, or Authorization header is logged/returned. Legacy JWT files are detected, ignored, and reported for manual quarantine; never exchanged or deleted automatically.

## Testing Strategy

Backend unit/e2e: generation, HMAC/version rotation, one-time response, ownership, expiry/revocation, project/scope denial, error redaction, rate/count limits, and JWT regression. Admin Vitest: create/reveal-once/revoke/replace and role views. MCP integration/packed tests: env bearer, missing/legacy file, failure mapping, no secret telemetry, all tool mappings. Plugin tests: explicit env only and no credential-file access. Documentation scans assert HTTPS, no literal secrets, and client-specific interpolation.

## Threat Matrix

| Boundary | Status / safe and failure behavior / RED test |
|---|---|
| Documentation-like paths | Applicable: docs are never executed; scan `README`, JSON, and package `bin` examples for secrets and absolute paths. |
| Git repository selection | N/A — no Git automation. |
| Commit state | N/A — no commit automation. |
| Push state | N/A — no push automation. |
| PR commands | N/A — no PR automation. |

## Migration / Rollout

Order: `backend schema → backend disabled flag + management → admin → MCP release → plugin/docs → enable API keys`; use the approved flags and explicit pre-deploy migration runner, validate one key per project, then remove MCP login in the next client release. Rollback disables flags and reverts clients, retaining additive keys/audit data and JWT sessions without automatic destructive reverts. Review slices stay ≤400 lines.

## Open Questions

- None for the approved API-key policy. The task delivery chain strategy remains `pending` in `tasks.md` and is separate from these security and operational defaults.
