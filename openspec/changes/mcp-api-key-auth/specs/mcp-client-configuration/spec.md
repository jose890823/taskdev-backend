# MCP Client Configuration Specification

## Purpose

Define portable npm, Claude Code, OpenCode, and migration documentation for API-key-only MCP installation without committed secrets.

## Requirements

### Requirement: Portable npm installation examples

Documentation MUST provide a portable way to run the published `taskhub-mcp` package using npm installation, including a global executable path and an `npx`-compatible invocation where supported. Examples MUST use the existing `TASKHUB_API_TOKEN` contract and an HTTPS API endpoint, never a machine-specific repository path or literal secret.

#### Scenario: Published package is configured portably

- GIVEN a user installs `taskhub-mcp` from npm
- WHEN the user follows the documented command in a different project directory
- THEN the MCP process starts without requiring this repository’s absolute path

### Requirement: Claude Code configuration contract

Documentation MUST include a `.mcp.json` local-server example with command, arguments, and an environment reference for `TASKHUB_API_TOKEN`. Claude-specific `${TASKHUB_API_TOKEN}` interpolation MUST be kept in the Claude example and MUST NOT be presented as an OpenCode syntax.

#### Scenario: Claude receives an environment token

- GIVEN the user exports `TASKHUB_API_TOKEN` outside the committed configuration
- WHEN Claude Code starts the configured local MCP server
- THEN the server receives the token through the documented environment mapping

### Requirement: OpenCode configuration contract

Documentation MUST include an `opencode.json` local MCP example using the documented local command array and environment configuration. Where OpenCode interpolation is used, examples MUST use its `{env:TASKHUB_API_TOKEN}` form; otherwise they MUST instruct users to inject the environment before launching OpenCode. `${TASKHUB_API_TOKEN}` MUST NOT be copied into OpenCode interpolation fields.

#### Scenario: OpenCode uses supported interpolation

- GIVEN `TASKHUB_API_TOKEN` is present in the OpenCode launch environment
- WHEN OpenCode starts the local MCP process from the documented configuration
- THEN the process receives the configured token and no literal secret is committed

### Requirement: Safe setup, rotation, and migration documentation

The documentation MUST explain HTTPS bearer transport, one-time secret reveal, metadata-only later inspection, revoke-and-replace recovery, expiration presets, scope selection, safe redaction, and the removal of `taskhub_login`. It MUST state that Admin/web email-password and JWT sessions remain unchanged and are configured independently.

#### Scenario: User migrates from password MCP login

- GIVEN a user has an existing password or JWT-based MCP setup
- WHEN the user follows the migration guide
- THEN they create and bind a key, configure `TASKHUB_API_TOKEN`, remove obsolete MCP login configuration, and retain unrelated web JWT configuration

#### Scenario: Secret safety is verified in documentation examples

- GIVEN documentation examples are reviewed or packaged
- WHEN configuration and installation examples are scanned
- THEN no plaintext token, password, authorization header, or recoverable secret is present
