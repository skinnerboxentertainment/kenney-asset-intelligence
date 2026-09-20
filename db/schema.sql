-- Kenney asset index.
-- One database replaces manifest.json / analyzed-manifest.json /
-- enriched-manifest.json / merged-manifest.json. Each enrichment tier is an
-- UPDATE against columns on `assets`, keyed by (pack, path) -- so the
-- index-position join that could silently misalign descriptions is gone.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS packs (
  slug          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  category      TEXT,              -- 2D | 3D | Audio | Textures | Other
  series        TEXT,
  download_url  TEXT,
  preview_url   TEXT,
  tags          TEXT,              -- JSON array, scraped from kenney.nl
  file_count    INTEGER,           -- kenney's own count (approximate)
  installed     INTEGER NOT NULL DEFAULT 0,   -- extracted to disk?
  license       TEXT NOT NULL DEFAULT 'CC0-1.0'
);

CREATE TABLE IF NOT EXISTS assets (
  id            INTEGER PRIMARY KEY,
  pack          TEXT NOT NULL REFERENCES packs(slug) ON DELETE CASCADE,
  path          TEXT NOT NULL,     -- pack-relative, '/' separated
  kind          TEXT NOT NULL,     -- image | audio | other
  ext           TEXT,
  bytes         INTEGER,
  width         INTEGER,
  height        INTEGER,

  -- Tier 1: structural, from a real decoder. NULL until `assets analyze`.
  unique_colors INTEGER,
  top_colors    TEXT,              -- JSON array of hex; a quantized histogram,
                                   -- deliberately NOT called k-means
  has_alpha     INTEGER,
  alpha_ratio   REAL,
  content_ratio REAL,
  tile_score    REAL,
  symmetry_score REAL,
  style         TEXT,              -- 1-bit | indexed | pixel-art | full-color
  is_atlas      INTEGER NOT NULL DEFAULT 0,

  -- Tier 2: lexical, from filename + parent directory. Free, high recall.
  keywords      TEXT,              -- JSON array
  role          TEXT,              -- character|enemy|tile|background|ui|
                                   -- effect|pickup|weapon|audio
  anim_frame    TEXT,              -- walk|jump|idle|... or NULL

  -- Tier 3: vision. NULL until bought. Provenance is never optional.
  observed      TEXT,
  vision_style  TEXT,
  vision_model  TEXT,              -- which model made this claim
  vision_at     TEXT,              -- ISO 8601
  audited       INTEGER NOT NULL DEFAULT 0,  -- someone compared the claim to the pixels
  audited_at    TEXT,              -- ISO 8601; provenance without verification is half a chain

  UNIQUE(pack, path)
);

CREATE INDEX IF NOT EXISTS idx_assets_pack  ON assets(pack);
CREATE INDEX IF NOT EXISTS idx_assets_role  ON assets(role);
CREATE INDEX IF NOT EXISTS idx_assets_style ON assets(style);
CREATE INDEX IF NOT EXISTS idx_assets_kind  ON assets(kind);

-- Standalone FTS5 (not external-content): rowid is aligned to assets.id and
-- the table is repopulated wholesale by `assets index --fts`. No triggers to
-- drift out of sync.
CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
  text,
  tokenize = 'porter unicode61'
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
