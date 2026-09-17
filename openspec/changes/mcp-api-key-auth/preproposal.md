# Pre-proposal State: MCP API-Key Authentication

## Artifact metadata

- **Schema:** `gentle-ai.sdd-preproposal/v1`
- **Revision:** 4
- **Change:** `mcp-api-key-auth`
- **Artifact store:** `hybrid` (OpenSpec + Engram)

## Research handoff

- **Exploration reference:** `openspec/changes/mcp-api-key-auth/exploration.md`
- **Research reference:** `openspec/changes/mcp-api-key-auth/research.md` | `sdd/mcp-api-key-auth/research`
- **Research request:** the four selected source-backed research lanes retained in the research artifact
- **Requested evidence classes:** `documentation`, `open-web`
- **Capability declaration observed:** `gentle-ai.sdd-research-capability/v1` with `documentation: ["Context7 official documentation"]` and `open-web: ["webfetch official/authoritative sources"]`
- **Admission:** accepted for the exact declared grants
- **Outcome:** `done`; authoritative claims are mapped and unsupported product details are explicitly labeled as recommendations, decisions, or uncertainty

## Gate state

- **Product decisions:** `pending`
- **Proposal ready:** `false`
- **Reason:** research is complete, but proposal admission still requires orchestrator-owned product discovery and confirmed decisions.
- **Next action:** resolve key format/storage, lifetime, rotation, audit granularity, scope/limit policy, migration compatibility, plugin credential source, ownership/admin powers, and recovery behavior; then re-evaluate proposal readiness.

## Recovery note

The selected intent and prior exploration were retained losslessly. Research revision 3 adds the supplied authoritative OWASP and RFC evidence while retaining the prior Context7 Claude Code and OpenCode evidence. No unsupported authority was invented, and no proposal, specification, design, task plan, or implementation was created.
