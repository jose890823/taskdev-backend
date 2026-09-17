# Tasks: MCP API-Key Authentication

## Review Workload Forecast

Estimated changed lines: 1,050–1,450. Split: backend foundation → management → Admin → clients → docs.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Test | Runtime | Rollback |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Backend schema, verifier, guarded routes | PR 1 | `cd backend && pnpm run test -- --runInBand api-keys` | Local API smoke, migration disabled | Module, migration, guard wiring |
| 2 | JWT-only management and audit | PR 2 | `cd backend && pnpm run test:e2e -- --runInBand` | Create/revoke/replace key | Management and audit code |
| 3 | Admin key lifecycle UI | PR 3 | `cd admin && pnpm run test -- --run` | Browser flow with JWT cookies | Admin module/page |
| 4 | Static-token MCP/plugin boundary | PR 4 | `cd taskhub-mcp && pnpm run test && pnpm run build` | Live key call; missing/legacy cases | MCP auth/client/tools and plugin |
| 5 | Docs/configs/release | PR 5 | Secret/path scan and package smoke | `npx -y taskhub-mcp` with env token | README, SECURITY, plugin/config |

## Approved Policy — User Approval (2026-09-14)

The following defaults are explicitly approved and binding for the unchecked implementation tasks. The API-key policy decision is closed; the forecast's remaining `pending` item is delivery chain strategy only.

- **Scopes:** Explicit catalog: `tasks:read`, `tasks:write`, `comments:read`, `comments:write`, `notifications:read`, `notifications:write`, `activity:read`, `search:read`, `projects:read`, `projects:write`, `project-members:read`, `project-members:write`, `project-modules:read`, `project-modules:write`, `task-statuses:read`, `task-statuses:write`, `organizations:read`, `invitations:read`, `invitations:write`. Default `tasks:read`; maximum 6 scopes/key; no wildcard or implied scopes.
- **Project/tool boundary:** Deny project-independent MCP operations except metadata-only `taskhub_whoami`; deny missing, ambiguous, or cross-project context, global list/create, organization-wide, and unfiltered search operations.
- **Limits:** 10 active keys/user; 3 active keys/user/project; 50 active keys/project; 60 requests/minute/key, 300/user, 1,000/project; optional 10 requests/10 seconds/key. Use Redis atomic counters and return `429 Retry-After`.
- **Audit and pepper:** Retain audit data at least 365 days; record lifecycle, denials, invalid/expired/revoked use, scope/project denials, and rate-limit violations; never record secrets, verifier, pepper, `Authorization` header, raw query/body, or token-bearing configuration. Use versioned HMAC-SHA-256 in the production secret manager, current plus previous during rotation, retire previous after 30 days, fail closed if missing/invalid, and never use JWT fallback.
- **Flags and migrations:** Use `taskhub.mcp_api_key_management` and `taskhub.mcp_api_key_authentication` with additive rollout, management before auth, and environment emergency disable. Use compiled TypeORM DataSource with explicit pre-deploy `migration:run`; no startup/seeder/replica migrations. Rollback disables flags and retains additive key/audit data without automatic destructive revert.
- **Repository scope:** Migrate `taskhub-mcp` and `taskboard-plugin` in this change; keep `taskboard-tui` as a separate follow-up before retiring legacy JWT-file credentials; every repository has its own PR targeting `main`.

**Conflict reconciliation:** This approval supersedes the earlier unresolved policy task and the draft limits of 20 keys/user and 120 requests/minute/key. The TUI remains unmodified in this change but is not permanently out of scope; its required follow-up is explicit. Do not mark any implementation task complete because of this policy record.

## Phase 1: Decisions / Backend Foundation

- [x] 1.1 Apply the approved policy in `backend/src/modules/api-keys/` and `backend/.env.example`: format/verifier, scopes, independent tools, limits, retention, pepper, flags, runner, and TUI follow-up; do not infer alternatives.
- [x] 1.2 Write RED tests in `backend/src/modules/api-keys/*.spec.ts` for CSPRNG, verifier versions, redaction, project denial, and unchanged browser JWT.
- [x] 1.3 Create `backend/src/modules/api-keys/{entity,dto,guards,decorators,strategies,service,controller,module}` and `backend/src/migrations/*CreateMcpApiKeys.ts`; wire disabled mode without changing `backend/src/modules/auth/auth.controller.ts` JWT routes.
- [x] 1.4 Add `CombinedAuthGuard`, `RequestIdentity`, scope/project resolvers, events, Swagger; annotate MCP routes and reject org/project creation per the approved policy.

## Phase 2: Management / Integration

- [x] 2.1 Write RED tests for JWT-only ownership, superadmin access, one-time reveal, expiry/revoke, atomic replace, audit attribution, and approved limits.
- [x] 2.2 Implement `backend/src/modules/api-keys/api-keys.controller.ts` endpoints for list/create/inspect/revoke/replace; reveal secrets only on create/replace.
- [x] 2.3 Add e2e coverage for binding/scopes, safe 401/403, disabled rollback, migration, and web JWT regression.

## Phase 3: Admin

- [ ] 3.1 Write RED Vitest cases for create/reveal-once/revoke/replace, ownership, superadmin views, expiry, and redacted errors.
- [ ] 3.2 Create `admin/modules/api-keys/{types,composables}` and `admin/pages/api-keys/index.vue`; register `admin/app/module-config.ts`, preserving `admin/modules/auth/composables/useAuth.ts`.

## Phase 4: Clients / Plugin

- [ ] 4.1 Write RED tests in `taskhub-mcp/tests/integration.test.ts` and plugin tests for env bearer, legacy files, 401/403, telemetry leakage, and mappings.
- [ ] 4.2 Replace `taskhub-mcp/src/auth.ts` with env-only auth; remove `taskhub_login` from `taskhub-mcp/src/tools/auth.ts`, cached authority, refresh/JWT types, and persistence; retain metadata-only `taskhub_whoami`.
- [ ] 4.3 Update `taskhub-mcp/src/{api-client,config,types}.ts`, `src/tools/*.ts`, and `taskboard-plugin/taskboard.ts` for HTTPS, server scopes, env-only credentials, and no legacy-file access.

## Phase 5: Documentation / Rollout

- [ ] 5.1 RED-test the threat case by scanning `taskhub-mcp/README.md`, `taskhub-mcp/SECURITY.md`, `taskboard-plugin/README.md`, `.mcp.json`, and approved `opencode.json` examples for secrets/absolute paths.
- [ ] 5.2 Update examples with npm/npx, Claude `${TASKHUB_API_TOKEN}`, OpenCode `{env:TASKHUB_API_TOKEN}`, migration, redaction, replacement, unchanged JWT; pin evidence revisions.
- [ ] 5.3 Roll out schema → disabled management → Admin → MCP → plugin/docs → flag; rehearse route/client rollback while retaining keys, audits, and JWT sessions.

## Backend Evidence Reconciliation — 2026-09-16

- Tasks 2.1 and 2.2 are marked complete from the implemented backend source and focused security coverage.
- Evidence: `pnpm run build` passed; full backend unit suite passed with 45 suites / 1,290 tests; focused API-key/security suite passed with 15 suites / 175 tests; API-key HTTP E2E passed with 16 tests; notification boundary tests passed with 114 tests; organization-member controller regression passed with 2 tests; targeted lint and `git diff --check` passed.
- The project-bound API-key boundaries for global notification preferences and organization-member enumeration are enforced with typed 403 responses; JWT behavior remains unchanged.
- Task 2.3 is complete for the assigned backend integration slice. HTTP coverage now proves binding/scopes, redacted 401/403 responses, disabled-feature rollback, and web JWT refresh compatibility; migration coverage proves the compiled DataSource and additive DDL contract without claiming migration runtime execution.
- Latest focused evidence: `pnpm run test:e2e -- --runInBand test/api-keys.e2e-spec.ts test/organization-members-api-key.e2e-spec.ts` passed with 2 suites / 18 tests; `pnpm run test -- --runInBand src/modules/api-keys src/migrations/1760000000000-CreateMcpApiKeys.spec.ts` passed with 8 suites / 33 tests; `pnpm run build`, targeted Prettier, targeted ESLint, and `git diff --check` passed.
- Tasks 3–5 remain pending and were not inferred complete from backend-only work.
- Delivery decision: split the remaining scope into chained PRs using `stacked-to-main`; each work unit must stay within the 400-line review budget.
