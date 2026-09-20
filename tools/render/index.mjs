import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { assetsRoot, ROOT } from "../../lib/config.mjs"

/**
 * Drive the Blender turntable renderer over a whole pack.
 *
 * Output lands in <pack>/Isometric/<model>_<BEARING>.png -- Kenney's own
 * convention -- so a rendered pack is indistinguishable from one where Kenney
 * shipped the renders, and every downstream step (indexing, the four-per-row
 * contact sheet, describing) works on it unchanged.
 */

const MODEL_DIRS = ["Models/GLTF format", "Models/GLB format", "Models/OBJ format", "Models"]
const EXT_FOR = { ".glb": ".glb", ".gltf": ".gltf", ".obj": ".obj", ".fbx": ".fbx" }

function findBlender() {
  if (process.env.BLENDER) return process.env.BLENDER
  const guesses = [
    "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe",
    "C:/Program Files/Blender Foundation/Blender 4.4/blender.exe",
    "C:/Program Files/Blender Foundation/Blender 4.3/blender.exe",
    "/usr/bin/blender",
    "/Applications/Blender.app/Contents/MacOS/Blender",
  ]
  for (const g of guesses) if (fs.existsSync(g)) return g
  return null
}

/** The first directory in this pack that actually holds model files. */
function findModels(packDir) {
  for (const rel of MODEL_DIRS) {
    const dir = path.join(packDir, ...rel.split("/"))
    if (!fs.existsSync(dir)) continue
    for (const ext of Object.keys(EXT_FOR)) {
      if (fs.readdirSync(dir).some((f) => f.toLowerCase().endsWith(ext))) return { dir, ext }
    }
  }
  return null
}

export function renderPack({ pack, steps = 0, size = 512, elevation = null,
                             margin = null, limit = 0, only = "", out = null } = {}) {
  const blender = findBlender()
  if (!blender) {
    throw new Error(
      "Blender not found. Install it, or set BLENDER to the executable.\n" +
      "The renderer uses Blender headless -- it imports GLB/OBJ/FBX natively\n" +
      "and needs no native node modules.")
  }

  const packDir = path.join(assetsRoot(), pack)
  if (!fs.existsSync(packDir)) throw new Error(`pack not on disk: ${pack}`)

  const found = findModels(packDir)
  if (!found) {
    throw new Error(
      `No model files in ${pack}.\n` +
      `Kenney ships them, but they are only kept if the pack was fetched after\n` +
      `the extract filter learned about model formats. Re-fetch it:\n` +
      `  npm run extract -- ${pack}`)
  }

  const dst = out ? path.resolve(out) : path.join(packDir, "Isometric")
  const script = path.join(ROOT, "tools", "render", "turntable.py")

  const args = ["-b", "-P", script, "--",
    "--in", found.dir, "--out", dst, "--ext", found.ext, "--size", String(size)]
  if (steps) args.push("--steps", String(steps))
  if (elevation !== null) args.push("--elevation", String(elevation))
  if (margin !== null) args.push("--margin", String(margin))
  if (limit) args.push("--limit", String(limit))
  if (only) args.push("--only", only)

  console.log(`  blender  ${path.basename(blender)}`)
  console.log(`  models   ${path.relative(packDir, found.dir)}  (${found.ext})`)
  console.log(`  output   ${path.relative(packDir, dst)}`)
  console.log(`  bearings ${steps ? `${steps} at ${(360 / steps).toFixed(1)}°` : "NE, SE, SW, NW"}\n`)

  return new Promise((resolve, reject) => {
    const proc = spawn(blender, args, { stdio: ["ignore", "pipe", "pipe"] })
    let tail = ""
    proc.stdout.on("data", (d) => {
      const s = String(d)
      tail = (tail + s).slice(-4000)
      // Blender is extremely chatty; surface only per-model progress.
      for (const line of s.split("\n")) if (/^\[\d+\/\d+\]|^rendered /.test(line)) console.log("  " + line.trim())
    })
    proc.stderr.on("data", (d) => { tail = (tail + d).slice(-4000) })
    proc.on("error", reject)
    proc.on("close", (code) => {
      if (code === 0) return resolve({ out: dst })
      reject(new Error(`blender exited ${code}\n${tail.split("\n").slice(-12).join("\n")}`))
    })
  })
}
