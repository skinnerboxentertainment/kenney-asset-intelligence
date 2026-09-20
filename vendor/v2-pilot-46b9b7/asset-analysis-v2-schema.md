# Asset Analysis v2 — Schema & Redo Plan (Draft)

Status: **draft, not yet run.** Supersedes the v1 pipeline (`assets/codex-vision-prompt.md`,
`assets/enriched/*.json`, `assets/merged-manifest.json`). v1 output is being discarded, not
migrated — 83.6% of its 27,040 entries were filename-templated text with no real vision
behind them (see prior audit in this session: `flag-pack`, `input-prompts-pixel-1-bit`, and
38 other packs were 100% template; only 10 packs got genuine per-image analysis).

## Goal

An entry in this dataset should let an agent or a human answer, without opening the image:
*"Do I want this piece, what does it look like, which way does it face, and what can I
attach it to?"* v1 answered the first two questions sometimes. It never answered the last
one — there was no concept of a piece belonging to a kit or connecting to another piece.
That's the gap this version closes.

## Engines

- **Primary: Claude (this session), via contact sheets.** Proven in this session — reading
  the existing `assets/.codex-contact-sheets/top-down-tanks-redux/contact-0N.png` grids
  produced accurate, specific descriptions directly from the image. A contact sheet is a
  grid of ~25 labeled thumbnails (filename + dimensions under each); one sheet read replaces
  25 individual image calls. 27,048 images → roughly 1,000–1,100 sheet reads.
- **Secondary: Codex (ChatGPT desktop, Plus tier).** Spot-check / second-opinion only, on a
  small sample of ambiguous cases (tileability, connector orientation) — not primary
  coverage, because its usage cap is unknown and shouldn't gate the whole pack.
- Every entry records which engine produced it (`analysis.method`), so quality is never
  silently mixed the way v1's template fallback was.

## Schema

Replaces v1's flat `description` object with two objects: `visual` (unchanged intent,
tightened) and `kit` (new — the relational/compatibility layer), plus `analysis`
(provenance/verification, new).

```json
{
  "path": "Tilemap/road_straight.png",
  "visual": {
    "what": "Straight two-lane asphalt road segment with a dashed yellow center line and gray shoulder on both long edges.",
    "orientation": "top-down",
    "facing": "N/A",
    "style": "flat-vector",
    "palette": "dark gray asphalt, yellow center line, light gray shoulder",
    "transparency": "no",
    "symmetry": "180-rotation-symmetric",
    "animationFrame": null,
    "scaleHint": "64x64 px, fits 1 grid tile"
  },
  "kit": {
    "setId": "city-kit-roads",
    "role": "road-straight",
    "connectors": [
      { "edge": "top",    "type": "road", "lanes": 2, "compatibleWith": ["road-straight", "road-curve-90", "road-t-junction", "road-cross"] },
      { "edge": "bottom", "type": "road", "lanes": 2, "compatibleWith": ["road-straight", "road-curve-90", "road-t-junction", "road-cross"] },
      { "edge": "left",   "type": "none" },
      { "edge": "right",  "type": "none" }
    ],
    "rotatable": true,
    "snapGrid": "64x64",
    "pairsWith": ["road_curve_90.png", "road_t_junction.png", "sidewalk_straight.png"],
    "isKitPiece": true
  },
  "usage": {
    "isUI": false, "isTile": true, "isCharacter": false,
    "isEffect": false, "isPickup": false, "isBackground": false,
    "suggested": "Straight road segment for a top-down or isometric city/track layout; tile along the road axis and rotate 90° for the perpendicular direction."
  },
  "analysis": {
    "method": "claude-vision",
    "batchId": "city-kit-roads/contact-03.png",
    "analyzedAt": "2026-09-21",
    "confidence": "high"
  }
}
```

### Field notes

- **`kit.connectors`** is the actual new capability: per-edge (or per-socket, for non-grid
  pieces) type + compatibility list, so "build the track" queries become a graph-adjacency
  lookup instead of a human staring at thumbnails. Pieces with no connection semantics
  (characters, UI icons, standalone props) omit `kit` entirely or set `isKitPiece: false`.
- **`visual.what` must name the specific thing**, not the filename. "Ad game asset" is
  banned; a lint check enforces this (see Verification below).
- **`analysis.method`** is one of `claude-vision`, `codex-vision`, or `template-fallback`.
  `template-fallback` is allowed to exist (some assets — solid-color placeholders, generated
  noise textures — genuinely don't need vision) but must be an explicit, reviewed decision
  per pack, not a silent default.
- **`analysis.batchId`** points at the contact sheet the description came from, so any entry
  can be traced back to the actual image evidence it was read from.

## Verification (the part v1 never had)

A pack is not "complete" until a check script confirms, per pack:

1. Zero entries match the v1 template regex
   (`/^.+ (game asset|environment tile|user-interface graphic), \d+x\d+ px, in [\w.-]+ style\.$/`).
2. `analysis.method` is present on every entry, and `template-fallback` entries are ≤ some
   small explicit allowance (default 0%) unless the pack's `README` note explains why.
3. Duplicate-`what`-within-pack rate is below a threshold (e.g. 5%) — catches copy-paste
   regressions before they ship, the way the v1 audit caught them after the fact.
4. For kit packs specifically: every `kit.connectors[].compatibleWith` entry resolves to a
   `role` that actually exists in the same `setId` — no dangling references.

`codex-progress.json`'s `"status": "complete"` claim gets replaced by this script's exit
code, not a self-report.

## Pilot

Before touching all 100 packs: pilot this schema on **one real kit pack** to prove the
`kit.connectors` design actually works for "build the track" style queries. Candidates:
`car-kit` or a roads/track pack (`city-kit-roads` if it exists, else check pack list).
I'll generate contact sheets for the pilot pack, do the analysis, run the verification
script against it, and show you the output before committing to the other 99.

## Open questions for you

1. Confirm discard-not-migrate for v1 output (I'm reading it that way from "throw outside
   all the work we did").
2. Pilot pack — pick one, or I'll pick a small roads/vehicle kit and confirm before running.
3. Threshold values above (5% dup rate, 0% template allowance) are starting guesses — tune
   if you have a different bar in mind.
