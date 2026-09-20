// Tier A validation (docs/GEOMETRIC-CONNECTIVITY-SPEC.md, Validation plan):
// an automated, exact-invariant oracle for tools/index/geometry.mjs,
// not hand-verification.
//
// Ported unmodified from vendor/geometric-connectivity-spec-eb8b72/tools/test-geometry-extractor.mjs
// -- only the import path changed. This is deliberate: these fixtures are the
// phase's own stated oracle (KICKOFF.md Phase 1), so the safest port keeps
// them byte-for-byte identical rather than rewriting them against the new
// DB-backed tool.
//
// Design note / deviation from the spec's literal wording: fixtures here
// are synthetic in-memory RGBA pixel buffers ({width,height,pixels}), the
// same shape computeGeometry() consumes, rather than encoded PNG files.
// PNG decoding is exercised separately, against real extracted catalog
// files, by tools/index/analyze.mjs's existing sharp-based decode path.
// Splitting the two keeps this file about the geometry algorithm only and
// lets fixtures be built with exact pixel control.
//
// Assertions are order/rotation-invariant (vertex-count, corner-point set,
// shoelace area, hole count) rather than one fixed ordered array, since the
// tracer's starting point and direction are implementation details, not
// part of the contract.

import assert from "node:assert/strict"
import { computeGeometry } from "./geometry.mjs"

let passed = 0, failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ok  - ${name}`)
    passed++
  } catch (err) {
    console.log(`  FAIL - ${name}`)
    console.log(`         ${err.message}`)
    failed++
  }
}

function blankImage(w, h) {
  return { width: w, height: h, pixels: Buffer.alloc(w * h * 4, 0) }
}

function setPixel(img, x, y, a = 255, r = 128, g = 128, b = 128) {
  const off = (y * img.width + x) * 4
  img.pixels[off] = r; img.pixels[off + 1] = g; img.pixels[off + 2] = b; img.pixels[off + 3] = a
}

function fillRect(img, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPixel(img, x, y)
}

function shoelaceArea(points) {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    sum += x1 * y2 - x2 * y1
  }
  return Math.abs(sum) / 2
}

function pointSet(points) {
  return new Set(points.map(([x, y]) => `${x},${y}`))
}

// ── Fixture 1: solid filled square ──────────────────────────────────────

test("solid 8x8 square at origin -> 1 component, 4-vertex outline, area 64, 0 holes", () => {
  const img = blankImage(10, 10)
  fillRect(img, 0, 0, 8, 8)
  const geo = computeGeometry(img)
  assert.equal(geo.componentCount, 1)
  assert.equal(geo.isConnected, true)
  const comp = geo.components[0]
  assert.equal(comp.area, 64)
  assert.equal(comp.holes.length, 0)
  assert.equal(comp.outline.length, 4)
  assert.equal(shoelaceArea(comp.outline), 64)
  const expectedCorners = pointSet([[0, 0], [8, 0], [8, 8], [0, 8]])
  assert.deepEqual(pointSet(comp.outline), expectedCorners)
})

// ── Fixture 2: ring / donut (hole) ──────────────────────────────────────

test("10x10 square with a 4x4 hole -> 1 component, 1 hole, correct areas", () => {
  const img = blankImage(14, 14)
  fillRect(img, 0, 0, 10, 10)
  // punch a 4x4 transparent hole in the middle, fully enclosed
  for (let y = 3; y < 7; y++) for (let x = 3; x < 7; x++) setPixel(img, x, y, 0)
  const geo = computeGeometry(img)
  assert.equal(geo.componentCount, 1)
  const comp = geo.components[0]
  assert.equal(comp.area, 100 - 16) // 10x10 minus the 4x4 hole
  assert.equal(comp.holes.length, 1)
  assert.equal(shoelaceArea(comp.outline), 100)
  assert.equal(shoelaceArea(comp.holes[0]), 16)
  assert.equal(comp.outline.length, 4)
  assert.equal(comp.holes[0].length, 4)
})

// ── Fixture 3: two disconnected blobs ───────────────────────────────────

test("two disconnected 3x3 blobs -> 2 components, isConnected false", () => {
  const img = blankImage(20, 10)
  fillRect(img, 0, 0, 3, 3)
  fillRect(img, 10, 0, 3, 3)
  const geo = computeGeometry(img)
  assert.equal(geo.componentCount, 2)
  assert.equal(geo.isConnected, false)
  assert.deepEqual(geo.components.map(c => c.area).sort(), [9, 9])
})

// ── Fixture 4: fully transparent image ──────────────────────────────────

test("fully transparent image -> componentCount 0, isConnected false", () => {
  const img = blankImage(16, 16)
  const geo = computeGeometry(img)
  assert.equal(geo.componentCount, 0)
  assert.equal(geo.isConnected, false)
  assert.deepEqual(geo.components, [])
})

// ── Fixture 5: single-pixel-wide diagonal stroke (the defect this spec fixes) ─

test("single-pixel diagonal stroke survives the size filter (not componentCount 0)", () => {
  const img = blankImage(10, 10)
  setPixel(img, 0, 0); setPixel(img, 1, 1); setPixel(img, 2, 2); setPixel(img, 3, 3)
  const geo = computeGeometry(img)
  // Each pixel is its own 4-connected component (no shared edges between
  // diagonal neighbors), but the diagonal-adjacency merge makes the whole
  // 4-pixel group's combined area (4) meet MIN_COMPONENT_PX, so all 4
  // survive as separate 1-pixel components rather than being deleted.
  assert.equal(geo.componentCount, 4, "a diagonal stroke must not be reported as empty")
  assert.equal(geo.isConnected, false)
  for (const c of geo.components) assert.equal(c.area, 1)
})

// ── Fixture 6: two components touching only diagonally stay separate ────

test("two components touching only at a diagonal corner stay 2 separate, non-crossing contours", () => {
  const img = blankImage(10, 10)
  fillRect(img, 0, 0, 3, 3) // occupies (0,0)-(2,2)
  fillRect(img, 3, 3, 3, 3) // occupies (3,3)-(5,5), touches the first only at corner (3,3)
  const geo = computeGeometry(img)
  assert.equal(geo.componentCount, 2)
  for (const c of geo.components) {
    assert.equal(c.outline.length, 4, "each 3x3 block's outline must stay a clean 4-vertex square, not merge into the other block")
    assert.equal(shoelaceArea(c.outline), 9)
  }
})

// ── Fixture 7: sub-MIN_COMPONENT_PX noise (not diagonal) is still dropped ─

test("isolated single opaque pixel (no diagonal neighbors) is dropped as noise", () => {
  const img = blankImage(10, 10)
  setPixel(img, 5, 5)
  const geo = computeGeometry(img)
  assert.equal(geo.componentCount, 0)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
