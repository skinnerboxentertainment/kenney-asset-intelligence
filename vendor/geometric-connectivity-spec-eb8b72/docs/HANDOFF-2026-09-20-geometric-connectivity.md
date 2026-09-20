# Handoff: Geometric Connectivity + WFC Tile-Adjacency work

**Date:** 2026-09-20
**Branch:** `claude/geometric-connectivity-spec-eb8b72`
**Worktree:** `C:\Users\oscar\AI WORKBENCH\_Active\UniversalAssetEdgeExtractor\.claude\worktrees\geometric-connectivity-spec-eb8b72`
**Base repo:** `C:\Users\oscar\AI WORKBENCH\_Active\UniversalAssetEdgeExtractor`
**Latest commit:** `a9ad0d8` (5 commits ahead of the branch point `5e3ff37`)
**Working tree:** clean, nothing pushed to a remote (no remote is configured)

Read this before touching this branch's work. Section 1 is the one thing
that changes what you should do next — read it even if you skip everything
else.

---

## 1. Important — a parallel branch already supersedes part of this work

While writing this handoff I checked the repo's other branches and found
`rebuild/asset-index` (29 commits ahead of the same fork point, last
commit **2026-09-06**, two weeks before tonight's work). It is a much
larger, more mature rebuild:

- A SQLite (FTS5) index over **61,005 files across the full ~223-pack
  catalog** (`assets build`), not the JSON-manifest pipeline this branch
  uses.
- Semantic search (`assets search "side-view player walk cycle" --role
  character`), a contact-sheet render command (`assets sheet ...`), and an
  install command (`assets install ... --to ./src/assets --manifest`).
- Vision-generated descriptions for thousands of tiles, a retrieval eval
  harness (recall@10 up to ~95%), a synonym map, a camelCase-aware
  tokenizer.
- Exposed over MCP as a queryable tool.
- **Commit `7c5ca16`, "Phase 2: replace the hand-rolled PNG decoder with
  sharp"** — this independently found and fixed the *exact same three
  decoder bugs* I found and fixed tonight (colorType 3 reading palette
  indices as raw RGB, filter type 3/Average never implemented, filter
  type 4/Paeth using the wrong formula), by dropping in `sharp`
  (libvips) instead of hand-rolling a corrected decoder. Their code
  comment says it outright: *"Every colour, style and score [the old
  decoder] produced for an indexed or Average-filtered PNG was wrong,
  and 27,048 rows inherited that silently."* That is the same finding
  this branch made independently, days later, from a different angle.
- **It deletes `tools/local-analyzer.mjs` and `tools/merge-analysis.mjs`
  outright** — the exact two files this branch's `geometry-extractor.mjs`
  and `wfc-adjacency.mjs` import `decodePNG()` from and hook into.

**What this means practically:** the two new tools built tonight
(`tools/geometry-extractor.mjs`, `tools/wfc-adjacency.mjs`) are built on
top of a pipeline that a parallel, more advanced branch has already
replaced. The *algorithms* (connected-component silhouette extraction,
WFC edge-adjacency) don't exist anywhere on `rebuild/asset-index` — they're
novel, not duplicated work. But the *plumbing* they're wired into
(`assets/manifest.json` → `assets/analyzed-manifest.json` →
`assets/merged-manifest.json`) is the old architecture.

**This is a decision for a human or a session with more context on
project direction, not something I resolved unilaterally tonight:**
before doing more work here, decide whether to (a) port
`geometry-extractor.mjs`/`wfc-adjacency.mjs` onto `rebuild/asset-index`'s
SQLite index + `sharp` decoder, discarding the JSON-manifest pipeline
this branch extends, or (b) keep this branch's pipeline as an
intentionally separate track and merge/rebase later, or (c) something
else. I have not attempted a merge or rebase against `rebuild/asset-index`.

Other worktrees checked out right now, for reference:
```
UniversalAssetEdgeExtractor (root)                          5e3ff37 [master]
.claude/worktrees/analyzed-assets-samples-46b9b7             5e3ff37 [claude/analyzed-assets-samples-46b9b7]
.claude/worktrees/codebase-analysis-docs-443dcf              5e3ff37 [claude/codebase-analysis-docs-443dcf]
.claude/worktrees/geometric-connectivity-spec-eb8b72         a9ad0d8 [claude/geometric-connectivity-spec-eb8b72]  <- this one
.claude/worktrees/identify-session-fe4762                    5e3ff37 [claude/identify-session-fe4762]
.claude/worktrees/project-overview-005975                    e7cb0ab [rebuild/asset-index]
```
`project-overview-005975` is already sitting on `rebuild/asset-index`'s
tip — that worktree is the one to open if you want to look at that branch
directly rather than trust this summary.

---

## 2. What this project is

Turns Kenney.nl's free CC0 game-asset library into a machine-readable pack
a non-visual coding agent (OpenCode, or similar) can use without a human
describing every sprite by hand. Two tiers historically: Tier 1 (structural
pixel analysis, free, every asset) and Tier 2 (vision-model descriptions,
costs tokens, per-asset). `rebuild/asset-index` (see §1) has since grown
this into a full search index; this branch's work is additional Tier-1-style
structural analysis that isn't present there.

---

## 3. What was done on this branch, in order

1. **Wrote `docs/GEOMETRIC-CONNECTIVITY-SPEC.md`** — a spec for
   connected-component silhouette/outline extraction from sprite alpha
   channels. You (the user) chose this scope over tile-edge-matching when
   asked.
2. **Adversarially reviewed it** — an 86-agent find/refute/synthesize
   workflow found 3 blockers and 12 major/minor defects (a
   self-contradicting pipeline read/write path, a decoder wrong for
   indexed PNGs, a named algorithm that couldn't produce the promised
   output format, plus connectivity edge cases). All fixed in the doc.
   Full review at `docs/GEOMETRIC-CONNECTIVITY-SPEC_REVIEW_RESULT.md`.
3. **Verified the decoder risk against one real pack** before building
   anything — found it was worse than guessed (99.6% of a real pack was
   indexed PNG, not an edge case).
4. **Built `tools/geometry-extractor.mjs`**: 4-connected component
   labeling (with a diagonal-adjacency exemption so single-pixel-wide
   diagonal strokes don't get deleted as noise), boundary-edge-chaining
   contour tracing (an algorithm found *while building* that's simpler
   than what got reviewed — it naturally yields both outer and hole
   loops from one pass, classified by enclosed area, no separate
   background-labeling pass needed), RDP simplification with a vertex
   cap. `tools/test-geometry-extractor.mjs`: 7 fixture cases, all
   passing.
5. **Rewrote `decodePNG()` in `tools/local-analyzer.mjs`**: correct
   per-byte unfiltering for all 5 PNG filter types, bit-unpacking for
   1/2/4-bit indexed rows, `PLTE`+`tRNS` parsing, fixed a colorType-2
   byte-width bug. (See §1 — this exact set of bugs was independently
   found and fixed differently on `rebuild/asset-index`.)
6. **Mid-session, you asked for an addition**: Wave Function
   Collapse-style tile-adjacency data, scope-detected automatically
   across "all asset packs that can be interpreted in a WFC lens."
   Wrote `docs/WFC-TILE-ADJACENCY-SPEC.md` and
   `tools/wfc-adjacency.mjs`. Key finding: Kenney names every sprite
   export `tile_NNNN.png` regardless of content, so a directory-name
   blocklist (`character|enem|player|npc|hero|mob`) was necessary to
   stop character sprites from being scope-detected as terrain tiles.
   `tools/test-wfc-adjacency.mjs`: 8 fixture cases, all passing.
7. **Extracted all 53 downloadable 2D-category packs** (54 exist;
   `crosshair-pack` fails — pre-existing unfollowed-HTTP-307 bug in
   `tools/extract.mjs`, not fixed) and ran the full pipeline at real
   scale: 18,223 PNGs analyzed, 18,113 got geometry, 16,793 tiles went
   through WFC adjacency, no crashes.
8. **Two real defects found and fixed only by running at that scale** —
   see §4.
9. **Produced a contact sheet** for `isometric-blocks` (144 real PNGs,
   embedded as-is, checkerboard-backed thumbnails) as an Artifact:
   https://claude.ai/artifact/1ZnENWFv8PermW8YQEFR1F — private to your
   account, share it yourself if someone else needs the link.

---

## 4. Real defects found and fixed (not by re-reading code — by running it)

| # | Tool | What broke | How found | Fix | Result |
|---|---|---|---|---|---|
| 1 | `local-analyzer.mjs` decoder | Wrong pixels/alpha for indexed & sub-8-bit PNGs (99%+ of real packs) | Sampled real IHDR/PLTE/tRNS bytes directly, then ASCII-rendered a decoded sprite by hand to visually confirm | Rewrote the decoder (see §3.5) | Verified across all 18,223 real files, no decode errors |
| 2 | `geometry-extractor.mjs` | Stalled indefinitely at full-catalog scale (a set `local-analyzer.mjs` finishes in 40s never completed after 3+ min) | Ran it for real, killed it rather than waiting out an unexplained hang | Exact O(n²) max-separation search in the closed-contour split → O(n) 2-pass farthest-point heuristic, computed once per loop instead of once per epsilon-retry (was rerun up to 7×) | 1m43s for 18,113 files, no stall |
| 3 | `wfc-adjacency.mjs` | Output ballooned to 387MB across 43 packs, 168MB in one file | One 1632-tile icon pack: 1182 tiles shared one transparent-edge signature → ~1.4M near-meaningless pairs | Exclude transparent-edge-to-transparent-edge matches from the output (uniform *opaque* edges — real self-tiling terrain — still included) | 210K pairs (13× fewer), 76MB total (worst file 16MB) — improved, not fully solved |

---

## 5. Where things are

```
tools/local-analyzer.mjs           decodePNG() rewrite + exported, analyzeImage() unchanged
tools/geometry-extractor.mjs       connectivity/silhouette extraction (new)
tools/test-geometry-extractor.mjs  7 fixture tests (new)
tools/wfc-adjacency.mjs            WFC tile-adjacency extraction (new)
tools/test-wfc-adjacency.mjs       8 fixture tests (new)
tools/merge-analysis.mjs           +7 lines: copies geometry through untouched
docs/GEOMETRIC-CONNECTIVITY-SPEC.md            full spec, "Implemented" status, real measured numbers
docs/GEOMETRIC-CONNECTIVITY-SPEC_REVIEW_RESULT.md   the adversarial review's findings
docs/GEOMETRIC-CONNECTIVITY-SPEC_VERIFY_PROMPT_CURSOR.md   outside-tool verification prompt (unused so far)
docs/WFC-TILE-ADJACENCY-SPEC.md    full spec, real measured numbers, explicitly flagged as not yet adversarially reviewed
package.json                       +5 scripts: analyze, geometry, test-geometry, wfc-adjacency, test-wfc-adjacency
.gitignore                         +1 line: assets/wfc/ (generated, like the other manifest outputs)
```

Generated, gitignored, currently on disk in this worktree only (not
committed, will vanish if the worktree is cleaned): `assets/experimental/`
(55 extracted packs, ~120MB), `assets/analyzed-manifest.json`,
`assets/wfc/*.json` (76MB across 43 files).

### Commands
```bash
npm run extract -- <slug>      # download + extract one pack
npm run analyze                # local-analyzer.mjs -> assets/analyzed-manifest.json
npm run geometry                # geometry-extractor.mjs, adds `geometry` per file
npm run wfc-adjacency            # wfc-adjacency.mjs, adds `wfcSocket` per file + assets/wfc/<pack>.json
npm run test-geometry            # 7 fixture tests
npm run test-wfc-adjacency       # 8 fixture tests
```

---

## 6. Potential applications

- **Physics/collision data for a game engine.** The `geometry` block's
  simplified polygon outlines are close to what you'd hand a 2D physics
  engine (Matter.js, Box2D) as a collider shape — not convex-decomposed
  yet (explicitly out of scope), but the hard part (accurate silhouette
  from alpha) is done.
- **"Is this sprite actually one piece" queries for an agent building a
  game** — `isConnected`/`componentCount` answers a question OpenCode
  currently can't answer at all from the manifest.
- **Procedural level/building generation** (your original ask) — the WFC
  adjacency data is the direct input format a Wave Function Collapse
  solver needs (which tiles can legally sit next to which, per direction).
  No solver was built — this is the constraint data a solver would
  consume, not the generator itself.
- **A `merged-manifest.json` query surface** for a non-visual agent: once
  Tier 2 vision descriptions exist for a pack (they don't yet in this
  worktree — no `enriched-manifest.json` present), `merge-analysis.mjs`
  now carries `geometry` through to the final file an agent would query.
- **If reconciled with `rebuild/asset-index`** (see §1): both tools'
  actual algorithms could run against `sharp`-decoded pixels and write
  into the SQLite index instead of a JSON manifest, making shape/adjacency
  data queryable via the same `assets search`/MCP surface as everything
  else, rather than living in a separate file tree.

---

## 7. Other observations

- The repo has **6 branches and 6 worktrees** active right now (listed in
  §1). Anyone picking this up should check what else is in flight before
  assuming this branch's view of the codebase is current — it wasn't,
  which is the whole reason §1 exists.
- `tools/extract.mjs` has a real, unrelated bug: it doesn't follow HTTP
  redirects, so any Kenney URL that 307-redirects (only `crosshair-pack`
  observed so far) fails silently rather than erroring loudly. Not fixed.
- `assets/manifest.json` (checked into git, built by `tools/build-manifest.mjs`)
  is missing entries for at least 7 packs that exist on Kenney and were
  successfully extracted tonight (`1-bit-platformer-pack`,
  `animal-pack-remastered`, `playing-cards-pack`,
  `simplified-platformer-pack`, `space-shooter-remastered`,
  `top-down-tanks-remastered`, `ui-pack-rpg-expansion`) — a pre-existing
  gap, not something introduced tonight, found while compiling an asset
  list for you earlier in this session.
- Both new specs are explicit about what's Trusted vs. Verified and what's
  still an open question (vertex-cap tuning, WFC blocklist not manually
  spot-checked across all 43 qualifying packs, etc.) — read the "Open
  questions" section of each before treating any constant in them as
  settled.

---

## 8. Suggested next steps, in order

1. **Resolve §1** — decide whether this branch's tools get ported onto
   `rebuild/asset-index`'s architecture or stay on their own track. This
   blocks everything else being worth doing.
2. If staying on this branch's architecture: sample a couple more of the
   43 WFC-qualifying packs by hand to check the directory blocklist isn't
   missing a false positive/negative.
3. Consider the deferred WFC output-format fix (signature-bucket
   representation instead of enumerated pairs) — noted in the spec as
   identified but not built.
4. Regenerate `assets/manifest.json` to pick up the 7 missing packs found
   in §7, if this pipeline is going to keep being used.
