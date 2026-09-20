import fs from "node:fs"
import path from "node:path"
import { openDb } from "../lib/db.mjs"
import { assetFile, assetsRoot, dbPath } from "../lib/config.mjs"
import { fetchPack, isOnDisk, removePack, catalogPacks } from "../lib/fetch-pack.mjs"
import { searchAssets } from "../lib/search.mjs"

/**
 * Dev-server API for the browser UI.
 *
 * The app used to "install" a pack by fetching the zip into browser memory as
 * blob URLs that died on refresh. Nothing reached disk, so the index never saw
 * it and the browse half and the index half never met. A browser cannot write
 * to the corpus -- but the dev server can, so installing runs here: download,
 * extract, index, analyze, all server-side.
 *
 * It also serves the index itself, so the UI can show real sprites and real
 * coverage instead of a localStorage flag.
 */

const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp",
  ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp3": "audio/mpeg",
}

function json(res, body, status = 200) {
  const s = JSON.stringify(body)
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "no-store")
  res.end(s)
}

function indexReady() {
  return fs.existsSync(dbPath())
}

function searchAssets_(db, q) {
  return searchAssets(db, {
    q: q.q, pack: q.pack, role: q.role, style: q.style,
    kind: q.kind || "image",
    tileable: q.tileable === "1",
    described: q.described === "1" ? true : q.described === "0" ? false : undefined,
    atlas: q.atlas === "1",
    minSize: q.minSize, maxSize: q.maxSize,
    limit: q.limit ?? 60, offset: q.offset ?? 0,
  }, { total: true })
}

export function assetsApi() {
  // One install at a time: two concurrent extracts into the same corpus, each
  // followed by an index write, is a good way to corrupt both.
  let installing = null

  return {
    name: "kenney-assets-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost")
        const p = url.pathname
        if (!p.startsWith("/api/")) return next()

        try {
          // --- index + corpus summary -------------------------------------
          if (p === "/api/stats") {
            if (!indexReady()) return json(res, { ready: false, assetsRoot: assetsRoot() })
            const db = openDb({ readonly: true })
            const g = (q) => db.prepare(q).get().c
            const out = {
              ready: true,
              assetsRoot: assetsRoot(),
              packsCataloged: g("SELECT count(*) c FROM packs"),
              packsOnDisk: g("SELECT count(*) c FROM packs WHERE installed=1"),
              assets: g("SELECT count(*) c FROM assets"),
              images: g("SELECT count(*) c FROM assets WHERE kind='image'"),
              analyzed: g("SELECT count(*) c FROM assets WHERE unique_colors IS NOT NULL"),
              described: g("SELECT count(*) c FROM assets WHERE observed IS NOT NULL"),
              installing,
            }
            db.close()
            return json(res, out)
          }

          // --- packs, with real state rather than a localStorage flag ------
          if (p === "/api/packs") {
            const catalog = catalogPacks()
            let stats = {}
            if (indexReady()) {
              const db = openDb({ readonly: true })
              for (const r of db.prepare(
                `SELECT pack,
                        count(*) AS files,
                        sum(kind='image') AS images,
                        sum(observed IS NOT NULL) AS described,
                        sum(unique_colors IS NOT NULL) AS analyzed
                 FROM assets GROUP BY pack`).all()) stats[r.pack] = r
              db.close()
            }
            return json(res, {
              installing,
              packs: catalog.map((c) => ({
                ...c,
                onDisk: isOnDisk(c.slug),
                indexed: stats[c.slug]?.files ?? 0,
                images: stats[c.slug]?.images ?? 0,
                described: stats[c.slug]?.described ?? 0,
                analyzed: stats[c.slug]?.analyzed ?? 0,
              })),
            })
          }

          // --- asset search ------------------------------------------------
          if (p === "/api/search") {
            if (!indexReady()) return json(res, { assets: [] })
            const db = openDb({ readonly: true })
            const q = Object.fromEntries(url.searchParams)
            const r = searchAssets_(db, q)
            db.close()
            return json(res, r)
          }

          // --- serve a real sprite from the corpus -------------------------
          if (p.startsWith("/api/file/")) {
            if (!indexReady()) return json(res, { error: "no index" }, 404)
            const id = Number(p.slice("/api/file/".length))
            const db = openDb({ readonly: true })
            const row = db.prepare("SELECT pack, path FROM assets WHERE id=?").get(id)
            db.close()
            if (!row) return json(res, { error: "not found" }, 404)
            const file = assetFile(row.pack, row.path)
            if (!fs.existsSync(file)) return json(res, { error: "missing on disk" }, 404)
            res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream")
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
            return fs.createReadStream(file).pipe(res)
          }

          // --- pack thumbnail, served from local art when we have it --------
          // kenney.nl appears to gate hotlinked previews, and 212 simultaneous
          // requests to someone else's server is rude regardless. Once a pack
          // is on disk we already have better art than its remote preview.
          if (p.startsWith("/api/pack-thumb/")) {
            if (!indexReady()) return json(res, { error: "no index" }, 404)
            const slug = decodeURIComponent(p.slice("/api/pack-thumb/".length))
            const db = openDb({ readonly: true })
            const row =
              db.prepare(
                `SELECT pack, path FROM assets
                 WHERE pack=? AND kind='image'
                 ORDER BY (path LIKE '%Preview%') DESC, (path LIKE '%Sample%') DESC,
                          is_atlas DESC, bytes DESC LIMIT 1`).get(slug)
            db.close()
            if (!row) return json(res, { error: "not found" }, 404)
            const file = assetFile(row.pack, row.path)
            if (!fs.existsSync(file)) return json(res, { error: "missing" }, 404)
            res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] ?? "image/png")
            res.setHeader("Cache-Control", "public, max-age=3600")
            return fs.createReadStream(file).pipe(res)
          }

          // --- install: download, extract, index, analyze -------------------
          if (p.startsWith("/api/install/") && req.method === "POST") {
            const slug = decodeURIComponent(p.slice("/api/install/".length))
            if (installing) return json(res, { error: `busy installing ${installing}` }, 409)
            installing = slug
            try {
              const r = await fetchPack(slug)
              const { build } = await import("./index/build.mjs")
              build({ packs: [slug] })
              const { analyze } = await import("./index/analyze.mjs")
              await analyze({ packs: [slug] })
              return json(res, { ok: true, ...r })
            } finally {
              installing = null
            }
          }

          if (p.startsWith("/api/uninstall/") && req.method === "POST") {
            const slug = decodeURIComponent(p.slice("/api/uninstall/".length))
            const removed = removePack(slug)
            if (removed && indexReady()) {
              const db = openDb()
              db.prepare("DELETE FROM assets WHERE pack=?").run(slug)
              db.prepare("UPDATE packs SET installed=0 WHERE slug=?").run(slug)
              const { rebuildFts } = await import("./index/build.mjs")
              rebuildFts(db)
              db.close()
            }
            return json(res, { ok: removed })
          }

          return json(res, { error: "unknown endpoint" }, 404)
        } catch (err) {
          installing = null
          return json(res, { error: String(err?.message ?? err) }, 500)
        }
      })
    },
  }
}
