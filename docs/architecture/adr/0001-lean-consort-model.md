# ADR-0001: Adopt Lean Consort Model

**Date:** 2026-07-08
**Status:** Accepted

## Context

The existing agent system has 36 named agents in 3 tiers (Directors, Leads,
Specialists). Due diligence identified:
- Too many agents for default use, creating routing overhead
- Overlapping domains (lead-programmer vs engine-programmer vs gameplay-programmer)
- Premature specialists for most projects (community-manager, live-ops-designer)
- High cognitive overhead before a user has a playable game

The system needs a leaner operating model while preserving the valuable domain
knowledge encoded in the existing agent definitions.

## Decision

Replace the 36-agent studio model with the **Lean Consort Model** — three tiers of
operating structure (not three tiers of agents):

1. **Tier 0 — Actors:** OpenCode (Orchestrator) + Codex (Builder) as the
   core consort. Authority and escalation defined by explicit ladder.

2. **Tier 1 — Rhythm:** 7-beat operating rhythm (Explore, Frame, Expand, Attack,
   Commit, Build, Prove) coordinated via `production/active.md`.

3. **Tier 2 — Knowledge:** Structured knowledge packs extracted from the 36
   existing agent definitions. Triggered by path-based recommendations, never
   loaded automatically.

Durable memory via three artifacts: `production/active.md`, `docs/architecture/adr/`,
`production/events.md`.

## Rationale

- Replaces agent sprawl with a clear two-actor consort plus on-demand knowledge
- Preserves domain expertise from the 36 agents via extracted knowledge packs
- Reduces default cognitive overhead — packs loaded only when needed
- The 7-beat rhythm is memorable and avoids rebuilding the old 7-phase pipeline
- Path-based recommendations preserve forced perspective without forced process
- Three-file project brain is low ceremony but sufficient for continuity

## Consequences

**Positive:**
- New projects start lean, add knowledge as needed
- Knowledge packs are composable, testable, versionable
- Clear escalation ladder prevents authority ambiguity
- Fewer files to maintain in the default agent system

**Negative:**
- Existing 36 agent files become deprecated reference material
- Knowledge packs require extraction effort from the existing agents
- Path-based recommendations need to be implemented
- Long-running projects may need additional memory artifacts later

## Rejected Alternatives

- **Keep 36-agent model:** Too much overhead for most projects.
- **HTTP/WebSocket based IPC:** Rejected for same reasons as CODEX_ENDPOINT.
- **Single agent model:** Loses too much domain perspective.
