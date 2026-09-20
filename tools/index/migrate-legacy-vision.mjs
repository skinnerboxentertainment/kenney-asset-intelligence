import fs from "node:fs"
import path from "node:path"
import { openDb } from "../../lib/db.mjs"
import { assetsRoot } from "../../lib/config.mjs"

/**
 * Import the sprite descriptions the Codex pass already produced.
 *
 * 4,741 images across 3 packs were described before this rebuild; that work is
 * good and paid for. Import it rather than re-buying it -- tagged
 * vision_model='codex-legacy' so a later pass can tell it apart from anything
 * this project generates, and so a bad tier can be identified and re-run
 * instead of quietly contaminating the corpus.
 *
 * Rows are matched on (pack, path), not array position. The old
 * tools/merge-analysis.mjs paired analyzed[i] with enriched[i] and would
 * silently attach a description to the wrong sprite if either list shifted.
 */
export function migrateLegacyVision({ dir } = {}) {
  const enrichedDir = dir
    ? path.resolve(dir)
    : path.join(assetsRoot(), "..", "enriched")

  if (!fs.existsSync(enrichedDir)) {
    throw new Error(`No legacy enrichment at ${enrichedDir}\nPass --dir to point at assets/enriched/`)
  }

  const db = openDb()
  const update = db.prepare(`
    UPDATE assets SET observed=?, vision_style=?, vision_model=?, vision_at=?
    WHERE pack=? AND path=?
  `)

  let seen = 0, applied = 0, unmatched = 0
  const misses = []

  db.exec("BEGIN")
  for (const file of fs.readdirSync(enrichedDir).filter((f) => f.endsWith(".json"))) {
    const data = JSON.parse(fs.readFileSync(path.join(enrichedDir, file), "utf-8"))
    for (const pack of data.packs ?? [data]) {
      const slug = pack.pack ?? path.parse(file).name
      for (const f of pack.files ?? []) {
        const vd = f.description?.visualDescriptor
        if (!vd?.visionVerified || !vd.observed) continue
        seen++
        // Legacy manifests store Windows separators; the index uses '/'.
        const rel = f.path.split(/[\\/]/).join("/")
        const r = update.run(vd.observed, vd.visualStyle ?? null, "codex-legacy",
          vd.reviewedAt ?? null, slug, rel)
        if (r.changes > 0) applied++
        else { unmatched++; if (misses.length < 5) misses.push(`${slug}:${rel}`) }
      }
    }
  }
  db.exec("COMMIT")

  console.log(`  legacy descriptors found:   ${seen}`)
  console.log(`  applied to index rows:      ${applied}`)
  console.log(`  unmatched (no such asset):  ${unmatched}`)
  for (const m of misses) console.log(`    - ${m}`)
  db.close()
  return { seen, applied, unmatched }
}
