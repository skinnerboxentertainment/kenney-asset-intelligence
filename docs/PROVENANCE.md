# Provenance

Where this repo came from, and why it exists instead of the pipeline it
replaced. This is the permanent home for that history — `KICKOFF.md` was a
one-time briefing for the session that seeded this repo and should be
treated as historical from here on, not re-edited as the living record.

## The corpus

Kenney.nl's CC0 game-asset packs. At last catalog refresh (`catalog/catalog.json`,
generated 2026-08-30): 212 packs tracked in the catalog. The live index
(`index/assets.db`) covers 223 packs, 61,565 files, keyed by `(pack, path)`.

## What this repo replaced

A prior pipeline self-reported `"status": "vision_complete"` while 83.6% of
its 27,040 descriptions were filename-templated fraud — the same boilerplate
sentence (`"Tile environment tile, 16x16 px..."`) applied to every image in a
folder regardless of what was actually in it. That pipeline is dead; nothing
in this repo depends on its output.

Investigating that fraud surfaced four other efforts against the same
corpus, built in different sessions with no visibility into each other, all
living in a sibling repo (`UniversalAssetEdgeExtractor`) or elsewhere:

1. **Hand-built v2 pilot** — 2 packs (`desert-shooter-pack`,
   `city-kit-roads`), real per-image descriptions and a hand-built
   kit-connector graph, but small and with no regression harness. Its data
   is staged in this repo at `vendor/v2-pilot-46b9b7/` for porting in
   (Phase 2 and Phase 3 below), not for running as-is.
2. **This branch** — the one snapshotted into this repo. Verified live at
   snapshot time: a real SQLite index, working full-text + semantic search,
   and an eval harness whose own README states, verbatim: *"The project
   this replaces reported '27,048 images analyzed (100%)' as its success
   metric while the decoder mangled every indexed PNG."* Built specifically
   to prevent a repeat of that failure mode.
3. **Geometric-connectivity branch** — real, tested pixel-edge-adjacency and
   silhouette extraction for WFC-style procedural generation, built on an
   old JSON-manifest pipeline and a hand-rolled PNG decoder that had the
   same decoding bugs this branch already fixed independently with `sharp`.
   Its algorithms are worth porting; its plumbing is not. Staged in this
   repo at `vendor/geometric-connectivity-spec-eb8b72/` (source `tools/`,
   both fixture test suites, and the spec/handoff docs) for Phase 1.
4. **`RetroAIGames`** — a separate, unrelated project (different repo
   entirely) with its own 225-pack corpus, sharing an unexplained overlap
   with this one: the identical 7 fully-described packs, near-identical
   schema field names. Nobody has explained why yet. **Explicitly out of
   scope for this repo's build** — flagged for a later, wider conversation,
   not resolved here, and not to be touched from this repo.

A full audit trail (fraud-rate calculation, live-DB verification queries, a
pixel-vs-vision reconciliation experiment against `desert-shooter-pack`:
2,970 adjacency pairs, 2,547 confirmed, 423 flagged as real disagreements,
including one case where the disagreement caught an error in the vision
pass itself) exists only in the conversation that produced `KICKOFF.md`, not
as a committed artifact. If it's needed, ask the user for that conversation
or its exported findings — don't reconstruct it from guesswork.

## Verification log

Re-run the commands below yourself before trusting these numbers; this
section goes stale the moment the DB changes.

| Check | KICKOFF.md claim | Verified 2026-09-20 |
|---|---|---|
| Row count | 61,565 | 61,565 (`SELECT COUNT(*) FROM assets`) |
| Distinct packs | 223 | 223 |
| Rows with real `observed` vision descriptions | 7,458 | 7,458 — spot-checked 5, all content-specific, not filename-templated |
| `assets search "health pickup heart" --limit 5` | returns real hits | confirmed — 5 relevant heart/health tiles across 3 packs |
| `assets eval` recall@10 | baseline "95% lexical, 60% semantic" | **94.4% overall** — 96% lexical (177/184), **100% semantic** (70/70), 80% intent (40/50). Semantic recall has improved substantially since the KICKOFF snapshot; treat the "60% semantic" figure in KICKOFF.md as stale, not as a regression target. |

Note on environment: `index/assets.db` is gitignored (regenerable release
artifact per plan Phase 5, not yet committed while it churns) and therefore
does **not** carry over into a fresh git worktree — only the main checkout
had it. It was copied from the main checkout into this worktree's `index/`
directory to run the verification above; this is expected worktree
behavior, not data loss, and anyone starting fresh work in a new worktree
should do the same (or run `assets build`, which requires the raw corpus,
kept outside this repo).

## Phase 1 — shipped 2026-09-20

Ported both algorithms staged at `vendor/geometric-connectivity-spec-eb8b72/`
onto this repo's real SQLite + `sharp` architecture, per `KICKOFF.md` §4
Phase 1. Landed as 5 checkpointed commits: schema/migration, a shared
`lib/concurrency.mjs` extraction, the geometry tool, the WFC-adjacency tool,
this update.

**What shipped:**
- `assets geometry [--packs a,b] [--force]` — connected-component silhouette
  extraction (`tools/index/geometry.mjs`), writing `geometry_json` per asset.
- `assets wfc-adjacency [--packs a,b] [--force]` — WFC tile-edge-adjacency
  extraction (`tools/index/wfc-adjacency.mjs`), writing the four `wfc_*`
  socket columns per tile and populating the new `wfc_adjacency(pack,
  direction, tile_a, tile_b)` table.
- Both algorithms are logically unchanged from the vendor source. The only
  code changes were the I/O layer (sharp instead of the vendor's hand-rolled
  `decodePNG()`, SQLite instead of a JSON manifest) and making
  `computeGroupWFCData` async, since sharp decodes asynchronously and the
  vendor's decoder didn't.

**Oracle, per KICKOFF's own framing ("must pass, not a status message")**:
both fixture suites ported with zero logic changes (import path only) —
`tools/index/test-geometry.mjs` 7/7 pass, `tools/index/test-wfc-adjacency.mjs`
8/8 pass.

**Real-data verification** (`ASSETS_ROOT` pointed at the sibling
`UniversalAssetEdgeExtractor` repo's extracted corpus, read-only):

| Check | Original spec doc | This port | Verdict |
|---|---|---|---|
| Geometry: files with `componentCount > 1` (pixel-platformer + pixel-line-platformer) | 7 | 7 | exact match |
| Geometry: `MAX_OUTLINE_VERTICES` overflow on the 180-component tilemap sheet | 126 verts | 126 verts | exact match |
| WFC: tile counts per group | 180 / 24 / 60 (264 total) | 180 / 24 / 60 (264 total) | exact match |
| WFC: adjacency pairs | "8,301" cited in the spec doc | 2,546 stored | **investigated, see below** |

The pair-count line looked like a real discrepancy, not a rounding
difference, so it was checked rather than waved off: recomputing directly
from this port's own stored socket data, the *pre*-transparent-exclusion
pair count is exactly 8,301 (confirms this port's pixel decoding is
bit-identical to the vendor decoder — that's what makes a derived count
match exactly) and the *post*-exclusion count — what the tool actually
stores, per the transparent-edge fix the spec doc itself documents — is
2,546. The spec doc's "8,301" was the pre-fix number from its initial
2-pack validation run; the fix was verified afterward only at full-catalog
scale (43 packs) and the 2-pack figure was never restated. 2,546 is the
correct, expected output of a correctly-fixed implementation, not a bug in
this port.

**Regression check**: `assets eval` unchanged at 94.4% recall@10 after the
schema migration; `assets search` returns the same real hits as before.

**Deviations from the plan**: none of substance. The async-ification of
`computeGroupWFCData` (noted above) wasn't anticipated in the original
`KICKOFF.md` phase description but is a mechanical consequence of using
`sharp`, not a design change, and isn't exercised by the ported test suite.

**Not done in this pass** (by design, out of scope for Phase 1): a full
223-pack/61k-file production run of either tool — verification was scoped to
the two packs the original spec doc itself measured, which gave a stronger,
falsifiable oracle than an unverified full-catalog run would have. Running
`assets geometry`/`assets wfc-adjacency` catalog-wide is a natural fast
follow whenever it's wanted; both commands are idempotent (skip
already-processed rows/packs unless `--force`) so it can be done incrementally.

## Open work

See `KICKOFF.md` §4 for the phase breakdown (geometry/WFC adjacency [done,
above] → reconciliation tier → kit-connector schema → retire superseded
artifacts). This file will be updated as each phase lands with what actually
shipped, including any deviation from the plan and why.
