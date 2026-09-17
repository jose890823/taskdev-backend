# Research: MCP API-Key Authentication

## Artifact metadata

- **Schema:** `gentle-ai.sdd-research/v1`
- **Revision:** 3
- **Change:** `mcp-api-key-auth`
- **Selection:** selected
- **Outcome:** `done`
- **Artifact store:** `hybrid` (OpenSpec + Engram)
- **Pace:** `interactive`
- **Delivery strategy:** `ask-on-risk`
- **Review budget:** 400 changed lines per PR
- **Retry lineage:** positive recovery after revision 2; prior exploration, selected intent, and source-mapped claims were retained

## Selected research request

Conduct source-backed research for these lanes:

1. Secure API-key lifecycle: generation entropy, one-time secret display, hashed-at-rest storage, prefix/lookup strategy, revocation, expiration, rotation, auditability, and compromise response.
2. Authentication contract choices: bearer API key over HTTPS versus JWT refresh/session credentials; migration compatibility and failure semantics.
3. Claude Code and OpenCode local MCP configuration: official supported environment/config patterns and portability constraints for users installing `taskhub-mcp` from npm.
4. Operational/admin UX implications: per-user key management, scopes/least privilege, limits, and recovery.

The requested evidence classes are authoritative current documentation and security standards/guidance, recorded with URLs and a description of what each source supports. Source-backed facts remain separate from product recommendations, and unresolved product decisions are not inferred.

## Evidence admission

- **Required capability:** `gentle-ai.sdd-research-capability/v1`
- **Observed declaration:**

  ```json
  {"schemaName":"gentle-ai.sdd-research-capability","schemaVersion":1,"grants":{"documentation":["Context7 official documentation"],"open-web":["webfetch official/authoritative sources"]}}
  ```

- **Admission result:** accepted for the exact declared `documentation` and `open-web` grants.
- **Evidence actually admitted:** official Claude Code and OpenCode documentation retrieved through Context7, plus the authoritative OWASP and RFC evidence pre-fetched by the orchestrator under the declared open-web grant.
- **Access date:** `2026-09-14`
- **Sensitive-data handling:** no secrets or credential-like values are included in this artifact.

## Sources

Sources S1–S9 were retrieved as official documentation through Context7; the named OWASP and RFC sources were supplied as authoritative open-web evidence by the orchestrator. No secrets or credential-like values are included.

| ID | Class | Title | Publisher | URL | Accessed | Supported excerpt |
|---|---|---|---|---|---|---|
| S1 | documentation | JSON Web Token Cheat Sheet | OWASP | https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/JSON_Web_Token_Cheat_Sheet.md | 2026-09-14 | Recommends cryptographically secure random bytes for HMAC secrets and explains that JWTs have no built-in immediate user revocation; a `jti`/`iss` denylist can provide revocation. |
| S2 | documentation | Secrets Management Cheat Sheet | OWASP | https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Secrets_Management_Cheat_Sheet.md | 2026-09-14 | States that secrets should exist only as long as necessary, be rotated, be least-privilege, be revocable, have revoked use logged, and never be logged in plaintext; lists lifecycle and administrative events that should be audited. |
| S3 | documentation | Forgot Password Cheat Sheet | OWASP | https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Forgot_Password_Cheat_Sheet.md | 2026-09-14 | Requires reset identifiers to use a CSPRNG, be long enough, be linked to an individual, be invalidated after use, and be stored securely. This is adjacent token guidance, not an API-key-specific format standard. |
| S4 | documentation | MCP integration stdio example | Anthropic Claude Code | https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/mcp-integration/examples/stdio-server.json | 2026-09-14 | Shows local server command/args and an `env` block with `${VAR}` references, including an API-key example. |
| S5 | documentation | MCP server types reference | Anthropic Claude Code | https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/mcp-integration/references/server-types.md | 2026-09-14 | Documents stdio configuration with command, args, and environment variables; the current integration skill links the official Claude Code MCP documentation and test command. |
| S6 | documentation | MCP servers documentation | OpenCode | https://github.com/anomalyco/opencode/blob/dev/packages/web/src/content/docs/mcp-servers.mdx | 2026-09-14 | Defines local MCP servers with `type: "local"`, a command array, optional `environment`, `cwd`, `enabled`, and timeout; examples use `npx` command arrays. |
| S7 | documentation | OpenCode configuration loader | OpenCode | https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/config/config.ts | 2026-09-14 | Shows global and project configuration loading plus custom config/environment-content inputs and their merge order. |
| S8 | documentation | OpenCode MCP transport | OpenCode | https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/mcp/index.ts | 2026-09-14 | Shows local MCP processes receive `process.env` plus configured `mcp.environment` overrides. |
| S9 | documentation | OpenCode MCP configuration guidance | OpenCode | https://github.com/anomalyco/opencode/blob/dev/packages/core/src/plugin/skill/customize-opencode.md | 2026-09-14 | Defines the `mcp` object and local `command`/`environment`; documents `{env:VAR}` interpolation for string values such as headers and says shell-style `${VAR}` is not substituted there. |
| OWASP-Secrets-Management-Cheat-Sheet | open-web | Secrets Management Cheat Sheet | OWASP | https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html | 2026-09-14 | Sections 2.3, 2.4, 2.6, 2.7, 2.8, 2.11, 6.3, and 6.5 cover least-privilege access, rotation automation, audit metadata/events, secret lifecycle, TLS, metadata, limitations, and usability/onboarding. |
| OWASP-Authentication-Cheat-Sheet | open-web | Authentication Cheat Sheet | OWASP | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html | 2026-09-14 | Advises that third-party applications should not store a user's username/password; passwordless or delegated protocols reduce that exposure, and secure transport and authentication monitoring are required. |
| RFC-6750-Bearer-Token-Usage | open-web | The OAuth 2.0 Authorization Framework: Bearer Token Usage | RFC Editor | https://www.rfc-editor.org/rfc/rfc6750 | 2026-09-14 | Defines bearer possession as sufficient to use a token, recommends the Authorization Bearer header over TLS, discourages URI query parameters, and covers limited lifetime, scopes, `invalid_token`, and `insufficient_scope` semantics. |

## Validated claims

The following are evidence claims only. They do not choose TaskHub's product behavior.

### Lane 1 — Secure API-key lifecycle

- Bearer secrets should be generated with a cryptographically secure random generator and sufficient length; OWASP's concrete byte examples are algorithm-specific HMAC/JWT guidance and must not be misrepresented as a universal API-key length. **[S1, S3]**
- Secret-management guidance says secrets should have a bounded lifecycle, be rotated, be least-privilege, be revocable, and have use of revoked secrets logged. **[S2]**
- Plaintext secrets must not be written to logs; masking or encryption is required when secret values are handled by logging or monitoring systems. **[S2]**
- Security audit coverage should include secret requests, usage, expiration, attempts to reuse expired secrets, authentication/authorization errors, and administrative actions. **[S2]**
- The adjacent OWASP reset-token guidance requires secure random generation, sufficient length, user association, invalidation after use, and secure storage. It supports one-time-display/one-time-use risk controls by analogy, not an API-key-specific display rule. **[S3]**
- Secret-management guidance supports controlled access using least privilege and a documented lifecycle covering creation, rotation, revocation, and expiration. **[S2, OWASP-Secrets-Management-Cheat-Sheet]**
- TLS is required for protected secret transport, and bearer credentials sent to an HTTP API should use the Authorization Bearer header rather than a URI query parameter. **[OWASP-Secrets-Management-Cheat-Sheet, RFC-6750-Bearer-Token-Usage]**

### Lane 2 — Bearer API key versus JWT refresh/session credentials

- OWASP describes JWTs as lacking built-in immediate user-initiated revocation; immediate invalidation requires a server-side denylist keyed by signed identifiers such as `jti` and `iss`, with expiry-based cleanup. **[S1]**
- OWASP notes that server-side session invalidation is a traditional alternative and advises evaluating whether JWTs are necessary when revocation complexity removes their stateless advantage. **[S1]**
- A bearer credential grants use to whoever possesses it; its lifetime should be limited and its authority constrained with scopes. RFC 6750 defines `invalid_token` and `insufficient_scope` failure semantics for invalid or under-scoped credentials. **[RFC-6750-Bearer-Token-Usage]**
- Authentication guidance says a third-party application should not store a user's username/password; passwordless or delegated protocols can reduce that exposure. **[OWASP-Authentication-Cheat-Sheet]**
- The sources support transport, possession, scope, lifetime, and failure principles, but do not prescribe TaskHub's migration window, compatibility alias, refresh-file handling, or exact response body. Those remain implementation/product decisions.

### Lane 3 — Claude Code and OpenCode local MCP configuration

- Claude Code's official examples configure a local MCP process with a command, args, and per-server `env`; `${VAR}` references are used so the secret is supplied by the user's environment rather than committed literally. **[S4, S5]**
- OpenCode's official documentation configures local MCP under an `mcp` object with `type: "local"`, a command array such as `npx -y <package>`, and an `environment` object. **[S6, S9]**
- OpenCode loads global and project configuration sources and merges them; this means a portable npm command can be represented without a machine-specific absolute repository path, while the chosen config scope still affects portability and exposure. **[S6, S7]**
- OpenCode's local MCP transport passes the process environment and configured overrides to the server process. **[S8]**
- The admitted configuration sources do not establish whether an OpenCode plugin receives an MCP server's configured environment. That integration boundary requires direct product/repository verification.
- The OpenCode guidance explicitly documents `{env:VAR}` interpolation for string values such as headers and says shell-style `${VAR}` is not substituted there. Therefore Claude's `${VAR}` syntax must not be copied blindly into OpenCode values; use the OpenCode-documented form where interpolation is supported, or inject the environment before launching OpenCode. **[S4, S9]**

### Lane 4 — Admin UX and operations

- OWASP's secrets guidance supports least privilege, revocation, rotation, plaintext-log avoidance, and audit events as operational requirements for secret management. **[S2]**
- RFC 6750 supports limiting bearer-token lifetime and authority through scopes, but it does not define TaskHub's numeric request limits, key-count limits, retention period, or scope catalog. **[RFC-6750-Bearer-Token-Usage]**
- OWASP's guidance on secret limitations and usability/onboarding supports documenting operational limitations and making secure adoption usable; it does not prescribe a per-user API-key screen, administrator ownership boundary, or recovery flow. **[OWASP-Secrets-Management-Cheat-Sheet]**
- The admitted sources do not decide whether a lost secret can be recovered. Any replacement or recovery behavior is a product decision, not a standards requirement.

## Question coverage and dispositions

Each requested question is mapped to admitted evidence where available. Details not prescribed by the sources are explicitly classified as product decisions or uncertainty, not emitted as validated claims.

| Requested question | Evidence disposition |
|---|---|
| Secure storage and lookup | Sources support controlled access, protected handling, metadata, lifecycle, and no plaintext logging. Exact hash/verifier, prefix, index, and pepper design remains a product/security decision. **[S2, OWASP-Secrets-Management-Cheat-Sheet]** |
| Entropy and generation | CSPRNG and sufficient length are supported; no universal API-key bit length is supported. **[S1, S3]** |
| One-time display | No admitted source directly mandates one-time display for personal API keys; one-time reveal is a product security recommendation, with reset-token guidance only as analogy. **[S3]** |
| Revocation, expiration, and rotation | Lifecycle guidance supports creation, rotation, revocation, expiration, bounded lifetime, and logging revoked-secret use; exact overlap/grace semantics remain a product decision. **[S2, OWASP-Secrets-Management-Cheat-Sheet, RFC-6750-Bearer-Token-Usage]** |
| Audit metadata | Sources support recording actor/action/time, usage, expiration, failures, and administrative actions; exact retention and per-request granularity remain product decisions. **[S2, OWASP-Secrets-Management-Cheat-Sheet]** |
| Scopes and least privilege | Least privilege and bearer-token scopes are source-backed; the selectable catalog, defaults, maxima, and authorization mapping are TaskHub decisions. **[S2, OWASP-Secrets-Management-Cheat-Sheet, RFC-6750-Bearer-Token-Usage]** |
| Migration semantics | Sources support avoiding third-party password storage and define bearer invalid/under-scoped failure semantics, but do not define TaskHub's compatibility window or legacy alias. **[OWASP-Authentication-Cheat-Sheet, RFC-6750-Bearer-Token-Usage]** |
| Limits | Limited token lifetime and scoped authority are supported; numeric rate, count, retention, and payload limits are unsupported and require product decisions. **[RFC-6750-Bearer-Token-Usage, OWASP-Secrets-Management-Cheat-Sheet]** |
| Recovery | Secure onboarding/usability is supported, but lost-key recovery and replacement UX are not prescribed. Treat any recovery behavior as a product decision. **[OWASP-Secrets-Management-Cheat-Sheet]** |
| Admin UX | Metadata, least privilege, lifecycle, and usability are supported concerns; ownership, screen layout, and administrator powers remain product decisions. **[OWASP-Secrets-Management-Cheat-Sheet]** |

## Non-authoritative product recommendations and decisions

These are explicitly not evidence claims. They preserve unresolved choices for orchestrator-owned product discovery:

- Prefer a dedicated opaque database-backed key record, storing no recoverable plaintext secret; choose the verifier, public identifier, and lookup strategy during security design.
- Generate with a CSPRNG, reveal the secret once, and make lost-key recovery mean replacement rather than plaintext recovery unless product discovery decides otherwise.
- Keep JWT browser sessions separate from static API-key authentication; do not send API keys through refresh-token flows.
- Define a bounded default/max lifetime, immediate revocation behavior, rotation overlap policy, audit retention, request/count limits, scope catalog, default/max scopes, ownership boundary, and compromise response.
- Treat Claude Code `${VAR}` and OpenCode `{env:VAR}` interpolation as client-specific configuration contracts, and verify the TaskBoard plugin's environment boundary before choosing shared-file or environment-only migration.
- Preserve the retained exploration's proposed opaque-key direction as a candidate only; it is not promoted to an authoritative requirement.

## Contradictions, freshness, and source limits

- **Syntax contradiction/qualification:** Claude examples use `${VAR}` in `.mcp.json` `env`; OpenCode guidance says `${VAR}` is not substituted for its documented string interpolation and uses `{env:VAR}` in supported string contexts. Treat the syntaxes as client-specific. **[S4, S9]**
- **Freshness:** sources were accessed on `2026-09-14`, but several URLs point to moving `main`/`master`/`dev` branches. Pin exact upstream revisions before implementation or release documentation.
- **Coverage limit:** authoritative sources do not settle TaskHub-specific product policy. Those details are recorded above as recommendations, decisions, or uncertainty and are not emitted as validated claims.
- **Applicability limit:** OWASP reset-token and JWT/HMAC examples are security guidance for adjacent credential classes; they do not silently become a complete API-key standard.

## Product choices

All product and migration decisions remain **pending**. In particular, this research does not decide key format, hashing parameters, prefix/index design, lifetime, rotation overlap, audit scope, compromise response, authentication compatibility, client configuration names, plugin portability, scope defaults, limits, administrator powers, or recovery behavior.

The retained exploration's opaque database-backed-key recommendation remains a non-authoritative product direction pending proposal decisions; it is not promoted to an evidence claim here.

## Proposal readiness and recovery

- **Proposal readiness:** `false`
- **Research gate:** complete; the selected evidence outcome is `done` and every requested lane has a source-backed map or an explicit non-authoritative disposition.
- **Product gate:** not ready because product decisions remain `pending`.
- **Next handoff:** the orchestrator may run product discovery for the listed decisions; proposal remains prohibited until the preproposal records confirmed decisions and valid hybrid readback.
- **Retained intent:** the complete selected request and all four research lanes from `openspec/changes/mcp-api-key-auth/exploration.md` remain preserved.
