import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CATALOG_PATH = path.join(__dirname, "catalog.json")

function load() {
  const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"))
  return raw.packs
}

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/[\s-]+/).filter(Boolean)
}

function score(pack, queryTokens) {
  let s = 0
  const slug = pack.slug.toLowerCase()
  const name = pack.name.toLowerCase()
  const tags = (pack.tags || []).map(t => t.toLowerCase())
  const series = (pack.series || "").toLowerCase()

  for (const token of queryTokens) {
    if (slug === token) s += 10
    if (slug.includes(token)) s += 5
    if (name.includes(token)) s += 4
    if (tags.includes(token)) s += 3
    if (series.includes(token)) s += 2
    if (pack.category.toLowerCase() === token) s += 3
  }
  return s
}

function filter(packs, opts = {}) {
  let results = [...packs]

  if (opts.category) {
    results = results.filter(p => p.category === opts.category)
  }
  if (opts.tag) {
    results = results.filter(p => (p.tags || []).includes(opts.tag.toLowerCase()))
  }
  if (opts.platformer) {
    results = results.filter(p => p.platformerRelevant)
  }
  if (opts.hasDownload) {
    results = results.filter(p => !!p.downloadUrl)
  }

  if (opts.query) {
    const tokens = tokenize(opts.query)
    results = results
      .map(p => ({ pack: p, score: score(p, tokens) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(r => r.pack)
  }

  if (opts.top) {
    results = results.slice(0, opts.top)
  }

  return results
}

function formatMarkdown(results) {
  if (results.length === 0) return "No matching packs found."
  return results.map(r => {
    const tags = (r.tags || []).join(", ")
    const dl = r.downloadUrl ? "✓ Download" : "✗ No URL"
    return `- **${r.name}** (\`${r.slug}\`) — ${r.category}${r.series ? ` · ${r.series}` : ""} · ${r.fileCount ?? "?"} files\n  Tags: ${tags || "none"} · ${dl}`
  }).join("\n")
}

function formatJSON(results) {
  return JSON.stringify(results, null, 2)
}

function formatSummary(results) {
  const byCategory = {}
  for (const r of results) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1
  }
  return `Found ${results.length} packs: ${Object.entries(byCategory).map(([c, n]) => `${n} ${c}`).join(", ")}`
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

function printUsage() {
  console.log(`kenney-assets — query Kenney.nl CC0 asset catalog

Usage:
  node query.mjs <query>              Free-text search across name, slug, tags
  node query.mjs --category <cat>     Filter by: 2D, 3D, Audio, Textures, Other
  node query.mjs --tag <tag>          Filter by exact tag
  node query.mjs --platformer         Platformer-relevant packs only
  node query.mjs --has-download       Only packs with verified download URLs
  node query.mjs --top <n>            Limit to top N results
  node query.mjs --json               Output as JSON (default is Markdown)

Examples:
  node query.mjs platformer tile      Platformer tile packs
  node query.mjs --tag character      2D character packs
  node query.mjs --category Audio --top 5    Top 5 audio packs
  node query.mjs --platformer --has-download --json   Downloadable platformer packs`)
}

async function main() {
  const args = process.argv.slice(2)
  const opts = {}

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage()
    process.exit(0)
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--category" || a === "-c") opts.category = args[++i]
    else if (a === "--tag" || a === "-t") opts.tag = args[++i]
    else if (a === "--platformer") opts.platformer = true
    else if (a === "--has-download") opts.hasDownload = true
    else if (a === "--top" || a === "-n") opts.top = parseInt(args[++i], 10)
    else if (a === "--json") opts.json = true
    else if (!a.startsWith("--")) {
      opts.query = (opts.query ? opts.query + " " : "") + a
    }
  }

  const packs = load()
  const results = filter(packs, opts)

  console.log(formatSummary(results))
  console.log("")

  if (opts.json) {
    console.log(formatJSON(results))
  } else {
    console.log(formatMarkdown(results))
  }
}

main().catch(console.error)
