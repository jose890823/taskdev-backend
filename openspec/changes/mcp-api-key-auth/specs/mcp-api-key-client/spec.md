# MCP API-Key Client Specification

## Purpose

Define the `taskhub-mcp` and TaskBoard plugin client contract for loading, sending, rejecting, and migrating MCP credentials.

## Requirements

### Requirement: Static API-token client contract

The MCP client MUST use `TASKHUB_API_TOKEN` as its credential contract and send that value as an HTTPS bearer header for every protected MCP API call. It MUST NOT prompt for, store, or transmit a TaskHub email/password, refresh token, or MCP JWT. A missing token MUST fail before a protected action is attempted.

#### Scenario: Environment token authenticates a call

- GIVEN `TASKHUB_API_TOKEN` contains an active key for the requested project
- WHEN the MCP client invokes a protected tool
- THEN it sends the bearer credential and returns the server result

#### Scenario: Missing token fails safely

- GIVEN `TASKHUB_API_TOKEN` is absent or empty
- WHEN the client starts or invokes a protected tool
- THEN it reports setup guidance without attempting password login or exposing a secret

### Requirement: Uniform MCP authentication failure handling

The client MUST distinguish setup/authentication failures from authorization failures and server errors sufficiently to guide remediation, while preserving server-safe responses. It MUST NOT print, include in tool output, or send to telemetry the token, password, authorization header, or secret-bearing configuration.

#### Scenario: Expired or revoked token

- GIVEN the server rejects the bearer as expired or revoked
- WHEN the client receives the response
- THEN it advises revocation/replacement and does not retry with password login or a stale token

#### Scenario: Missing scope

- GIVEN the server rejects a call because the key lacks the required scope
- WHEN the client receives the authorization failure
- THEN it reports that the key needs an appropriate scope without suggesting credential disclosure

### Requirement: Explicit plugin credential boundary

The TaskBoard plugin MUST use `TASKHUB_API_TOKEN` only when explicitly configured by the host environment or documented configuration boundary. It MUST NOT read an MCP server’s private credential store, copy a token from another project, or infer credentials from web JWT files. If the boundary is unavailable, the plugin MUST report configuration guidance rather than silently falling back.

#### Scenario: Plugin has explicit shared environment

- GIVEN the host explicitly supplies `TASKHUB_API_TOKEN` to the plugin process
- WHEN the plugin performs a supported TaskHub operation
- THEN it uses that token under the same project and scope rules as MCP

### Requirement: Legacy credential migration and recovery

The client distribution MUST document that existing password-based credentials and legacy JWT files are not API keys and MUST NOT be silently exchanged or treated as valid tokens. Migration MUST direct users to create a project-bound key, configure `TASKHUB_API_TOKEN`, validate access, and remove or quarantine obsolete credential material according to the final operational design. Lost or compromised keys MUST be recovered by revoke-and-replace, never plaintext recovery.

#### Scenario: Legacy file is encountered

- GIVEN a legacy credential file contains a JWT or password-login data
- WHEN the client loads credentials
- THEN it refuses that material for MCP authentication and provides migration guidance without logging its contents
