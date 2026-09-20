// Validation for tools/wfc-adjacency.mjs — see
// docs/WFC-TILE-ADJACENCY-SPEC.md "Validation". Synthetic in-memory tile
// fixtures, same pattern as tools/test-geometry-extractor.mjs.

import assert from "node:assert/strict"
import { groupEligibleTiles, edgeSockets, computeAdjacency, computeGroupWFCData, isUniformTransparentSignature } from "./wfc-adjacency.mjs"

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

function solidTile(w, h, r, g, b) {
  const pixels = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    pixels[i * 4] = r; pixels[i * 4 + 1] = g; pixels[i * 4 + 2] = b; pixels[i * 4 + 3] = 255
  }
  return { width: w, height: h, pixels }
}

// Tile with a distinct-colored right edge and a matching (same as its own
// right edge) left edge column, everything else a base color — used to
// test edge-specific matching rather than whole-tile color matching.
function edgedTile(w, h, baseColor, rightColor, leftColor) {
  const img = solidTile(w, h, ...baseColor)
  for (let y = 0; y < h; y++) {
    const rOff = (y * w + (w - 1)) * 4
    img.pixels[rOff] = rightColor[0]; img.pixels[rOff + 1] = rightColor[1]; img.pixels[rOff + 2] = rightColor[2]
    const lOff = (y * w + 0) * 4
    img.pixels[lOff] = leftColor[0]; img.pixels[lOff + 1] = leftColor[1]; img.pixels[lOff + 2] = leftColor[2]
  }
  return img
}

// ── Fixture: identical solid-color tiles are compatible on every side ────

test("two identical solid-color tiles are adjacency-compatible right<->left and bottom<->top", () => {
  const a = { path: "a.png", sockets: edgeSockets(solidTile(4, 4, 100, 150, 200)) }
  const b = { path: "b.png", sockets: edgeSockets(solidTile(4, 4, 100, 150, 200)) }
  const adj = computeAdjacency([a, b])
  const rightPairs = adj.right.map(([x, y]) => `${x}>${y}`)
  assert.ok(rightPairs.includes("a.png>b.png"), "a.right should match b.left")
  assert.ok(rightPairs.includes("b.png>a.png"), "b.right should match a.left")
})

// ── Fixture: differently-colored edges are not compatible ────────────────

test("tiles with different-colored touching edges are not adjacency-compatible", () => {
  const a = { path: "a.png", sockets: edgeSockets(edgedTile(4, 4, [50, 50, 50], [255, 0, 0], [50, 50, 50])) }
  const b = { path: "b.png", sockets: edgeSockets(edgedTile(4, 4, [50, 50, 50], [50, 50, 50], [0, 255, 0])) }
  const adj = computeAdjacency([a, b])
  const rightPairs = adj.right.map(([x, y]) => `${x}>${y}`)
  assert.ok(!rightPairs.includes("a.png>b.png"), "a's red right edge must not match b's green left edge")
})

// ── Fixture: a self-tiling tile is compatible with itself ────────────────

test("a solid-color tile is self-compatible (self-tiling) in every direction", () => {
  const a = { path: "a.png", sockets: edgeSockets(solidTile(4, 4, 10, 20, 30)) }
  const adj = computeAdjacency([a])
  assert.ok(adj.right.some(([x, y]) => x === "a.png" && y === "a.png"))
  assert.ok(adj.bottom.some(([x, y]) => x === "a.png" && y === "a.png"))
})

// ── Fixture: transparent-padding edges are excluded from output (real-data fix) ─
// See isUniformTransparentSignature's comment in wfc-adjacency.mjs: a real
// 1632-tile icon pack had 1182 tiles sharing one transparent edge
// signature, implying ~1.4M near-meaningless pairs and a 168MB output
// file. Two icons with fully transparent padding on the touching side
// must not produce an adjacency pair, even though their signatures match.

function transparentTile(w, h) {
  return { width: w, height: h, pixels: Buffer.alloc(w * h * 4, 0) }
}

test("two tiles with fully transparent touching edges are NOT reported as adjacency-compatible", () => {
  const a = { path: "icon-a.png", sockets: edgeSockets(transparentTile(6, 6)) }
  const b = { path: "icon-b.png", sockets: edgeSockets(transparentTile(6, 6)) }
  assert.ok(isUniformTransparentSignature(a.sockets.right))
  const adj = computeAdjacency([a, b])
  const rightPairs = adj.right.map(([x, y]) => `${x}>${y}`)
  assert.ok(!rightPairs.includes("icon-a.png>icon-b.png"), "transparent padding must not be reported as meaningful adjacency")
})

test("a uniform OPAQUE solid-color tile (legitimate self-tiling terrain) is still reported compatible", () => {
  // Regression guard: the transparent-edge exclusion above must not also
  // exclude a real flat-color terrain tile designed to self-tile.
  const a = { path: "floor.png", sockets: edgeSockets(solidTile(4, 4, 80, 60, 40)) }
  assert.ok(!isUniformTransparentSignature(a.sockets.right), "an opaque uniform edge is not transparent")
  const adj = computeAdjacency([a])
  assert.ok(adj.right.some(([x, y]) => x === "floor.png" && y === "floor.png"))
})

// ── Fixture: directory-name blocklist excludes character-like directories ─

test("a uniform-size group under a 'Characters' directory is excluded despite qualifying by size", () => {
  const pack = {
    category: "2D",
    files: [
      { type: "image", ext: ".png", path: "Characters/tile_0000.png", width: 24, height: 24 },
      { type: "image", ext: ".png", path: "Characters/tile_0001.png", width: 24, height: 24 },
      { type: "image", ext: ".png", path: "Characters/tile_0002.png", width: 24, height: 24 },
      { type: "image", ext: ".png", path: "Characters/tile_0003.png", width: 24, height: 24 },
      { type: "image", ext: ".png", path: "Tiles/tile_0000.png", width: 18, height: 18 },
      { type: "image", ext: ".png", path: "Tiles/tile_0001.png", width: 18, height: 18 },
      { type: "image", ext: ".png", path: "Tiles/tile_0002.png", width: 18, height: 18 },
      { type: "image", ext: ".png", path: "Tiles/tile_0003.png", width: 18, height: 18 },
    ],
  }
  const groups = groupEligibleTiles(pack)
  assert.equal(groups.length, 1, "only the non-character group should qualify")
  assert.equal(groups[0].dir, "Tiles")
})

// ── Fixture: a small group (below MIN_GROUP_SIZE) is excluded ────────────

test("a group with fewer than MIN_GROUP_SIZE files is excluded", () => {
  const pack = {
    category: "2D",
    files: [
      { type: "image", ext: ".png", path: "Tiles/tile_0000.png", width: 18, height: 18 },
      { type: "image", ext: ".png", path: "Tiles/tile_0001.png", width: 18, height: 18 },
    ],
  }
  const groups = groupEligibleTiles(pack)
  assert.equal(groups.length, 0)
})

// ── Fixture: a 3D-category pack contributes no groups ─────────────────────

test("a 3D-category pack is excluded regardless of directory/size structure", () => {
  const pack = {
    category: "3D",
    files: [
      { type: "image", ext: ".png", path: "Tiles/tile_0000.png", width: 18, height: 18 },
      { type: "image", ext: ".png", path: "Tiles/tile_0001.png", width: 18, height: 18 },
      { type: "image", ext: ".png", path: "Tiles/tile_0002.png", width: 18, height: 18 },
      { type: "image", ext: ".png", path: "Tiles/tile_0003.png", width: 18, height: 18 },
    ],
  }
  const groups = groupEligibleTiles(pack)
  assert.equal(groups.length, 0)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
