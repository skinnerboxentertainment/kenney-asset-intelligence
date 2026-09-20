#!/usr/bin/env node
import { fetchPack, catalogPacks, isOnDisk } from "../lib/fetch-pack.mjs"

/**
 * Download and extract packs into the corpus.
 *
 * A thin CLI over lib/fetch-pack.mjs, which the dev server also uses, so the
 * button in the UI and this command do exactly the same thing. The previous
 * version parsed src/kenney/catalog.ts with a regex to find download URLs;
 * that file is generated now, and catalog.json is the source of truth.
 */

const args = process.argv.slice(2)
if (!args.length) {
  console.log("Usage: npm run extract -- <slug> [slug...]")
  console.log("       npm run extract -- --all        every fetchable pack")
  console.log("       npm run extract -- --missing    only packs not yet on disk")
  process.exit(1)
}

const packs = catalogPacks().filter((p) => p.downloadUrl)
let slugs
if (args[0] === "--all") slugs = packs.map((p) => p.slug)
else if (args[0] === "--missing") slugs = packs.filter((p) => !isOnDisk(p.slug)).map((p) => p.slug)
else slugs = args

console.log(`${slugs.length} pack(s) to fetch`)
let ok = 0
let failed = 0

for (const slug of slugs) {
  try {
    process.stdout.write(`  ${slug} ... `)
    const r = await fetchPack(slug)
    console.log(`${r.files} files, ${(r.bytes / 1024 / 1024).toFixed(1)} MB`)
    ok++
  } catch (err) {
    console.log(`FAILED: ${err.message}`)
    failed++
  }
}

console.log(`\n${ok} extracted${failed ? `, ${failed} failed` : ""}`)
if (ok) console.log(`Now run: node bin/assets build && node bin/assets analyze`)
