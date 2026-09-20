# Command File Review — Comprehensive Quality Audit

## Summary
- **Total commands reviewed**: 77
- **Commands with stale/broken references**: 10
- **Commands with agent routing issues**: 3
- **Commands needing PixiJS/web-specific updates**: 7
- **Commands clean (no issues)**: 57

---

## Per-Command Directory

| Command | Stale Refs | Agent Routing | Web/PixiJS Ready | Notes |
|---------|-----------|---------------|-------------------|-------|
| adopt.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic; `docs/engine-reference/[engine]/` pattern is placeholder |
| architecture-decision.md | ⚠️ Minor | ✅ Clean | ✅ Yes | Engine field example says "Godot 4.6" (line 242); ADR template engine-agnostic otherwise |
| architecture-review.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic; `docs/engine-reference/[engine]/` pattern correct |
| art-bible.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| asset-audit.md | ⚠️ Minor | ✅ Clean | ✅ Yes | References `GUIDE.md` (correct for our stack); line 89 mentions `content-audit` path referencing "GDD-specified" which is fine |
| asset-spec.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| balance-check.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| brainstorm.md | ⚠️ Minor | ✅ Clean | ⚠️ Partial | Phase 6 mentions platform implications: "mobile means Unity is strongly preferred; console means Godot has limitations; web means Godot exports cleanly" — this is Godot/Unity-centric advice that ignores PixiJS as the primary web platform |
| bug-report.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| bug-triage.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| build-audio-sprites.md | ✅ Clean | ✅ Clean | ✅ Yes | TypeScript code at line 29 uses correct import; web-ready |
| changelog.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| code-review.md | ❌ Stale | ❌ Broken | ❌ Not Ready | **Line 27**: references `.gd` file extension (`src/combat/attack.gd`). **Line 95-98**: references `.gd`, `.gdshader`, `.hlsl` file patterns; engine specialist routing uses extensions from Godot/Unity workflows. Needs PixiJS-aware patterns (`.ts`) |
| consistency-check.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| content-audit.md | ❌ Stale | ✅ Clean | ❌ Not Ready | **Lines 59-60**: Glob patterns for `.tscn`, `.unity`, `.umap` scene files — all engine-specific formats not used in PixiJS. **Lines 66-92**: All Glob patterns assume Godot/Unity/Unreal directory structures |
| create-architecture.md | ⚠️ Minor | ✅ Clean | ⚠️ Partial | **Line 75**: `Godot 4.6` in knowledge gap warning example. **Lines 216-218**: mentions Godot-specific types (`Node`, `Resource`, `Signal`). The architectural patterns are engine-agnostic but examples are Godot-centric |
| create-control-manifest.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| create-epics.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| create-stories.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| day-one-patch.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| design-review.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic; uses `GUIDE.md` correctly |
| design-system.md | ⚠️ Minor | ✅ Clean | ⚠️ Partial | **Line 391**: mentions "Autoload singleton" (Godot pattern). **Lines 146-157**: Engine domain table is engine-agnostic. The "Autoload" reference is Godot-specific |
| dev-story.md | ❌ Stale | ❌ Broken | ❌ Not Ready | **Lines 159-163**: Engine specialist routing table lists `godot-specialist`, `godot-gdscript-specialist`, `godot-shader-specialist`, `unity-specialist`, `unity-ui-specialist`, `unity-shader-specialist`, `unreal-specialist`, `ue-gas-specialist`, `ue-blueprint-specialist`, `ue-umg-specialist`, `ue-replication-specialist` — none of these exist for PixiJS. No `pixijs-specialist` routing |
| estimate.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| gate-check.md | ✅ Clean | ✅ Clean | ⚠️ Partial | **Line 99**: References `GUIDE.md Technology Stack` — uses correct filename. Otherwise engine-agnostic; all checks are file-existence based. Works for PixiJS |
| generate-sfx.md | ✅ Clean | ✅ Clean | ✅ Yes | References TypeScript tooling (`npx tsx tools/audio-pipeline/src/sfxr.ts`); web-ready |
| help.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| hotfix.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| launch-checklist.md | ⚠️ Minor | ✅ Clean | ✅ Yes | References `GUIDE.md` (correct); otherwise engine-agnostic |
| localize.md | ⚠️ Minor | ✅ Clean | ⚠️ Partial | **Line 277**: "Godot: `Control.layout_direction`, Unity: `RTL Support` package, Unreal: text direction flags" — references Godot/Unity/Unreal patterns for RTL layout. No PixiJS/HTML/CSS RTL guidance |
| map-systems.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| milestone-review.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| mix-check.md | ✅ Clean | ✅ Clean | ✅ Yes | Web-ready; uses `.wav` and `.webm` patterns |
| narrative-validate.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| onboard.md | ⚠️ Minor | ✅ Clean | ✅ Yes | References `GUIDE.md` (correct); engine-agnostic |
| patch-notes.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| perf-profile.md | ⚠️ Minor | ✅ Clean | ⚠️ Partial | **Line 30**: "_process() / Update() / Tick()" — Godot/Unity/Unreal lifecycle methods. PixiJS uses `requestAnimationFrame` and `app.ticker` |
| playtest-report.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| project-stage-detect.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| propagate-design-change.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| prototype.md | ⚠️ Minor | ✅ Clean | ⚠️ Partial | **Line 177**: mentions "project engine (Godot, Unity, Unreal)" as engine path options. No PixiJS/HTML5-specific alternative listed |
| qa-plan.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| quick-design.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| regression-suite.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| release-checklist.md | ⚠️ Minor | ✅ Clean | ✅ Yes | References `GUIDE.md` (correct) |
| retrospective.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| reverse-document.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| review-all-gdds.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| scope-check.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| security-audit.md | ⚠️ Minor | ✅ Clean | ⚠️ Partial | **Line 73**: Grep patterns reference `PacketPeer`, `NetworkedMultiplayerPeer` (Godot networking APIs), `rpc`, `rpc_id` |
| setup-engine.md | ✅ Clean | ✅ Clean | ✅ Yes | **Fully rewritten for PixiJS**. Uses `pixi.js@^8`, TypeScript, Vite, Vitest. Ideal reference implementation |
| skill-improve.md | ❌ Stale | ✅ Clean | ✅ Yes | **Line 45, 140, 209-211**: References `CCGS Skill Testing Framework/catalog.yaml` — this directory/framework does not exist in the project. All references should be removed or mapped to `.opencode/` paths |
| skill-test.md | ❌ Stale | ✅ Clean | ✅ Yes | **Lines 30, 140, 209-211, 217-218, 221, 271-278, 284-285**: Extensively references `CCGS Skill Testing Framework/catalog.yaml`, `CCGS Skill Testing Framework/skills/`, `CCGS Skill Testing Framework/quality-rubric.md`, `CCGS Skill Testing Framework/results/`, `CCGS Skill Testing Framework/agents/` — none of these paths exist. The entire `spec`, `category`, and `audit` modes are built around this missing framework |
| smoke-check.md | ❌ Stale | ❌ Broken | ❌ Not Ready | **Lines 78-112**: Engine-specific test commands for Godot (gdunit4), Unity (test-results XML), Unreal (automation logs). **No PixiJS/Vitest runner**. **Line 109-111**: "Unknown engine / not configured" fallback tells user to run `/setup-engine` but no PixiJS branch exists |
| soak-test.md | ⚠️ Minor | ✅ Clean | ⚠️ Partial | **Lines 88-106**: Engine-specific memory monitoring guidance for Godot, Unity, Unreal. No browser/PixiJS memory profiling (Chrome DevTools, `performance.memory`) |
| sprint-plan.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| sprint-status.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| start.md | ✅ Clean | ✅ Clean | ✅ Yes | **Line 34**: Correctly branded "OpenCode PixiJS Game Studio". Phase 1 checks `src/` for `*.ts` files |
| story-done.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| story-readiness.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| team-audio.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic; references engine specialist generically |
| team-combat.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic; references engine specialist generically |
| team-level.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| team-live-ops.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| team-narrative.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| team-polish.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| team-qa.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| team-release.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| team-ui.md | ⚠️ Minor | ⚠️ Minor | ⚠️ Partial | **Line 47**: References `unity-ui-specialist`, `ue-umg-specialist`, `godot-specialist` as engine UI specialists. No `pixijs-specialist` for UI. **Line 104**: Engine UI framework guidance mentions "UI Toolkit vs UGUI in Unity, Control nodes vs CanvasLayer in Godot, UMG vs CommonUI in Unreal" |
| tech-debt.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| test-evidence-review.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| test-flakiness.md | ⚠️ Minor | ✅ Clean | ⚠️ Partial | **Lines 47-52**: CI log parsing assumes JUnit XML (GdUnit4/Unity) or Unreal automation logs. No Vitest/JUnit XML parsing for PixiJS |
| test-helpers.md | ❌ Stale | ✅ Clean | ❌ Not Ready | **Lines 71-296**: Contains extensive GDScript (Godot), C# (Unity), and C++ (Unreal) helper code. No TypeScript/PixiJS helpers. The entire file is engine-specific code for engines we don't use |
| test-setup.md | ❌ Stale | ✅ Clean | ❌ Not Ready | **Lines 130-200**: Scaffolds Godot (GdUnit4), Unity (EditMode/PlayMode), and Unreal (Source/Tests/) test infrastructure. **No PixiJS + Vitest + Vite scaffold**. The CI workflows create Godot/Unity/Unreal-specific runners, not `vitest run` |
| ux-design.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| ux-review.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |
| vertical-slice.md | ✅ Clean | ✅ Clean | ✅ Yes | Engine-agnostic |

---

## Findings by Severity

### Critical (4 items)

1. **`dev-story.md` — Engine specialist routing table lists only Godot/Unity/Unreal agents** (lines 159-163)
   - Lists: `godot-specialist`, `unity-specialist`, `unreal-specialist`, `ue-gas-specialist`, `ue-blueprint-specialist`, `ue-umg-specialist`, `ue-replication-specialist`
   - Missing: `pixijs-specialist` routing for any file type
   - Impact: `/dev-story` cannot route implementation to the correct PixiJS programmer agent

2. **`smoke-check.md` — No PixiJS/Vite/Vitest test execution path** (lines 78-112)
   - Has Godot (gdunit4), Unity (test-results), Unreal (automation logs) branches
   - No `npx vitest run` or `npm test` branch for PixiJS
   - Impact: `/smoke-check` cannot execute tests in a PixiJS project

3. **`test-setup.md` — Scaffolds only Godot/Unity/Unreal test infrastructure** (lines 130-200)
   - Creates GDScript test runner, Unity assembly definitions, Unreal test directories
   - Creates Godot/Unity/Unreal CI workflows in `.github/workflows/tests.yml`
   - No PixiJS + Vitest scaffold, no `vitest run` CI workflow
   - Impact: `/test-setup` will produce wrong files for our stack

4. **`test-helpers.md` — Contains only Godot (GDScript), Unity (C#), and Unreal (C++) code** (lines 71-296)
   - Hundreds of lines of engine-specific helper code
   - No TypeScript test helpers for PixiJS/Vitest
   - Impact: Generated helpers are completely wrong for our project

### High (7 items)

5. **`skill-test.md` — Entirely dependent on missing `CCGS Skill Testing Framework/`** (lines 30, 140, 209-211, 217-218, 221, 271-278, 284-285)
   - References `CCGS Skill Testing Framework/catalog.yaml`, `CCGS Skill Testing Framework/skills/`, `CCGS Skill Testing Framework/quality-rubric.md`, `CCGS Skill Testing Framework/results/`, `CCGS Skill Testing Framework/agents/`
   - These paths do not exist in the project
   - The `spec`, `category`, and `audit` modes cannot function
   - Only `static` mode works (it only reads `.opencode/skills/*/SKILL.md`)

6. **`skill-improve.md` — References missing `CCGS Skill Testing Framework/catalog.yaml`** (lines 45, 140, 209-211)
   - Category baseline lookup reads from the non-existent catalog
   - Rest of skill is inoperable without the framework

7. **`code-review.md` — Hardcoded file extensions from Godot/Unity** (lines 27, 95-98)
   - References `.gd` files (GDScript), `.gdshader`, `.hlsl`
   - Should reference `.ts` files for PixiJS
   - Engine specialist routing uses these extensions to pick reviewers

8. **`content-audit.md` — Asset scanning patterns are engine-specific** (lines 59-60, 66-92)
   - Glob patterns for `.tscn` (Godot), `.unity` (Unity), `.umap` (Unreal)
   - Should scan `.ts`, `.json`, image assets for PixiJS web project
   - All implementation scan paths assume Godot/Unity/Unreal directory structures

9. **`soak-test.md` — Memory monitoring guidance is engine-specific** (lines 88-106)
   - Godot Debugger monitors, Unity Memory Profiler, Unreal `stat memory`
   - No browser DevTools Performance/Memory panel guidance
   - Should reference `performance.memory` (per web-code rules) and Chrome DevTools

10. **`test-flakiness.md` — CI log parsing assumes JUnit XML from GdUnit4/Unity or UE automation logs** (lines 47-52)
    - No Vitest JSON/JUnit reporter output parsing

11. **`localize.md` — RTL layout guidance references Godot/Unity/Unreal APIs** (line 277)
    - "Godot: `Control.layout_direction`, Unity: `RTL Support` package, Unreal: text direction flags"
    - No CSS `direction: rtl` or HTML `dir` attribute guidance for PixiJS/web

### Medium (8 items)

12. **`brainstorm.md` — Platform/engine advice centers on Godot/Unity** (Phase 6)
    - "mobile means Unity is strongly preferred; console means Godot has limitations; web means Godot exports cleanly"
    - Should note that PixiJS/TypeScript natively targets web and is the primary platform

13. **`create-architecture.md` — Examples use Godot-specific types** (lines 75, 216-218)
    - Knowledge gap example: "Godot 4.6"
    - API boundaries section references Godot types: `Node`, `Resource`, `Signal`
    - Should use PixiJS examples: `Container`, `Application`, event emitters

14. **`design-system.md` — References Godot Autoload singleton pattern** (line 391)
    - "Should this use an Autoload singleton or a signal bus?"
    - Should reference PixiJS patterns (e.g., module-scoped instances, event emitter)

15. **`perf-profile.md` — Hot path methods use Godot/Unity/Unreal lifecycle names** (line 30)
    - "_process() / Update() / Tick()"
    - Should reference `requestAnimationFrame`, `app.ticker`, PixiJS render loop

16. **`prototype.md` — Engine path options reference Godot/Unity/Unreal** (line 177)
    - Mentions Godot, Unity, Unreal as "project engine" options with Love2D alternative
    - Should clarify that PixiJS + TypeScript is the native "engine" path
    - HTML path is already correct and web-ready

17. **`security-audit.md` — Network grep patterns are Godot-specific** (line 73)
    - "PacketPeer", "NetworkedMultiplayerPeer", "rpc", "rpc_id"
    - Should reference WebSocket patterns, fetch API patterns for PixiJS

18. **`team-ui.md` — Engine UI specialist references Godot/Unity/Unreal agents** (lines 47, 104)
    - Lists `unity-ui-specialist`, `ue-umg-specialist`, `godot-specialist`
    - UI framework guidance references "UI Toolkit vs UGUI in Unity, Control nodes vs CanvasLayer in Godot, UMG vs CommonUI in Unreal"
    - Should reference PixiJS Container-based hierarchy, HTML DOM overlay patterns

19. **`architecture-decision.md` — Example uses "Godot 4.6"** (line 242)
    - Engine Compatibility table example field: "Godot 4.6"
    - Should use "PixiJS v8" as example

### Low (5 items)

20. **`adopt.md` — References `docs/engine-reference/[engine]/VERSION.md`** (line 153)
    - Pattern is a valid placeholder, but needs verification against actual path `.opencode/docs/pixijs-reference/VERSION.md`

21. **`launch-checklist.md`** and **`release-checklist.md`** — Reference `GUIDE.md` (correct) but `onboard.md` also references `GUIDE.md`
    - These are correct for our stack (GUIDE.md is our project metadata file)

22. **`asset-audit.md`** — References `GUIDE.md` naming conventions (correct)

23. **`mix-check.md`** — Uses `.wav` and `.webm` patterns which are correct for web audio

24. **`regression-suite.md`** — Engine-agnostic but references engine-specific test file extension patterns in templates

---

## Commands Fully Rewritten for PixiJS (Benchmark)

| Command | Status |
|---------|--------|
| `setup-engine.md` | ✅ **Fully rewritten** — PixiJS v8, TypeScript, Vite, Vitest. Correct `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts` |

---

## Quick Wins

### Batch find-and-replace suggestions

1. **"GUIDE.md" → already correct** — All commands correctly use `GUIDE.md` (not `CLAUDE.md`). No change needed.

2. **"CCGS Skill Testing Framework" → `.opencode/`**  
   Affected files: `skill-test.md`, `skill-improve.md`  
   Replace all references to `CCGS Skill Testing Framework/catalog.yaml` with `.opencode/docs/workflow-catalog.yaml` (or remove if catalog doesn't exist)

3. **"Godot 4.6" → "PixiJS v8"** (in examples)  
   Affected: `architecture-decision.md` line 242, `create-architecture.md` line 75

4. **Engine lifecycle method names**:  
   `perf-profile.md` line 30: "`_process()` / `Update()` / `Tick()`" → "`requestAnimationFrame` / `app.ticker` / update loop"

5. **File extensions**:  
   `code-review.md` lines 27, 95-98: `.gd`, `.gdshader` → `.ts`, `.tsx`

### Commands that can be fixed with single-line edits

- `brainstorm.md` Phase 6: Remove/update the platform-engine advice about Unity/Godot
- `design-system.md` line 391: Replace "Autoload singleton" with "module-scoped instance"
- `perf-profile.md` line 30: Replace lifecycle method names
- `localize.md` line 277: Add CSS/HTML RTL guidance alongside engine references
- `security-audit.md` line 73: Add WebSocket patterns alongside engine networking APIs
- `architecture-decision.md` line 242: Replace "Godot 4.6" with "PixiJS v8"

### Commands requiring full rewrites (not quick wins)

- **`dev-story.md`** (lines 159-163): Replace entire engine specialist routing table with PixiJS routing
- **`smoke-check.md`** (lines 78-112): Replace engine-specific test commands with `npx vitest run`
- **`test-setup.md`** (lines 130-200): Replace Godot/Unity/Unreal scaffolding with PixiJS + Vitest scaffold
- **`test-helpers.md`** (lines 71-296): Replace GDScript/C#/C++ helpers with TypeScript/Vitest helpers
- **`content-audit.md`** (lines 59-92): Replace `.tscn`/`.unity`/`.umap` patterns with web asset patterns
- **`skill-test.md`** (entire `spec`, `category`, `audit` modes): Remove or remap CCGS Framework references
- **`team-ui.md`** (lines 47, 104): Replace engine UI specialist references with PixiJS patterns

---

## YAML Frontmatter Audit

- **All 77 commands** have valid YAML frontmatter with `description` and `agent: build`
- **No commands** reference "Claude", "sonnet", "opus", or "haiku" in frontmatter
- **No commands** reference "Godot", "Unity", or "Unreal" in frontmatter descriptions
- All descriptions are clear and action-oriented

---

## Agent Name Audit

### Agents referenced that exist in `.opencode/agents/`:
All 35 standard agents (creative-director, technical-director, producer, game-designer, lead-programmer, art-director, audio-director, narrative-director, qa-lead, release-manager, localization-lead, gameplay-programmer, engine-programmer, ai-programmer, pixijs-specialist, etc.) — correctly referenced.

### Agents referenced that DO NOT exist:
- `godot-specialist` (in `dev-story.md`, `team-ui.md`)
- `godot-gdscript-specialist` (in `dev-story.md`)
- `godot-shader-specialist` (in `dev-story.md`)
- `unity-specialist` (in `dev-story.md`)
- `unity-ui-specialist` (in `dev-story.md`, `team-ui.md`)
- `unity-shader-specialist` (in `dev-story.md`)
- `unreal-specialist` (in `dev-story.md`)
- `ue-gas-specialist` (in `dev-story.md`)
- `ue-blueprint-specialist` (in `dev-story.md`)
- `ue-umg-specialist` (in `dev-story.md`, `team-ui.md`)
- `ue-replication-specialist` (in `dev-story.md`)

---

## Tool References Audit

All commands reference standard OpenCode tools (Glob, Grep, Read, Write, Edit, Bash, Task, AskUserQuestion, WebSearch). No references to CCGS-specific or Claude-specific tools found.
