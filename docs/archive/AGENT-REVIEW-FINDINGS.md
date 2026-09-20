# Agent File Review — Comprehensive Quality Audit

**Date**: 2026-06-25
**Reviewer**: Automated quality audit
**Scope**: All 36 agent definition files in `.opencode/agents/`

---

## Summary

- **Total agents reviewed**: 36 (AGENTS.md claims 35 — `audio-specialist.md` is undocumented)
- **Critical issues (broken/inoperable)**: 6
- **High priority (poor output quality)**: 8
- **Medium priority (inconsistencies, missing sections)**: 12
- **Low priority (style, minor language)**: 5

---

## Critical Findings

### 1. `qa-tester.md` — Wrong engine test patterns (Lines 77–135)
The agent contains GDScript/GdUnit4 (Godot), C#/NUnit (Unity), and C++ (Unreal) automated test scaffolding examples. This project uses **TypeScript + Vitest**. A QA Tester invoked to write test stubs would generate completely wrong, inoperable test code.

**Fix**: Replace lines 70-143 with TypeScript/Vitest test patterns matching `test-standards.md`.

### 2. Five agents reference non-existent `docs/engine-reference/` path
These agents all have "Engine Version Safety" blocks pointing to `docs/engine-reference/[engine]/VERSION.md`, which **does not exist**:
- `gameplay-programmer.md` (line 89)
- `engine-programmer.md` (line 86)
- `ui-programmer.md` (line 87)
- `technical-artist.md` (line 88)
- `tools-programmer.md` (line 84)

The actual PixiJS reference doc location is `.opencode/docs/pixijs-reference/VERSION.md` — but even that directory is empty (no files found).

**Fix**: Either create the reference files or remove/replace the "Engine Version Safety" blocks with correct paths.

### 3. `lead-programmer.md` — References non-existent TypeScript reference files (Lines 22–24)
References three files that do not exist:
- `.opencode/docs/ts-reference/VERSION.md`
- `.opencode/docs/ts-reference/patterns.md`
- `.opencode/docs/ts-reference/module-architecture.md`

The entire `.opencode/docs/ts-reference/` directory is missing.

**Fix**: Create these reference files or remove the references.

### 4. `lead-programmer.md` — References non-existent MCP tools (Lines 29–34)
References `ts-compiler-mcp` tools (`findSymbol`, `findReferences`, `checkAnyUsage`, `traceImports`, `checkBoundaryViolation`) that are Claude Code MCP server tools not available in OpenCode.

### 5. `prototyper.md` — References four non-existent files (Lines 123, 179, 181)
- `.opencode/docs/technical-preferences.md` (line 123) — does not exist
- `.opencode/docs/templates/prototype-report.md` (line 179) — does not exist
- `.opencode/docs/templates/vertical-slice-report.md` (line 181) — does not exist
- `docs/architecture/control-manifest.md` (line 122) — does not exist (only `tr-registry.yaml` exists in that directory)

### 6. `community-manager.md` — References non-existent template (Line 104)
References `.opencode/docs/templates/incident-response.md` which does not exist.

---

## High Priority Findings

### 7. Custom agents (`pixijs-specialist.md`, `audio-specialist.md`) missing critical sections
Both custom agents lack the structural sections present in all 34 inherited agents:
- **No "Collaboration Protocol" section** — Neither agent explains how it should interact with the user (ask questions, present options, get approval, etc.)
- **No "What This Agent Must NOT Do" section** — `pixijs-specialist.md` has none; `audio-specialist.md` has "Banned Patterns" which is conceptually similar but differently structured
- **No "Delegation Map" section** — Neither agent specifies reporting structure, escalation targets, or coordinating agents
- **No "Key Responsibilities" section** — `pixijs-specialist.md` has no enumerated responsibilities; `audio-specialist.md` implies them through tool knowledge
- **`audio-specialist.md`** uses `#` headings instead of `###` (inherited agents use `###`)
- **Much shorter** than inherited agents (45 and 89 lines vs 100-367 lines for inherited)

### 8. 14 agents have incomplete or missing Delegation Maps
The following agents lack the full `## Delegation Map` section (Delegates to / Reports to / Coordinates with / Escalation target for):

| Agent | Has What |
|-------|---------|
| `engine-programmer.md` | Only "Reports to" + "Coordinates with" (no "Delegates to") |
| `ai-programmer.md` | Only "Reports to" + "Implements specs from" |
| `pixijs-specialist.md` | **Nothing** |
| `audio-specialist.md` | **Nothing** |
| `network-programmer.md` | Only "Reports to" + "Coordinates with" |
| `ui-programmer.md` | Only "Reports to" + "Implements specs from" |
| `accessibility-specialist.md` | "Coordination" section (different format) |
| `analytics-engineer.md` | Only "Reports to" + "Coordinates with" |
| `community-manager.md` | "Coordination" section (different format) |
| `devops-engineer.md` | Only "Reports to" + "Coordinates with" |
| `economy-designer.md` | Only "Reports to" + "Coordinates with" |
| `level-designer.md` | Only "Reports to" + "Coordinates with" |
| `performance-analyst.md` | Only "Reports to" + "Coordinates with" |
| `qa-tester.md` | Only "Reports to" |
| `security-engineer.md` | "Coordination" section (different format) |
| `sound-designer.md` | Only "Reports to" |
| `technical-artist.md` | Only "Reports to" + "Coordinates with" |
| `tools-programmer.md` | Only "Reports to" + "Coordinates with" |
| `ux-designer.md` | Only "Reports to" + "Coordinates with" |
| `world-builder.md` | Only "Reports to" + "Coordinates with" |
| `writer.md` | Only "Reports to" + "Coordinates with" |

### 9. 5 agents missing "What This Agent Must NOT Do" section
- `pixijs-specialist.md` — entirely absent
- `accessibility-specialist.md` — entirely absent
- `community-manager.md` — entirely absent
- `live-ops-designer.md` — absent (has escalation paths but no must-NOT-do list)
- `security-engineer.md` — entirely absent

### 10. Three agents have non-standard `task: allow` permission
- `community-manager.md` — has `task: allow` (no other agent has this)
- `live-ops-designer.md` — has `task: allow` (non-standard)
- `security-engineer.md` — has `task: allow` (non-standard)

`task` is not a standard OpenCode permission. This appears to be a Claude Code artifact (Claude Code has a `task` tool). These should be removed.

### 11. Mismatched collaboration protocol causing role confusion
Several agents use the "collaborative implementer" protocol (with architecture questions like "Should this be a static utility class or a scene node?") when they are **design/consulting roles that never write code**:
- `accessibility-specialist.md` (lines 20-66) — says "Before writing any code" but this agent audits, it doesn't implement
- `community-manager.md` (lines 19-67) — says "Before writing any code" but writes player-facing docs, not code
- `release-manager.md` (lines 19-67) — says "Before writing any code" but manages releases, doesn't code
- `sound-designer.md` (lines 19-67) — says "Before writing any code" but writes spec docs, not code
- `localization-lead.md` (lines 19-67) — says "Before writing any code" but designs i18n architecture

These agents have copy-pasted the programmer implementation workflow verbatim.

### 12. `qa-tester.md` line 17 mentions outdated engine test patterns
The role description says "when a story needs a GDScript/C#/C++ test file, you can scaffold it." This should be TypeScript/Vitest.

### 13. `writer.md` has numbering gap in implementation workflow
Line 53 jumps from step 3 directly to step 6 (missing steps 4 "Propose architecture before implementing" and 5 "Get approval before writing files").

### 14. `live-ops-designer.md` and `ux-designer.md` use simplified collaboration protocol
Their step 3 is "Draft based on user's choice" without the full incremental file-writing protocol (create skeleton, draft section-by-section, write to file after each section). This differs from the pattern used by game-designer, art-director, narrative-director, economy-designer, level-designer, world-builder.

---

## Medium Priority Findings

### 15. Inconsistent description quoting in YAML frontmatter
**Quoted** (16 agents): producer, art-director, audio-director, release-manager, engine-programmer, ai-programmer, pixijs-specialist, audio-specialist, network-programmer, ui-programmer, community-manager, live-ops-designer, prototyper, technical-artist, tools-programmer, world-builder

**Unquoted** (20 agents): creative-director, technical-director, game-designer, lead-programmer, narrative-director, qa-lead, localization-lead, gameplay-programmer, accessibility-specialist, analytics-engineer, devops-engineer, economy-designer, level-designer, performance-analyst, qa-tester, security-engineer, sound-designer, systems-designer, ux-designer, writer

Both are valid YAML, but inconsistency makes batch processing harder. Agents with colons or special characters in descriptions should be quoted.

### 16. Inconsistent section naming
- "Key Responsibilities" — used by 30 agents
- "Core Responsibilities" — used by 4 agents (accessibility-specialist, community-manager, live-ops-designer, security-engineer)
- No responsibilities section — pixijs-specialist

### 17. Inconsistent "Reports to:" format
- Formal "Delegation Map" section: creative-director, technical-director, producer, game-designer, lead-programmer, art-director, audio-director, narrative-director, qa-lead, release-manager, localization-lead, gameplay-programmer, prototyper, systems-designer
- Bare "Reports to:" at bottom: engine-programmer, ai-programmer, network-programmer, ui-programmer, analytics-engineer, devops-engineer, economy-designer, level-designer, performance-analyst, qa-tester, sound-designer, technical-artist, tools-programmer, ux-designer, world-builder, writer
- "Coordination" section: accessibility-specialist, community-manager, security-engineer
- Nothing: pixijs-specialist, audio-specialist

### 18. Inconsistent `webfetch` permission
Agents with research/design roles that benefit from web research **do not** have `webfetch: allow`:
- accessibility-specialist, community-manager, devops-engineer, level-designer, live-ops-designer, performance-analyst, prototyper, qa-lead, qa-tester, release-manager, security-engineer, sound-designer, systems-designer, technical-artist, tools-programmer, world-builder, writer

Only 9 of 36 agents have `webfetch: allow`.

### 19. Filler sample content in `gameplay-programmer.md` Delegation Map
Lines 58-59: `"This is ready for /code-review if you'd like validation"` and similar `/command` references. The `/code-review` and `/architecture-decision` commands may or may not exist in OpenCode. Same in 14 other agents that use the "collaborative implementer" template.

### 20. `producer.md` and `systems-designer.md` contain bracketed placeholder text
- `producer.md` line 89: "[Date Range]"
- `systems-designer.md` lines 121, 163: "[output]", "[recovery]", "[progression resource]"

These appear to be intentional template placeholders rather than bugs but are inconsistent with other agents that use concrete terms.

### 21. `prototyper.md` steps: 25 — between lead (20) and director (30)
This may be intentional given the iterative nature of prototyping, but it's the only non-tier-standard step count.

### 22. `live-ops-designer.md` uses `task: allow` and `bash: deny`
Has the non-standard `task` permission. Should be removed or replaced with standard OpenCode permissions.

### 23. `accessibility-specialist.md`, `community-manager.md`, `security-engineer.md` use "Escalation Paths" / "Coordination" instead of "Delegation Map"
These sections serve the same purpose but use different heading names and structures, making cross-agent reference harder.

### 24. Model assignment: `prototyper.md` uses `opencode-go/deepseek-v4-flash`
Prototyper is listed in the specialist tier but has `steps: 25` (higher than leads at 20). Model assignment is correct per AGENTS.md but the step count is anomalous.

### 25. `economy-designer.md` and `systems-designer.md` have "Registry Awareness" sections
These sections reference `design/registry/entities.yaml` (which exists). No other agents have this section, but they probably should — e.g., `game-designer.md` would also benefit from registry awareness.

### 26. Heading hierarchy inconsistencies
- Most inherited agents use `###` for subsections
- `pixijs-specialist.md` uses `##` for subsections (lines 18, 30, 37)
- `audio-specialist.md` uses `##` for subsections (lines 20, 29, 36, 43, 52, 59, 66, 76, 83)
- `accessibility-specialist.md` uses `##` for "Core Responsibilities" (link 66) but `###` for "Accessibility Standards" sub-sections
- `community-manager.md` uses `##` for "Core Responsibilities" and "Crisis Communication" etc.
- `live-ops-designer.md` uses `##` for "Core Responsibilities"
- `prototyper.md` uses `---` horizontal rule separators (unique style)
- `security-engineer.md` uses `##` for "Core Responsibilities"

---

## Low Priority / Observations

### 27. `creative-director.md` has a massive example dialogue (Lines 59-149, ~90 lines)
The example interaction pattern between User and Creative Director is 90 lines. While highly illustrative, it consumes significant context budget on every invocation.

### 28. Minor markdown inconsistency in em dash usage
- `--` (double hyphen) used in most agents: game-designer, art-director, audio-director, narrative-director, gameplay-programmer, etc.
- `—` (em dash) used in: community-manager, live-ops-designer, accessibility-specialist
Both render the same, but mixed conventions.

### 29. `audio-specialist.md` references tools/scripts that may not exist
Lines 47-50 reference `tools/audio-pipeline/normalize.js`, `tools/audio-pipeline/convert.js`, `tools/audio-pipeline/sprite.js`, `tools/audio-pipeline/sfxr.js` — these may not exist yet.

### 30. `audio-specialist.md` references slash commands that may not exist
Lines 78-81 reference `/generate-sfx`, `/mix-check`, `/build-audio-sprites`, `/normalize-audio` — these commands are not in the AGENTS.md command list of 73 commands.

### 31. `community-manager.md` has a `bash: deny` but needs `bash` for its workflow?
This agent writes patch notes and community updates but has `bash: deny`. This seems correct (it's a writing role), but it also has `task: allow` which is non-standard.

---

## Per-Agent Directory

| Agent | Frontmatter OK | Stale Refs | Structure | Quality | Notes |
|-------|---------------|------------|-----------|---------|-------|
| creative-director | Yes | None | Complete | Excellent | Very long (367 lines); massive example dialogue |
| technical-director | Yes | None | Complete | Excellent | Clean, well-structured |
| producer | Yes (quoted desc) | None | Complete | Good | Bracketed placeholder [Date Range] |
| game-designer | Yes | None | Complete | Excellent | Strong theoretical framework |
| lead-programmer | Yes | `ts-reference/` files, MCP tools | Complete | Good | References 3 non-existent files + MCP tools |
| art-director | Yes (quoted desc) | None | Complete | Good | Has Gate Verdict Format |
| audio-director | Yes (quoted desc) | None | Complete | Good | Has audio naming convention |
| narrative-director | Yes | None | Complete | Good | Has world-building standards |
| qa-lead | Yes | None | Complete | Good | Has story-type test evidence matrix |
| release-manager | Yes (quoted desc) | None | Complete | Good | Detailed release pipeline |
| localization-lead | Yes | None | Complete | Good | Comprehensive i18n standards |
| gameplay-programmer | Yes | `docs/engine-reference/` | Complete | Good | Engine Version Safety refs wrong path |
| engine-programmer | Yes (quoted desc) | `docs/engine-reference/` | Partial | Adequate | Missing Delegates-to section |
| ai-programmer | Yes (quoted desc) | None | Partial | Adequate | Minimal delegation info |
| **pixijs-specialist** | **Yes (quoted desc)** | **None** | **Incomplete** | **Below standard** | **Missing: Collab Protocol, Key Resp, Must-NOT-Do, Delegation Map** |
| **audio-specialist** | **Yes (quoted desc)** | **None** | **Incomplete** | **Below standard** | **Missing: Collab Protocol, Key Resp, Must-NOT-Do, Delegation Map** |
| network-programmer | Yes (quoted desc) | None | Partial | Adequate | Minimal delegation info |
| ui-programmer | Yes (quoted desc) | `docs/engine-reference/` | Partial | Adequate | Engine Version Safety refs wrong path |
| accessibility-specialist | Yes | None | Non-standard | Good | Non-standard headings; wrong collab protocol |
| analytics-engineer | Yes | None | Partial | Good | Missing full delegation map |
| community-manager | Yes (quoted desc) | `incident-response.md` template | Non-standard | Adequate | `task: allow`; missing must-NOT-do; wrong collab protocol |
| devops-engineer | Yes | None | Partial | Good | Minimal delegation info |
| economy-designer | Yes | None | Complete | Good | Has Registry Awareness section |
| level-designer | Yes | None | Partial | Good | Minimal delegation info |
| live-ops-designer | Yes (quoted desc) | None | Non-standard | Good | `task: allow`; missing must-NOT-do; simplified collab protocol |
| performance-analyst | Yes | None | Partial | Good | Minimal delegation info |
| prototyper | Yes (quoted desc) | 4 non-existent files | Complete | Good | Unique structure; steps=25; unique `---` separators |
| **qa-tester** | **Yes** | **Godot/Unity/Unreal examples** | **Complete** | **Poor** | **CRITICAL: wrong engine test patterns (lines 77-135)** |
| security-engineer | Yes | None | Non-standard | Adequate | `task: allow`; missing must-NOT-do; non-standard headings |
| sound-designer | Yes | None | Partial | Adequate | Wrong collab protocol; minimal delegation |
| systems-designer | Yes | None | Complete | Good | Has Escalation Paths; formula standards |
| technical-artist | Yes (quoted desc) | `docs/engine-reference/` | Partial | Good | Engine Version Safety refs wrong path |
| tools-programmer | Yes (quoted desc) | `docs/engine-reference/` | Partial | Good | Engine Version Safety refs wrong path |
| ux-designer | Yes | None | Partial | Good | Simplified collab protocol; missing full delegation |
| world-builder | Yes (quoted desc) | None | Partial | Good | Minimal delegation info |
| writer | Yes | None | Partial | Adequate | Step numbering gap (3→6); wrong collab protocol |

---

## Recommendations

### Top 5 Things to Fix First

1. **`qa-tester.md` engine examples** — Replace lines 70-143 with TypeScript/Vitest patterns matching `test-standards.md`. This is the only agent that would produce actively wrong output.

2. **`docs/engine-reference/` path** — Either create the PixiJS reference docs at that path (matching what 5 agents expect) OR update all 5 agents to remove/replace "Engine Version Safety" blocks. The actual PixiJS reference should live at `.opencode/docs/pixijs-reference/`.

3. **`lead-programmer.md` TypeScript references** — Create `.opencode/docs/ts-reference/` with VERSION.md, patterns.md, and module-architecture.md, OR remove those references from the agent. Also remove the MCP tool references (lines 29-34).

4. **`prototyper.md` template references** — Create `.opencode/docs/technical-preferences.md`, `.opencode/docs/templates/prototype-report.md`, and `.opencode/docs/templates/vertical-slice-report.md`, OR update prototyper to not reference non-existent files.

5. **Custom agents upgrade** — Add Collaboration Protocol, Key Responsibilities, What This Agent Must NOT Do, and Delegation Map sections to `pixijs-specialist.md` and `audio-specialist.md` to match the inherited agent pattern.

### Quick Wins (Batch Changes)

- Remove `task: allow` from `community-manager.md`, `live-ops-designer.md`, `security-engineer.md` (it's a Claude Code artifact)
- Rename "Core Responsibilities" → "Key Responsibilities" in `accessibility-specialist.md`, `community-manager.md`, `live-ops-designer.md`, `security-engineer.md`
- Fix `writer.md` step numbering (3 → 4 → 5 → 6)
- Replace "collaborative implementer" protocol with "collaborative consultant" protocol in agents that don't write code: `accessibility-specialist.md`, `community-manager.md`, `release-manager.md`, `sound-designer.md`, `localization-lead.md`
- Create `.opencode/docs/templates/incident-response.md` or remove reference from `community-manager.md`

### Items Requiring Manual Rewrite

- **Full Delegation Maps** for 14 agents — requires understanding each agent's role in the hierarchy
- **Gate Verdict Format** — Consider whether non-director agents need this section (currently only creative-director, technical-director, producer, art-director have it)
- **`prototyper.md`** has the most non-existent file references and unique structure — may need substantial rewrite if template files aren't created
- **`live-ops-designer.md`** and **`ux-designer.md`** use simplified collaboration protocol — decide whether to expand to full incremental-writing protocol or standardize on the shorter format
