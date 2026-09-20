---
name: automagically-audio
description: "Howler.js audio lifecycle for AutoMagically Built Games. Defines audio initialization, unlock handling, music/SFX buses, mute/volume persistence, scene cleanup, and test doubles. Load when implementing audio systems or writing audio-related code."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, Task, Question
model: opencode-go/deepseek-v4-flash
---

# AutoMagically Audio

This skill defines how audio works in the project. Audio uses Howler.js.
All audio code lives under `src/audio/`.

---

## 1. Initialization

Audio init must happen after a user gesture (click, keypress, tap).
Browsers block `AudioContext` creation until user interaction.

```typescript
// src/audio/audio-manager.ts
import { Howl } from "howler"

export class AudioManager {
  private musicVolume = 0.7
  private sfxVolume = 1.0
  private music: Howl | null = null

  init(): void {
    // Called once after first user gesture.
    // No Howl instances created before this point.
  }
}
```

Call `audioManager.init()` from `main.ts` after the first click/tap/keydown,
not in module scope or constructor.

---

## 2. Music and SFX Buses

Two separate volume controls:

```typescript
setMusicVolume(v: number): void  // 0.0 to 1.0, persisted to localStorage
setSfxVolume(v: number): void     // 0.0 to 1.0, persisted to localStorage
mute(): void                       // Howler.mute(true)
unmute(): void                     // Howler.mute(false)
```

Howler exposes `Howler.volume()` for global volume and `Howler.mute()` for
global mute. Use these, not raw Web Audio API gain nodes.

---

## 3. Loading and Playing Sounds

```typescript
// Music — single instance, long duration
playMusic(key: string): void {
  this.music?.stop()
  this.music = new Howl({
    src: [`assets/audio/music/${key}.mp3`, `assets/audio/music/${key}.webm`],
    loop: true,
    volume: this.musicVolume,
  })
  this.music.play()
}

// SFX — short, pooled by Howler
playSfx(key: string): void {
  const sfx = new Howl({
    src: [`assets/audio/sfx/${key}.mp3`, `assets/audio/sfx/${key}.webm`],
    volume: this.sfxVolume,
  })
  sfx.play()
}
```

Prefer audio sprites (`Howl` sprite map) for frequently played SFX to reduce
HTTP requests and latency. Use `assets/audio/sprites/` for packed sprite
manifests.

---

## 4. Scene Change Cleanup

When a scene exits, it must stop any audio it started:

```typescript
// Called by scene.exit()
stopAll(): void {
  this.music?.stop()
  this.music?.unload()
  this.music = null
}
```

Scene audio is the scene's responsibility:
- Scene `enter()` starts audio.
- Scene `exit()` stops and cleans up audio.
- `AudioManager` provides `playMusic`, `playSfx`, `stopAll`. Scenes call them.

---

## 5. Error Handling

Howler fires events on failure:

```typescript
const sound = new Howl({
  src: ["missing.mp3"],
  onloaderror: (_id, error) => {
    console.warn(`Audio failed to load: missing.mp3`, error)
    // Fall back silently — don't block gameplay
  },
  onplayerror: (_id, error) => {
    console.warn(`Audio playback blocked`, error)
    // Common on first play before user gesture
  },
})
```

Never let a missing or blocked audio file throw an uncaught error.
Audio failures must not block gameplay.

---

## 6. Test Double

```typescript
// src/audio/audio-manager.interface.ts
export interface IAudioManager {
  init(): void
  playMusic(key: string): void
  playSfx(key: string): void
  stopAll(): void
  setMusicVolume(v: number): void
  setSfxVolume(v: number): void
  mute(): void
  unmute(): void
}

// src/audio/audio-manager.ts — implements IAudioManager with Howl
// tests/helpers/mocks.ts — implements IAudioManager with vi.fn()
```

Test code never creates real `Howl` instances. Use `vi.fn()` mocks
implementing `IAudioManager`.

---

## 7. Anti-Patterns

- Creating `Howl` instances at module scope (blocked by autoplay policy).
- Direct Web Audio API (`AudioContext`, `OscillatorNode`) — use Howler.
- Uncaught audio errors (use `onloaderror` / `onplayerror`).
- Starting music in `main.ts` before user gesture.
- `setTimeout` for audio timing — use Howler's `seek()` or sprite start/end.
