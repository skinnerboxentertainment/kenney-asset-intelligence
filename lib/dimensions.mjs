import fs from "node:fs"
import path from "node:path"

/**
 * Image dimensions from file headers only -- no decode, no dependency.
 * Ported unchanged in spirit from tools/build-manifest.mjs; that header
 * parsing was correct. (The pixel *decoder* in tools/local-analyzer.mjs was
 * not, and is replaced by sharp in the structural pass.)
 */
function png(buf) {
  if (buf.length < 24) return null
  if (buf.readUInt32BE(0) !== 0x89504e47) return null
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

function jpeg(buf) {
  let off = 2
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) { off++; continue }
    const marker = buf[off + 1]
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8) {
      return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) }
    }
    off += buf.readUInt16BE(off + 2) + 2
  }
  return null
}

export function readDimensions(file) {
  let fd
  try {
    fd = fs.openSync(file, "r")
    const buf = Buffer.alloc(64)
    fs.readSync(fd, buf, 0, 64, 0)
    const ext = path.extname(file).toLowerCase()
    if (ext === ".png") return png(buf)
    if (ext === ".jpg" || ext === ".jpeg") return jpeg(buf)
    return null
  } catch {
    return null
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd) } catch {}
  }
}
