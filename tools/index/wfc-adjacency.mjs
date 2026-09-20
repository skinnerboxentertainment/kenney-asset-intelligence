import sharp from "sharp"
import { openDb } from "../../lib/db.mjs"
import { assetFile, requireAssetsRoot } from "../../lib/config.mjs"
import { pool } from "../../lib/concurrency.mjs"

/**
 * Tier 4b: Wave Function Collapse tile-adjacency extraction, from real
 * decoded pixels.
 *
 * Ported from vendor/geometric-connectivity-spec-eb8b72/tools/wfc-adjacency.mjs
 * (docs/WFC-TILE-ADJACENCY-SPEC.md has the full design rationale) --
 * algorithm unchanged, only the I/O layer changes: the vendor version decoded
 * PNGs with a hand-rolled decoder and wrote into a JSON manifest +
 * per-pack assets/wfc/<pack>.json files; this reads from the SQLite index,
 * decodes with sharp (same pattern as tools/index/analyze.mjs and
 * tools/index/geometry.mjs -- one decoder, not a third one), writes the
 * four wfc_* socket columns per tile, and writes adjacency pairs into the
 * wfc_adjacency table instead of a per-pack JSON file.
 */

const MIN_GROUP_SIZE = 4
const NON_TERRAIN_DIR_RE = /character|enem|player|npc|hero|mob/i
const QUANTIZE_SHIFT = 4 // value >> 4: 16 buckets per channel

// ─── Scope-detection ─────────────────────────────────────────────────────
// See docs/WFC-TILE-ADJACENCY-SPEC.md "Scope-detection" for why this is a
// directory-name blocklist keyed off (pack, dir, width, height) grouping
// rather than a keyword allowlist — Kenney names every sprite export
// `tile_NNNN.png` regardless of content, so the "tile" keyword alone can't
// tell a terrain tile from a character sprite exported the same way.

function groupEligibleTiles(pack) {
  if (pack.category !== "2D") return []
  const groups = new Map() // key: dir|w|h -> files[]
  for (const file of pack.files) {
    if (file.type !== "image" || file.ext !== ".png") continue
    const parts = file.path.split(/[\\/]/)
    const dir = parts.slice(0, -1).join("/")
    if (NON_TERRAIN_DIR_RE.test(dir)) continue
    const key = `${dir}|${file.width}|${file.height}`
    if (!groups.has(key)) groups.set(key, { dir, w: file.width, h: file.height, files: [] })
    groups.get(key).files.push(file)
  }
  return [...groups.values()].filter(g => g.files.length >= MIN_GROUP_SIZE)
}

// ─── Edge signatures ─────────────────────────────────────────────────────

function quantize(v) { return v >> QUANTIZE_SHIFT }

function edgeSockets(img) {
  const { width: w, height: h, pixels } = img
  const px = (x, y) => {
    const off = (y * w + x) * 4
    return [pixels[off], pixels[off + 1], pixels[off + 2], pixels[off + 3]]
  }
  const strip = (coords) => coords.map(([x, y]) => px(x, y).map(quantize).join(",")).join(";")

  const top = strip(Array.from({ length: w }, (_, x) => [x, 0]))
  const bottom = strip(Array.from({ length: w }, (_, x) => [x, h - 1]))
  const left = strip(Array.from({ length: h }, (_, y) => [0, y]))
  const right = strip(Array.from({ length: h }, (_, y) => [w - 1, y]))

  return { top, right, bottom, left }
}

// ─── Adjacency within a group ────────────────────────────────────────────

// An edge signature is "uniform-transparent" if every quantized pixel
// along it has alpha 0 — a fully transparent border (icon/sprite padding).
// Verified against real data: in a 1632-tile icon pack, 1182 tiles (72%)
// shared one identical transparent right-edge signature, and that single
// bucket alone implied ~1.4M "compatible" pairs (out of 2.8M total across
// the whole catalog run), blowing one pack's output file to 168MB.
// Transparent-to-transparent matches aren't wrong — two transparent
// borders genuinely are visually seamless — but they carry no "this
// specific art continues" signal, are true of nearly any icon/sprite with
// padding, and dominate the output by sheer combinatorics rather than by
// being useful. Excluded from the materialized adjacency list.
//
// Deliberately narrower than "any uniform edge": a uniform *opaque*
// signature (e.g. a flat solid-color terrain tile designed to self-tile)
// is real, meaningful adjacency data and stays included — only the
// all-transparent case is excluded. The per-tile `sockets` are still
// emitted either way, so a consumer that specifically wants "any two
// transparent edges are compatible" can still derive that cheaply itself
// without this tool paying to enumerate every such pair.
function isUniformTransparentSignature(sig) {
  const pixels = sig.split(";")
  return pixels.every(p => p.split(",")[3] === "0")
}

function computeAdjacency(tiles) {
  // tiles: [{ path, sockets }]
  const adjacency = { right: [], bottom: [] } // left/top are the symmetric inverse of right/bottom
  for (const a of tiles) {
    for (const b of tiles) {
      if (a.sockets.right === b.sockets.left && !isUniformTransparentSignature(a.sockets.right)) {
        adjacency.right.push([a.path, b.path])
      }
      if (a.sockets.bottom === b.sockets.top && !isUniformTransparentSignature(a.sockets.bottom)) {
        adjacency.bottom.push([a.path, b.path])
      }
    }
  }
  return adjacency
}

// ─── Public entry point (tested by tools/index/test-wfc-adjacency.mjs) ───
//
// Vendor's decodeFn was synchronous (its hand-rolled decodePNG() ran
// in-process on an already-read buffer). sharp decodes asynchronously, so
// this is the one necessary mechanical change from the vendor version --
// async/await added, no logic change. Not exercised by the ported test
// suite (none of its 8 cases call this function; they test the pure
// pieces -- groupEligibleTiles, edgeSockets, computeAdjacency,
// isUniformTransparentSignature -- directly), so this change carries no
// risk to the phase's oracle.
async function computeGroupWFCData(group, decodeFn) {
  const tiles = []
  for (const file of group.files) {
    const img = await decodeFn(file)
    if (!img) continue
    tiles.push({ path: file.path, sockets: edgeSockets(img) })
  }
  return {
    directory: group.dir,
    tileSize: { w: group.w, h: group.h },
    tileCount: tiles.length,
    tiles,
    adjacency: computeAdjacency(tiles),
  }
}

// ─── DB orchestration ───────────────────────────────────────────────────────

async function decodeImage(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, pixels: data }
}

export async function runWfcAdjacency({ packs = null, force = false, concurrency = 12 } = {}) {
  requireAssetsRoot()
  const db = openDb()

  let packSql = "SELECT slug, category FROM packs WHERE category = '2D'"
  const packParams = []
  if (packs) { packSql += ` AND slug IN (${packs.map(() => "?").join(",")})`; packParams.push(...packs) }
  const packRows = db.prepare(packSql).all(...packParams)

  const updateSockets = db.prepare(
    "UPDATE assets SET wfc_top=?, wfc_right=?, wfc_bottom=?, wfc_left=? WHERE id=?")
  const deleteForPack = db.prepare("DELETE FROM wfc_adjacency WHERE pack=?")
  const insertPair = db.prepare(
    "INSERT INTO wfc_adjacency (pack, direction, tile_a, tile_b) VALUES (?,?,?,?)")
  const hasWfcData = db.prepare("SELECT 1 FROM assets WHERE pack=? AND wfc_top IS NOT NULL LIMIT 1")

  let packsWithGroups = 0, totalGroups = 0, totalTiles = 0, totalPairs = 0, skippedPacks = 0
  const t0 = Date.now()

  for (const packRow of packRows) {
    const fileRows = db.prepare(
      "SELECT id, path, width, height FROM assets WHERE pack = ? AND kind = 'image' AND ext = '.png'"
    ).all(packRow.slug)
    if (!fileRows.length) continue

    const pack = {
      category: packRow.category,
      files: fileRows.map((f) => ({ path: f.path, width: f.width, height: f.height, type: "image", ext: ".png" })),
    }
    const groups = groupEligibleTiles(pack)
    if (!groups.length) continue

    if (!force && hasWfcData.get(packRow.slug)) { skippedPacks++; continue }

    const idByPath = new Map(fileRows.map((f) => [f.path, f.id]))
    const groupResults = []
    for (const group of groups) {
      // Decode each tile once, concurrently, before computeGroupWFCData's
      // own (sequential, unchanged-from-vendor) aggregation pass -- keeps
      // the ported logic untouched while still getting real concurrency
      // out of sharp's async decode.
      const decodedByPath = new Map()
      await pool(group.files, concurrency, async (file) => {
        try {
          decodedByPath.set(file.path, await decodeImage(assetFile(packRow.slug, file.path)))
        } catch {
          decodedByPath.set(file.path, null)
        }
      })
      const decodeFn = async (file) => decodedByPath.get(file.path) ?? null
      const result = await computeGroupWFCData(group, decodeFn)
      if (result.tileCount === 0) continue
      groupResults.push(result)
    }
    if (!groupResults.length) continue

    packsWithGroups++
    totalGroups += groupResults.length

    db.exec("BEGIN")
    deleteForPack.run(packRow.slug)
    for (const g of groupResults) {
      totalTiles += g.tileCount
      for (const t of g.tiles) {
        const id = idByPath.get(t.path)
        if (id != null) updateSockets.run(t.sockets.top, t.sockets.right, t.sockets.bottom, t.sockets.left, id)
      }
      for (const [aPath, bPath] of g.adjacency.right) {
        const a = idByPath.get(aPath), b = idByPath.get(bPath)
        if (a != null && b != null) insertPair.run(packRow.slug, "right", a, b)
      }
      for (const [aPath, bPath] of g.adjacency.bottom) {
        const a = idByPath.get(aPath), b = idByPath.get(bPath)
        if (a != null && b != null) insertPair.run(packRow.slug, "bottom", a, b)
      }
      totalPairs += g.adjacency.right.length + g.adjacency.bottom.length
    }
    db.exec("COMMIT")

    console.log(`  ${packRow.slug}: ${groupResults.length} group(s), ${groupResults.reduce((s, g) => s + g.tileCount, 0)} tiles`)
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n  Complete. ${packsWithGroups} pack(s) with qualifying tile groups, ${totalGroups} group(s), ${totalTiles} tile(s), ${totalPairs} adjacency pairs in ${secs}s.`)
  if (skippedPacks) console.log(`  ${skippedPacks} pack(s) skipped (already have wfc data; use --force to redo)`)
  db.close()
}

export { groupEligibleTiles, edgeSockets, computeAdjacency, computeGroupWFCData, isUniformTransparentSignature, NON_TERRAIN_DIR_RE, MIN_GROUP_SIZE }
