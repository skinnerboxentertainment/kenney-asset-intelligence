# Control Manifest

*Version: 0.1.0 | Generated: 2026-06-25*

## Layer Rules

| Layer | Required | Forbidden | Guardrails |
|-------|----------|-----------|------------|
| core/ | Dependency-free utilities | No imports from gameplay/ai/ui/networking | Zero-alloc hot paths |
| gameplay/ | Uses core | No direct UI references | Data-driven values, delta time |
| ai/ | Uses core, gameplay | No direct UI references | 2ms budget per frame |
| networking/ | Uses core, gameplay | No direct UI references | Server-authoritative |
| rendering/ | Uses core, pixi.js | No gameplay imports | Shader re-creation on context loss |
| ui/ | Uses core, gameplay (via events) | No game state ownership | Container-based, hitArea set |
| tools/ | Anything (dev-only) | No production imports | None |
