# API-Key Management Specification

## Purpose

Define user and superadmin administration of named, project-bound MCP API keys, including disclosure, expiry, revocation, replacement, and audit behavior.

## Requirements

### Requirement: User-owned and superadmin key administration

Users MUST be able to create and inspect multiple independent named keys, and MUST NOT manage keys owned by another user. A superadmin MUST be able to manage keys for any user. Creation MUST require a name, exactly one project, selected scopes, and one expiration preset: 30, 90, 180, or 365 days.

#### Scenario: User creates a least-privilege key

- GIVEN an authenticated user can access project A
- WHEN the user creates a named key for project A with selected scopes and a 90-day preset
- THEN one active key is created with those bindings and its secret is eligible for one-time reveal

#### Scenario: User cannot administer another owner’s key

- GIVEN user U is not a superadmin and key K belongs to user V
- WHEN U attempts to inspect, revoke, or replace K
- THEN the operation is denied and K’s metadata and secret remain undisclosed

### Requirement: One-time secret reveal and non-secret metadata

The full secret MUST be returned exactly once during successful creation or replacement and MUST NOT be recoverable afterward. Management views MUST expose safe metadata such as key name, public identifier/prefix, owner, project, scopes, created time, expiry, status, last-use time, and revocation details when available; they MUST never expose the secret, password, verifier, or token-bearing configuration.

#### Scenario: Secret is revealed once

- GIVEN a newly created key has not yet been revealed
- WHEN the creator reads the successful creation result
- THEN the full secret is shown once and subsequent reads return metadata only

#### Scenario: Lost secret recovery

- GIVEN a user no longer has the full secret
- WHEN the user requests recovery
- THEN the system does not recover it, and directs the user to revoke and create a replacement

### Requirement: Revocation, expiry, and replacement lifecycle

Users MUST be able to revoke their own active keys, and superadmins MUST be able to revoke any user’s key. Expired keys MUST fail authentication without manual action. Replacement MUST create a new independently bound key and revoke the selected compromised or retired key as part of the documented recovery flow; any separate rotation overlap or grace policy is an explicit design decision, not an implicit requirement.

#### Scenario: Replacement invalidates a compromised key

- GIVEN an owner selects active key K for replacement
- WHEN replacement succeeds
- THEN K is revoked, a new key with requested metadata is created, and only the new secret is revealed once

#### Scenario: Expiration is enforced while metadata remains available

- GIVEN a key has passed its selected expiry date
- WHEN it is used for MCP or inspected through authorized management
- THEN MCP authentication fails while management shows its expired metadata and status

### Requirement: Auditable management actions

Creation, one-time reveal, inspection, revocation, replacement, expiry, denied management attempts, and attempts to use revoked or expired keys MUST produce audit events containing actor, affected owner/key identifier, action, timestamp, outcome, and safe reason metadata. Audit retention and request-level granularity remain explicit design decisions.

#### Scenario: Superadmin action is attributable

- GIVEN a superadmin revokes another user’s key
- WHEN the operation completes
- THEN the audit event identifies the superadmin actor, target key, outcome, and reason without recording the secret
