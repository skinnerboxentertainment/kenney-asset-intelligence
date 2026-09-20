import fs from "node:fs"
import https from "node:https"
import path from "node:path"
import { ROOT, catalogPath } from "../lib/config.mjs"

/**
 * Refresh catalog.json from kenney.nl.
 *
 * tools/scrape-metadata.mjs only ever extracted tags and file counts -- it had
 * no notion of a download URL at all, which is why 116 of 223 packs were
 * permanently unfetchable and showed as "Soon" in the UI. The links were
 * always on the pages; nothing was ever scraping them.
 *
 * catalog.json is the source of truth. src/kenney/catalog.ts is generated from
 * it by tools/gen-catalog.mjs, so the TypeScript file is never hand-edited and
 * nothing has to parse TypeScript with a regex to read it.
 */

const DELAY_MS = 350
const RETRIES = 2

function fetchPage(slug) {
  const url = `https://kenney.nl/assets/${slug}`
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 (asset-index catalog sync)" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return reject(new Error(`redirect to ${res.headers.location}`))
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
        const chunks = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
      })
      .on("error", reject)
  })
}

function extract(html) {
  const zips = html.match(/https:[^"'\s]*\.zip/g) ?? []
  const previews = html.match(/https:[^"'\s]*\.(?:png|jpg)/gi) ?? []

  const tagRow = html.match(/class='title text-muted'>Tags[\s\S]*?<\/tr>/)
  const tagLinks = tagRow ? tagRow[0].match(/class='tag'>(\w+)/g) ?? [] : []
  const tags = [...new Set(tagLinks.map((t) => t.replace(/class='tag'>/, "").toLowerCase()))]

  const files = html.match(/class='title text-muted'>Files[\s\S]*?<td[^>]*>(\d+)×/)
  const preview = previews.find((p) => /preview/i.test(p)) ?? previews[0]

  return {
    downloadUrl: zips[0],
    previewUrl: preview,
    tags,
    fileCount: files ? parseInt(files[1], 10) : undefined,
  }
}

async function withRetry(fn, tries = RETRIES) {
  let last
  for (let i = 0; i <= tries; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (i < tries) await new Promise((r) => setTimeout(r, 800 * (i + 1)))
    }
  }
  throw last
}

export async function scrapeCatalog({ all = false, only = null, limit = null } = {}) {
  const file = catalogPath()
  const catalog = JSON.parse(fs.readFileSync(file, "utf-8"))

  let todo = catalog.packs
  if (only) todo = todo.filter((p) => only.includes(p.slug))
  else if (!all) todo = todo.filter((p) => !p.downloadUrl)
  if (limit) todo = todo.slice(0, limit)

  if (!todo.length) {
    console.log("  nothing to scrape (use --all to refresh every pack)")
    return { updated: 0, failed: 0 }
  }
  console.log(`  scraping ${todo.length} pack pages...`)

  let updated = 0
  let gained = 0
  const failures = []

  for (const pack of todo) {
    try {
      const html = await withRetry(() => fetchPage(pack.slug))
      const info = extract(html)
      const had = !!pack.downloadUrl
      if (info.downloadUrl) {
        pack.downloadUrl = info.downloadUrl
        if (!had) gained++
      }
      if (info.previewUrl) pack.previewUrl = info.previewUrl
      if (info.tags.length) pack.tags = info.tags
      if (info.fileCount) pack.fileCount = info.fileCount
      updated++
      if (!info.downloadUrl) failures.push(`${pack.slug}: page ok, no .zip link`)
    } catch (err) {
      failures.push(`${pack.slug}: ${err.message}`)
    }
    if (process.stdout.isTTY) process.stdout.write(`\r  ${updated}/${todo.length}`)
    await new Promise((r) => setTimeout(r, DELAY_MS))
  }
  if (process.stdout.isTTY) process.stdout.write("\n")

  catalog.generatedAt = new Date().toISOString()
  catalog.totalPacks = catalog.packs.length
  fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n")

  const withUrl = catalog.packs.filter((p) => p.downloadUrl).length
  console.log(`  updated ${updated} packs, ${gained} gained a download URL`)
  console.log(`  catalog now has ${withUrl}/${catalog.packs.length} fetchable`)
  if (failures.length) {
    console.log(`  ${failures.length} could not be resolved:`)
    for (const f of failures.slice(0, 12)) console.log(`    ${f}`)
    if (failures.length > 12) console.log(`    ... and ${failures.length - 12} more`)
  }
  return { updated, gained, failed: failures.length }
}

/** Regenerate the TypeScript catalog the browser bundle imports. */
export function generateCatalogTs() {
  const catalog = JSON.parse(fs.readFileSync(catalogPath(), "utf-8"))
  const out = path.join(ROOT, "src", "kenney", "catalog.ts")

  const lines = catalog.packs.map((p) => {
    const fields = [
      `slug: ${JSON.stringify(p.slug)}`,
      `name: ${JSON.stringify(p.name)}`,
      `category: ${JSON.stringify(p.category)}`,
      `series: ${JSON.stringify(p.series ?? "")}`,
      `platformerRelevant: ${p.platformerRelevant ? "true" : "false"}`,
    ]
    if (p.downloadUrl) fields.push(`downloadUrl: ${JSON.stringify(p.downloadUrl)}`)
    if (p.previewUrl) fields.push(`previewUrl: ${JSON.stringify(p.previewUrl)}`)
    if (p.tags?.length) fields.push(`tags: ${JSON.stringify(p.tags)}`)
    if (p.fileCount) fields.push(`fileCount: ${p.fileCount}`)
    return `  { ${fields.join(", ")} },`
  })

  const src = [
    "// GENERATED FILE -- do not edit.",
    "// Source: catalog/catalog.json. Regenerate with: npm run catalog:gen",
    "",
    "export interface KenneyPack {",
    "  slug: string",
    "  name: string",
    '  category: "2D" | "3D" | "Audio" | "Textures" | "Other"',
    "  series: string",
    "  platformerRelevant: boolean",
    "  downloadUrl?: string",
    "  previewUrl?: string",
    "  tags?: string[]",
    "  fileCount?: number",
    "}",
    "",
    'const BASE = "https://kenney.nl"',
    "const DONATE = `${BASE}/donate`",
    "",
    "const packs: KenneyPack[] = [",
    ...lines,
    "]",
    "",
    "export const CATALOG: KenneyPack[] = packs",
    "",
    "export function getPageUrl(slug: string): string {",
    "  return `${BASE}/assets/${slug}`",
    "}",
    "",
    "export function getDonateUrl(): string {",
    "  return DONATE",
    "}",
    "",
    "export function getPreviewUrl(slug: string): string {",
    "  return CATALOG.find((p) => p.slug === slug)?.previewUrl ?? \"\"",
    "}",
    "",
    "export function getPlatformerPacks(): KenneyPack[] {",
    "  return CATALOG.filter((p) => p.platformerRelevant)",
    "}",
    "",
    "export function getPacksByCategory(cat: KenneyPack[\"category\"]): KenneyPack[] {",
    "  return CATALOG.filter((p) => p.category === cat)",
    "}",
    "",
  ].join("\n")

  fs.writeFileSync(out, src)
  console.log(`  wrote ${path.relative(ROOT, out)} (${catalog.packs.length} packs)`)
}
