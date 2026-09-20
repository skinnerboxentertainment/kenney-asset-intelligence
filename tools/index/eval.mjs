import fs from "node:fs"
import path from "node:path"
import { openDb } from "../../lib/db.mjs"
import { ROOT } from "../../lib/config.mjs"
import { rebuildFts } from "./build.mjs"
import { searchAssets } from "../../lib/search.mjs"

/**
 * The oracle.
 *
 * The project it replaces reported "27,048 images analyzed (100%)" as a
 * success metric while the decoder mangled every indexed PNG. Coverage counts
 * how much was processed; it says nothing about whether the right asset comes
 * back. This measures that, and it is the only number that licenses spending
 * money on the vision tier.
 */

// Regex metacharacters, escaped without any backslash literal in the source.
const RE_META = new Set([".", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", String.fromCharCode(92)])
const BS = String.fromCharCode(92)

function globToRe(g) {
  const esc = (s) => [...s].map((c) => (RE_META.has(c) ? BS + c : c)).join("")
  return new RegExp("^" + g.split("*").map(esc).join(".*") + "$", "i")
}

/**
 * Run a case through exactly the query the CLI and the app run.
 *
 * This used to be a private copy, and it had drifted: no size filters, no
 * described filter, kind hardcoded. The measurement was therefore taken on a
 * query path nobody used. See lib/search.mjs.
 */
function runQuery(db, c, limit) {
  return searchAssets(db, {
    q: c.q, pack: c.pack, role: c.role, style: c.style,
    tileable: c.tileable, kind: "image", limit,
  }).assets
}

/** Does the corpus even contain a correct answer? An unpassable case makes the metric lie. */
function validate(db, cases) {
  const all = db.prepare("SELECT pack, path FROM assets WHERE kind='image'").all()
    .map((r) => `${r.pack}:${r.path}`)
  const dead = []
  for (const c of cases) {
    const res = c.expect.map(globToRe)
    if (!all.some((s) => res.some((re) => re.test(s)))) dead.push(c.q)
  }
  return dead
}

export function evaluate({ suite, tiers, k = 10, verbose = false } = {}) {
  const file = suite ? path.resolve(suite) : path.join(ROOT, "eval", "queries.json")
  const { cases } = JSON.parse(fs.readFileSync(file, "utf-8"))
  const db = openDb()

  const configs = tiers
    ? [tiers]
    : [
        { label: "lexical only",        structural: false, vision: false },
        { label: "+ structural",        structural: true,  vision: false },
        { label: "+ semantic",          structural: true,  vision: true  },
      ]

  console.log(`suite: ${path.relative(ROOT, file)}  (${cases.length} cases)\n`)
  const results = []

  for (const cfg of configs) {
    rebuildFts(db, cfg)
    let hit1 = 0, hit5 = 0, hitK = 0
    const byKind = {}
    const failures = []
    for (const c of cases) {
      const kind = c.kind ?? "lexical"
      byKind[kind] ??= { n: 0, hit: 0 }
      byKind[kind].n++
      const rows = runQuery(db, c, k)
      const res = c.expect.map(globToRe)
      const rank = rows.findIndex((r) => res.some((re) => re.test(`${r.pack}:${r.path}`)))
      if (rank === 0) hit1++
      if (rank >= 0 && rank < 5) hit5++
      if (rank >= 0) { hitK++; byKind[kind].hit++ }
      else failures.push({ q: c.q, got: rows.slice(0, 3).map((r) => `${r.pack}:${r.path}`) })
    }
    const pct = (n) => ((n / cases.length) * 100).toFixed(1).padStart(5) + "%"
    const kinds = Object.entries(byKind)
      .map(([n, v]) => `${n} ${((v.hit / v.n) * 100).toFixed(0)}% (${v.hit}/${v.n})`).join("   ")
    console.log(`${cfg.label.padEnd(22)} recall@${k} ${pct(hitK)}      ${kinds}`)
    results.push({ ...cfg, hit1, hit5, hitK, failures })
  }

  const last = results[results.length - 1]
  if (last.failures.length) {
    console.log(`\nmisses at the best tier (${last.failures.length}):`)
    for (const f of last.failures) {
      console.log(`  "${f.q}"`)
      if (verbose) for (const g of f.got) console.log(`      got: ${g}`)
    }
  }

  // Leave the index in its fully-enriched state.
  rebuildFts(db, { structural: true, vision: true })
  db.close()
  return results
}

export function validateSuite({ suite } = {}) {
  const file = suite ? path.resolve(suite) : path.join(ROOT, "eval", "queries.json")
  const { cases } = JSON.parse(fs.readFileSync(file, "utf-8"))
  const db = openDb()
  const dead = validate(db, cases)
  console.log(dead.length
    ? `UNPASSABLE cases (corpus has no correct answer):\n` + dead.map((d) => "  " + d).join("\n")
    : `all ${cases.length} cases have at least one correct answer in the corpus`)
  db.close()
}
