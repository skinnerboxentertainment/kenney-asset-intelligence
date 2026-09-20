---
name: automagically-game-architecture
description: "Non-negotiable game architecture rules for the AutoMagically Built Games project. Load this skill when designing, implementing, or reviewing game code. Defines scene lifecycle, state ownership, update loop, input handling, composition model, project structure, and save/load conventions. All game code must follow these rules."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, Task, Question
model: opencode-go/deepseek-v4-flash
---

# AutoMagically Game Architecture

This skill defines the structural rules that every game system must follow.
Apply these when writing or reviewing any code under `src/`.

---

## 1. State Ownership

Game simulation state must live in plain TypeScript classes or records,
**never** on PixiJS display object properties.

```typescript
// CORRECT — state on a plain class
class PlayerState {
  health = 100
  position = { x: 0, y: 0 }
  inventory: string[] = []
}

// Render pass syncs display to state
function syncPlayerDisplay(player: PlayerState, sprite: Sprite) {
  sprite.position.set(player.position.x, player.position.y)
}

// WRONG — state on a Sprite
sprite.health = 100          // no
sprite.playerData = { ... }  // no
```

This is the single most important rule. Violating it produces code that is
untestable, impossible to save/load, and tightly coupled to the renderer.

---

## 2. Scene Lifecycle

Use a stack-based scene manager. Each scene follows this contract:

```
enter()     → create display objects, subscribe to input, start audio
update(dt)  → run game logic for one frame
exit()      → destroy display objects, unsubscribe, stop audio
```

Rules:
- Scenes own their display objects. `enter()` creates them, `exit()` destroys them.
- Scenes do not own the PixiJS `Application` or `InputManager` — those live at the app level.
- Scene transitions: push (pause current, start new), pop (destroy top, resume previous), replace (destroy current, start new).

Example scene:

```typescript
class MenuScene implements Scene {
  private container = new Container()

  enter(): void {
    app.stage.addChild(this.container)
    // create menu sprites, add to container
  }

  update(dt: number): void {
    // check input, animate menu items
  }

  exit(): void {
    this.container.removeFromParent()
    this.container.destroy({ children: true })
  }
}
```

---

## 3. Update Loop

Use variable delta with PixiJS v8 `Ticker`:

```typescript
app.ticker.add((ticker) => {
  const dt = ticker.deltaTime  // fraction of target frame (1.0 = 60fps)
  update(dt)
})
```

- `dt` is a float where 1.0 = one frame at 60fps. Multiply speeds by `dt`.
- If deterministic physics/replay is needed later, wrap this in a fixed-step accumulator.
- Start with variable delta. Add fixed-step only when gameplay demands it.

---

## 4. Input Handling

A single `InputManager` captures all input states once per frame:

```typescript
class InputManager {
  readonly keys = new Set<string>()
  readonly keysJustPressed = new Set<string>()
  readonly mouse = { x: 0, y: 0, left: false }

  update(): void {
    // called once per frame before scene.update()
    // captures current keyboard, mouse, touch, gamepad state
  }
}
```

Rules:
- Scenes read from `InputManager` — they never register their own DOM event listeners.
- This simplifies pausing (clear input on pause), focus-loss (clear on blur), and input remapping.
- `update()` is called once per frame, before any scene's `update()`.

---

## 5. Composition Model

Use plain classes with clear dependencies. Not ECS.

```typescript
class Player {
  readonly state = new PlayerState()
  private sprite: Sprite

  constructor(sprite: Sprite) {
    this.sprite = sprite
  }

  update(dt: number, input: InputManager): void {
    // read input, update state
    // sync sprite to state
  }
}
```

- ECS overhead is not justified for solo/small-team projects.
- If composition becomes painful (cross-cutting systems, data-driven entities),
  migrate to ECS later. Do not start there.

---

## 6. Project Structure

```
src/
  main.ts               — PixiJS Application init, game loop, scene manager
  core/                  — SceneManager, InputManager
  scenes/                — BootScene, MenuScene, GameScene, etc.
  gameplay/              — Player, Enemy, Projectile, systems
  ui/                    — HUD, menus, overlays
  input/                 — InputManager, input bindings
  audio/                 — Howler.js wrapper, sound manager
  data/                  — Static data: levels, enemy configs, loot tables
  utils/                 — Math helpers, object pooling, seeded RNG
```

Rules:
- `core/` has zero imports from `gameplay/`, `scenes/`, or `ui/`.
- `gameplay/` can import from `core/` and `input/` but not `ui/`.
- `ui/` can import from `core/` and `input/` but not `gameplay/`.

---

## 7. Audio Communication

Scenes communicate audio events by calling the `AudioManager` directly.
No event bus or callback pattern is needed.

```typescript
// In a scene's update() or on a gameplay event:
import { audioManager } from "../audio/audio-manager"

function onCollectGem(): void {
  audioManager.playSfx("collect")
}

function onPlayerHit(): void {
  audioManager.playSfx("hit")
}

function onJump(): void {
  audioManager.playSfx("jump")
}
```

Rules:
- `audioManager` is a singleton import — no dependency injection needed.
- Scenes call `playSfx(key)` and `playMusic(key)` directly.
- Audio cleanup is the scene's responsibility (`stopAll()` in `exit()`).
- The `AudioManager` handles bus routing (music vs SFX), volume, mute, and autoplay policy.

---

## 8. Save/Load

State objects implement `toJSON()` / `fromJSON()`:

```typescript
class PlayerState {
  toJSON(): object {
    return { health: this.health, inventory: this.inventory }
  }

  static fromJSON(data: object): PlayerState {
    const s = new PlayerState()
    s.health = data.health ?? 100
    s.inventory = data.inventory ?? []
    return s
  }
}
```

Rules:
- Serialize to JSON. Store in `localStorage`.
- No binary formats. No schema migrations yet.
- Add versioning only when the project requires breaking changes.

---

## 10. Graph Integration

Every gameplay system must declare its state machine using the
`NarrativeDocumentV2Schema` from `@automagically/narrative-core`.
This enables live graph visualization and cross-system dependency analysis.

### How it works

A `GraphRegistry` singleton at `src/core/graph-registry.ts` collects
`NarrativeDocument` declarations from all systems at init time.

```typescript
import { GraphRegistry } from "../core/graph-registry"
import type { NarrativeDocument } from "@automagically/narrative-core"

const doc: NarrativeDocument = {
  schema: "NarrativeDocumentV2",
  metadata: { id: "player", title: "Player", version: "2.0.0", createdAt: "", modifiedAt: "" },
  environment: {
    variables: {
      player_health: { id: "player_health", name: "Health", type: "number", defaultValue: 3, scope: "session" },
    },
  },
  topology: {
    nodes: {
      PLAYER_IDLE: { id: "PLAYER_IDLE", sceneId: "player" },
    },
    transitions: [],
  },
  content: { scenes: {}, arcs: {} },
  presentation: { scenes: {}, characters: {}, themes: {}, cinematics: {} },
  runtime: { config: { startNodeId: "PLAYER_IDLE" } },
  editor: {},
  audio: { cues: {} },
  plugins: { registry: {}, state: {} },
}

GraphRegistry.register("player", doc)
```

Rules:
- Every system module registers its own graph at init time.
- `GraphRegistry.exportJSON()` serializes the combined graph for the viewer.
- The dev server exposes `/api/graph` that returns the combined graph.
- The viewer fetches this endpoint during development.
- At build time, `npm run export-graph` writes the combined graph to
  `design/game-graph.json` for static analysis.

## 11. Anti-Patterns

Never generate:

- `new Application()` inside a scene or gameplay class — init once in `main.ts`.
- State stored on `Sprite`, `Container`, or any PixiJS display object.
- DOM event listeners registered by scenes — use `InputManager`.
- `setInterval` or `setTimeout` for game logic — use `Ticker`.
- Direct references from `gameplay/` to `ui/` — use events or callbacks.
- Strings where enums or union types capture the domain.
