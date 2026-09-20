import sharp from "sharp"
import { openDb, setMeta } from "../../lib/db.mjs"
import { assetFile, requireAssetsRoot } from "../../lib/config.mjs"
import { pool } from "../../lib/concurrency.mjs"

/**
 * Tier 1: structural analysis from real decoded pixels.
 *
 * Replaces tools/local-analyzer.mjs, which hand-rolled a PNG decoder that
 * read palette *indices* as RGB for colorType 3, never implemented filter
 * type 3 (Average), and used a + b - c where filter 4 requires the Paeth
 * predictor. Every colour, style and score it produced for an indexed or
 * Average-filtered PNG was wrong, and 27,048 rows inherited that silently.
 *
 * sharp/libvips decodes correctly for every colour type, bit depth and
 * filter, and handles JPEG/WebP/GIF too.
 */

const TOL = 30            // per-channel tolerance for "these pixels match"
const OPAQUE = 16         // alpha above this counts as content
const EXACT_COLOR_CAP = 65536

function hex(r, g, b) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
}

export async function analyzeFile(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width: w, height: h } = info
  const total = w * h
  if (!total) return null

  const exact = new Set()
  let exactOverflow = false
  const buckets = new Map()
  let opaquePixels = 0
  let translucent = 0
  let anyAlpha = false

  for (let i = 0; i < total; i++) {
    const o = i * 4
    const r = data[o], g = data[o + 1], b = data[o + 2], a = data[o + 3]

    if (a < 255) { anyAlpha = true; if (a > 0) translucent++ }
    if (a > OPAQUE) opaquePixels++

    if (!exactOverflow) {
      exact.add(((r << 24) | (g << 16) | (b << 8) | a) >>> 0)
      if (exact.size > EXACT_COLOR_CAP) exactOverflow = true
    }
    // Dominant colours ignore transparent pixels; a sprite's "main colour"
    // is not the empty space around it.
    if (a > OPAQUE) {
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
  }

  const uniqueColors = exactOverflow ? EXACT_COLOR_CAP + 1 : exact.size

  const topColors = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => hex(((k >> 10) & 31) << 3, ((k >> 5) & 31) << 3, (k & 31) << 3))

  // Edge match, for tileability. Unlike the old implementation this ignores
  // pairs where both edges are transparent -- otherwise every sprite with a
  // transparent border scored a perfect 1.0 and looked seamlessly tileable.
  const edgeMatch = (aOff, bOff) => {
    const aA = data[aOff + 3], bA = data[bOff + 3]
    if (aA <= OPAQUE && bA <= OPAQUE) return null       // both empty: no evidence
    if (aA <= OPAQUE || bA <= OPAQUE) return false      // one empty: mismatch
    return Math.abs(data[aOff] - data[bOff]) < TOL &&
           Math.abs(data[aOff + 1] - data[bOff + 1]) < TOL &&
           Math.abs(data[aOff + 2] - data[bOff + 2]) < TOL
  }

  let hM = 0, hN = 0, vM = 0, vN = 0
  for (let y = 0; y < h; y++) {
    const r = edgeMatch(y * w * 4, (y * w + w - 1) * 4)
    if (r !== null) { hN++; if (r) hM++ }
  }
  for (let x = 0; x < w; x++) {
    const r = edgeMatch(x * 4, ((h - 1) * w + x) * 4)
    if (r !== null) { vN++; if (r) vM++ }
  }
  let tileScore = (hN && vN) ? ((hM / hN) + (vM / vN)) / 2 : 0

  // A uniform border matches itself trivially. A 16x16 heart drawn on solid
  // black has four identical edges and scored a perfect 1.0, which told a
  // developer it was a seamless terrain tile. Require the edges to actually
  // carry variation before calling anything tileable.
  const edgeVariation = () => {
    const seen = new Set()
    const put = (o) => seen.add((data[o] >> 4) * 256 + (data[o + 1] >> 4) * 16 + (data[o + 2] >> 4))
    for (let y = 0; y < h; y++) { put(y * w * 4); put((y * w + w - 1) * 4) }
    for (let x = 0; x < w; x++) { put(x * 4); put(((h - 1) * w + x) * 4) }
    return seen.size
  }
  if (edgeVariation() < 2) tileScore = 0

  // Horizontal mirror symmetry, alpha included.
  let sM = 0, sN = 0
  const half = w >> 1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < half; x++) {
      const l = (y * w + x) * 4, r = (y * w + (w - 1 - x)) * 4
      sN++
      if (Math.abs(data[l] - data[r]) < TOL && Math.abs(data[l + 1] - data[r + 1]) < TOL &&
          Math.abs(data[l + 2] - data[r + 2]) < TOL && Math.abs(data[l + 3] - data[r + 3]) < TOL) sM++
    }
  }

  // Content = actually-drawn pixels. The old version tested RGB > 10, so a
  // black sprite on transparency measured as almost entirely blank.
  const contentRatio = opaquePixels / total

  let style
  if (uniqueColors <= 4) style = "1-bit"
  else if (uniqueColors <= 64) style = "indexed"
  else if (uniqueColors <= 256) style = "pixel-art"
  else style = "full-color"

  return {
    width: w, height: h,
    unique_colors: uniqueColors,
    top_colors: JSON.stringify(topColors),
    has_alpha: anyAlpha ? 1 : 0,
    alpha_ratio: Math.round((translucent / total) * 1000) / 1000,
    content_ratio: Math.round(contentRatio * 1000) / 1000,
    tile_score: Math.round(tileScore * 1000) / 1000,
    symmetry_score: sN ? Math.round((sM / sN) * 1000) / 1000 : 0,
    style,
  }
}

export async function analyze({ packs = null, force = false, concurrency = 12 } = {}) {
  requireAssetsRoot()
  const db = openDb()
  let sql = "SELECT id, pack, path FROM assets WHERE kind='image'"
  const params = []
  if (!force) sql += " AND unique_colors IS NULL"
  if (packs) { sql += ` AND pack IN (${packs.map(() => "?").join(",")})`; params.push(...packs) }
  const rows = db.prepare(sql).all(...params)

  if (!rows.length) {
    console.log("  nothing to analyze (use --force to redo)")
    db.close(); return
  }
  console.log(`  analyzing ${rows.length} images...`)

  const update = db.prepare(`
    UPDATE assets SET width=?, height=?, unique_colors=?, top_colors=?, has_alpha=?,
      alpha_ratio=?, content_ratio=?, tile_score=?, symmetry_score=?, style=?
    WHERE id=?`)

  let done = 0, failed = 0
  const failures = []
  const t0 = Date.now()
  const pending = []

  await pool(rows, concurrency, async (row) => {
    try {
      const a = await analyzeFile(assetFile(row.pack, row.path))
      if (a) pending.push([a, row.id])
    } catch (err) {
      failed++
      if (failures.length < 5) failures.push(`${row.pack}/${row.path}: ${err.message}`)
    }
    if (++done % 2000 === 0 && process.stdout.isTTY) {
      process.stdout.write(`\r  ${done}/${rows.length}`)
    }
  })

  db.exec("BEGIN")
  for (const [a, id] of pending) {
    update.run(a.width, a.height, a.unique_colors, a.top_colors, a.has_alpha,
      a.alpha_ratio, a.content_ratio, a.tile_score, a.symmetry_score, a.style, id)
  }
  db.exec("COMMIT")

  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`  analyzed ${pending.length}/${rows.length} in ${secs}s${failed ? `, ${failed} failed` : ""}`)
  for (const f of failures) console.log(`    ! ${f}`)
  setMeta(db, "analyzed_at", new Date().toISOString())
  db.close()
}
