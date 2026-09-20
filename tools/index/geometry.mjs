import sharp from "sharp"
import { openDb } from "../../lib/db.mjs"
import { assetFile, requireAssetsRoot } from "../../lib/config.mjs"
import { pool } from "../../lib/concurrency.mjs"

/**
 * Tier 4a: connected-component silhouette extraction, from real decoded
 * pixels.
 *
 * Ported from vendor/geometric-connectivity-spec-eb8b72/tools/geometry-extractor.mjs
 * (docs/GEOMETRIC-CONNECTIVITY-SPEC.md has the full design rationale) --
 * algorithm unchanged, only the I/O layer changes: the vendor version decoded
 * PNGs with a hand-rolled decoder and wrote into a JSON manifest; this reads
 * from the SQLite index and decodes with sharp (see tools/index/analyze.mjs
 * for the same decode pattern -- one decoder, not a second one).
 */

const ALPHA_THRESHOLD = 16
const MIN_COMPONENT_PX = 4
const SIMPLIFY_EPSILON = 1.0
const MAX_OUTLINE_VERTICES = 64
const MAX_EPSILON_ESCALATIONS = 6

// Non-sprite content this tool skips: pack-level preview/sample composites,
// which are photographic renders, not individual sprites. 3D-category packs
// are already excluded by the caller's SQL (packs.category = '2D').
function isPackComposite(relPath) {
  const base = relPath.split(/[\\/]/).pop().toLowerCase()
  return base === "preview.png" || base === "sample.png"
}

// ─── Union-Find (for the diagonal-adjacency size-filter exemption) ─────────

class UnionFind {
  constructor(n) {
    this.parent = new Int32Array(n)
    for (let i = 0; i < n; i++) this.parent[i] = i
  }
  find(x) {
    while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x] }
    return x
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b)
    if (ra !== rb) this.parent[ra] = rb
  }
}

// ─── Connected-component labeling (4-connectivity, BFS) ────────────────────

function labelComponents(w, h, isFG) {
  const label = new Int32Array(w * h).fill(-1)
  const areas = []
  const bboxes = []
  const queue = new Int32Array(w * h)

  for (let start = 0; start < w * h; start++) {
    if (!isFG(start) || label[start] !== -1) continue
    const id = areas.length
    let qHead = 0, qTail = 0
    queue[qTail++] = start
    label[start] = id
    let minX = start % w, maxX = start % w, minY = (start / w) | 0, maxY = (start / w) | 0
    let area = 0

    while (qHead < qTail) {
      const i = queue[qHead++]
      area++
      const x = i % w, y = (i / w) | 0
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      if (x > 0) { const n = i - 1; if (isFG(n) && label[n] === -1) { label[n] = id; queue[qTail++] = n } }
      if (x < w - 1) { const n = i + 1; if (isFG(n) && label[n] === -1) { label[n] = id; queue[qTail++] = n } }
      if (y > 0) { const n = i - w; if (isFG(n) && label[n] === -1) { label[n] = id; queue[qTail++] = n } }
      if (y < h - 1) { const n = i + w; if (isFG(n) && label[n] === -1) { label[n] = id; queue[qTail++] = n } }
    }

    areas.push(area)
    bboxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 })
  }

  return { label, areas, bboxes }
}

// ─── Diagonal-adjacency merge, for MIN_COMPONENT_PX survival only ──────────
// See docs/GEOMETRIC-CONNECTIVITY-SPEC.md Section 2: a single-pixel-wide
// diagonal stroke is a chain of area-1 4-connected components; without this
// step the size filter below would silently delete it.

function mergedSurvivalAreas(w, h, label, numLabels, areas, isFG) {
  const uf = new UnionFind(numLabels)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (label[i] === -1) continue
      const l = label[i]
      const diagOffsets = []
      if (x > 0 && y > 0) diagOffsets.push(i - w - 1)
      if (x < w - 1 && y > 0) diagOffsets.push(i - w + 1)
      if (x > 0 && y < h - 1) diagOffsets.push(i + w - 1)
      if (x < w - 1 && y < h - 1) diagOffsets.push(i + w + 1)
      for (const n of diagOffsets) {
        if (label[n] !== -1 && label[n] !== l) uf.union(l, label[n])
      }
    }
  }
  const groupArea = new Map()
  for (let l = 0; l < numLabels; l++) {
    const root = uf.find(l)
    groupArea.set(root, (groupArea.get(root) || 0) + areas[l])
  }
  const survivalArea = new Array(numLabels)
  for (let l = 0; l < numLabels; l++) survivalArea[l] = groupArea.get(uf.find(l))
  return survivalArea
}

// ─── Boundary-edge extraction + loop chaining ───────────────────────────────
//
// For a target label, every pixel edge whose neighbor is NOT that exact
// label (background, a different component, or out of bounds) is a
// boundary edge. Orienting each edge consistently (clockwise around the
// labeled region, screen coords x-right/y-down) makes edges chain into
// closed loops automatically. Because holes are also "target label inside,
// non-target label outside," the same pass yields hole loops too — no
// separate background labeling or point-in-polygon step needed. Loops are
// told apart by enclosed area: the one with the largest |area| is the
// outer boundary, the rest are holes. This supersedes the spec's original
// background-connected-component hole-seeding design — simpler and doesn't
// depend on bbox/border heuristics.

function traceLoops(w, h, label, targetLabel) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? -1 : label[y * w + x]
  const edgesFrom = new Map() // cornerKey -> [{to: [x,y]}]
  const keyOf = (x, y) => x * (h + 1) + y

  const pushEdge = (fx, fy, tx, ty) => {
    const k = keyOf(fx, fy)
    if (!edgesFrom.has(k)) edgesFrom.set(k, [])
    edgesFrom.get(k).push([tx, ty])
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (at(x, y) !== targetLabel) continue
      if (at(x, y - 1) !== targetLabel) pushEdge(x, y, x + 1, y)         // top: L->R
      if (at(x + 1, y) !== targetLabel) pushEdge(x + 1, y, x + 1, y + 1) // right: T->B
      if (at(x, y + 1) !== targetLabel) pushEdge(x + 1, y + 1, x, y + 1) // bottom: R->L
      if (at(x - 1, y) !== targetLabel) pushEdge(x, y + 1, x, y)         // left: B->T
    }
  }

  const loops = []
  for (const [startKey, startEdges] of edgesFrom) {
    while (startEdges.length > 0) {
      const startPoint = [Math.floor(startKey / (h + 1)), startKey % (h + 1)]
      let current = startPoint
      const loop = [current]
      let guard = 0
      while (guard++ < (w + 1) * (h + 1) * 4 + 8) {
        const k = keyOf(current[0], current[1])
        const options = edgesFrom.get(k)
        if (!options || options.length === 0) break
        const next = options.pop()
        current = next
        if (current[0] === startPoint[0] && current[1] === startPoint[1]) break
        loop.push(current)
      }
      loops.push(loop)
    }
  }
  return loops
}

function shoelaceArea(points) {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    sum += x1 * y2 - x2 * y1
  }
  return sum / 2
}

// ─── Ramer-Douglas-Peucker, with the required closed-contour split ─────────
// (RDP is defined on an open polyline; a traced loop is closed, so split at
// the two most-separated points into two open chains, simplify each, rejoin.)

function distToSegment(p, a, b) {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function rdpOpen(points, epsilon) {
  if (points.length < 3) return points.slice()
  let maxDist = -1, maxIdx = -1
  const a = points[0], b = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const d = distToSegment(points[i], a, b)
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }
  if (maxDist <= epsilon) return [a, b]
  const left = rdpOpen(points.slice(0, maxIdx + 1), epsilon)
  const right = rdpOpen(points.slice(maxIdx), epsilon)
  return left.slice(0, -1).concat(right)
}

// Finding the true maximum-separation pair is O(n^2) and, at catalog scale,
// a large composite/tilemap sheet's raw (unsimplified) traced loop can run
// into the thousands of points — an exact search here, re-run on every
// epsilon-escalation attempt, is what made an early full-catalog run stall
// for minutes on a handful of pathological files. A 2-pass farthest-point
// heuristic (pick any point, find the point farthest from it, find the
// point farthest from THAT) is O(n), doesn't need to find the true
// diameter — just two reasonably-separated points so RDP gets two
// well-conditioned open chains — and is computed once per loop, not once
// per escalation attempt (see splitClosedLoop below).
function findSplitPoints(loop) {
  let far1 = 0, bestD = -1
  const [x0, y0] = loop[0]
  for (let i = 1; i < loop.length; i++) {
    const d = (loop[i][0] - x0) ** 2 + (loop[i][1] - y0) ** 2
    if (d > bestD) { bestD = d; far1 = i }
  }
  let far2 = 0
  bestD = -1
  const [fx, fy] = loop[far1]
  for (let i = 0; i < loop.length; i++) {
    const d = (loop[i][0] - fx) ** 2 + (loop[i][1] - fy) ** 2
    if (d > bestD) { bestD = d; far2 = i }
  }
  return far1 <= far2 ? [far1, far2] : [far2, far1]
}

// Splits a closed loop into its two open chains ONCE — the split points are
// geometric, independent of epsilon — so the epsilon-escalation retry loop
// in computeComponentGeometry only re-runs the (cheap, per-attempt) RDP
// pass, not the split search.
function splitClosedLoop(loop) {
  if (loop.length <= 4) return null // too small to need splitting; caller returns as-is
  const [iMax, jMax] = findSplitPoints(loop)
  const chain1 = loop.slice(iMax, jMax + 1)
  const chain2 = loop.slice(jMax).concat(loop.slice(0, iMax + 1))
  return [chain1, chain2]
}

function simplifyChains(chains, epsilon) {
  const s1 = rdpOpen(chains[0], epsilon)
  const s2 = rdpOpen(chains[1], epsilon)
  return s1.slice(0, -1).concat(s2.slice(0, -1))
}

// ─── Per-component geometry ─────────────────────────────────────────────────

function computeComponentGeometry(w, h, label, targetLabel, area, bbox) {
  const loops = traceLoops(w, h, label, targetLabel)
  if (loops.length === 0) return null

  const withArea = loops.map(loop => ({ loop, absArea: Math.abs(shoelaceArea(loop)) }))
  withArea.sort((a, b) => b.absArea - a.absArea)
  const outerLoop = withArea[0].loop
  const holeLoops = withArea.slice(1).map(x => x.loop)

  // Split search is O(n) and geometric (independent of epsilon) — compute
  // once per loop, not once per escalation attempt (see splitClosedLoop).
  const outerChains = splitClosedLoop(outerLoop)
  const holeChains = holeLoops.map(splitClosedLoop)
  const simplifyLoop = (loop, chains, epsilon) => chains ? simplifyChains(chains, epsilon) : loop.slice()

  let epsilon = SIMPLIFY_EPSILON
  let outline, holes
  for (let attempt = 0; attempt <= MAX_EPSILON_ESCALATIONS; attempt++) {
    outline = simplifyLoop(outerLoop, outerChains, epsilon)
    holes = holeLoops.map((h, i) => simplifyLoop(h, holeChains[i], epsilon))
    const total = outline.length + holes.reduce((s, h) => s + h.length, 0)
    if (total <= MAX_OUTLINE_VERTICES) break
    epsilon *= 1.5
  }

  const totalVertices = outline.length + holes.reduce((s, h) => s + h.length, 0)
  if (totalVertices > MAX_OUTLINE_VERTICES) {
    console.warn(`  ! component exceeds MAX_OUTLINE_VERTICES even after epsilon escalation (${totalVertices} verts, bbox ${JSON.stringify(bbox)})`)
  }

  return {
    id: targetLabel,
    area,
    bbox,
    outline,
    holes,
    simplifyEpsilon: Math.round(epsilon * 100) / 100,
  }
}

// ─── Public entry point (tested directly by tools/index/test-geometry.mjs) ───

function computeGeometry(img) {
  const { width: w, height: h, pixels } = img
  const isFG = (i) => pixels[i * 4 + 3] >= ALPHA_THRESHOLD

  const { label, areas, bboxes } = labelComponents(w, h, isFG)
  const numLabels = areas.length

  if (numLabels === 0) {
    return { componentCount: 0, isConnected: false, components: [] }
  }

  const survivalArea = mergedSurvivalAreas(w, h, label, numLabels, areas, isFG)
  const components = []
  for (let l = 0; l < numLabels; l++) {
    if (survivalArea[l] < MIN_COMPONENT_PX) continue
    const comp = computeComponentGeometry(w, h, label, l, areas[l], bboxes[l])
    if (comp) components.push(comp)
  }

  return {
    componentCount: components.length,
    isConnected: components.length === 1,
    components,
  }
}

// ─── DB orchestration ───────────────────────────────────────────────────────

async function decodeImage(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, pixels: data }
}

export async function runGeometry({ packs = null, force = false, concurrency = 12 } = {}) {
  requireAssetsRoot()
  const db = openDb()
  let sql = `
    SELECT assets.id, assets.pack, assets.path
    FROM assets JOIN packs ON assets.pack = packs.slug
    WHERE assets.kind = 'image' AND assets.ext = '.png' AND packs.category = '2D'`
  const params = []
  if (!force) sql += " AND assets.geometry_json IS NULL"
  if (packs) { sql += ` AND assets.pack IN (${packs.map(() => "?").join(",")})`; params.push(...packs) }
  const rows = db.prepare(sql).all(...params).filter((r) => !isPackComposite(r.path))

  if (!rows.length) {
    console.log("  nothing to extract geometry for (use --force to redo)")
    db.close(); return
  }
  console.log(`  extracting geometry for ${rows.length} images...`)

  const update = db.prepare("UPDATE assets SET geometry_json=? WHERE id=?")
  let done = 0, failed = 0
  const failures = []
  const t0 = Date.now()
  const pending = []

  await pool(rows, concurrency, async (row) => {
    try {
      const img = await decodeImage(assetFile(row.pack, row.path))
      const geo = computeGeometry(img)
      pending.push([JSON.stringify(geo), row.id])
    } catch (err) {
      failed++
      if (failures.length < 5) failures.push(`${row.pack}/${row.path}: ${err.message}`)
    }
    if (++done % 2000 === 0 && process.stdout.isTTY) process.stdout.write(`\r  ${done}/${rows.length}`)
  })

  db.exec("BEGIN")
  for (const [json, id] of pending) update.run(json, id)
  db.exec("COMMIT")

  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`  extracted geometry for ${pending.length}/${rows.length} in ${secs}s${failed ? `, ${failed} failed` : ""}`)
  for (const f of failures) console.log(`    ! ${f}`)
  db.close()
}

export { computeGeometry, labelComponents, traceLoops, findSplitPoints, splitClosedLoop, simplifyChains, isPackComposite }
