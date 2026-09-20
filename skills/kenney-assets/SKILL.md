---
name: kenney-assets
description: Find and install 2D game art from a local index of ~59,000 CC0 Kenney.nl sprites — characters, tiles, backgrounds, UI, pickups, enemies, effects. Use when building or prototyping a game and you need actual sprite files: player walk cycles, ground tiles, parallax backgrounds, HUD elements, particle art. Also use to check what art is available before writing procedural placeholder graphics.
---

# Kenney asset index

~59,000 CC0 sprites across 223 packs, indexed and queryable. Everything is
public domain; a donation link belongs in whatever you ship.

**Do not browse the corpus by hand.** Listing directories burns context and
filenames lie — a third of them (`tile_0147.png`) say nothing at all. Query
the index instead.

## The loop

```bash
assets search "side-view player walk cycle" --role character --limit 20
```

Returns id, pack, size, role, style, path — and a one-line description where
one exists.

```bash
assets sheet 1011 1012 1013 1014 --out /tmp/candidates.png
```

Composites them into one labelled image. **Then read that image.** This is the
point: the index narrows 59,000 to 20, and you choose by looking, so you never
commit to a sprite you have not seen.

```bash
assets install 1011 1012 1013 --to ./src/assets --manifest
```

Copies the files and writes `assets.manifest.json` — keys, dimensions, roles,
tileability, attribution — for the game code to import.

## Filters

`--role` character | enemy | tile | background | ui | effect | pickup | weapon | audio
`--pack <slug>` · `--style` 1-bit | indexed | pixel-art | full-color
`--tileable` (edges actually match) · `--min-size` / `--max-size` px
`--described` / `--undescribed` — which assets carry a description and which
still need one
`--kind` image | audio · `--limit` (default 20) · `--json`

Sprite sheets are excluded by default; add `--atlas` for them.

## What to trust

- `width`/`height`, `style`, `tileable`, colours — measured from pixels.
- `role`, `keywords` — inferred from filename and directory. Good recall,
  not authoritative. 61% of assets have a role.
- `description` — present for 7,458 assets (13%). Where absent, the filename
  is usually self-describing; where the filename is opaque, look at a sheet.

Never state that a sprite faces a direction, has a particular colour, or shows
a specific action unless you read it in a description or saw it on a sheet.
Filenames and roles do not license those claims.

## Setup

Examples write `assets`; the command is `node bin/assets` from the repo root
(`npm link` or `npx assets` also work). `npm run assets -- search ...` needs
the `--`.

`ASSETS_ROOT` must point at the extracted corpus (default
`./assets/experimental`). `assets stats` reports what is indexed. If a pack is
cataloged but not on disk, `npm run extract -- <slug>` fetches it.

More: `references/query-cookbook.md` for worked query patterns,
`references/slots.md` for mapping game roles to searches.
