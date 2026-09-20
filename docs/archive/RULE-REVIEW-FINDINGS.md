# Rule File Review

**Date**: 2026-06-25
**Reviewer**: Automated quality review of `.opencode/rules/`
**Scope**: All 12 rule files + cross-reference against project directory structure

---

## Summary

- **Total rules**: 12
- **Issues found**: 6 (1 documentation bug, 2 missing coverage gaps, 3 low-severity notes)
- **Stale references in rules**: 0 (clean)
- **Code example language**: 3 rules have TypeScript examples (engine-code, gameplay-code, test-standards); 9 are declarative/bullet-list style (no code examples, which is appropriate for their domains)
- **Overall quality**: Good. All rules are properly scoped to this PixiJS/TypeScript/web project. No engine-specific stale references (Godot, Unity, Unreal, GDScript) found in any rule file.

---

## Per-Rule Assessment

| # | Rule File | Path(s) | Dir Exists? | TS Examples | Stale Refs | Issues |
|---|-----------|---------|-------------|-------------|------------|--------|
| 1 | `ai-code.md` | `src/ai/**` | No (future) | N/A (bullets only) | 0 | None |
| 2 | `data-files.md` | `assets/data/**` | No (future) | N/A (JSON examples) | 0 | None |
| 3 | `design-docs.md` | `design/gdd/**` | No (future) | N/A (no code) | 0 | None |
| 4 | `engine-code.md` | `src/core/**` | No (future) | Yes (2 examples) | 0 | None |
| 5 | `gameplay-code.md` | `src/gameplay/**` | **Yes** | Yes (2 examples) | 0 | None |
| 6 | `narrative.md` | `design/narrative/**` | No (future) | N/A (no code) | 0 | None |
| 7 | `network-code.md` | `src/networking/**` | No (future) | N/A (bullets only) | 0 | See Finding #3 |
| 8 | `prototype-code.md` | `prototypes/**` | **Yes** (empty) | N/A (no code) | 0 | None |
| 9 | `shader-code.md` | `assets/shaders/**` | No (future) | N/A (GLSL/WGSL refs) | 0 | None |
| 10 | `test-standards.md` | `tests/**` | **Yes** (empty) | Yes (2 vitest examples) | 0 | None |
| 11 | `ui-code.md` | `src/ui/**` | No (future) | N/A (bullets only) | 0 | None |
| 12 | `web-code.md` | `src/**` | **Yes** (src/gameplay/) | N/A (bullets only) | 0 | See Finding #1 |

---

## Findings

### Issue #1 [BUG] — `web-code.md` missing from `rules-reference.md` table

**Severity**: Medium (documentation bug)

The file `.opencode/docs/rules-reference.md` lists only 11 rules in its table. The 12th rule, `web-code.md` (catch-all for `src/**`), is completely absent from that reference table. This means anyone consulting the rules reference doc will not know web-code.md exists or what it enforces.

**Fix**: Add a row to the table in `.opencode/docs/rules-reference.md`:

```markdown
| `web-code.md` | `src/**` | Browser constraints, bundle budget, context loss, web workers, `requestAnimationFrame`, no DOM outside UI layer |
```

---

### Issue #2 [MISSING COVERAGE] — `src/rendering/` has no rule

**Severity**: Low

The directory-structure.md specifies `src/rendering/` as the home for "Custom shaders, post-processing." However:
- `shader-code.md` covers `assets/shaders/**` only (the shader source files)
- `src/rendering/` (the runtime TypeScript code that loads and applies those shaders) has no domain-specific rule

The `web-code.md` catch-all (`src/**`) applies, so there is still general web/TS coverage. A rendering-specific rule may not be needed if `web-code.md` and `engine-code.md` (for core rendering pipeline code) suffice.

**Recommendation**: Either (a) expand `shader-code.md` to also cover `src/rendering/**`, or (b) document that `src/rendering/` is intentionally covered by the combination of `web-code.md` and `shader-code.md`.

---

### Issue #3 [MISSING COVERAGE] — `src/tools/` has no rule

**Severity**: Low

The directory-structure.md specifies `src/tools/` as "Dev tools, debug overlays." No rule targets this path. The `web-code.md` catch-all covers it with general web/TS rules, but tools code often has different standards (less strict memory budgets, debug code allowed, etc.).

**Recommendation**: Either (a) add a `tools-code.md` rule for `src/tools/**`, or (b) document that tools code follows relaxed standards similar to `prototype-code.md`, or (c) confirm `web-code.md` is sufficient.

---

### Issue #4 [NOTE] — 8 of 12 rule paths target directories that don't exist yet

**Severity**: Informational

The following rule paths reference directories that are planned in the directory structure but have not been created on disk:
- `src/core/` (engine-code.md)
- `src/ai/` (ai-code.md)
- `src/networking/` (network-code.md)
- `src/ui/` (ui-code.md)
- `assets/data/` (data-files.md)
- `assets/shaders/` (shader-code.md)
- `design/gdd/` (design-docs.md)
- `design/narrative/` (narrative.md)

This is normal for a project in the setup/early phase. The rules will automatically apply when those directories are populated. No action needed, but worth noting that the project currently has only `src/gameplay/` as the sole populated source directory.

The following directories exist on disk but have **no** rule coverage:
- `src/` (general) -> covered by web-code.md ✓
- `src/gameplay/` -> covered by gameplay-code.md ✓
- `src/gameplay/audio/` -> covered by gameplay-code.md ✓
- `src/gameplay/narrative/` -> covered by gameplay-code.md ✓
- `tests/` -> covered by test-standards.md ✓
- `prototypes/` -> covered by prototype-code.md ✓

---

### Issue #5 [NOTE] — `design/registry/` directory exists but has no matching rule

**Severity**: Low

The directory `design/registry/` exists on disk (contains `game-graph.json`, `entities.yaml`) but is not mentioned in the directory-structure.md and has no rule coverage. The two existing design rules cover `design/gdd/**` and `design/narrative/**`, but not `design/registry/**`.

**Recommendation**: Either add `design/registry/**` to an existing rule's paths or document what `design/registry/` is for and whether it needs a rule.

---

### Issue #6 [NOTE] — `public/` and `production/` directories have no rules

**Severity**: Informational

- `public/` — static assets served directly. No rule needed; these are raw files.
- `production/` — session state and logs (both `session-state/` and `session-logs/`). No rule needed; these are gitignored operational files.

These are intentionally uncovered. No action needed.

---

## Stale Reference Audit

A full-text search across all 12 rule files for the following terms returned **zero matches**:
- `Claude`
- `Godot`
- `Unity`
- `Unreal`
- `GDScript`
- `.claude/`
- `engine-reference`

**Result: Clean.** No stale engine or tool references exist in any rule file.

Note: The broader project does contain a `design/CLAUDE.md` file (outside the rules directory), which is a leftover from the original Claude Code Game Studios template. That is outside the scope of this review but could be cleaned up separately.

---

## PixiJS / Web / Browser Relevance Check

All 12 rules are appropriate for a PixiJS v8 + TypeScript + browser-targeted project:

| Rule | Web/PixiJS Relevance |
|------|---------------------|
| `web-code.md` | Directly addresses browser constraints: bundle budgets, WebGL context loss, `requestAnimationFrame`, web workers, service workers, PWA |
| `ui-code.md` | References PixiJS Container hierarchy, `hitArea`, DOM overlays, canvas UI |
| `shader-code.md` | References PixiJS v8 `Filter.from()`, `Filter` class, WebGL2/WebGPU, GLSL/WGSL |
| `engine-code.md` | References `.opencode/docs/pixijs-reference/VERSION.md`, zero-allocation patterns |
| `gameplay-code.md` | Generic game logic rules; engine-agnostic but correct for TypeScript |
| `ai-code.md` | Engine-agnostic AI rules; applicable to any game |
| `network-code.md` | Engine-agnostic netcode rules; applicable to web games (WebSocket/WebRTC) |
| `test-standards.md` | Uses `vitest` imports, which is the project's configured test framework |
| `prototype-code.md` | Engine-agnostic; correct |
| `data-files.md` | JSON data rules; technology-appropriate |
| `design-docs.md` | Design document rules; technology-agnostic |
| `narrative.md` | Narrative rules; technology-agnostic |

### Potential additions for a PixiJS/web project (none are critical):

1. **`web-code.md` could add**: Guidance on PixiJS asset loading patterns (async texture loading, spritesheet handling)
2. **`network-code.md` could add**: WebSocket reconnection strategy, WebRTC data channel considerations for browser multiplayer
3. **`engine-code.md` could add**: PixiJS `Ticker` usage patterns, `Application` lifecycle hooks
4. No PixiJS-specific rules are missing that would block development.

---

## Missing Coverage Summary

| Path/Domain | In Directory Structure? | Has Rule? | Severity |
|-------------|------------------------|-----------|----------|
| `src/rendering/` | Yes | No (catch-all `web-code.md` only) | Low |
| `src/tools/` | Yes | No (catch-all `web-code.md` only) | Low |
| `design/registry/` | No (exists on disk) | No | Low |
| `public/` | No (exists on disk) | No | None needed |
| `production/` | No (exists on disk) | No | None needed |

---

## Recommendations

### Immediate (bug fix)
1. Add `web-code.md` to the table in `.opencode/docs/rules-reference.md` — it is the 12th rule and currently missing.

### Low priority
2. Decide whether `src/rendering/` needs its own rule or is adequately covered by `web-code.md` + `shader-code.md`.
3. Decide whether `src/tools/` needs its own rule (possibly relaxed, like `prototype-code.md`).
4. Document `design/registry/` in the directory structure and determine if it needs a rule.
5. Create the placeholder directories for the 8 rule paths that don't exist yet (optional — rules will apply automatically when those directories are populated).

### Already clean
- No stale engine references in any rule file.
- All code examples are in TypeScript (where applicable).
- All rules are appropriate for the PixiJS/TypeScript/web technology stack.
- `opencode.json` correctly loads all 12 rules via `".opencode/rules/*.md"`.
