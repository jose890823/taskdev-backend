# API-Key Authentication Specification

## Purpose

Define the server-side credential, authorization, lifecycle, and compatibility behavior for MCP API keys.

## Requirements

### Requirement: Secure project-scoped key credentials

The system MUST issue independent opaque bearer credentials whose server record identifies one owner, exactly one TaskHub project, selected scopes, creation metadata, expiration, and revocation state. Only a non-recoverable verifier and non-secret lookup metadata MAY be persisted; generation MUST use a CSPRNG. Exact entropy, verifier/hash, pepper, prefix, and lookup parameters are explicit design constraints for security design.

#### Scenario: Credential is accepted for its binding

- GIVEN an active user owns an unexpired key bound to project A with scope S
- WHEN the key is presented to an MCP endpoint in project A requiring S
- THEN the request is authenticated and authorized

#### Scenario: Cross-project use is denied

- GIVEN a valid key bound to project A
- WHEN it is presented for a project B request
- THEN the request is denied without disclosing key or membership details

### Requirement: Bearer authentication on every MCP API call

MCP API calls MUST authenticate with `Authorization: Bearer <API key>` over HTTPS. The server MUST evaluate key state, owner activity, project access, and endpoint scope on every call; it MUST NOT accept API keys in URI query parameters, passwords, or web refresh-token flows.

#### Scenario: Missing or invalid bearer

- GIVEN an MCP request has no usable bearer credential
- WHEN the request reaches a protected endpoint
- THEN the server returns a safe authentication error and performs no protected action

#### Scenario: Revocation takes effect immediately

- GIVEN a key was valid for a prior request and is then revoked
- WHEN the same key is presented again
- THEN the request is rejected and the revoked-key attempt is auditable

### Requirement: Server-enforced scopes and safe failures

Each MCP endpoint MUST map to a declared scope. A key lacking that scope MUST be rejected with a stable authorization error equivalent to `insufficient_scope`; invalid, expired, revoked, inactive-owner, or malformed credentials MUST use safe, non-secret error responses. Responses and logs MUST NOT contain plaintext keys, passwords, or recoverable secret material. Exact rate, count, retention, and scope-catalog limits remain open design decisions.

#### Scenario: Under-scoped request

- GIVEN an authenticated key lacks the scope required by an endpoint
- WHEN the client invokes that endpoint
- THEN the server denies the action and does not execute a partial mutation

### Requirement: MCP-only migration preserves web sessions

The MCP surface MUST remove `taskhub_login`, password authentication, MCP JWT refresh assumptions, and password-based configuration from its final contract. Admin/web email-password login, JWT access tokens, refresh rotation, and existing web sessions MUST remain independently supported and behaviorally compatible.

#### Scenario: Legacy MCP login is unavailable

- GIVEN an MCP client requests the removed login tool or submits MCP password credentials
- WHEN the server handles the request
- THEN it returns a safe unsupported/authentication error and does not create an MCP session

#### Scenario: Web JWT remains valid

- GIVEN a user has a valid Admin/web JWT session
- WHEN the user accesses an unchanged web endpoint
- THEN web authentication continues without requiring an API key
