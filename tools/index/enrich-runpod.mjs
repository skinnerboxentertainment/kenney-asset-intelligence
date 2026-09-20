import fs from "node:fs"
import path from "node:path"
import { openDb } from "../../lib/db.mjs"
import { ROOT } from "../../lib/config.mjs"
import { pool } from "../../lib/concurrency.mjs"
import { buildSheet } from "./sheet.mjs"
import { targets, ingest, PROMPT, SCHEMA, CELL } from "./enrich.mjs"

/**
 * Vision tier via a self-hosted Qwen2.5-VL-7B-Instruct pod (RunPod + vLLM),
 * as an alternative backend to enrich.mjs's Claude Batch API path -- chosen
 * specifically because it draws from neither Anthropic API billing nor the
 * Claude Desktop/Max usage allocation, both explicitly ruled out for this
 * work. Reuses enrich.mjs's contact-sheet building, prompt, schema,
 * target-selection, and DB-ingest logic completely unchanged; only the
 * inference backend (an OpenAI-compatible endpoint instead of the Anthropic
 * SDK) differs.
 *
 * Sheet size and sampling params below are NOT enrich.mjs's Claude-tuned
 * defaults (PER_SHEET=64) -- they're the result of smoke-testing against
 * this actual model/server, which behaves differently at this density:
 *   - 64 sprites/sheet, default sampling: degenerates into repeating one
 *     earlier answer verbatim for every remaining cell (confirmed: 56/56
 *     identical "ladder" entries against a real sheet with hearts, bells,
 *     crosshairs -- none of which are ladders).
 *   - 64 sprites/sheet + repetition_penalty: fixes the repetition but a
 *     *different* failure appears -- the strict JSON-schema grammar
 *     decoder truncates early (6/64 entries, empty fields).
 *   - 16 sprites/sheet + moderate repetition_penalty: clean. 16/16
 *     returned, no repetition, correctly distinguished two real shape
 *     categories in 14/16 cells. This is the configuration below.
 * Full findings in docs/PROVENANCE.md.
 */
const RUNPOD_PER_SHEET = 16
const RUNPOD_COLS = 4

async function describeSheet(endpoint, file) {
  const imageB64 = fs.readFileSync(file).toString("base64")
  const body = {
    model: "Qwen/Qwen2.5-VL-7B-Instruct",
    max_tokens: 2000,
    temperature: 0.3,
    repetition_penalty: 1.15,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:image/png;base64,${imageB64}` } },
        { type: "text", text: PROMPT },
      ],
    }],
    response_format: { type: "json_schema", json_schema: { name: "sprites", schema: SCHEMA, strict: true } },
  }
  const res = await fetch(`${endpoint}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error("no content in response")
  return JSON.parse(text)
}

/**
 * Run against exactly one sheet and report whether the output looks usable,
 * before committing the rest of the pod-hour to a full run. This is the
 * direct answer to "if the vision analysis ain't shit, we'd have to
 * recommit to something local": catch that on one sheet, for pennies.
 */
export async function smokeTest({ endpoint }) {
  const db = openDb({ readonly: true })
  const rows = targets(db, { all: true }).slice(0, RUNPOD_PER_SHEET)
  db.close()
  if (!rows.length) throw new Error("no target rows to smoke-test against")

  const sheetDir = path.join(ROOT, "index", "sheets")
  fs.mkdirSync(sheetDir, { recursive: true })
  const file = path.join(sheetDir, "runpod_smoketest.png")
  await buildSheet({ rows, out: file, cols: RUNPOD_COLS, cell: CELL, label: "id" })
  console.log(`  built smoke-test sheet: ${rows.length} sprites -> ${path.relative(ROOT, file)}`)

  const t0 = Date.now()
  const result = await describeSheet(endpoint, file)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  const sprites = result.sprites ?? []
  console.log(`  got ${sprites.length}/${rows.length} sprite entries in ${secs}s`)

  const idsExpected = new Set(rows.map((r) => String(r.id)))
  const validLabels = sprites.filter((s) => idsExpected.has(String(s.label)))
  console.log(`  label match: ${validLabels.length}/${sprites.length} returned labels correspond to real ids on this sheet`)

  console.log("\n  sample entries:")
  for (const s of sprites.slice(0, 8)) {
    console.log(`    [${s.label}] ${s.what}  (role: ${s.role}, uses: ${(s.uses ?? []).join(", ")})`)
  }

  return { rows, sprites, secs: +secs, labelMatchRate: sprites.length ? validLabels.length / sprites.length : 0 }
}

/** Full run: every sheet in scope, concurrent requests against the pod's own internal batching. */
export async function run({ endpoint, packs = null, all = true, concurrency = 4, limit = null } = {}) {
  const db = openDb({ readonly: true })
  let rows = targets(db, { all, packs })
  db.close()
  if (limit) rows = rows.slice(0, limit)
  if (!rows.length) { console.log("  nothing to describe"); return }

  const sheetDir = path.join(ROOT, "index", "sheets")
  fs.mkdirSync(sheetDir, { recursive: true })

  const chunks = []
  for (let i = 0; i < rows.length; i += RUNPOD_PER_SHEET) chunks.push(rows.slice(i, i + RUNPOD_PER_SHEET))
  console.log(`  ${rows.length} images across ${chunks.length} sheets, concurrency ${concurrency}`)

  const allSprites = []
  let done = 0, failed = 0
  const failures = []
  const t0 = Date.now()

  await pool(chunks, concurrency, async (chunk) => {
    const file = path.join(sheetDir, `runpod_sheet_${chunk[0].id}.png`)
    try {
      await buildSheet({ rows: chunk, out: file, cols: RUNPOD_COLS, cell: CELL, label: "id" })
      const result = await describeSheet(endpoint, file)
      for (const s of result.sprites ?? []) allSprites.push(s)
    } catch (err) {
      failed++
      if (failures.length < 5) failures.push(`sheet starting at id ${chunk[0].id}: ${err.message}`)
    } finally {
      done++
      if (process.stdout.isTTY) process.stdout.write(`\r  ${done}/${chunks.length} sheets (${allSprites.length} sprites so far)`)
    }
  })
  console.log()

  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`  described ${allSprites.length} sprites across ${chunks.length - failed}/${chunks.length} sheets in ${secs}s${failed ? `, ${failed} sheets failed` : ""}`)
  for (const f of failures) console.log(`    ! ${f}`)

  const outFile = path.join(sheetDir, "runpod-descriptions.json")
  fs.writeFileSync(outFile, JSON.stringify({ sprites: allSprites }, null, 2))
  console.log(`  wrote combined descriptions to ${path.relative(ROOT, outFile)}`)

  const r = await ingest({ file: outFile, model: "qwen2.5-vl-7b-instruct (runpod)" })
  console.log(`  ingested: ${r.applied} applied${r.unmatched ? `, ${r.unmatched} unmatched` : ""}`)
  return r
}
