# Universal Asset Edge Extractor

A queryable index over ~59,000 CC0 game sprites from [Kenney.nl](https://kenney.nl),
built so an agent can go from "I need a player walk cycle" to files on disk in
three commands.

## Why an index

Kenney ships 59,012 PNGs across 223 packs. An agent cannot look at all of them,
and filenames only sometimes help — roughly a third of them (`tile_0147.png`)
say nothing at all. Browsing the corpus by hand burns context and misses things.

So the index does not try to be a substitute for looking. It produces a
**shortlist**, and whoever asked confirms by eye:

```bash
assets search "side-view player walk cycle" --role character --limit 20
assets sheet 1011 1012 1013 1014 --out /tmp/candidates.png   # then look at it
assets install 1011 1012 1013 --to ./src/assets --manifest
```

Recall is what matters; precision gets fixed for free at the last step.

## Enrichment tiers

One SQLite database, one row per asset, columns filled by successive passes.

| Tier | Source | Coverage |
|------|--------|----------|
| Inventory | filesystem walk + image headers | 61,005 files |
| Structural | decoded pixels via sharp — colours, style, tileability, symmetry, alpha | 59,656 images |
| Lexical | filename + parent directory heuristics | 37,272 have a role (61%) |
| Semantic | per-sprite descriptions | 7,458 (13%) |

Tiers are joined on `(pack, path)`, and every semantic claim records which
model made it and when.

## Does it work?

`assets eval` measures recall@10 against 69 hand-labeled queries and reports
each tier's contribution separately. Current baseline:

| tier | lexical cases | semantic cases |
|------|---------------|----------------|
| lexical only | 93% | 0% |
| + structural | 95% | 0% |
| + semantic | 95% | 60% |

"Semantic" cases are scoped to a pack whose files are named `tile_0000.png` …
`tile_0195.png`, so filename matching cannot answer them at all. That split is
the point: it is what shows whether an enrichment tier is worth its cost, and
it is why the remaining vision work targets the 31% of images whose filenames
are opaque rather than the whole corpus.

See [eval/README.md](eval/README.md), including a note on how an earlier
version of this suite reported the opposite conclusion.

## The app

```bash
npm run dev
```

Two views over the same index.

**Packs** — all 212 packs with their real state: on disk, how many files
indexed, what fraction is described. Install downloads, extracts, indexes and
analyzes the pack server-side, so the moment it finishes it is searchable.
Remove deletes it from disk and the index.

**Assets** — search every indexed sprite by text, role, style, pack, or
whether its edges actually tile. Results are the real images, served from the
corpus on a transparency checkerboard. Clicking one shows its description,
measured metadata, dominant colours, and the CLI line to install it.

Searching *"health pickup heart"* returns `tile_0040.png`, `tile_0041.png`
and `tile_0042.png` in the top five. Those filenames contain no such word;
they are findable only because they carry descriptions. That is what the
enrichment tiers are for.

The app needs `npm run dev` — a browser cannot write to the corpus, so
installing runs on the dev server. A static build browses nothing.

## Using it from another agent (MCP)

`mcp/server.mjs` exposes the index over the Model Context Protocol, so any MCP
client can use it. A project-scoped `.mcp.json` is included, so a client
opened in this directory picks it up with no setup.

| tool | does |
|------|------|
| `search_assets` | find candidates by description, with the same filters as the CLI |
| `contact_sheet` | composite up to 64 assets into one labelled image **and return it** |
| `get_asset` | full record for one asset, including who described it |
| `install_assets` | copy chosen assets into a directory, optionally with a manifest |
| `list_packs` | every pack, and whether it is downloaded |
| `index_stats` | coverage per tier, so a caller knows how much to trust a result |

`contact_sheet` is the reason this is worth exposing over MCP at all. MCP tools
may return images, so a client can run the loop the whole project is built
around — narrow 59,000 sprites to twenty by search, then *look* at them and
choose. Without that step it would only be a worse `ls`.

Every tool reads through `lib/search.mjs`, the same query the CLI, the web app
and the eval use, so what a client gets back is what the measured recall was
measured on. Only `install_assets` writes, and only where the caller says.

Elsewhere, register it by absolute path:

```json
{ "mcpServers": { "kenney-assets": {
    "command": "node",
    "args": ["<path to repo>/mcp/server.mjs"],
    "env": { "ASSETS_ROOT": "<path to extracted packs>" } } } }
```

## Commands

```bash
assets catalog                     # refresh catalog from kenney.nl
assets build                       # index the catalog + corpus
assets analyze                     # structural pass (~40s for 27k images)
assets search <query> [filters]    # find candidates
assets sheet <ids> --out f.png     # composite a contact sheet
assets install <pack|ids> --to <d> # copy out, with a typed manifest
assets enrich                      # plan the description pass (costs money)
assets enrich --sheets-only        # render sheets without spending
assets enrich --ingest <file>      # apply descriptions written by hand
assets eval                        # recall@10 by tier
assets stats                       # what is indexed

npm run dev                        # the app
npm run extract -- --missing       # fetch every pack not yet on disk
```

`ASSETS_ROOT` points at the extracted corpus (default `assets/experimental`);
`ASSETS_DB` relocates the index.

## Describing sprites

A third of the corpus has filenames that say nothing (`tile_0147.png`), and
only a description makes those findable. Two ways to produce them:

- **By looking.** `assets enrich --sheets-only` renders labelled contact
  sheets, 64 sprites each. Read one, write the descriptions, apply them with
  `assets enrich --ingest`. No API, no key, no bill.
- **In bulk.** `assets enrich` prints a plan and a cost; `--submit` sends the
  sheets through the Batch API. ~118 sheets for the images that need it.

Descriptions are exported to `descriptions/<pack>.json` and committed. They
are the one tier that cannot be regenerated -- structural analysis re-runs
from the pixels in 40 seconds, but a description is the product of someone
looking at the sprite. `assets descriptions import` restores them into a
rebuilt index, keyed by path rather than row id.

Either way, name what a thing is *for*. "Vertical strip with a checker seam"
is accurate and useless; "ladder" is what somebody searches for. That single
distinction moved semantic recall from 60% to 100%.

## License

Code is MIT. Every asset is CC0 from [Kenney.nl](https://kenney.nl) — a donate
link is in the UI and in every generated manifest. Please support Kenney.
