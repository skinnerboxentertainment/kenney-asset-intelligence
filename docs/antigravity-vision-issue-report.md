# Antigravity Vision Pipeline — Blocking Issue Report

**Date:** 2026-08-05
**AGY Version:** 1.0.2
**OS:** Windows (PowerShell 7)

---

## Context

Building an automated vision analysis pipeline for 27,000+ game asset sprites (Kenney.nl CC0 packs). Need to batch-process PNG images through Antigravity's multimodal vision to generate structured JSON descriptors (visual style, content description, color palette, game usage hints).

The intent is to use `agy --print` as a headless CLI bridge — send a prompt with image context, receive structured JSON back.

---

## What Works

### Text-only prompts
```powershell
agy -p "count from 1 to 5" --dangerously-skip-permissions --print-timeout 30s
# Output: 1, 2, 3, 4, 5
```

### Filesystem access with --add-dir
```powershell
agy -p "List ALL files in assets/experimental/cube-pets/" `
  --add-dir "C:/Users/oscar/AI WORKBENCH/_Active/UniversalAssetEdgeExtractor" `
  --dangerously-skip-permissions --print-timeout 60s
# Output: Correctly lists 28 files recursively
```

---

## What Breaks

### Image file access — 100% failure rate

Any prompt that asks AGY to read/open/inspect a PNG image file crashes:

```powershell
# ATTEMPT 1 — Explicit file reference in prompt
agy -p "Look at assets/experimental/cube-pets/Previews/animal-beaver.png and describe it" `
  --add-dir "C:/Users/oscar/AI WORKBENCH/_Active/UniversalAssetEdgeExtractor" `
  --dangerously-skip-permissions --print-timeout 120s

# RESULT: "Error: Agent execution terminated due to error."

# ATTEMPT 2 — Navigate into directory then open file
agy -p "Navigate to assets/experimental/cube-pets/Previews/ and look at animal-beaver.png. Describe it." `
  --add-dir "C:/Users/oscar/AI WORKBENCH/_Active/UniversalAssetEdgeExtractor" `
  --dangerously-skip-permissions --print-timeout 120s

# RESULT: "Error: Agent execution terminated due to error."

# ATTEMPT 3 — --add-dir pointing to the specific subdirectory
agy -p "Look at the first PNG in the Previews directory and describe it" `
  --add-dir "C:/Users/oscar/AI WORKBENCH/_Active/UniversalAssetEdgeExtractor/assets/experimental/cube-pets/Previews" `
  --dangerously-skip-permissions --print-timeout 120s

# RESULT: "Error: Agent execution terminated due to error."
```

### Pattern
- Text file operations: work fine
- Directory listing: works fine
- Any image file read/inspect: immediate crash with "Agent execution terminated due to error"
- No partial output or stderr — just the error message and exit

---

## Hypothesis

The error behavior is consistent with one of:

1. **The backing Gemini model lacks multimodal/vision capabilities** — AGY v1.0.2 may be configured with a text-only model (e.g., `gemini-2.0-flash` without vision). Trying to read an image triggers an unsupported operation.

2. **Filesystem sandbox prevents binary/image reads** — AGY can list text files but blocks binary/image access at the sandbox level.

3. **Missing `agy exec` command** — The integration spec references `agy exec` for subprocess-style invocation with file arguments, but v1.0.2 only has `--print` mode. If `exec` is the intended path for image processing, it hasn't shipped yet.

---

## Request

Can Antigravity help diagnose and resolve this? Specifically:

1. **Confirm the model**: Is the current AGY instance running a multimodal Gemini model? If not, how do we configure it?

2. **Multimodal image access**: What is the correct CLI invocation to pass PNG images to AGY for vision analysis in `--print` mode?

3. **Sandbox**: Is there a sandbox restriction blocking image reads? Can we disable it or grant explicit permission?

4. **Roadmap check**: Is `agy exec` (referenced in the integration spec) on the roadmap? That would be the ideal interface for this pipeline.

---

## What We're Trying to Build

```powershell
# DESIRED WORKFLOW (pseudocode)
$sheet = Generate-ContactSheet -packSlug "cube-pets" -imagesPerSheet 64
$result = agy -p @"
Analyze this contact sheet of game sprites. For each sprite, output JSON:
{ "file": "filename.png", "what": "description", "style": "pixel-art|3d-render", "use": "game usage" }
"@ --image $sheet --print-timeout 300s
# Output: [{ "file": "animal-beaver.png", "what": "...", ... }, ...]
```

The contact sheets are generated (8 sheets already exist for `top-down-tanks-redux`). We just need the vision engine to process them.
