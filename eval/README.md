# Retrieval oracle

The project this replaces reported "27,048 images analyzed (100%)" as its
success metric while the decoder mangled every indexed PNG. Coverage counts
how much was processed. It says nothing about whether the right asset comes
back. This measures that.

## Running

```
assets eval              # recall@10 by tier
assets eval --validate   # confirm every case has a correct answer in the corpus
assets eval --verbose    # show what came back for each miss
```

## Two kinds of case

**lexical** (59) — the answer's filename contains the query words. Filename
matching wins these by construction, so they are a regression guard, not
evidence that enrichment helps.

**semantic** (10) — scoped to `1-bit-platformer`, whose files are named
`tile_0000.png` … `tile_0195.png` and carry no meaning whatsoever. No amount
of filename matching can answer these.

Labels for the semantic cases were established by rendering a contact sheet
(`ground-truth-tiles.png`, produced by `assets sheet`) and looking at it, then
cross-checking against the independently-produced legacy descriptions. Only
cases where both agreed were kept — a useful discipline, since one first-pass
reading called `tile_0015` a tree when it is a rock.

Expectations are path globs over `pack:path`, derived from the corpus's own
naming. They are never derived from this index's ranking, which would make the
eval circular.

## Baseline (2026-08-30, 69 cases)

| tier | recall@10 | lexical | semantic |
|------|-----------|---------|----------|
| lexical only | 79.7% | 93% (55/59) | **0%** (0/10) |
| + structural | 79.7% | 93% (55/59) | **0%** (0/10) |
| + semantic   | 95.7% | 95% (56/59) | **100%** (10/10) |

### What this decided

An earlier version of this suite contained only lexical cases and reported
that the semantic tier contributed nothing. That was the suite's fault, not
the tier's: expectations were path substrings and the index searches paths, so
the cases were close to tautological and filename matching could not lose
them.

With semantic cases present, description is the only tier that moves the
needle — structural contributes nothing semantically, which is expected, since
a colour histogram does not tell you a shape is a heart.

It also scopes the spend. As of 2026-09-05, 11,046 images (19% of non-atlas
images) are both undescribed and opaquely named -- the only ones description
can help; the rest already describe themselves. That is ~173 contact sheets.
Recompute rather than quote this: it moves every time a pack is fetched or
described.

### Functional vocabulary is the whole game

The semantic tier first scored 60% using the legacy Codex descriptions. The
four misses were all phrasing: `tile_0032` was described as "vertical white
structural strip with a black-and-white checker seam", which never retrieves
"ladder".

Re-describing those 48 tiles by looking at a contact sheet and naming what
each thing is *for* — ladder, slope, health pickup, crate, doorway, ground
platform — took semantic recall from 60% to 100%. Same images, same tier, same
model. Only the vocabulary changed.

That is why the enrichment prompt demands functional game vocabulary rather
than visual appearance, and it is the single highest-leverage detail in the
whole pipeline.

### Known limitation

"spiky enemy creature" misses because the expected files are named
`enemySpikey_*` and the prefix term `"spiky"*` does not match `spikey`. The
FTS query is a term-wise OR with bm25 ranking and no fuzzy matching, so
near-miss spellings are not recovered. It passed before only because fewer
documents competed for the top 10.


## Ground truth has to keep up

Describing `platformer-art-pixel` appeared to drop lexical recall from 93% to
85%. It had not. The suite was returning `tile_0014.png` for "key item to
unlock door" and scoring it a miss, because the expectation was a path glob
and that file is a key whose name says nothing.

The lexical expectations were written when only filename-matched assets could
be found. As opaque-named assets gain descriptions they legitimately outrank
the filename-matched ones, and the suite has to learn those answers instead of
scoring them as failures.

Each widening is verified first: render the candidate, look at it, confirm it
answers the query, then add it. Thirteen expectations were added across six
cases that way; `"spiky enemy creature"` was left failing because its
candidate was not confirmed. Never widen an expectation to make a number look
better -- that turns the oracle into a mirror.


## Baseline (2026-09-06, 304 cases)

The suite was widened from 69 to 304 cases: 184 lexical across ~50 packs the
old suite never touched, 70 semantic drawn from descriptions that were audited
against the pixels (`assets.audited=1`) in four packs rather than one, and 50
intent-shaped sentences -- the shape of a real query, of which the old suite
had none.

| tier | recall@10 | lexical | semantic | intent |
|------|-----------|---------|----------|--------|
| lexical only      | 57.6% | 76% (140/184) | 1% (1/70)   | 68% (34/50) |
| + structural      | 58.6% | 77% (142/184) | 1% (1/70)   | 70% (35/50) |
| + semantic        | 80.3% | 77% (141/184) | 100% (70/70) | 66% (33/50) |

**The previous 95.7% was flattering.** It was measured on 59 keyword-shaped
cases written by the person who wrote the descriptions, with all 10 semantic
cases from a single pack. On a suite that looks more like real use, the same
index scores 80.3%. Nothing about the index changed between the two numbers;
only the instrument did.

What the breakdown says:

- Semantic retrieval works when an audited description exists -- 100% across
  four packs. That is the tier worth investing in, and `audited` is the field
  that makes the investment checkable.
- The lexical tier is weaker than it looked. Most misses are camelCase names
  (`stoneLedgeRight`, `tundraCliffLeft`) where the file matches every query
  term but common terms like "right" and "stone" pull thousands of documents
  ahead of it under OR ranking. A ranking fix, not a data fix.
- Intent queries sit at 66%. Stopwords ("a", "the", "player") match almost
  everything. Same root cause as above, seen from the other side.

Still outstanding: every case was written by the same mind that wrote the
descriptions. A third authored by someone else is the remaining gap.

### Ranking: AND-first with stopwords (2026-09-06)

Hypothesis from the misses above: common terms drown specific files under OR.
Change: require every term first, fall back to OR only to fill the page; drop
a short stopword list. Same 304 cases:

| | before | after |
|---|---|---|
| recall@10 | 80.3% | 80.9% |
| intent | 66% | 70% |
| lexical | 77% | 77% |
| semantic | 100% | 100% |

Kept -- it helps intent queries and regresses nothing -- but it did not fix
the lexical misses, so the drowning hypothesis was mostly wrong. Diagnosing
five of them directly:

- `stone ledge right edge` -- target matches every term and still misses.
  Ten *other* files match every term too, and described tiles win bm25
  because their text is longer. Several of those are stone ledges. The
  expectation was too narrow, not the ranking wrong.
- `yellow race car` -- top hit is `car_yellow_1.png`. That is a yellow race
  car. The expectation named the driver sprite instead.
- `queen of diamonds` -- rank 7, from `cards-pack`; the expectation named
  `playing-cards-pack`.
- `frog hurt` -- file is `frog_hit`. A genuine vocabulary gap (users say
  hurt, files say hit), and the one fix that is a retrieval fix.
- `half planet background` -- "background" is not in the filename; top hit
  `moon_half` is arguably fine.

So the lexical number is a floor set by expectations written from one pack
at a time. Raising it honestly means widening each miss by *looking* at what
came back, the same discipline used on semantic cases -- never by copying the
top hit into the expectation because it was the top hit.

### Widening the misses, and one synonym (2026-09-06)

Went through all 43 lexical misses with their top-3 hits. In 18 of them the
top hit *was* a correct answer by filename -- `car_yellow_1.png` for "yellow
race car", `character_zombie_behindBack.png` for "zombie from behind",
`zoom_out.png` for "zoom out magnifier" -- listed under a pack the
expectation, written from a different pack, never mentioned. Those 18 were
widened. The remaining 25 stay as misses.

Three ranking changes were tried on top, one at a time, on the widened suite:

| change | recall@10 | lexical | intent |
|---|---|---|---|
| widened expectations only | 86.8% | 86% | 70% |
| + synonyms (hurt/hit, grey/gray, three/3, dead/death) | **87.5%** | 88% | 70% |
| + stemming ("wooden" -> "wood") | 84.2% | 85% | 60% |
| + demote `role='preview'` rows | 70.7% | 63% | 60% |

Synonyms kept. Stemming dropped: short stems prefix-match far more noise than
they recover. The preview demotion was a wrong assumption caught by the
oracle -- `role='preview'` is not a handful of pack overview images, it is
3,254 per-model preview renders of the 3D kits (`hexagon-kit/Previews/
building-sheep.png`), the only picture of those models the index has.

**Baseline is now 87.5%** (lexical 88%, semantic 100%, intent 70%). The
widening is the larger part of the gain and is a correction to the
instrument, not the index; the synonym map is the only retrieval change.

### The camelCase defect (2026-09-06)

Looking at the remaining lexical misses with the real filenames behind them:
`laserRedVertical.png`, `outlineCrystal.png`, `iceWaterDeep.png` each
contain every word of their query and were not in the top 100. The FTS row
for the first held `laserredvertical` as one token. `tokenize()` in
lib/classify.mjs lowercased *before* the camelCase split it documents, so
the split never fired -- for every camelCase filename in the corpus, which is
most of Kenney's naming. Its own comment claimed "grassHalfMid -> grass,
half, mid". It did not.

Fix: keep case until after the split. Rebuilt the lexical tier and FTS;
description, audited and structural counts are identical before and after
(7,458 / 151 / 59,656).

| | before | after |
|---|---|---|
| recall@10 | 87.5% | 91.4% |
| lexical | 88% | 94% |
| intent | 70% | 70% |

This is the first change in this file that improved the *index* by a wide
margin rather than the instrument. It was found by reading misses, not by
guessing at ranking.

### Second widening pass, and grounded synonyms (2026-09-06)

Contact sheet of the top 10 for each numbered-tile miss. Flags, bats, candy,
a pink cane top and snow-capped branches were all there, under filenames
with no words to glob (`tile_0310.png`) or under a pack the expectation
never named. Six cases widened after looking; "spiky enemy" (bugs, slimes, a
golem -- nothing spiky) and "hex tile" (map-pack tiles are squares) stay as
misses.

Synonyms added only where a miss had a specific file behind it: wooden/wood
(`fence_woodCorner`), glossy/gloss (`bar_round_gloss`), slider/slide,
magnifying/zoom, and "north west" -> `nw` (`arrow_nw.png`).

**Baseline is now 94.4%** (lexical 96%, semantic 100%, intent 80%), 17
misses. Of those, seven are intent sentences that describe a thing by its
relation to the player ("ground the player can stand on" returns the
player's standing pose) -- word matching cannot answer them and the
contact-sheet step is what does.
