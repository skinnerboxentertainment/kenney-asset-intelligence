import fs from "node:fs"
import path from "node:path"
import { openDb } from "../../lib/db.mjs"
import { assetFile } from "../../lib/config.mjs"

/**
 * Copy chosen assets out of the corpus into a project, with a typed manifest
 * the game code can import.
 *
 * Takes explicit ids (what `assets search` returned and a contact sheet
 * confirmed) or a whole pack. Copying beats referencing: the corpus lives
 * outside the project and is not something a build should depend on.
 */
export function install({ ids = null, pack = null, to, manifest = false, flat = false }) {
  if (!to) throw new Error("--to <dir> is required")
  const db = openDb({ readonly: true })

  const rows = ids?.length
    ? ids.map((id) => db.prepare("SELECT * FROM assets WHERE id=?").get(id)).filter(Boolean)
    : db.prepare("SELECT * FROM assets WHERE pack=? AND kind='image'").all(pack)

  if (!rows.length) throw new Error(ids?.length ? "no assets for those ids" : `no assets in pack "${pack}"`)

  const dest = path.resolve(to)
  fs.mkdirSync(dest, { recursive: true })

  const entries = []
  let copied = 0, missing = 0
  for (const r of rows) {
    const src = assetFile(r.pack, r.path)
    const rel = flat ? `${r.pack}_${path.parse(r.path).base}` : path.join(r.pack, ...r.path.split("/"))
    const outFile = path.join(dest, rel)
    if (!fs.existsSync(src)) { missing++; continue }
    fs.mkdirSync(path.dirname(outFile), { recursive: true })
    fs.copyFileSync(src, outFile)
    copied++
    entries.push({
      id: r.id, key: path.parse(r.path).name, file: rel.split(path.sep).join("/"),
      pack: r.pack, width: r.width, height: r.height,
      role: r.role, style: r.style, animFrame: r.anim_frame,
      tileable: r.tile_score >= 0.7, description: r.observed ?? undefined,
    })
  }

  const packs = [...new Set(rows.map((r) => r.pack))]
  if (manifest) {
    const manifestPath = path.join(dest, "assets.manifest.json")
    fs.writeFileSync(manifestPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      license: "CC0-1.0",
      source: "https://kenney.nl",
      attribution: "Assets by Kenney (kenney.nl), CC0. Consider donating: https://kenney.nl/donate",
      packs, assets: entries,
    }, null, 2) + "\n")
  }

  db.close()
  return { copied, missing, dest, packs }
}
