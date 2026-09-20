# Geometric Connectivity Spec

Status: **Implemented** (`tools/geometry-extractor.mjs`, `tools/test-geometry-extractor.mjs`)
Owner: Universal Asset Edge Extractor pipeline (Tier 1, structural analysis)

Revised after an adversarial review (86-agent find/refute/synthesize pass;
see [GEOMETRIC-CONNECTIVITY-SPEC_REVIEW_RESULT.md](GEOMETRIC-CONNECTIVITY-SPEC_REVIEW_RESULT.md))
that found 3 blockers and 12 major/minor defects, all fixed. Then built and
verified: decoder fix confirmed against a 429-PNG, 5-pack, 4-category real
catalog sample (99.6% indexed in one pack, format mix varies sharply by
category — see Section 0); `tools/geometry-extractor.mjs` implemented, its
7-case Tier A test suite (`tools/test-geometry-extractor.mjs`) passes, and a
real-catalog smoke run against those 429 files produced sane, visually
spot-checked output (see "Implementation notes" below the algorithm).

**One deviation from the reviewed design, found while implementing:** hole
detection no longer uses the background-connected-component-labeling +
point-in-polygon approach Section 3 originally specified post-review.
Building it surfaced a simpler, more robust equivalent: extract every
boundary edge of a component's own labeled pixels (an edge exists wherever
the neighbor pixel doesn't share the exact same label — background, a
different component, *or* a hole, all trigger it identically) with a
consistent per-edge orientation, then chain matching edges into closed
loops. This yields both the outer boundary and every hole boundary from one
pass, with hole/outer classified by which loop encloses more area — no
separate background labeling pass, no bbox pre-filter, no point-in-polygon
step. It's implemented in `tools/geometry-extractor.mjs`'s `traceLoops()`
and is what Section 3 below now describes. This is a genuine improvement,
not a shortcut: it removes an entire algorithm stage the review's defect #6
was about, while producing the same output.

## Problem

The current analyzer (`tools/local-analyzer.mjs`) treats "edge" as the literal
border row/column of pixels — it compares the left/right and top/bottom pixel
strips of an image to score tileability. It says nothing about the *shape* of
the content inside the sprite: how many disconnected visual parts an asset
has, what its silhouette actually looks like, or whether that silhouette has
holes. An agent building a game from these assets can't currently answer
"is this one solid sprite or does it have a detached piece," or "what's the
outline I'd hand to a physics engine for this platform tile."

Geometric connectivity extraction closes that gap: given a sprite's alpha
channel, derive its connected-component structure and the polygon outline(s)
of each component, using the same zero-dependency, pure-Node.js approach as
the existing analyzer.

## Scope

In scope:
- Per-image connected-component labeling of the non-transparent region, for
  **2D-category files only** (`pack.category === "2D"`, per the manifest's
  existing category field), excluding pack-level `Preview.png`/`Sample.png`
  composites. 3D-category packs' texture atlases / UV colormaps have no
  meaningful "silhouette" and are out of scope — found during
  implementation, see "Scope addition" under Validation plan below.
- Polygon contour extraction (outer boundary, plus inner boundaries for
  holes) for each component.
- Contour simplification to a compact vertex list.
- A JSON schema addition to the manifest, produced by a new pipeline tool.

Out of scope (explicitly not solved by this spec):
- Convex decomposition or physics-engine-ready collision shapes (the output
  is a simple polygon; turning concave polygons into convex sub-shapes is a
  downstream consumer's job, e.g. via a Box2D/Matter.js triangulator).
- Skeleton/medoid extraction, corner/feature detection beyond the outline.
- Cross-sprite connectivity (e.g. "do these two tiles interlock") — that is
  the tile-matching problem already partially covered by `tileScore` and is
  a separate spec if pursued.
- Vector (SVG) export — JSON polygon coordinates only, for now.

## Algorithm

### 0. Decoder prerequisite (blocking — must land before Section 1 is implemented)

**Verified against the real catalog** (sampled 2026-09-20 by extracting the
`pixel-platformer` pack — 240 PNGs, IHDR/PLTE/tRNS bytes read directly, not
assumed): 239/240 files (99.6%) are colorType 3 (indexed), and of those,
237/240 overall (98.75%) are **sub-8-bit indexed** (1-, 2-, or 4-bit
palette). Only 1 file (0.4%) is colorType 6 (RGBA) — the one format
`decodePNG()` decodes correctly. 186/240 (77.5%) carry a `tRNS` chunk.

This means the decoder problem is worse than "missing alpha on an edge
case." `decodePNG()` parses `bitDepth` from IHDR (`local-analyzer.mjs:26`)
but never uses it — `bytesPerPixel` and `rawRowLen`
(`local-analyzer.mjs:34-35`) unconditionally assume 1 byte per pixel-index
for colorType 3, i.e. 8-bit indexed. For a 1/2/4-bit indexed PNG, palette
indices are bit-packed multiple-per-byte, so the row length and every pixel
read after the first are misaligned: **not just wrong alpha, but wrong
pixel data entirely**, for 98.75% of this real pack. Combined with the
alpha-hardcoding bug (`local-analyzer.mjs:49-52`, `a = 255` for colorType 0
and 3, `tRNS` never parsed), an unmodified `decodePNG()` produces
meaningless geometry for essentially the whole catalog, not a rectangle
approximation — this is not survivable as a "latent risk," it blocks
Section 1 outright.

Before Algorithm §1 is implemented, resolve this one of two ways:
- **(a)** Extend `decodePNG()` (or a geometry-local copy of it) to
  bit-unpack 1/2/4-bit indexed rows per PNG's spec, and parse `PLTE` +
  `tRNS` for colorType 3 and `tRNS` for colorType 0. Given the measured
  99.6% indexed-PNG rate, this is now the recommended default, not option
  (a) of two coequal choices.
- **(b)** Detect colorType 0/3 or sub-8-bit depth up front and skip/flag
  those files (emit `geometry: null` with a `reason` field) — given the
  measured rate, this would leave geometry data for well under 1% of the
  catalog and is not a viable v1 strategy on its own; only worth keeping as
  a fallback for whatever residual format (a) doesn't cover.

The Validation plan (below) includes fixtures that would fail against an
unmodified decoder, so this cannot be silently skipped.

Also not handled by `decodePNG()` as written: interlaced (Adam7) PNGs —
every sampled file had `interlace = 0` (non-interlaced), so this remains a
latent risk, not a measured blocker; note it and revisit if a broader
catalog sample surfaces an interlaced file.

**Reuse mechanism:** `local-analyzer.mjs` has no `export` statement and calls
`main()` unconditionally at file scope, so `import { decodePNG } from
"./local-analyzer.mjs"` would execute that script's `main()` as a side
effect. `geometry-extractor.mjs` must NOT import from `local-analyzer.mjs`
as-is. Either add `export { decodePNG }` to `local-analyzer.mjs` and guard
its `main()` call behind an entry-point check (`import.meta.url ===
\`file://${process.argv[1]}\``), or duplicate the decode logic directly in
`geometry-extractor.mjs`. This spec assumes the former (a shared, exported
decoder) as the default; state explicitly in the implementing PR which was
chosen.

### 1. Binarize

Using the decoded RGBA buffer from the (now-exported, alpha-correct)
`decodePNG()`, a pixel is **foreground** if `alpha >= ALPHA_THRESHOLD`
(default `ALPHA_THRESHOLD = 16`, i.e. treat near-fully-transparent
anti-aliasing fringe as background). This threshold is a named constant so it
can be tuned per-pack later; it is not exposed as a CLI flag in v1.

### 2. Connected-component labeling

Flood-fill (BFS/queue, not recursive — sprites run up to 512×512+) over the
binary mask using **4-connectivity** for foreground pixels. Standard
digital-topology practice pairs 4-connected foreground with 8-connected
background (or vice versa) to avoid the connectivity paradox where a
foreground contour crosses itself at a diagonal pinch point; foreground gets
4-connectivity here because it produces cleaner, non-self-intersecting outer
contours for pixel-art sprites, which is what downstream consumers need most.

Each component gets: a sequential id, pixel count (area), and a bounding box.

**Diagonal-adjacency exemption (required, not optional):** 4-connectivity
alone would shred an intentional single-pixel-wide diagonal stroke (e.g. a
strap, whisker, or staircase edge — pixels at `(0,0),(1,1),(2,2),(3,3)`) into
four separate area-1 components, none of which touch under a strict 4-neighbor
test, all of which the size filter below would then delete — turning a sprite
with real content into a reported `componentCount: 0`. Before applying the
size filter, re-merge any 4-connected components that are 8-adjacent to each
other (i.e. touch only at a corner) into a single component for the purposes
of `MIN_COMPONENT_PX` — but keep their *contours* traced independently per
Section 3's per-label restriction, so this merge affects only the size-filter
survival check, not the shape output.

After that merge step, components below `MIN_COMPONENT_PX = 4` pixels are
dropped as noise (stray anti-aliased pixels, not intentional shapes) and do
not appear in output.

### 3. Contour tracing

**As implemented** (`traceLoops()` in `tools/geometry-extractor.mjs`), this
replaces both the original Moore-neighbor-tracing description and the
post-review background-CC-labeling hole design with one simpler algorithm:
**boundary-edge extraction + loop chaining.**

For a target component's label, walk every pixel that carries that label.
For each of its 4 sides, if the neighboring pixel does *not* carry the exact
same label — whether that neighbor is background, a different component, or
a hole — emit that grid edge, oriented consistently (clockwise around the
labeled region, in screen coordinates: top edges left-to-right, right edges
top-to-bottom, bottom edges right-to-left, left edges bottom-to-top). This
produces pixel-*corner* coordinates natively — a filled 8x8 square at
`(0,0)` yields the 4-point loop `[[0,0],[8,0],[8,8],[0,8]]` (up to rotation)
— with no center-to-corner conversion step, and no risk of one component's
trace bleeding into a diagonally-touching different component, since an edge
is only emitted where the neighbor's label doesn't exactly match the target
label being traced.

Because testing against the *exact* label (not generic "foreground") is
what emits an edge, this single pass naturally produces **both** the outer
boundary loop and every hole's boundary loop — a hole is just background
pixels whose neighbor-across-the-edge has the target label, geometrically
identical to the outer-boundary case. Chain the extracted edges into closed
loops by following each edge's endpoint to the next edge starting there.
Classify loops by enclosed area (shoelace formula): the loop with the
largest `|area|` is the outer boundary; every other loop is a hole. This
needs no separate background-connected-component pass, no bbox pre-filter,
and no point-in-polygon test — it falls out of the edge-orientation
convention for free, and is O(pixels) once per component with no per-hole
multiplier.

Contours — both outer boundaries and holes — are produced as pixel-grid
polygons: a list of `[x, y]` integer coordinate pairs tracing pixel corners
(not centers), matching the array-pair format used throughout the Output
schema below.

### 4. Simplification

Run Ramer–Douglas–Peucker on each traced contour with
`SIMPLIFY_EPSILON = 1.0` (in pixel units). RDP is defined on an open
polyline with two fixed endpoints; a traced contour is closed (starts and
ends at the same corner), so split each contour into two open polylines
before running RDP: pick the two vertices with maximum Euclidean separation
as the split points, run RDP independently on each half, then rejoin. This
avoids a degenerate zero-length anchor chord at the trace's start/end seam.

This collapses the redundant collinear points that pixel-grid tracing
produces on straight edges while preserving actual corners. The claim that
this yields an 80-95% vertex-count reduction is **not measured** and is
known to be optimistic for non-rectangular silhouettes: RDP only collapses
points within `epsilon` of their chord, and a pixel-grid staircase
approximating a diagonal or curved edge (round characters, wheels — both
present in the target Kenney catalog) deviates from its chord by roughly
0.5-1px per step, the same order as `SIMPLIFY_EPSILON = 1.0`, so reduction
on curved/diagonal silhouettes will be materially lower than on the
axis-aligned worked example above. Treat 80-95% as an upper bound for
rectilinear content, not a general expectation; get a measured distribution
from a real catalog run before relying on it (see Output schema note on
vertex caps below). Epsilon is a named constant, tunable later, not a v1 CLI
flag.

### 5. Output normalization

Coordinates are emitted in image pixel space, origin at top-left, matching
the convention already used by `size: { w, h }` elsewhere in the manifest.
No re-centering or scaling — a downstream consumer that wants
sprite-local/centered coordinates can subtract `(w/2, h/2)` itself.

## Output schema

Adds a `geometry` block alongside the existing `analysis` block on each file
entry in `analyzed-manifest.json`:

```json
{
  "geometry": {
    "componentCount": 1,
    "isConnected": true,
    "components": [
      {
        "id": 0,
        "area": 6421,
        "bbox": { "x": 12, "y": 4, "w": 40, "h": 58 },
        "outline": [[12,4],[52,4],[52,62],[12,62]],
        "holes": []
      }
    ]
  }
}
```

- `componentCount` / `isConnected` are hoisted to the top of the block
  because "is this sprite one piece" is the single most common query and
  shouldn't require iterating `components`. Rule, stated explicitly:
  `isConnected` is `true` if and only if `componentCount === 1`.
- `outline` is the simplified outer contour, `holes` is a list of simplified
  inner contours, each a list of `[x, y]` integer pairs (same format as
  `outline`) tracing pixel corners, empty array when none.
- `componentCount: 0, isConnected: false, components: []` covers **two**
  distinct causes, not one: a fully-transparent image (zero foreground
  pixels), and an image whose only foreground content was entirely below
  `MIN_COMPONENT_PX` and dropped as noise. Both produce the same output
  shape by design — a consumer only needs "was there usable shape data,"
  not which case it was — but implementers should not assume
  `componentCount: 0` implies zero non-transparent pixels existed in the
  source image.
- **Vertex volume cap:** because this block is inlined into
  `merged-manifest.json`, the file an LLM agent queries directly (see
  README), an uncapped `outline`/`holes` vertex list risks bloating that
  manifest across ~27,000 entries, especially since Section 4's compaction
  claim is unmeasured for curved/diagonal silhouettes. Cap each component at
  `MAX_OUTLINE_VERTICES = 64` total across `outline` + all `holes`; if RDP at
  `SIMPLIFY_EPSILON = 1.0` still exceeds the cap, re-run RDP on that
  component with successively larger epsilon until it fits, and record the
  epsilon actually used as `simplifyEpsilon` on the component. No fallback
  to bbox-only representation in v1 — if this cap proves too aggressive once
  measured against the real catalog, revisit; log (don't silently drop) any
  component that still exceeds the cap after epsilon escalation, to be
  caught by the validation script below rather than shipped unnoticed.

## Pipeline integration

New tool: `tools/geometry-extractor.mjs`, mirroring `local-analyzer.mjs`'s
structure (same manifest-walk shape, same `\r`-progress output, same
`node:fs`/`node:zlib` decoder — no new dependency).

- Run order: `local-analyzer.mjs` (writes `assets/manifest.json` →
  `assets/analyzed-manifest.json` with the `analysis` block added) runs
  **first**. `geometry-extractor.mjs` runs **second**: it reads
  `assets/analyzed-manifest.json` (not `manifest.json` — reading the raw
  manifest would skip past the `analysis` block `local-analyzer.mjs` just
  wrote), adds `geometry` onto each file entry, and writes back to the same
  `assets/analyzed-manifest.json` path, so the file accumulates both blocks.
  `merge-analysis.mjs` runs third and reads that accumulated file. (Earlier
  drafts of this section named `assets/manifest.json` as
  `geometry-extractor.mjs`'s input, which is incompatible with the
  "fields accumulate" run-order claim in the same paragraph; the above is
  the corrected, single source of truth. If run-order independence turns out
  to matter later, switch both tools to read `manifest.json` and deep-merge
  on `file.path` instead of relying on file accumulation — not needed for
  v1 since the pipeline is already sequential per `README.md`'s Architecture
  diagram.)
- `merge-analysis.mjs` is extended to copy `aFile.geometry` onto the merged
  output untouched (no correction/inference needed — geometry is measured,
  not guessed, unlike the `description.*` fields it currently derives).
  Note: this copy relies on `merge-analysis.mjs`'s existing pairing of
  `aFile`/`eFile` by positional array index (see its `for` loop), not by
  `file.path` — this is pre-existing fragility in the pairing model, not
  something this spec introduces, but it means `geometry` silently attaches
  to the wrong image if the analyzed and enriched manifests ever diverge in
  per-pack file count or order. Not fixed here; flagged so it isn't
  mistaken for a geometry-specific bug if it surfaces.
- `npm run` script: add `"geometry": "node tools/geometry-extractor.mjs"` to
  `package.json`. Note: `package.json`'s existing `extract`/`build` scripts
  run unrelated tools (the Kenney downloader and the frontend Vite build,
  respectively) — there is no existing analysis-pipeline npm-script
  convention (`local-analyzer.mjs`, `merge-analysis.mjs`, and
  `build-manifest.mjs` are all currently invoked directly via `node
  tools/...`, not through `npm run`). Add `geometry` as a directly-invoked
  script consistent with that existing direct-invocation pattern, not as
  "alongside extract/build."

## Performance target

`local-analyzer.mjs` processes 27,048 images in ~30s single-threaded pure JS
per `README.md` (Trusted, carried from README prose). Independently
**measured** for this spec: with the Section 0 decoder fix, `npm run
analyze` against all 53 successfully-extracted 2D packs (18,223 real PNGs
on disk out of 27,048 manifest entries) completed in **40s** — consistent
with the README figure, at real scale, with the new decoder.

`geometry-extractor.mjs` was NOT initially O(pixels) as claimed, and this
was found by actually running it at catalog scale, not by re-deriving the
complexity analysis harder. First full-catalog run stalled indefinitely
(no output after 3+ minutes on a set that `local-analyzer.mjs` finished in
40s) and was killed rather than waited out. Cause: `simplifyClosedLoop`'s
closed-contour split step (Section 4) searched for the true
maximum-separation point pair via an exhaustive `O(n^2)` double loop over
the **raw, unsimplified** traced loop — and re-ran that search on **every**
epsilon-escalation attempt (up to `MAX_EPSILON_ESCALATIONS + 1 = 7` times
per component). A large composite/tilemap sheet's raw loop can run into
the thousands of points (one real file's largest component needed 3+
escalation attempts, `bbox` 3328×2560), so this was `O(n^2)` search times
up to 7 retries times however many such large components the catalog
contains — the actual stall, not a marginal slowdown.

**Fixed**: replaced the exact search with a 2-pass farthest-point
heuristic (`findSplitPoints`, `O(n)` — doesn't need the true diameter, just
two reasonably-separated points for RDP to work with) and moved the split
to run once per loop instead of once per escalation attempt
(`splitClosedLoop`/`simplifyChains`, in `tools/geometry-extractor.mjs`).
Re-verified against the same fixture suite (all 7 cases still pass — this
was a performance fix, not a correctness change) and re-run at full
catalog scale: **1m43s** for 18,113 images geometry-extracted, no stall.
Several real (expected, logged) `MAX_OUTLINE_VERTICES` overflow warnings
for large composite sheets, up to 618 vertices on a 3328×2560 canvas — data
for the open vertex-cap question below.

Total Tier 1 (`analyze` + `geometry`) at full real-catalog scale: ~2m23s,
not the sub-minute target originally stated — the target assumed geometry
extraction would cost the same order as `local-analyzer.mjs`'s existing
passes, which held for typical sprites but not for the pathological
composite-sheet case above before the fix, and even after the fix the
measured total is roughly double the ~1-minute target. Revising the target
to **~2.5 minutes for the full real catalog, measured**, rather than
re-asserting the original unmeasured sub-minute guess.

## Validation plan

**Tier A — automated invariant oracle: `tools/test-geometry-extractor.mjs`
(run via `npm run test-geometry`). Implemented, 7 cases, all passing.**
Fixtures are synthetic in-memory RGBA pixel buffers (not encoded PNG files —
see the file's own header comment for why), each asserted against
independently-reasoned geometric invariants (vertex count, shoelace area,
hole count, component count) rather than one fixed ordered vertex array,
since the tracer's starting point/direction is an implementation detail, not
part of the contract. This is a deliberate adjustment from "exact expected
vertex list" in the original spec wording, made while implementing, and
still a real oracle: order/rotation-invariant, but each expected value is
computed from the fixture's known geometry, not copied from a first run of
the code under test. Covers: solid square (vertex count + area), ring with
hole (both loop areas), two disconnected blobs, fully transparent image, the
single-pixel diagonal stroke (must NOT report `componentCount: 0`), two
components touching only diagonally (must stay separate, non-crossing), and
an isolated single pixel (must be dropped as noise). PNG decoding itself
(bit-unpacking, `PLTE`/`tRNS`) is validated separately, against real
extracted files — see "Implementation notes" below.

**Tier B — real-catalog smoke run.** Ran `npm run analyze` then `npm run
geometry` against the 429 PNGs extracted across 5 packs / 4 categories
(`pixel-platformer`, `pixel-line-platformer`, `mini-forest`, `skyboxes`,
`ui-pack-rpg-expansion`). Results and what they mean are in "Implementation
notes" directly below.

### Implementation notes (from the real-catalog smoke run)

- 301 of 339 analyzed PNGs got geometry (the rest correctly skipped as
  non-2D-category or `Preview.png`/`Sample.png` composites — see the Scope
  section addition below).
- 294/301 single-component sprites, as expected for individual character/tile
  art. 7 files had `componentCount > 1` — all tilemap composite sheets
  (e.g. `pixel-platformer/Tilemap/tilemap_packed.png` → `componentCount: 180`,
  one per packed tile), which is the algorithm correctly detecting that a
  sheet of many separately-drawn tiles is not one connected shape.
- 11 components had holes.
- One real vertex-cap overflow: that same 180-component tilemap sheet's
  largest single component hit 126 vertices even after
  `MAX_EPSILON_ESCALATIONS`, above `MAX_OUTLINE_VERTICES = 64`. This is a
  real data point for the open vertex-cap question below — expected, since
  tilemap composite sheets are exactly the "complex/non-rectilinear"
  case Section 4's simplification-ratio caveat already flagged as
  optimistic. The code logs (not silently drops) this case, per spec.
- Spot-checked one output by hand against an ASCII-rendered silhouette of
  the same sprite (`pixel-platformer/Tiles/Characters/tile_0000.png`, a
  sub-8-bit-indexed+`tRNS` file): the traced 9-vertex outline's shape and
  area (399px of a 24x24 canvas) visually match the rendered silhouette.
- Decoder fix verified directly: decoded a real 8-bit-indexed+`tRNS` file,
  a sub-8-bit (bitDepth 4) indexed+`tRNS` file, a `colorType 6` RGBA file,
  and an 8-bit-indexed-no-`tRNS` file — all decoded without error, with
  sane opaque/transparent pixel splits (no partial/garbage alpha values on
  hard-edged pixel-art sources, as expected).

### Full-catalog run (after the performance fix above)

Extracted all 53 successfully-downloadable 2D-category packs (54 exist in
the catalog; `crosshair-pack` fails with an unfollowed HTTP 307 redirect —
a pre-existing bug in `tools/extract.mjs`, not fixed here) and ran
`npm run analyze` then `npm run geometry` against the full set: 18,223 PNGs
analyzed, 18,113 got geometry (46 of the 53 packs represented — the other 7
had no eligible files with geometry, e.g. packs consisting only of
`Preview.png`/`Sample.png`), 61,070 total components, 4,084 files with
`componentCount > 1`, 12,362 components with holes. No crashes. This
superseded the earlier 5-pack/429-file smoke run above as the larger,
current validation baseline; both are kept in this doc since they're each
real, timestamped evidence, not because the later one invalidates the
earlier one's findings.

### Scope addition found during implementation

3D-category packs contain texture atlases / UV colormaps
(`mini-forest/Models/*/Textures/colormap.png`), which have no meaningful
"silhouette" — running geometry extraction on them would produce nonsense.
`tools/geometry-extractor.mjs` restricts extraction to `pack.category ===
"2D"` and skips `Preview.png`/`Sample.png` (pack-level composite renders,
not individual sprites). This wasn't in the original Scope section; add it
there formally: **geometry extraction applies only to 2D-category sprite
files**, not the full manifest.

## Open questions

- ~~Section 0's decoder fix, option (a) vs (b)~~ — resolved, **built, and
  now confirmed at scale**: option (a) (bit-unpack + `PLTE`/`tRNS`) is
  implemented in `local-analyzer.mjs`'s `decodePNG()`, and running it
  against all 53 extracted 2D packs (18,223 PNGs) completed cleanly with no
  decode errors — the fix holds well beyond the original 429-PNG/5-pack
  sample. Still not sampled: the ~40 catalog packs never extracted
  (Textures/3D/Audio, and `crosshair-pack` which fails to download) — not
  needed for this spec's 2D-only scope, so no longer tracked as open here.
- `MAX_OUTLINE_VERTICES = 64` — **measured at full-catalog scale**: several
  real overflow cases beyond the original single tilemap example, up to
  618 vertices on a 3328×2560 composite sheet, confirming the
  "complex/non-rectilinear content won't hit the 80-95% reduction" caveat
  in Section 4 generalizes, not a one-off. 64 still seems reasonable for
  *individual* sprites (the overwhelming majority of the 18,113 processed
  files never hit the cap) but not for large composite sheets — the
  per-file-type exemption idea below is now backed by more than one
  example, still not implemented.
- `ALPHA_THRESHOLD = 16` and `SIMPLIFY_EPSILON = 1.0` are starting guesses,
  not measured — confirm against fixture 5 above before treating them as
  final; adjust in code, this spec does not need updating for tuning.
- Whether `holes` should recurse (a hole containing an island containing a
  hole) — not seen in pixel-art sprites so far; v1 supports exactly one
  level of hole nesting and asserts/warns if it encounters deeper nesting
  rather than silently truncating.
