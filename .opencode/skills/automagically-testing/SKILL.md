---
name: automagically-testing
description: "Layered testing strategy for AutoMagically Built Games. Defines the testing pyramid, deterministic testing patterns, and when to use each test type. Load when writing tests, reviewing test coverage, or setting up test infrastructure."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, Task, Question
model: opencode-go/deepseek-v4-flash
---

# AutoMagically Testing

This skill defines the testing strategy for the project. All test code must
follow these patterns. Tests live under `tests/` mirroring `src/` structure:

```
tests/
  unit/            — fast, no browser, no PixiJS
  integration/     — scene lifecycle, input, audio, resize
  browser/         — Playwright, Chromium, headless
  visual/          — Playwright screenshot comparisons (sparse)
  helpers/         — shared factories, mocks, assertions
```

---

## 1. Testing Pyramid

### Unit Tests (80% of tests)

Test game logic in isolation. No browser, no PixiJS rendering.

```typescript
// tests/unit/gameplay/player-state.test.ts
import { describe, it, expect } from "vitest"
import { PlayerState } from "../../../src/gameplay/player-state"

describe("PlayerState", () => {
  it("takes damage and reduces health", () => {
    const state = new PlayerState()
    state.takeDamage(25)
    expect(state.health).toBe(75)
  })

  it("clamps health to zero", () => {
    const state = new PlayerState({ health: 10 })
    state.takeDamage(100)
    expect(state.health).toBe(0)
  })
})
```

What to unit test:
- State transitions (health, inventory, score, progression)
- Collision decisions (does entity A hit entity B?)
- Formulas (damage = attack - defense, crit rolls)
- Spawn logic (what spawns, where, how many)
- Save/load round-trip (toJSON → fromJSON → match)
- Seeded RNG (same seed → same sequence)

### Integration Tests (15% of tests)

Test interactions between systems. Vitest with jsdom environment.

```typescript
// tests/integration/scene-lifecycle.test.ts
import { describe, it, expect } from "vitest"
import { GameScene } from "../../src/scenes/game-scene"

describe("GameScene", () => {
  it("creates and destroys without leaking", () => {
    const scene = new GameScene()
    scene.enter()
    scene.exit()
    // verify no ticker callbacks, no DOM listeners remain
  })
})
```

What to integration test:
- Scene lifecycle (enter/exit, no leaks)
- InputManager frame capture
- Resize behavior
- Audio command routing
- Asset failure handling

### Browser Tests (4% of tests)

Playwright in headless Chromium. Test real browser behavior.

```typescript
// tests/browser/startup.test.ts
import { test, expect } from "@playwright/test"

test("game loads and renders canvas", async ({ page }) => {
  await page.goto("http://localhost:5173")
  await page.waitForSelector("canvas")
  expect(await page.locator("canvas").isVisible()).toBe(true)
})
```

What to browser test:
- Game loads and renders
- Pointer and keyboard interaction work
- Pause/resume cycle
- Fullscreen toggle
- Focus-loss handling

### Visual Tests (1% of tests)

Playwright screenshot comparisons. Sparse and intentional.

```typescript
// tests/visual/menu.test.ts
test("main menu renders correctly", async ({ page }) => {
  await page.goto("http://localhost:5173")
  await page.waitForSelector("canvas")
  await expect(page.locator("canvas")).toHaveScreenshot("main-menu.png")
})
```

What to visually test:
- Main menu (one stable contract)
- Representative gameplay state (one scene)
- HUD layout
- Game-over state

Do NOT visually test:
- Animations (will never match frame-perfect)
- Particle effects (non-deterministic)
- Content that changes per playthrough

---

## 2. Deterministic Testing

Game logic must be testable without a browser or real clock.

### Fake Clock

```typescript
// tests/helpers/fake-clock.ts
export class FakeClock {
  private _time = 0
  get time(): number { return this._time }
  advance(ms: number): void { this._time += ms }
  reset(): void { this._time = 0 }
}
```

Pass `FakeClock` to systems that need timing. Never call `Date.now()`,
`performance.now()`, or `requestAnimationFrame` directly in game logic.

### Seeded RNG

```typescript
// tests/helpers/seeded-rng.ts
export function createSeededRNG(seed: number) {
  let s = seed
  return {
    next(): number {
      s = (s * 16807 + 0) % 2147483647
      return (s - 1) / 2147483646
    },
  }
}
```

Always use seeded RNG in game logic. Same seed → same sequence →
deterministic tests.

---

## 3. What NOT to Test Through Pixels

Never test game logic by checking rendered pixel output.

```typescript
// WRONG — testing logic through rendering
// await expect(canvas).toHaveScreenshot("player-took-damage.png")

// CORRECT — test the state directly
player.takeDamage(25)
expect(player.health).toBe(75)
```

- State changes → unit tests
- Rendering changes → visual tests (sparse)
- If a bug manifests visually, write a unit test for the *underlying state change*,
  not a screenshot of the visual artifact.

---

## 4. Test Helpers Convention

Shared helpers live in `tests/helpers/`:

- `factories.ts` — create game objects with sensible defaults
- `mocks.ts` — mock event bus, mock audio manager
- `assertions.ts` — custom vitest matchers (e.g., `expectInRange`)
- `seeded-rng.ts` — deterministic randomness
- `fake-clock.ts` — deterministic time

---

## 5. Coverage Target

- **Unit tests**: 80% line coverage on `src/gameplay/` and `src/core/` logic
- **Integration tests**: all scene lifetime paths enter/exit without error
- **Browser tests**: startup smoke test, one interaction path
- **Visual tests**: no coverage target — maintained manually for stability

Do not enforce coverage on `src/ui/` or `src/audio/` — those are better
validated through manual review and browser tests.
