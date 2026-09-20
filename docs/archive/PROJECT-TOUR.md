# OpenCode PixiJS Game Studio — Full Project Tour

*Generated 2026-06-25 — reflects commits `32adae1` → `8ef042c`*

---

## What This Is

A **browser game development studio** powered by AI agents. Originally derived from
an upstream multi-engine game studio template,
we stripped the Godot/Unity/Unreal engine support and replaced it with
**PixiJS v8 + TypeScript + Vite**, then added a **compiler-backed TypeScript
agent infrastructure** — the novel part.

---

## Tech Stack

| Layer | Choice | Status |
|-------|--------|--------|
| **Renderer** | PixiJS v8 (WebGL2/WebGPU/Canvas) | Installed |
| **Language** | TypeScript 5.9.3, `strict: true` | Installed |
| **Build** | Vite 6 + tsc | Installed |
| **Testing** | Vitest 3 | Installed |
| **Models** | DeepSeek V4 Pro (Pro), DeepSeek V4 Flash (Flash/Flash) | Go plan |
| **Narrative Graph** | `@automagically/narrative-core` workspace package | Imported from Narrative Workbench |
| **Physics** | Matter.js | Not installed (optional) |
| **Audio** | Howler.js | Not installed (optional) |

---

## Agents (35)

Each agent is a markdown file with YAML frontmatter in `.opencode/agents/`.

### Tier 1 — Directors (Pro)
| Agent | Domain |
|-------|--------|
| `creative-director` | High-level vision, pillar conflicts, tone |
| `technical-director` | Architecture decisions, tech stack, performance |
| `producer` | Sprint planning, milestones, risk, coordination |

### Tier 2 — Department Leads (Flash)
| Agent | Domain |
|-------|--------|
| `game-designer` | Mechanics, systems, progression, economy |
| `lead-programmer` | Code architecture, API design, code review, TS enforcement |
| `art-director` | Style guides, art bible, asset standards |
| `audio-director` | Music direction, sound palette, audio strategy |
| `narrative-director` | Story arcs, world-building, character design |
| `qa-lead` | Test strategy, bug triage, release readiness |
| `release-manager` | Build management, versioning, changelogs |
| `localization-lead` | String externalization, translation pipeline |

### Tier 3 — Specialists (Flash / Flash)
| Agent | Model | Domain |
|-------|-------|--------|
| `gameplay-programmer` | Flash | Game mechanics, systems code |
| `engine-programmer` | Flash | Core engine, rendering, physics |
| `ai-programmer` | Flash | Behavior trees, pathfinding, NPC logic |
| `pixijs-specialist` | Flash | **PixiJS v8 rendering, scene graph, shaders, perf** |
| `network-programmer` | Flash | Netcode, replication, matchmaking |
| `tools-programmer` | Flash | Editor extensions, pipeline tools |
| `ui-programmer` | Flash | UI framework, screens, widgets, data binding |
| `technical-artist` | Flash | Shaders, VFX, optimization, art pipeline |
| `sound-designer` | Flash | SFX design, audio events, mixing |
| `writer` | Flash | Dialogue, lore, item descriptions |
| `world-builder` | Flash | World rules, factions, history |
| `systems-designer` | Flash | Formula design, mechanic specs |
| `level-designer` | Flash | Level layouts, pacing, encounters |
| `economy-designer` | Flash | Resource economies, loot, progression |
| `ux-designer` | Flash | User flows, wireframes, accessibility |
| `prototyper` | Flash | Throwaway prototypes, feasibility testing |
| `performance-analyst` | Flash | Profiling, optimization recommendations |
| `qa-tester` | Flash | Test cases, bug reports |
| `devops-engineer` | Flash | CI/CD, build scripts |
| `analytics-engineer` | Flash | Event tracking, dashboards |
| `security-engineer` | Flash | Anti-cheat, save encryption, network security |
| `accessibility-specialist` | Flash | WCAG, colorblind modes, remapping |
| `live-ops-designer` | Flash | Seasons, events, battle passes |
| `community-manager` | Flash | Patch notes, player feedback |

### Agents removed (15)
All Godot (`godot-specialist`, `godot-gdscript-specialist`, `godot-csharp-specialist`,
`godot-shader-specialist`, `godot-gdextension-specialist`), Unity (`unity-specialist`,
`unity-dots-specialist`, `unity-shader-specialist`, `unity-addressables-specialist`,
`unity-ui-specialist`), and Unreal (`unreal-specialist`, `ue-gas-specialist`,
`ue-blueprint-specialist`, `ue-replication-specialist`, `ue-umg-specialist`) agents
were deleted. Not applicable to browser game development.

---

## Commands (73)

All in `.opencode/commands/`. Full CCGS command set preserved.

### Onboarding & Navigation
`/start` `/help` `/project-stage-detect` `/setup-engine` `/adopt`

### Game Design
`/brainstorm` `/map-systems` `/design-system` `/quick-design`
`/review-all-gdds` `/propagate-design-change`

### Art & Assets
`/art-bible` `/asset-spec` `/asset-audit`

### UX & Interface
`/ux-design` `/ux-review`

### Architecture
`/create-architecture` `/architecture-decision` `/architecture-review`
`/create-control-manifest`

### Stories & Sprints
`/create-epics` `/create-stories` `/dev-story` `/sprint-plan` `/sprint-status`
`/story-readiness` `/story-done` `/estimate`

### Reviews & Analysis
`/design-review` `/code-review` `/balance-check` `/content-audit`
`/scope-check` `/perf-profile` `/tech-debt` `/gate-check` `/consistency-check`
`/security-audit`

### QA & Testing
`/qa-plan` `/smoke-check` `/soak-test` `/regression-suite` `/test-setup`
`/test-helpers` `/test-evidence-review` `/test-flakiness` `/skill-test`
`/skill-improve`

### Production
`/milestone-review` `/retrospective` `/bug-report` `/bug-triage`
`/reverse-document` `/playtest-report`

### Release
`/release-checklist` `/launch-checklist` `/changelog` `/patch-notes`
`/hotfix` `/day-one-patch`

### Creative & Content
`/prototype` `/onboard` `/localize`

### Team Orchestration
`/team-combat` `/team-narrative` `/team-ui` `/team-release` `/team-polish`
`/team-audio` `/team-level` `/team-live-ops` `/team-qa`

---

## Rules (12)

Path-scoped coding standards enforced by path. Loaded via `opencode.json`
`instructions` field.

| Path | Rule File | Enforces |
|------|-----------|----------|
| `src/gameplay/**` | `gameplay-code.md` | Data-driven values, delta time, no hardcoded values |
| `src/core/**` | `engine-code.md` | Zero-alloc hot paths, thread safety, API stability |
| `src/ai/**` | `ai-code.md` | 2ms budget, debuggability, data-driven params |
| `src/networking/**` | `network-code.md` | Server-authoritative, versioned messages, security |
| `src/ui/**` | `ui-code.md` | No state ownership, Container-based, hitArea, DOM overlays |
| `src/rendering/**` | `shader-code.md` | GLSL/WGSL, Filter.from(), WebGPU fallback |
| `src/**` (general) | `web-code.md` **new** | DOM guard, bundle budgets, context loss, error boundaries |
| `assets/**` | `data-files.md` | JSON schema, naming conventions, no orphans |
| `design/gdd/**` | `design-docs.md` | Required 8 sections, formula format |
| `design/narrative/**` | `narrative.md` | Lore cross-reference, canon levels, voice profiles |
| `tests/**` | `test-standards.md` | Vitest, arrange/act/assert, named tests |
| `prototypes/**` | `prototype-code.md` | README required, relaxed standards |

---

## TypeScript Compiler Agent Infrastructure (Novel)

This is the custom addition beyond the CCGS template. Instead of a
"TypeScript expert" prompt file, we built a **compiler-backed** agent
system across three tiers.

### Tier 1 — Reference Docs

**`.opencode/docs/ts-reference/`** — three files:

| File | Purpose |
|------|---------|
| `VERSION.md` | Pins TS 5.9.3 (post-cutoff), documents changes from 5.5→5.9, config rules |
| `patterns.md` | Dogma (no `any`, `as`, `!`), strict patterns (branded types, discriminated unions, type guards), banned patterns, bundle awareness |
| `module-architecture.md` | Dependency direction rules for all `src/` layers, barrel module pattern, boundary violation detection |

### Tier 2 — Agent Skill

**`.opencode/skills/typescript-patterns/`** — a loadable skill (`SKILL.md`)
that any agent can invoke for TypeScript code review, lint, or refactoring.
Three modes:
- **`review`** — checks `any`, `as`, `!`, `@ts-ignore`, return types, boundary violations
- **`lint`** — auto-fixes banned patterns
- **`refactor`** — architecture-aware refactoring with module boundary validation

### Tier 3 — MCP Server

**`tools/ts-compiler-mcp/`** — a Model Context Protocol server that exposes
the TypeScript compiler as agent-accessible tools. Uses `ts-morph` for
direct compiler access (no grep, no guesswork).

| Tool | What It Does |
|------|-------------|
| `findSymbol(name)` | Locates a symbol's declaration — file, line, kind |
| `findReferences(name)` | Finds all usages of a symbol across the codebase |
| `checkAnyUsage(path)` | Audits a file for `any`, type assertions (`as`), non-null (`!`) |
| `traceImports(path)` | Lists all imports and exports of a module |
| `checkBoundaryViolation(path)` | Validates module layer isolation rules |

### Wiring

**`lead-programmer.md`** was updated with a full TypeScript enforcement
checklist and compiler-backed workflow instructions. All three tiers are
referenced inline.

**`technical-preferences.md`** routes `.ts` file reviews to `lead-programmer`
(with note to consult `ts-reference/`), and documents the MCP server
configuration for agent integration.

### Why This Approach

The research that informed this design found that the industry is moving
away from "TypeScript expert prompts" and toward **compiler-backed agents**:

> *"Don't make the model smarter. Give the model direct access to the
> TypeScript compiler."*

The MCP server allows agents to query `tsserver`/`ts-morph` for symbol
lookup, reference tracing, and type resolution instead of using
grep-and-guess patterns. This reduces token usage by 60-70% for
navigation tasks and produces exact results.

---

## PixiJS Renderer

**`.opencode/agents/pixijs-specialist.md`** — dedicated render specialist:

- **Core knowledge**: Scene graph, Graphics, Sprite, Text, ParticleContainer, Assets class, Ticker, Events, Filters, Blend modes
- **Version awareness**: PixiJS v8 reference pinned in `.opencode/docs/pixijs-reference/VERSION.md` — v8 removed `Loader` (use `Assets`), changed `Application` options, added `FilterSystem.from()`
- **Performance guidelines**: Pool sprites, cache textures, never `new Sprite()` in hot paths, lazy containers for off-screen content

---

## Project File Structure

```
/
├── AGENTS.md                           # Master agent configuration
├── GUIDE.md                           # Claude/OpenCode root config
├── opencode.json                       # OpenCode permissions, model tiers, instructions
├── README.md                           # Project README
├── MIGRATE-TO-PIXIJS.md                # Migration plan (reference)
│
├── index.html                          # Vite entry HTML
├── package.json                        # npm: pixi.js, typescript, vite, vitest
├── tsconfig.json                       # TypeScript strict config
├── vite.config.ts                      # Vite + Vitest config
├── packages/
│   └── narrative-core/                 # Workspace: NarrativeDocumentV2 format + engine + analysis
│       └── src/
│           ├── schema.ts               # Zod schema (NarrativeDocumentV2)
│           ├── types.ts                # TS type definitions
│           ├── engine.ts               # Headless NarrativeEngine
│           ├── events.ts               # Pub/sub event bus
│           └── analysis.ts             # Graph analysis (reachability, orphans, dead ends)
├── src/
│   ├── main.ts                         # PixiJS Application bootstrap
│   └── gameplay/narrative/             # NarrativeEngine wrapper for PixiJS dialogue
│
├── public/                             # Static assets
├── tests/
│   ├── narrative-core.test.ts          # Vitest suite: 5 tests (schema, analysis, engine, events)
│
├── .opencode/
│   ├── agents/                         # 36 agent definitions
│   ├── commands/                       # 77 commands
│   ├── rules/                          # 12 path-scoped rules
│   ├── skills/
│   │   └── typescript-patterns/        # TS patterns skill (loadable)
│   ├── docs/
│   │   ├── pixijs-reference/           # PixiJS v8 version pin
│   │   ├── ts-reference/               # TS version + patterns + architecture
│   │   ├── templates/                  # Document templates (empty)
│   │   ├── hooks-reference/            # Hook documentation
│   │   └── ...                         # Coordination docs, workflows, etc.
│
├── tools/
│   └── ts-compiler-mcp/                # MCP server for compiler-backed tools
│       ├── src/index.ts                # Server with 8 tools (5 TS + 3 narrative)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
│
├── docs/
│   ├── architecture/                   # ADRs (empty, to be populated)
│   ├── examples/                       # Example docs
│   └── registry/                       # Entity/item registry
│
├── assets/                             # Game assets (empty)
├── design/
│   ├── game-graph.json                 # Example NarrativeDocumentV2 — cat grapple platformer
│   └── gdd/                            # GDD markdown files (empty)
├── prototypes/                         # Throwaway experiments (empty)
└── production/                         # Sprints, milestones, releases
    ├── session-state/                  # Ephemeral session state (gitignored)
    └── session-logs/                   # Session audit trail (gitignored)
```

---

## Project Lifecycle

This project uses a **7-phase pipeline** defined in
`.opencode/docs/workflow-catalog.yaml`:

```
Concept → Design → Architecture → Implementation → QA → Polish → Release
```

Each phase has specific gates, commands, and agent orchestrations.
The `/start` command runs the first-time onboarding flow.

---

---

## Narrative Core — Graph Format for Game Design

**`packages/narrative-core/`** — a workspace package extracted from
[Narrative Workbench](https://github.com/skinnerboxentertainment/NarrativeDocument),
MIT licensed. Pure TypeScript, zero UI dependencies.

### What It Is

The `NarrativeDocumentV2` schema is a **typed directed graph with conditional
edges and state variables**. Originally designed for interactive fiction,
it generalizes to any game design structure:

| Domain | Nodes | Edges |
|--------|-------|-------|
| System dependencies | Gameplay systems | `depends_on` |
| Feature roadmap | Epics/stories | `blocks`, `requires` |
| State machines | Game states | `transition` |
| Agent delegation | Agents | `delegates_to` |
| Asset pipeline | Assets | `depends_on` |

### Files

| File | Purpose |
|------|---------|
| `schema.ts` | Zod schema — validates any `NarrativeDocumentV2` JSON |
| `types.ts` | Inferred TypeScript types |
| `engine.ts` | Headless `NarrativeEngine` — walks graph, evaluates conditions, applies mutations, interpolates variables |
| `events.ts` | Pub/sub event bus for runtime side effects |
| `analysis.ts` | Graph analysis — reachability, orphan detection, dead ends, broken references |

### Integration Points

| Integration | What | File |
|-------------|------|------|
| **Command** | `/narrative-validate` — validates a graph JSON, runs analysis | `.opencode/commands/narrative-validate.md` |
| **MCP tool** | `validateNarrative`, `analyzeStory`, `simulatePath` | `tools/ts-compiler-mcp/src/index.ts` |
| **Gameplay** | `NarrativeSystem` — wraps `NarrativeEngine` for PixiJS | `src/gameplay/narrative/narrative-system.ts` |
| **Seed data** | Example cat grapple platformer graph | `design/game-graph.json` |
| **Tests** | 5 passing tests (schema, analysis, engine init, conditions, events) | `tests/narrative-core.test.ts` |

### Usage

The format is optional — a sidecar file alongside markdown GDDs.
Run `/narrative-validate design/game-graph.json` to validate and analyze.

---

## What's Missing

1. **No game concept** — no GDDs, no brainstorm docs, no idea what we're building
2. **No game code** — just the PixiJS `Application` bootstrap in `src/main.ts`
3. **No assets** — `assets/` is empty
4. **Tests growing** — `tests/narrative-core.test.ts` exists (5 tests passing), but no gameplay tests yet
5. **No architecture decisions** — `docs/architecture/` is empty
6. **No sprint plans** — `production/` has no sprint files

To start: run `/brainstorm` or `/start` to define a game concept.


