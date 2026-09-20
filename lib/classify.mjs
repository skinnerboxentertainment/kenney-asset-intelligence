import path from "node:path"

/**
 * Lexical tier: everything derivable from a filename and its parent directory,
 * at zero cost. Ported from tools/build-manifest.mjs extractContextClues, with
 * two changes:
 *   1. The parent directory is used as a signal. Kenney paths are strongly
 *      structured ("Sprites/Backgrounds/Default/background_clouds.png"), and
 *      the old code computed the directory but never classified on it.
 *   2. Emits one `role` (the schema's column) instead of a tag soup, while
 *      still putting every matched category into keywords for FTS recall.
 *
 * These are heuristics and are stored as a feature, never as ground truth.
 */

const ROLE_RULES = [
  ["enemy",      ["enemy", "enemies", "monster", "monsters", "creature", "boss", "slime", "zombie"]],
  ["character",  ["character", "characters", "player", "players", "hero", "p1", "p2", "p3", "alien", "astronaut"]],
  ["weapon",     ["weapon", "weapons", "gun", "guns", "sword", "bow", "blaster", "rifle", "pistol", "grenade"]],
  ["pickup",     ["item", "items", "pickup", "pickups", "coin", "coins", "gem", "gems", "key", "keys", "heart", "star", "collectible"]],
  ["ui",         ["ui", "hud", "button", "buttons", "panel", "panels", "icon", "icons", "menu", "cursor", "crosshair", "prompt", "prompts", "input", "keyboard", "gamepad", "controller", "font", "fonts",
                  "dpad", "stick", "trigger", "bumper", "shoulder", "emote", "emotes",
                  "flag", "flags", "piece", "pieces", "card", "cards", "bar", "slider",
                  "checkbox", "arrow", "badge", "tab", "toggle", "dice", "die"]],
  ["effect",     ["effect", "effects", "particle", "particles", "smoke", "explosion", "spark", "sparkle", "flash", "vfx", "light"]],
  ["background", ["background", "backgrounds", "bg", "sky", "parallax", "mountain", "mountains", "cloud", "clouds", "hill", "hills"]],
  ["tile",       ["tile", "tiles", "tilemap", "tileset", "terrain", "ground", "grass", "dirt", "stone", "sand", "snow", "brick", "platform", "block"]],
]

const ANIM_FRAMES = ["walk", "run", "jump", "idle", "stand", "climb", "duck", "crouch", "hit", "hurt", "die", "death", "attack", "fall", "swim", "roll"]

const ATLAS_RE = /(sheet|tilemap|tileset|atlas|spritesheet)/i
// Pack overview renders shipped alongside the assets, e.g. "Preview.png",
// "Previews/wall-corner-low.png", "Sample.png".
const PREVIEW_RE = /(^|\/)(previews?|sample)([\/.]|$)/i

export function tokenize(text) {
  const out = new Set()
  // Case must survive until the camelCase split below has seen it. This
  // used to lowercase first, so "laserRedVertical" was indexed as one token
  // and a query for "red laser" could not find it -- across the ~30,000
  // camelCase filenames in the corpus. Measured on the eval before/after.
  for (const part of text.split(/[-_\s.]+/)) {
    if (!part) continue
    out.add(part.toLowerCase())
    // Split camelCase AND letter<->digit boundaries.
    // "grassHalfMid" -> grass, half, mid ; "crosshair048" -> crosshair, 048.
    // Missing the digit split silently cost 1,205 crosshairs their role.
    const split = part
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([a-zA-Z])(\d)/g, "$1 $2")
      .replace(/(\d)([a-zA-Z])/g, "$1 $2")
      .toLowerCase()
      .split(/\s+/)
    for (const c of split) if (c.length > 1) out.add(c)
  }
  return out
}

/**
 * @param relPath pack-relative, '/' separated
 * @returns {{keywords: string[], role: string|null, animFrame: string|null, isAtlas: boolean}}
 */
export function classify(relPath, kind = "image") {
  const parsed = path.posix.parse(relPath)
  const stem = parsed.name
  const dirs = parsed.dir ? parsed.dir.split("/").filter(Boolean) : []

  const fileTokens = tokenize(stem)
  const dirTokens = new Set()
  for (const d of dirs) for (const t of tokenize(d)) dirTokens.add(t)

  const keywords = new Set([...fileTokens, ...dirTokens])

  // Directory outranks filename: "Backgrounds/rock.png" is a background.
  let role = null
  for (const source of [dirTokens, fileTokens]) {
    for (const [name, terms] of ROLE_RULES) {
      if (terms.some((t) => source.has(t))) {
        keywords.add(name)
        if (!role) role = name
      }
    }
    if (role) break
  }
  if (!role && kind === "audio") role = "audio"
  // A preview render keeps whatever role it actually depicts -- a 3D kit's
  // Previews/ directory is the only 2D art that kit ships, so labelling those
  // "preview" and nothing else would hide them from every sprite query.
  if (PREVIEW_RE.test(relPath)) {
    keywords.add("preview")
    if (!role) role = "preview"
  }

  const animFrame = ANIM_FRAMES.find((a) => fileTokens.has(a)) ?? null
  if (animFrame) keywords.add("animation")

  return {
    keywords: [...keywords].filter((k) => k.length > 1).sort(),
    role,
    animFrame,
    isAtlas: ATLAS_RE.test(relPath),
  }
}

export function kindForExt(ext) {
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) return "image"
  if ([".ogg", ".wav", ".mp3", ".webm", ".flac"].includes(ext)) return "audio"
  return "other"
}
