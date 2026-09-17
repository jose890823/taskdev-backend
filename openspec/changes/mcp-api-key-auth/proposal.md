# Proposal: MCP API-Key Authentication

## Intent

Replace password-based authentication on the MCP surface with independently revocable, project-scoped API keys while preserving email/password login and JWT sessions for the Admin/web platform. This removes password handling from MCP configuration and provides least-privilege, auditable credentials for separate projects and installations.

## Scope

### In Scope
- Backend API-key lifecycle, bearer authentication, project/scope authorization, expiration, immediate revocation, rotation/replacement, audit metadata, and production migration.
- Admin self-service key management plus superadmin management of any user's keys, including named keys, 30/90/180/365-day presets, and one-time secret reveal.
- Coordinated `taskhub-mcp`, `taskboard-plugin`, documentation, npm packaging, Claude Code, OpenCode, and environment/configuration migration contracts.

### Out of Scope
- Changing Admin/web JWT authentication, introducing OAuth/device flow, or recovering plaintext secrets.
- A compatibility window for `taskhub_login` in the final MCP contract; exact legacy JWT-file and TaskBoard credential migration behavior remains deferred where unspecified.
- Exact hash/pepper parameters, numeric rate/count limits, audit retention/granularity, and final scope catalog/default/max policy.

## Capabilities

### New Capabilities
- `api-key-authentication`: Opaque project-scoped bearer keys, secure lifecycle, and server-enforced scope authorization.
- `api-key-management`: User and superadmin key administration with one-time reveal and replacement semantics.
- `mcp-api-key-client`: Static-key MCP authentication, failure handling, credential-file migration, and plugin boundary behavior.
- `mcp-client-configuration`: Portable Claude Code/OpenCode examples using the existing `TASKHUB_API_TOKEN` contract without passwords or committed secrets.

### Modified Capabilities
- None; no existing source specs are present.

## Approach

Use a dedicated backend key record with opaque CSPRNG secret, public prefix/identifier lookup, hash-only persistence, owner/project/scope metadata, expiry, revocation, last-use, and audit actor/reason. Authenticate with HTTPS `Authorization: Bearer`; enforce key state, owner activity, project membership, and endpoint scopes on every request. Keep web JWT and refresh flows separate. Remove MCP password login and refresh assumptions, preserve `TASKHUB_API_TOKEN` as the client contract, and provide explicit migration guidance for existing JWT files. Update Admin, MCP, plugin, README/docs, and packed-artifact tests together; keep each delivery slice within the 400-line review budget.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/` | Modified/New | Auth boundary, API-key module/entity/migration, scope enforcement, audit/security events, tests. |
| `admin/` | New/Modified | Key management UI, one-time reveal/copy, lifecycle and scope controls. |
| `taskhub-mcp/` | Modified | API-key-only MCP tools/client, static bearer handling, migration and release docs. |
| `taskboard-plugin/` | Modified | Shared credential contract and explicit environment/file boundary. |
| `README`/config examples | Modified | npm, Claude Code, OpenCode, HTTPS, redaction, and non-secret setup guidance. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Secret leakage or overbroad scope | High | One-time reveal, redaction, hash-only storage, least privilege, server-side checks, and tests. |
| Partial client/plugin migration | High | Coordinated contract, packed-package smoke tests, explicit boundaries, and staged rollout. |
| Revocation delayed by caching or schema rollout | Med | Authoritative checks, immediate invalidation, migration-before-enable, and rollback rehearsal. |

## Rollback Plan

Disable API-key authentication and revert MCP/client releases while retaining the additive key table and web JWT sessions. Revert Admin/docs/config changes independently; do not delete users, existing web sessions, or key audit records without a separate migration decision.

## Dependencies

- Coordinated releases of the independent backend, Admin, MCP, and plugin repositories; production database migration before activation.

## Success Criteria

- [ ] MCP authenticates only with valid, unexpired, unrevoked project-scoped API keys; `taskhub_login` and password configuration are absent from the final contract.
- [ ] Admin users can create, inspect metadata, revoke, and replace named keys; plaintext is returned exactly once and never recoverable.
- [ ] Claude Code and OpenCode examples use `TASKHUB_API_TOKEN` safely, and plugin behavior is documented and verified without secret leakage.
