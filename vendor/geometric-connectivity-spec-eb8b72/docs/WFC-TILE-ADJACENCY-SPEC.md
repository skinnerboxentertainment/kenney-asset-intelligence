# WFC Tile-Adjacency Spec

Status: Implemented (`tools/wfc-adjacency.mjs`), first pass — not yet
adversarially reviewed like [GEOMETRIC-CONNECTIVITY-SPEC.md](GEOMETRIC-CONNECTIVITY-SPEC.md)
was. Built and smoke-tested against real data in the same session as an
addition to that spec's scope; treat the design below as solid but less
battle-tested than the geometric connectivity work.

## Problem

Wave Function Collapse (WFC) and similar constraint-based procedural
generators need to know, for a set of tiles, which tiles can legally sit
next to which others in each direction — i.e. whether the pixels along a
shared edge are visually continuous. Nothing in this pipeline currently
computes that. This spec adds a tool that scope-detects which catalog packs
are actual tilesets (not every "2D" pack is, and not every uniformly-sized,
`tile_NNNN.png`-named directory within a tileset pack is terrain — see
Scope-detection below) and computes per-tile edge signatures plus a
precomputed adjacency list per qualifying group.

## Scope-detection (the hard part — verified against real data, not guessed)

**Key finding from real catalog packs:** Kenney names *every* individual
sprite export `tile_NNNN.png`, regardless of content. In the
`pixel-platformer` pack (already extracted for the geometric connectivity
work), `Tiles/Characters/` (27 character sprites) and `Tiles/` (180 terrain
tiles) share the identical naming convention and both carry a `"tile"`
keyword from filename tokenization. Keyword-based detection alone would
wrongly pull in character sprites as if they were terrain. Confirmed by
directly rendering one `Tiles/Characters/tile_0000.png` file as ASCII art
during the geometric connectivity work — a rounded character silhouette,
not a terrain tile.

Eligibility, in order:
1. `pack.category === "2D"`.
2. Group files by `(pack, directory, width, height)` — a real tileset
   directory has many same-sized files; this is the strongest actual
   signal, stronger than any keyword.
3. A group qualifies only if it has **at least 4 files** (filters out
   one-off same-sized coincidences) **and** its directory path does not
   match `/character|enem|player|npc|hero|mob/i` (case-insensitive). This
   is a blocklist, not an allowlist — deliberately, since Kenney's
   directory naming for actual terrain varies a lot ("Tiles", "Backgrounds",
   "Environment", unnamed root) and an allowlist would need per-pack
   tuning; a blocklist of known-non-terrain directory names is more robust
   to that variance, at the cost of occasionally including a genuinely
   non-terrain group whose directory name isn't on the list yet (see Open
   questions).
4. Pack-level composites (`Preview.png`, `Sample.png`, tilemap-packed sheet
   composites already excluded by width/height grouping since they're each
   a unique size) are naturally excluded by the group-size-≥4 rule.

## Algorithm

### 1. Edge signature

For each eligible tile, using the same decoded RGBA buffer `decodePNG()`
produces (see `docs/GEOMETRIC-CONNECTIVITY-SPEC.md` Section 0 for the
decoder's fixed alpha/bit-depth handling — this tool depends on the same
fix), extract 4 edge pixel strips: `top` (row y=0), `bottom` (row y=h-1),
`left` (column x=0), `right` (column x=w-1), each read in image order
(left-to-right for top/bottom, top-to-bottom for left/right — no flipping,
since visual continuity across a shared border preserves that order).

Quantize each pixel in a strip to coarse RGBA buckets (`value >> 4`, 16
buckets per channel — coarser than the analyzer's existing 5-bit color
quantization, deliberately: edge-matching needs to tolerate the same minor
dithering/anti-aliasing noise between two hand-authored "matching" tiles
that the existing `tileScore`'s `abs diff < 30` tolerance already accounts
for, and quantization is the equality-based equivalent of that tolerance
check, needed to make grouping O(n) instead of O(n²) fuzzy comparison).
Concatenate the quantized values into a single string — this is the edge's
signature. Two edges are considered visually continuous if their
signatures are exactly equal after quantization.

### 2. Adjacency

Within each qualifying group, two tiles A and B are adjacency-compatible in
a direction if the touching edge signatures match: `A.right === B.left`
(B to the right of A), `A.bottom === B.top` (B below A), and symmetrically
`A.left === B.right`, `A.top === B.bottom`. A tile is always compatible
with itself in every direction where its own opposite-edge signatures
match (self-tiling, same check `tileScore` already does, but now via exact
quantized-signature match rather than the analyzer's float tolerance).

Computed as a direct within-group `O(n^2)` comparison. **This assumption —
"eligible groups are small (tens to low hundreds of tiles), no separate
optimization needed" — was wrong**, corrected after running the full
53-pack catalog: one icon pack's qualifying group had 1632 tiles, and
`ui-pack-sci-fi` alone produced 96 separate groups. The runtime itself
stayed fine (full catalog in ~11-38s), but the *combinatorics* of `O(n^2)`
pair enumeration within a large group was the actual problem — see
"Real finding" below, which is about output size, not runtime.

## Output

Two outputs, kept separate because they serve different consumers:

- **Per-file, in the manifest** (`file.wfcSocket = { top, right, bottom,
  left }`, the 4 quantized signature strings only — small, no adjacency
  data inlined, to avoid the same manifest-bloat concern the geometric
  connectivity spec raised for vertex lists). Lets an LLM agent check "do
  these two specific tiles connect" by comparing signature strings directly
  without needing this tool's adjacency-list file.
- **Per-pack adjacency file**, `assets/wfc/<pack-slug>.json`: for each
  qualifying group, the tile list with sockets, plus the precomputed
  compatible-pairs-per-direction list — the form a WFC solver actually
  wants (a constraint table), so it doesn't need to re-derive it from raw
  signatures itself.

```json
{
  "pack": "pixel-platformer",
  "groups": [
    {
      "directory": "Tiles",
      "tileSize": { "w": 18, "h": 18 },
      "tileCount": 180,
      "tiles": [
        { "path": "Tiles/tile_0000.png", "sockets": { "top": "...", "right": "...", "bottom": "...", "left": "..." } }
      ],
      "adjacency": {
        "right": [["Tiles/tile_0000.png", "Tiles/tile_0004.png"]],
        "bottom": [["Tiles/tile_0000.png", "Tiles/tile_0012.png"]]
      }
    }
  ]
}
```

## Pipeline integration

New tool: `tools/wfc-adjacency.mjs`. Reads `assets/analyzed-manifest.json`
(needs `width`/`height`/`path` from the base manifest fields already there
— does not depend on the `analysis` or `geometry` blocks, so it can run
independently of `local-analyzer.mjs`/`geometry-extractor.mjs`, though it
still needs files physically present in `assets/experimental/`). Decodes
PNGs directly via the same fixed `decodePNG()` import used by
`geometry-extractor.mjs`. Writes `wfcSocket` onto eligible file entries in
`assets/analyzed-manifest.json`, and writes one `assets/wfc/<pack>.json`
per qualifying pack. `npm run wfc-adjacency` script added.

## Validation

`tools/test-wfc-adjacency.mjs`: synthetic in-memory tile fixtures (same
pattern as the geometric connectivity Tier A tests) —
- Two tiles with an identical solid-color right/left edge → compatible.
- Two tiles with different-color edges → not compatible.
- A self-tiling single tile (matches itself on opposite edges) → compatible
  with itself.
- Directory-name blocklist: a `Characters/` group of uniform-size files is
  excluded from eligibility even though it would otherwise qualify by size
  count.

Real-data run: against `pixel-platformer` and `pixel-line-platformer` (the
two tile-bearing packs already extracted). Results: `pixel-line-platformer`
→ 1 group (`Tiles`, 60 tiles); `pixel-platformer` → 2 groups (`Tiles`, 180
tiles; `Tiles/Backgrounds`, 24 tiles — `Tiles/Characters`, 27 files of the
same 24x24 size, correctly excluded by the directory blocklist). No
crashes. 264 tiles total, 8301 adjacency pairs across right+bottom
directions.

**Real finding, not anticipated at design time — since fixed:** in
`pixel-platformer`'s 180-tile `Tiles` group, the single largest
shared-right-edge-signature bucket had 54 tiles (30% of the group) —
tiles with a transparent right edge, which all quantize identical and
were therefore mutually "compatible." That one bucket alone accounted for
54×54 = 2916 of the group's 3397 right-direction pairs (86%).

**This turned out to be a production blocker, not just a data-quality
caveat**, confirmed by scaling up to the full 53-pack catalog (see
"Full-catalog run" below): one 1632-tile icon pack had 1182 tiles (72%)
sharing one transparent-edge signature, implying ~1.4M pairs from that
bucket alone, and blew that one pack's output file to **168MB**. Fixed:
`computeAdjacency()` now excludes any pair where the matched edge is
**fully transparent** (`isUniformTransparentSignature()`) — deliberately
narrower than "any uniform edge," since a uniform *opaque* edge (a flat
solid-color terrain tile designed to self-tile) is real, meaningful
adjacency data and stays included. Verified with a regression test
(`tools/test-wfc-adjacency.mjs`) that a solid-color self-tiling tile is
still reported compatible with itself after the fix.

## Full-catalog run

After the fixes above (see also the geometric connectivity spec's own
full-catalog-run note about an unrelated `O(n^2)` split-search stall),
ran against all 53 successfully-extracted 2D packs (`crosshair-pack`
failed to extract — pre-existing HTTP-307-redirect bug in
`tools/extract.mjs`, unrelated to this work, not fixed here): 43/53 packs
had qualifying tile groups, 444 groups, 16,793 tiles. Before the
transparent-edge fix: 2,821,409 adjacency pairs, 387MB of per-pack JSON
output (worst single file 168MB). After: 210,243 pairs (13x fewer), 76MB
total (worst single file 16MB) — a real, substantial improvement, but
**not fully resolved**: 76MB across 43 files is still large for what's
meant to be lightweight constraint data. Worth a follow-up: either cap
adjacency pairs per tile, or switch the output format from an enumerated
pair list to a compact signature-bucket representation (group tiles by
matching signature instead of listing every pair) — deferred rather than
done here, to keep this addition's scope from expanding further tonight.

## Out of scope (v1)

- Rotation/reflection-aware adjacency (a tile rotated 90° matching a
  different tile's edge) — only exact, unrotated edge matches are checked.
- Weighting/frequency data for WFC's probabilistic tile selection — this
  tool only produces the hard constraint (can/cannot be adjacent), not
  weights.
- Any actual WFC solver/generator — this tool produces the adjacency input
  data a solver would consume, not the solver itself.

## Open questions

- ~~The directory-name blocklist...~~ — **exercised, not just designed**:
  ran against all 53 packs, 43 produced qualifying groups with no reported
  crashes or obviously-wrong groupings spot-checked in passing (e.g.
  `pixel-platformer`'s `Tiles/Characters` correctly excluded again at
  scale). Still not manually spot-checked pack-by-pack for false
  positives/negatives across all 43 — that would mean opening ~450 group
  results by hand, out of scope for tonight. A good next step: sample 5-10
  of the 43 packs' `assets/wfc/<pack>.json` output and manually confirm
  the qualifying groups are actually terrain, not something the blocklist
  missed.
- Quantization coarseness (`value >> 4`, 16 buckets) is still an unmeasured
  starting guess — confirm it doesn't over- or under-match against real
  adjacency pairs.
- Minimum group size of 4 files is arbitrary; revisit if a real terrain
  tileset with 2-3 tiles is found and wrongly excluded.
- ~~Uniform/transparent-edge tiles dominate...~~ — **fixed**: transparent
  edges excluded from the adjacency list (see "Real finding... since
  fixed" above). Remaining open item from that fix: 76MB of total output
  across 43 packs is still large for constraint data; the deferred
  signature-bucket output format (noted above) would likely cut it further
  without losing information, but wasn't built tonight.
