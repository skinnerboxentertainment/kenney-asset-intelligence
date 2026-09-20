/**
 * Kenney asset browser.
 *
 * Talks to the dev-server API (tools/vite-plugin-assets.mjs), which owns the
 * corpus and the index. Installing runs server-side: download, extract, index,
 * analyze. The previous version fetched zips into browser memory as blob URLs
 * that died on refresh, so nothing it did was visible to anything else.
 */

interface Pack {
  slug: string
  name: string
  category: string
  series: string
  platformerRelevant: boolean
  downloadUrl?: string
  previewUrl?: string
  tags?: string[]
  fileCount?: number
  onDisk: boolean
  indexed: number
  images: number
  described: number
  analyzed: number
}

interface Asset {
  id: number
  pack: string
  path: string
  width: number
  height: number
  role: string | null
  style: string | null
  anim_frame: string | null
  tile_score: number | null
  observed: string | null
  top_colors: string | null
}

interface Stats {
  ready: boolean
  assetsRoot: string
  packsCataloged?: number
  packsOnDisk?: number
  assets?: number
  images?: number
  analyzed?: number
  described?: number
}

const ROLES = ["character", "enemy", "tile", "background", "ui", "effect", "pickup", "weapon"]
const STYLES = ["1-bit", "indexed", "pixel-art", "full-color"]

let packs: Pack[] = []
let stats: Stats = { ready: false, assetsRoot: "" }
let view: "packs" | "assets" = "packs"
let installing: string | null = null

// pack filters
let packQuery = ""
let packCategory = "all"
let packOnly: "all" | "installed" | "available" = "all"

// asset filters
let assetQuery = ""
let assetRole = ""
let assetStyle = ""
let assetPack = ""
let assetTileable = false
let assetDescribed: "" | "1" | "0" = ""
let assets: Asset[] = []
let assetTotal = 0
let loadingMore = false
let selected: Asset | null = null
let searching = false

const $ = (sel: string) => document.querySelector(sel) as HTMLElement | null

/** The URL is the app's state: shareable, bookmarkable, reload-safe. */
function readUrl() {
  const q = new URLSearchParams(location.search)
  const v = q.get("view")
  if (v === "assets" || v === "packs") view = v
  assetPack = q.get("pack") ?? ""
  assetQuery = q.get("q") ?? ""
  assetRole = q.get("role") ?? ""
  assetStyle = q.get("style") ?? ""
  const d = q.get("described")
  assetDescribed = d === "1" || d === "0" ? d : ""
  if (assetPack || assetQuery || assetRole || assetStyle) view = v === "packs" ? "packs" : "assets"
}

function writeUrl() {
  const q = new URLSearchParams()
  if (view !== "packs") q.set("view", view)
  if (assetPack) q.set("pack", assetPack)
  if (assetQuery) q.set("q", assetQuery)
  if (assetRole) q.set("role", assetRole)
  if (assetStyle) q.set("style", assetStyle)
  if (assetDescribed) q.set("described", assetDescribed)
  const next = q.toString() ? `?${q}` : location.pathname
  history.replaceState(null, "", next)
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
  return body as T
}

async function loadPacks() {
  const r = await api<{ packs: Pack[]; installing: string | null }>("/api/packs")
  packs = r.packs
  installing = r.installing
}

async function loadStats() {
  stats = await api<Stats>("/api/stats")
}

const PAGE = 120
let searchToken = 0

async function loadAssets({ append = false } = {}) {
  const token = ++searchToken
  if (append) loadingMore = true
  else searching = true
  render()
  const q = new URLSearchParams()
  if (assetQuery) q.set("q", assetQuery)
  if (assetRole) q.set("role", assetRole)
  if (assetStyle) q.set("style", assetStyle)
  if (assetPack) q.set("pack", assetPack)
  if (assetTileable) q.set("tileable", "1")
  if (assetDescribed) q.set("described", assetDescribed)
  q.set("limit", String(PAGE))
  if (append) q.set("offset", String(assets.length))
  writeUrl()
  const r = await api<{ assets: Asset[]; total: number }>("/api/search?" + q.toString())
  // A slower earlier request must not overwrite a newer result.
  if (token !== searchToken) return
  assets = append ? assets.concat(r.assets) : r.assets
  assetTotal = r.total
  searching = false
  loadingMore = false
  render()
}

async function install(slug: string) {
  installing = slug
  render()
  try {
    await api("/api/install/" + encodeURIComponent(slug), { method: "POST" })
    await Promise.all([loadPacks(), loadStats()])
  } catch (err) {
    alert("Install failed: " + (err as Error).message)
  } finally {
    installing = null
    render()
  }
}

async function uninstall(slug: string) {
  if (!confirm(`Remove ${slug} from disk and the index?`)) return
  installing = slug
  render()
  try {
    await api("/api/uninstall/" + encodeURIComponent(slug), { method: "POST" })
    await Promise.all([loadPacks(), loadStats()])
  } finally {
    installing = null
    render()
  }
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** Local art for installed packs; the remote preview only as a fallback. */
function thumbFor(p: Pack) {
  if (p.onDisk && p.images > 0) return `<img src="/api/pack-thumb/${encodeURIComponent(p.slug)}" loading="lazy" alt="">`
  if (p.previewUrl) return `<img src="${esc(p.previewUrl)}" loading="lazy" referrerpolicy="no-referrer" alt="">`
  return ""
}

function packCard(p: Pack) {
  const busy = installing === p.slug
  const pct = p.images ? Math.round((p.described / p.images) * 100) : 0
  const status = p.onDisk
    ? `<span class="badge ok">${p.indexed.toLocaleString()} indexed</span>` +
      (p.images ? `<span class="badge ${pct > 0 ? "warn" : "dim"}">${pct}% described</span>` : "")
    : p.downloadUrl
      ? `<span class="badge dim">${p.fileCount ?? "?"} files</span>`
      : `<span class="badge dim">no download</span>`

  const action = busy
    ? `<button class="btn" disabled>working…</button>`
    : p.onDisk
      ? `<button class="btn ghost" data-uninstall="${p.slug}">Remove</button>
         <button class="btn" data-browse="${p.slug}">Browse</button>`
      : p.downloadUrl
        ? `<button class="btn" data-install="${p.slug}">Install</button>`
        : `<button class="btn" disabled>Unavailable</button>`

  return `
  <div class="card${p.onDisk ? " installed" : ""}">
    <div class="thumb">${thumbFor(p)}</div>
    <div class="body">
      <div class="title">${esc(p.name)}</div>
      <div class="meta">${esc(p.category)}${p.series ? " · " + esc(p.series) : ""}</div>
      ${p.tags?.length ? `<div class="tags">${p.tags.slice(0, 5).map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="status">${status}</div>
    </div>
    <div class="actions">${action}</div>
  </div>`
}

function assetTile(a: Asset) {
  const bits = [a.role, a.style].filter(Boolean).join(" · ")
  return `
  <button class="sprite${selected?.id === a.id ? " sel" : ""}" data-asset="${a.id}" title="${esc(a.pack + "/" + a.path)}">
    <span class="img"><img src="/api/file/${a.id}" loading="lazy" alt=""></span>
    <span class="cap">${esc(a.path.split("/").pop() ?? "")}</span>
    <span class="sub">${a.width}×${a.height}${bits ? " · " + esc(bits) : ""}</span>
    ${a.observed ? `<span class="dot" title="described"></span>` : ""}
  </button>`
}

function detail(a: Asset) {
  const colors: string[] = a.top_colors ? JSON.parse(a.top_colors) : []
  const rows: [string, string][] = [
    ["pack", a.pack],
    ["path", a.path],
    ["size", `${a.width} × ${a.height}`],
    ["role", a.role ?? "—"],
    ["style", a.style ?? "—"],
    ["frame", a.anim_frame ?? "—"],
    ["tileable", a.tile_score != null ? (a.tile_score >= 0.7 ? `yes (${a.tile_score})` : `no (${a.tile_score})`) : "—"],
  ]
  return `
  <aside class="detail">
    <div class="preview"><img src="/api/file/${a.id}" alt=""></div>
    ${a.observed ? `<p class="obs">${esc(a.observed)}</p>` : `<p class="obs dim">No description. Filename is the only signal.</p>`}
    <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(String(v))}</dd>`).join("")}</dl>
    ${colors.length ? `<div class="swatches">${colors.map((c) => `<i style="background:${esc(c)}" title="${esc(c)}"></i>`).join("")}</div>` : ""}
    <code class="cli">assets install ${a.id} --to ./src/assets --manifest</code>
  </aside>`
}

function render() {
  const root = $("#app")
  if (!root) return

  const cats = ["all", ...new Set(packs.map((p) => p.category))]
  const installedPacks = packs.filter((p) => p.onDisk)

  let filtered = packs
  if (packCategory !== "all") filtered = filtered.filter((p) => p.category === packCategory)
  if (packOnly === "installed") filtered = filtered.filter((p) => p.onDisk)
  if (packOnly === "available") filtered = filtered.filter((p) => !p.onDisk && p.downloadUrl)
  if (packQuery) {
    const q = packQuery.toLowerCase()
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.includes(q) ||
        (p.series ?? "").toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.includes(q)),
    )
  }

  root.innerHTML = `
    <div class="statbar">
      ${stats.ready
        ? `<span><b>${(stats.assets ?? 0).toLocaleString()}</b> assets</span>
           <span><b>${stats.packsOnDisk}</b>/${stats.packsCataloged ?? packs.length} packs on disk</span>
           <span><b>${(stats.analyzed ?? 0).toLocaleString()}</b> analyzed</span>
           <span><b>${(stats.described ?? 0).toLocaleString()}</b> described</span>`
        : `<span class="warnText">No index yet — run <code>assets build</code></span>`}
    </div>

    <nav class="tabs">
      <button class="tab${view === "packs" ? " on" : ""}" data-view="packs">Packs</button>
      <button class="tab${view === "assets" ? " on" : ""}" data-view="assets">Assets</button>
    </nav>

    ${view === "packs"
      ? `
      <div class="controls">
        <input id="packQ" class="search" placeholder="Search packs, tags, series…" value="${esc(packQuery)}">
        <div class="chips">
          ${(["all", "installed", "available"] as const)
            .map((k) => `<button class="chip${packOnly === k ? " on" : ""}" data-only="${k}">${k}</button>`)
            .join("")}
        </div>
        <div class="chips">
          ${cats.map((c) => `<button class="chip${packCategory === c ? " on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
        </div>
        <span class="count">${filtered.length} of ${packs.length}</span>
      </div>
      <div class="grid">${filtered.map(packCard).join("")}</div>`
      : `
      <div class="controls">
        <input id="assetQ" class="search" placeholder="Search sprites — try &quot;player walk&quot;, &quot;grass tile&quot;, &quot;health pickup&quot;…" value="${esc(assetQuery)}">
        <select id="roleSel">
          <option value="">any role</option>
          ${ROLES.map((r) => `<option${assetRole === r ? " selected" : ""}>${r}</option>`).join("")}
        </select>
        <select id="styleSel">
          <option value="">any style</option>
          ${STYLES.map((s) => `<option${assetStyle === s ? " selected" : ""}>${s}</option>`).join("")}
        </select>
        <select id="packSel">
          <option value="">all installed packs</option>
          ${installedPacks.map((p) => `<option value="${esc(p.slug)}"${assetPack === p.slug ? " selected" : ""}>${esc(p.name)}</option>`).join("")}
        </select>
        <label class="check"><input type="checkbox" id="tileChk"${assetTileable ? " checked" : ""}> tileable</label>
        <div class="chips">
          ${([["", "all"], ["1", "described"], ["0", "not described"]] as const)
            .map(([v, lbl]) => `<button class="chip${assetDescribed === v ? " on" : ""}" data-desc="${v}">${lbl}</button>`)
            .join("")}
        </div>
        <span class="count">${
          searching ? "searching…"
          : assetTotal === 0 ? "no matches"
          : assets.length < assetTotal
            ? `showing ${assets.length.toLocaleString()} of ${assetTotal.toLocaleString()}`
            : `${assetTotal.toLocaleString()} ${assetTotal === 1 ? "match" : "matches"}`
        }</span>
      </div>
      <div class="split">
        <div class="sprites">${assets.map(assetTile).join("") || `<p class="empty">No matches. Try fewer filters.</p>`}</div>
        ${selected ? detail(selected) : ""}
      </div>
      ${assets.length && assets.length < assetTotal
        ? `<div class="more"><button class="btn" id="moreBtn"${loadingMore ? " disabled" : ""}>${
            loadingMore ? "loading…" : `Load ${Math.min(PAGE, assetTotal - assets.length)} more`
          }</button><span class="count">${(assetTotal - assets.length).toLocaleString()} remaining</span></div>`
        : ""}`}
  `

  // --- wiring -----------------------------------------------------------
  root.querySelectorAll<HTMLElement>("[data-view]").forEach((el) =>
    el.addEventListener("click", () => {
      view = el.dataset.view as typeof view
      writeUrl()
      render()
      if (view === "assets" && !assets.length) void loadAssets()
    }),
  )
  root.querySelectorAll<HTMLElement>("[data-desc]").forEach((el) =>
    el.addEventListener("click", () => {
      assetDescribed = el.dataset.desc as typeof assetDescribed
      void loadAssets()
    }))
  root.querySelectorAll<HTMLElement>("[data-cat]").forEach((el) =>
    el.addEventListener("click", () => { packCategory = el.dataset.cat!; render() }))
  root.querySelectorAll<HTMLElement>("[data-only]").forEach((el) =>
    el.addEventListener("click", () => { packOnly = el.dataset.only as typeof packOnly; render() }))
  root.querySelectorAll<HTMLElement>("[data-install]").forEach((el) =>
    el.addEventListener("click", () => void install(el.dataset.install!)))
  root.querySelectorAll<HTMLElement>("[data-uninstall]").forEach((el) =>
    el.addEventListener("click", () => void uninstall(el.dataset.uninstall!)))
  root.querySelectorAll<HTMLElement>("[data-browse]").forEach((el) =>
    el.addEventListener("click", () => {
      assetPack = el.dataset.browse!
      view = "assets"
      void loadAssets()
    }))
  root.querySelectorAll<HTMLElement>("[data-asset]").forEach((el) =>
    el.addEventListener("click", () => {
      selected = assets.find((a) => a.id === Number(el.dataset.asset)) ?? null
      render()
    }))

  const packQ = root.querySelector<HTMLInputElement>("#packQ")
  if (packQ) {
    packQ.addEventListener("input", () => { packQuery = packQ.value; render(); restoreFocus("#packQ") })
  }
  const assetQ = root.querySelector<HTMLInputElement>("#assetQ")
  if (assetQ) {
    assetQ.addEventListener("input", () => {
      assetQuery = assetQ.value
      debounce(() => void loadAssets(), 220)
    })
  }
  bindSelect("#roleSel", (v) => { assetRole = v; void loadAssets() })
  bindSelect("#styleSel", (v) => { assetStyle = v; void loadAssets() })
  bindSelect("#packSel", (v) => { assetPack = v; void loadAssets() })
  root.querySelector<HTMLElement>("#moreBtn")
    ?.addEventListener("click", () => void loadAssets({ append: true }))
  const tile = root.querySelector<HTMLInputElement>("#tileChk")
  tile?.addEventListener("change", () => { assetTileable = tile.checked; void loadAssets() })
}

function bindSelect(sel: string, fn: (v: string) => void) {
  const el = document.querySelector<HTMLSelectElement>(sel)
  el?.addEventListener("change", () => fn(el.value))
}

let debounceTimer: number | undefined
function debounce(fn: () => void, ms: number) {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fn, ms) as unknown as number
}

/** Re-rendering innerHTML drops focus; put it back so typing is not interrupted. */
function restoreFocus(sel: string) {
  const el = document.querySelector<HTMLInputElement>(sel)
  if (!el) return
  const end = el.value.length
  el.focus()
  el.setSelectionRange(end, end)
}

export async function start() {
  readUrl()
  render()
  try {
    await Promise.all([loadPacks(), loadStats()])
  } catch (err) {
    const root = $("#app")
    if (root) {
      root.innerHTML = `<p class="empty">Cannot reach the dev-server API: ${esc((err as Error).message)}.<br>
        This UI needs <code>npm run dev</code>; a static build has no server to install packs with.</p>`
    }
    return
  }
  render()
  if (view === "assets") await loadAssets()
}
