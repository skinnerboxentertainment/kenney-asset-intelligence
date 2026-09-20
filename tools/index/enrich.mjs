import fs from "node:fs"
import path from "node:path"
import { openDb } from "../../lib/db.mjs"
import { ROOT } from "../../lib/config.mjs"
import { buildSheet } from "./sheet.mjs"

/**
 * Tier 3: per-sprite descriptions, via labelled contact sheets.
 *
 * One sheet of 64 sprites costs one request instead of 64. The technique is
 * inherited from the pass that produced the existing 4,741 descriptions
 * ("direct inspection of source pixels in labeled contact sheet"); only the
 * backend changes.
 *
 * Targeting is decided by eval/, not by appetite. Vision moves semantic recall
 * from 0% to 60% and moves lexical recall not at all, so the default target is
 * the images whose filenames carry no meaning -- where the entire gain lives.
 * --all is available and costs roughly 3x more for nothing the eval detects.
 */

const MODEL = "claude-opus-5"
const PER_SHEET = 64
const CELL = 128
const COLS = 8

// Cost model. Anthropic image tokens are approximately (w * h) / 750.
const PRICES = {
  "claude-opus-5": { in: 5, out: 25 },
  "claude-sonnet-5": { in: 2, out: 10 },
  "claude-haiku-4-5": { in: 1, out: 5 },
}
const BATCH_DISCOUNT = 0.5

const SCHEMA = {
  type: "object",
  properties: {
    sprites: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "the id printed under the sprite" },
          what: { type: "string", description: "what the sprite depicts, one sentence" },
          role: {
            type: "string",
            enum: ["character", "enemy", "tile", "background", "ui", "effect", "pickup", "weapon", "prop", "other"],
          },
          uses: {
            type: "array",
            items: { type: "string" },
            description: "functional game vocabulary a developer would search for",
          },
          style: { type: "string" },
        },
        required: ["label", "what", "role", "uses", "style"],
        additionalProperties: false,
      },
    },
  },
  required: ["sprites"],
  additionalProperties: false,
}

const PROMPT = [
  "This is a contact sheet of individual game sprites on a grey grid.",
  "Each cell holds one sprite with its numeric id printed underneath.",
  "",
  "Describe every sprite you can see, one entry per cell, using the printed id as the label.",
  "",
  'For "uses", give the functional vocabulary a game developer would actually search for --',
  '"ladder", "slope", "health pickup", "checkpoint flag", "conveyor" -- not just visual',
  'appearance. A description reading "vertical strip with a checker seam" is useless to',
  "someone searching for a ladder; say ladder.",
  "",
  "Skip empty cells.",
].join("\n")

/** Images whose filename carries no meaning -- the only ones vision can help. */
function isOpaqueName(p) {
  const stem = path.posix.parse(p).name.toLowerCase()
  const words = (stem.match(/[a-z]{3,}/g) ?? []).filter((w) => !["png", "the", "and"].includes(w))
  return /^[a-z]{0,6}[_-]?[0-9]{2,}$/.test(stem) || words.length === 0
}

function targets(db, { all = false, packs = null, redo = false }) {
  let sql = "SELECT id, pack, path, width, height FROM assets WHERE kind='image' AND is_atlas=0"
  const params = []
  if (!redo) sql += " AND observed IS NULL"
  if (packs) {
    sql += " AND pack IN (" + packs.map(() => "?").join(",") + ")"
    params.push(...packs)
  }
  const rows = db.prepare(sql + " ORDER BY pack, path").all(...params)
  return all ? rows : rows.filter((r) => isOpaqueName(r.path))
}

function estimate(sheetCount, model) {
  const px = COLS * CELL * Math.ceil(PER_SHEET / COLS) * CELL
  const imgTok = Math.round(px / 750)
  const inTok = (imgTok + 400) * sheetCount
  const outTok = PER_SHEET * 55 * sheetCount
  const p = PRICES[model] ?? PRICES[MODEL]
  const std = (inTok / 1e6) * p.in + (outTok / 1e6) * p.out
  return { imgTok, inTok, outTok, std, batch: std * BATCH_DISCOUNT }
}

export function plan({ all = false, packs = null, redo = false, model = MODEL } = {}) {
  const db = openDb({ readonly: true })
  const rows = targets(db, { all, packs, redo })
  const sheets = Math.ceil(rows.length / PER_SHEET)
  const e = estimate(sheets, model)
  const total = db.prepare(
    "SELECT count(*) c FROM assets WHERE kind='image' AND is_atlas=0",
  ).get().c

  const scope = all ? "all images" : "images with opaque filenames"
  console.log("target        " + scope + (packs ? " in " + packs.join(", ") : ""))
  console.log("              " + rows.length + " of " + total +
    " images (" + ((rows.length / total) * 100).toFixed(1) + "%)")
  console.log("sheets        " + sheets + "  (" + PER_SHEET + " sprites each, " +
    COLS * CELL + "x" + Math.ceil(PER_SHEET / COLS) * CELL + "px)")
  console.log("model         " + model)
  console.log("tokens        ~" + e.inTok.toLocaleString() + " in, ~" + e.outTok.toLocaleString() + " out")
  console.log("estimated     $" + e.std.toFixed(2) + " standard")
  console.log("              $" + e.batch.toFixed(2) + " via Batch API (50% off, up to 24h)")
  console.log("")
  console.log("Estimates only -- token volume is modelled, not measured.")
  console.log("Nothing was sent. To spend: assets enrich --submit")

  const byPack = {}
  for (const r of rows) byPack[r.pack] = (byPack[r.pack] ?? 0) + 1
  const top = Object.entries(byPack).sort((a, b) => b[1] - a[1]).slice(0, 8)
  if (top.length) {
    console.log("")
    console.log("largest targets:")
    for (const [p, c] of top) console.log("  " + p.padEnd(28) + c)
  }
  db.close()
  return { rows, sheets, estimate: e }
}

export async function submit({ all = false, packs = null, redo = false, model = MODEL, outDir = "index/batches", sheetsOnly = false } = {}) {
  const db = openDb({ readonly: true })
  const rows = targets(db, { all, packs, redo })
  db.close()
  if (!rows.length) throw new Error("nothing to enrich")

  const sheetDir = path.join(ROOT, "index", "sheets")
  fs.mkdirSync(sheetDir, { recursive: true })

  const requests = []
  const mapping = {}
  for (let i = 0; i < rows.length; i += PER_SHEET) {
    const chunk = rows.slice(i, i + PER_SHEET)
    const id = "sheet_" + String(i / PER_SHEET).padStart(4, "0")
    const file = path.join(sheetDir, id + ".png")
    // Reuse a sheet already rendered: submitting is retried far more often
    // than the corpus changes, and regenerating 118 sheets each time is waste.
    if (!fs.existsSync(file)) {
      await buildSheet({ rows: chunk, out: file, cols: COLS, cell: CELL, label: "id" })
    }
    mapping[id] = chunk.map((r) => r.id)
    requests.push({
      custom_id: id,
      params: {
        model,
        max_tokens: 8000,
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: fs.readFileSync(file).toString("base64") },
            },
            { type: "text", text: PROMPT },
          ],
        }],
      },
    })
  }

  if (sheetsOnly) {
    const bytes = requests.reduce((n, r) => n + r.params.messages[0].content[0].source.data.length, 0)
    console.log("  rendered " + requests.length + " sheets to " + path.relative(ROOT, sheetDir))
    console.log("  payload  ~" + (bytes / 1024 / 1024).toFixed(1) + " MB base64")
    console.log("  nothing sent (--sheets-only)")
    return null
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk")
  const client = new Anthropic()
  const batch = await client.messages.batches.create({ requests })
  const dir = path.join(ROOT, outDir)
  fs.mkdirSync(dir, { recursive: true })
  const metaFile = path.join(dir, batch.id + ".json")
  fs.writeFileSync(metaFile, JSON.stringify(
    { id: batch.id, model, created: new Date().toISOString(), mapping }, null, 2))

  console.log("  submitted " + requests.length + " sheets as " + batch.id)
  console.log("  mapping saved to " + path.relative(ROOT, metaFile))
  console.log("  collect with: assets enrich --collect " + batch.id)
  return batch.id
}

export async function collect({ batchId, outDir = "index/batches" } = {}) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk")
  const client = new Anthropic()
  const meta = JSON.parse(
    fs.readFileSync(path.join(ROOT, outDir, batchId + ".json"), "utf-8"))

  const info = await client.messages.batches.retrieve(batchId)
  if (info.processing_status !== "ended") {
    console.log("  " + batchId + " is " + info.processing_status + "; nothing to collect yet")
    return
  }

  const db = openDb()
  const update = db.prepare(
    "UPDATE assets SET observed=?, vision_style=?, vision_model=?, vision_at=? WHERE id=?")
  const now = new Date().toISOString()
  let applied = 0
  let failed = 0

  db.exec("BEGIN")
  // Results arrive in any order; they are keyed by custom_id, never position.
  for await (const res of await client.messages.batches.results(batchId)) {
    if (res.result.type !== "succeeded") { failed++; continue }
    const text = res.result.message.content.find((b) => b.type === "text")?.text
    if (!text) { failed++; continue }
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      failed++
      continue
    }
    for (const s of parsed.sprites ?? []) {
      const id = Number(s.label)
      if (!Number.isFinite(id)) continue
      const uses = (s.uses ?? []).length ? "Used as: " + s.uses.join(", ") + "." : null
      const observed = [s.what, uses].filter(Boolean).join(" ")
      if (update.run(observed, s.style ?? null, meta.model, now, id).changes) applied++
    }
  }
  db.exec("COMMIT")

  const { rebuildFts } = await import("./build.mjs")
  rebuildFts(db)
  db.close()
  console.log("  applied " + applied + " descriptions" +
    (failed ? ", " + failed + " responses unusable" : ""))
  console.log("  re-run 'assets eval' to see what it bought")
}

/**
 * Ingest descriptions produced by looking at the sheets directly, rather than
 * by paying the Batch API to look at them.
 *
 * Same columns, same provenance discipline as collect(): every row records
 * which model made the claim and when, so a bad pass can be found and redone.
 * Input is the same shape the batch returns -- { sprites: [...] } -- keyed by
 * the id printed under each sprite, never by position.
 */
export async function ingest({ file, model = "claude-opus-5 (in-session)" } = {}) {
  const payload = JSON.parse(fs.readFileSync(path.resolve(file), "utf-8"))
  const sprites = payload.sprites ?? payload
  const db = openDb()
  // A new description is an unchecked claim, whatever its predecessor was.
  const update = db.prepare(
    "UPDATE assets SET observed=?, vision_style=?, vision_model=?, vision_at=?, audited=0, audited_at=NULL WHERE id=?")
  const now = new Date().toISOString()
  let applied = 0
  let unmatched = 0

  db.exec("BEGIN")
  for (const s of sprites) {
    const id = Number(s.label)
    if (!Number.isFinite(id)) { unmatched++; continue }
    const uses = (s.uses ?? []).length ? "Used as: " + s.uses.join(", ") + "." : null
    const observed = [s.what, uses].filter(Boolean).join(" ")
    if (update.run(observed, s.style ?? null, model, now, id).changes) applied++
    else unmatched++
  }
  db.exec("COMMIT")

  const { rebuildFts } = await import("./build.mjs")
  rebuildFts(db)
  db.close()
  console.log("  applied " + applied + " descriptions" + (unmatched ? ", " + unmatched + " unmatched" : ""))
  return { applied, unmatched }
}
