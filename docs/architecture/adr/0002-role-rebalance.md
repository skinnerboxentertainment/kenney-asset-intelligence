# ADR-0002: Role Rebalance — OpenCode Builds, Codex Sharpens

**Date:** 2026-07-08
**Status:** Accepted

## Context

The original Lean Consort Model assigned Codex as the primary builder
and OpenCode as orchestrator. In practice:
- OpenCode (DeepSeek V4 Pro) has more quota and is stronger at coding
- Codex (OpenAI gpt-5.5) has limited quota and is better leveraged for
  research, critique, visual inspection, and art generation

Spending Codex tokens on routine implementation was inefficient.

## Decision

Rebalance roles:

| Role | Agent | Primary Domain |
|------|-------|---------------|
| **Orchestrator-Builder** | OpenCode | Architecture, implementation, coding, integration, repo governance |
| **Specialist Critic** | Codex | Research, design critique, visual QA/inspection, art generation, browser verification |

Authority:
- OpenCode decides architecture, implementation, integration, repo governance
- Codex advises on design quality, technical risks, visual correctness
- User decides product goals, taste, scope, final tradeoffs

## Rationale

- Matches actual quota and capability distribution
- OpenCode builds faster with more token budget
- Codex provides high-leverage critique and verification
- Separate builder and reviewer improves quality

## Consequences

- OpenCode owns all implementation work
- Codex focuses on research, critique, visual QA, and art
- Build beat shifts: OpenCode builds, Codex proves
- Existing docs updated to reflect new roles

## Rejected Alternatives

- Keep Codex as primary builder — wastes tokens on routine coding
- Single agent — loses the separate-reviewer advantage
