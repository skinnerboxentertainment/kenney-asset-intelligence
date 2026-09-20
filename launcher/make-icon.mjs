import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"
import { assetFile } from "../lib/config.mjs"

/**
 * Build the desktop icon out of an actual asset from the library.
 *
 * Writes a real multi-resolution .ico. Windows Vista and later accept PNG
 * payloads inside an ICO container, so each size is just a PNG with a 16-byte
 * directory entry in front of it -- no BMP/AND-mask encoding needed.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SIZES = [16, 24, 32, 48, 64, 128, 256]
const SOURCE_ID = 60574 // gold star: high contrast, legible at 16px

function buildIco(pngs) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(pngs.length, 4)

  const entries = []
  let offset = 6 + pngs.length * 16
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0) // 0 means 256
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2) // palette count
    e.writeUInt8(0, 3) // reserved
    e.writeUInt16LE(1, 4) // colour planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    entries.push(e)
    offset += data.length
  }

  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)])
}

const db = new DatabaseSync(path.join(HERE, "..", "index", "assets.db"))
const row = db.prepare("SELECT pack, path FROM assets WHERE id=?").get(SOURCE_ID)
db.close()
if (!row) throw new Error(`asset ${SOURCE_ID} not in the index`)

const src = assetFile(row.pack, row.path)
const pngs = []
for (const size of SIZES) {
  // A little padding keeps the sprite off the edge at large sizes, and
  // nearest-neighbour keeps pixel art crisp rather than smeared.
  const inner = Math.max(8, Math.round(size * 0.86))
  const data = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: await sharp(src)
          .resize(inner, inner, { fit: "contain", kernel: size >= 64 ? "lanczos3" : "nearest",
                                  background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer(),
        gravity: "center",
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer()
  pngs.push({ size, data })
}

const out = path.join(HERE, "kenney-assets.ico")
fs.writeFileSync(out, buildIco(pngs))
console.log(`  wrote ${path.relative(path.join(HERE, ".."), out)} from ${row.pack}/${row.path}`)
console.log(`  sizes: ${SIZES.join(", ")}  (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`)
