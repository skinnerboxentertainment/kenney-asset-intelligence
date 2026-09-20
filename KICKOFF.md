# Kickoff: Kenney Asset Intelligence — Consolidation Build

Read this first, in a fresh session, before touching anything else in this
repo. It is meant to be self-contained — you should not need the
conversation that produced it.

---

## 1. What this project is

A queryable index over Kenney.nl's CC0 game-asset corpus (223 packs,
~61,000 files), built so an agent or a human can go from "I need a road
piece that connects north-south" to files on disk without opening every
image by hand. One SQLite database (`index/assets.db`), enrichment tiers
added as columns, everything keyed by `(pack, path)`.

This repo is a **fresh, clean seed**, snapshotted from a more mature branch
of a messier sibling project (`UniversalAssetEdgeExtractor`) that had
accumulated five separate, overlapping, mutually-unaware efforts against
the same corpus. Full history of how that was discovered and audited is in
`docs/PROVENANCE.md` (write it if it doesn't exist yet — see §6). The short
version: one of those five efforts (this one) survived an audit; the other
four did not, or contain pieces worth porting in. That porting is most of
this repo's open work.

## 2. Current state — verified, not assumed

Run these yourself before trusting anything below; this file can go stale.

```bash
npm install
node bin/assets search "health pickup heart" --limit 5   # should return real hits
node bin/assets eval                                       # recall@10 baseline
sqlite3 index/assets.db "SELECT COUNT(*) FROM assets"       # should be 61,565
```

As of the snapshot:
- `index/assets.db` — present, gitignored (regenerable, but copied in as a
  working seed so you don't start from zero). 61,565 rows, 223 packs.
- 7,458 rows have real vision descriptions (`observed` column) — genuinely
  written by looking at the images, not filename-templated. Verify this
  claim yourself if you touch that tier: `sqlite3 index/assets.db "SELECT
  observed FROM assets WHERE observed IS NOT NULL LIMIT 10"` and read a few.
- `assets eval` — an honest recall@10 harness against hand-labeled queries.
  Baseline at snapshot time: 95% lexical, 60% semantic. Do not let this
  regress without knowing why.
- No WFC/adjacency/geometry data exists in this DB yet. That is Phase 1
  below, not done.

## 3. Why this repo exists (context you need, compressed)

A prior session set out to check "have these Kenney assets actually been
analyzed." They had not — a pipeline had self-reported `"status":
"vision_complete"` while 83.6% of its 27,040 descriptions were
filename-templated fraud (`"Tile environment tile, 16x16 px..."` applied to
every image in a folder regardless of content). That pipeline is dead.

Investigating further surfaced four *other* efforts against the same
corpus, built in different sessions with no visibility into each other:

1. A hand-built v2 pilot (2 packs, real but small, no regression harness).
2. **This branch** — the one snapshotted into this repo. Verified live: a
   real SQLite index, working full-text search, and — critically — an
   eval harness whose own README says, verbatim: *"The project this
   replaces reported '27,048 images analyzed (100%)' as its success metric
   while the decoder mangled every indexed PNG."* It already knows about
   the fraud and was built to prevent a repeat.
3. A sibling branch with real, tested pixel-edge-adjacency and silhouette
   extraction for Wave-Function-Collapse-style procedural generation —
   built on an old JSON-manifest pipeline and a hand-rolled PNG decoder
   that had the same bugs this branch already fixed with `sharp`,
   independently. Its algorithms are worth porting; its plumbing is not.
4. A **separate, unrelated project** (`RetroAIGames`, different repo
   entirely) with its own 225-pack corpus, sharing an unexplained overlap
   with this one: the *identical* 7 fully-described packs, near-identical
   schema field names. Nobody has explained why yet. Explicitly out of
   scope for this repo's build — flagged for a later, wider conversation,
   not resolved here.

A full audit trail — the fraud rate calculation, the live DB verification
queries, a pixel-vs-vision reconciliation experiment run against
`desert-shooter-pack` (2,970 adjacency pairs, 2,547 confirmed, 423 flagged
as real disagreements, including one case where the disagreement caught an
error in the vision pass itself, not the pixel pass) — exists only in that
prior conversation, not as a committed doc yet. If you need it, ask the user
for the conversation or its exported findings; don't reconstruct it from
guesswork.

## 4. The build, in phases

### Phase 1 — Port geometry + WFC adjacency onto this DB

Source algorithms are already staged in this repo at
`vendor/geometric-connectivity-spec-eb8b72/` (`tools/geometry-extractor.mjs`,
`tools/wfc-adjacency.mjs`, both test files, and the three spec/handoff docs
that explain the design decisions and real gotchas — read those before
porting, don't re-derive them from the code alone). Port them into this
repo's real `tools/` directory, re-pointed at `sharp`; the `vendor/` copies
are reference snapshots, not meant to run as-is or be edited in place.

- Re-point their PNG decoding from the old hand-rolled `decodePNG()` to
  this repo's existing `sharp`-based decoder (see how `assets analyze`
  already does structural decoding — reuse that path, don't add a second
  one).
- New columns on `assets`: `wfc_top`, `wfc_right`, `wfc_bottom`,
  `wfc_left` (quantized edge-signature strings), `geometry_json`
  (silhouette/outline, vertex-capped).
- New table `wfc_adjacency(pack, direction, tile_a, tile_b)`.
- Port both fixture test suites (7 + 8 cases). They must pass — that is
  the phase's oracle, not a status message.
- Known real gotchas from the source branch, already solved there, don't
  re-solve them differently: (a) Kenney names every sprite `tile_NNNN.png`
  regardless of content, so eligibility for "is this terrain" scope-
  detection needs a directory-name blocklist
  (`character|enem|player|npc|hero|mob`), not a keyword allowlist; (b)
  exclude fully-transparent-edge matches from the adjacency list (they
  dominate output by combinatorics — one 1632-tile pack had 72% of tiles
  sharing one transparent signature — without carrying real "this art
  continues" signal); uniform *opaque* edges stay included, only the
  all-transparent case is excluded.

### Phase 2 — Reconciliation tier

Cross-check Phase 1's pixel-signature adjacency against the semantic tier's
`role` (or a coarser derived family if `role`'s existing vocabulary is too
granular — check its actual cardinality in the live DB before adding a new
column; don't assume one is needed).

- New tool, new table `reconciliation(pack, tile_a, tile_b, direction,
  verdict, reason)`. Verdict is `confirmed` / `conflict` / `vision_only` /
  `unresolved` — never silently auto-resolved to one side.
- Acceptance case: run it against `desert-shooter-pack` once that pack has
  real semantic coverage (it doesn't yet in this DB). Real, verified
  descriptions for it already exist at
  `vendor/v2-pilot-46b9b7/desert-shooter-pack.json` (504 images, all 5
  subfolders) — import that data rather than redoing the vision pass from
  scratch. Expect roughly 80-86% confirmed, the rest flagged, zero
  unresolved once description coverage is complete for that pack. If your
  numbers are wildly different, that's a signal to investigate, not a
  number to force-match.

### Phase 3 — Kit-connector schema for build-from-pieces packs

For packs that are actually interlocking kits (roads, dungeons, modular
buildings) rather than loose sprite collections: add relational
connector/socket data (which edge connects to which, `pairsWith`) as
additive, nullable schema — scoped to kit packs only, not blanket across
the whole catalog. `city-kit-roads` (72 pieces) already has a verified,
hand-built version of this at
`vendor/v2-pilot-46b9b7/city-kit-roads.json` — a full connector graph
(which edge on which piece connects to which role), zero duplicate
descriptions, zero dangling references. Port that data in as the first
real example rather than designing the schema from zero.

### Phase 4 — Prove it, then let old copies go

Once Phases 1-3 have their oracles passing (fixture tests green, `assets
eval` not regressed, the reconciliation acceptance case reproducing
expected shape), the older, now-superseded artifacts in the sibling
`UniversalAssetEdgeExtractor` repo (the v1/v2 JSON manifests, the
geometric-connectivity branch's own JSON-manifest outputs) can be treated
as retired. Don't delete anything in that other repo from this one without
the user present — that repo isn't yours to clean up unilaterally from
here.

## 5. What NOT to do

- Don't re-run vision enrichment on packs that already have real
  descriptions without checking first — `assets audit` and the `audited`/
  `audited_at` columns exist specifically so "has a human/agent actually
  checked this claim against the pixels" is answerable, use it.
- Don't trust a self-reported completion status over a live query. That is
  the entire reason this repo exists instead of the pipeline it replaced.
- Don't touch the `RetroAIGames` project or try to explain its overlap with
  this one — out of scope, flagged for later, not yours to resolve.
- Don't expand `assets eval`'s baseline claims without re-running it and
  quoting the real number.

## 6. First things to do in a fresh session

1. Run the verification commands in §2. Confirm this file's claims are
   still true; if not, note the drift before proceeding.
2. Write `docs/PROVENANCE.md` capturing where this repo came from (this
   file can be the seed for it, but PROVENANCE.md should be the permanent
   home — KICKOFF.md is a one-time briefing, not a living doc).
3. Ask the user for the geometry-extractor/wfc-adjacency source files
   (Phase 1's dependency) if they aren't already staged in this repo —
   they live in a sibling project's git history, not this one's.
4. Start Phase 1.
