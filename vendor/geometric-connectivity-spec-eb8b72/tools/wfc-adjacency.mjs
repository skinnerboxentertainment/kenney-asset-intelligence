import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { decodePNG } from "./local-analyzer.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const EXTRACT_DIR = path.join(ROOT, "assets", "experimental")
const ANALYZED_PATH = path.join(ROOT, "assets", "analyzed-manifest.json")
const WFC_OUT_DIR = path.join(ROOT, "assets", "wfc")

const MIN_GROUP_SIZE = 4
const NON_TERRAIN_DIR_RE = /character|enem|player|npc|hero|mob/i
const QUANTIZE_SHIFT = 4 // value >> 4: 16 buckets per channel

// ─── Scope-detection ─────────────────────────────────────────────────────
// See docs/WFC-TILE-ADJACENCY-SPEC.md "Scope-detection" for why this is a
// directory-name blocklist keyed off (pack, dir, width, height) grouping
// rather than a keyword allowlist — Kenney names every sprite
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

// ─── Public entry points (tested by tools/test-wfc-adjacency.mjs) ───────

function computeGroupWFCData(group, decodeFn) {
  const tiles = []
  for (const file of group.files) {
    const img = decodeFn(file)
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

// ─── Main ────────────────────────────────────────────────────────────────

function main() {
  const manifest = JSON.parse(fs.readFileSync(ANALYZED_PATH, "utf-8"))
  fs.mkdirSync(WFC_OUT_DIR, { recursive: true })

  let packsWithGroups = 0, totalGroups = 0, totalTiles = 0, totalPairs = 0

  for (const pack of manifest.packs) {
    const groups = groupEligibleTiles(pack)
    if (groups.length === 0) continue

    const decodeFn = (file) => {
      const fullPath = path.join(EXTRACT_DIR, pack.pack, file.path)
      if (!fs.existsSync(fullPath)) return null
      const buf = fs.readFileSync(fullPath)
      return decodePNG(buf)
    }

    const groupResults = []
    for (const group of groups) {
      const result = computeGroupWFCData(group, decodeFn)
      if (result.tileCount === 0) continue
      groupResults.push(result)

      for (const t of result.tiles) {
        const file = group.files.find(f => f.path === t.path)
        if (file) file.wfcSocket = t.sockets
      }
    }
    if (groupResults.length === 0) continue

    packsWithGroups++
    totalGroups += groupResults.length
    for (const g of groupResults) {
      totalTiles += g.tileCount
      totalPairs += g.adjacency.right.length + g.adjacency.bottom.length
    }

    fs.writeFileSync(
      path.join(WFC_OUT_DIR, `${pack.pack}.json`),
      JSON.stringify({ pack: pack.pack, groups: groupResults }, null, 2)
    )
    console.log(`${pack.pack}: ${groupResults.length} group(s), ${groupResults.reduce((s, g) => s + g.tileCount, 0)} tiles`)
  }

  fs.writeFileSync(ANALYZED_PATH, JSON.stringify(manifest, null, 2))

  console.log(`\nComplete. ${packsWithGroups} pack(s) with qualifying tile groups, ${totalGroups} group(s), ${totalTiles} tile(s), ${totalPairs} adjacency pairs.`)
  console.log(`Per-pack adjacency files: ${WFC_OUT_DIR}`)
}

export { groupEligibleTiles, edgeSockets, computeAdjacency, computeGroupWFCData, isUniformTransparentSignature, NON_TERRAIN_DIR_RE, MIN_GROUP_SIZE }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main()
}
