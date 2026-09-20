import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Where the extracted Kenney corpus lives.
 *
 * The corpus is ~188 MB of gitignored data, so it does not travel with a
 * clone or a worktree. Treat it as data with a configurable location rather
 * than assuming it sits inside the repo.
 *   ASSETS_ROOT=/path/to/experimental assets build
 */
export function assetsRoot() {
  const env = process.env.ASSETS_ROOT
  if (env) return path.resolve(env)

  const local = path.join(ROOT, "assets", "experimental")
  if (hasContent(local)) return local

  // The corpus is gitignored, so it does not travel into a git worktree. If
  // the local one is empty, fall back to the main checkout's copy rather than
  // serving an index whose every image 404s.
  const main = mainCheckoutRoot()
  if (main) {
    const shared = path.join(main, "assets", "experimental")
    if (hasContent(shared)) return shared
  }
  return local
}

function hasContent(dir) {
  try {
    return fs.readdirSync(dir).some((n) => !n.startsWith("."))
  } catch {
    return false
  }
}

/** For a linked worktree, .git is a file pointing at <main>/.git/worktrees/<name>. */
function mainCheckoutRoot() {
  try {
    const dotGit = path.join(ROOT, ".git")
    if (!fs.statSync(dotGit).isFile()) return null
    const m = fs.readFileSync(dotGit, "utf-8").match(/gitdir:\s*(.+)/)
    if (!m) return null
    // git writes this pointer with forward slashes even on Windows, where
    // path.sep is a backslash -- so normalise before looking for the marker.
    const gitDir = m[1].trim().replaceAll(String.fromCharCode(92), "/")
    const idx = gitDir.indexOf("/.git/worktrees/")
    return idx === -1 ? null : gitDir.slice(0, idx)
  } catch {
    return null
  }
}

export function dbPath() {
  return process.env.ASSETS_DB
    ? path.resolve(process.env.ASSETS_DB)
    : path.join(ROOT, "index", "assets.db")
}

export function catalogPath() {
  return path.join(ROOT, "catalog", "catalog.json")
}

/** Absolute path to one asset on disk. */
export function assetFile(pack, relPath) {
  return path.join(assetsRoot(), pack, relPath.split("/").join(path.sep))
}

export function requireAssetsRoot() {
  const root = assetsRoot()
  if (!fs.existsSync(root)) {
    throw new Error(
      `Asset corpus not found at ${root}\n` +
        `Set ASSETS_ROOT to the directory holding the extracted packs, e.g.\n` +
        `  ASSETS_ROOT="/path/to/assets/experimental" assets build`,
    )
  }
  return root
}
