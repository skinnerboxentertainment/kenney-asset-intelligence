---
name: typescript-patterns
description: "TypeScript strict-mode patterns, type safety conventions, and compiler-backed code review for PixiJS game development. Load this when writing or reviewing TypeScript code."
argument-hint: "[review | lint | refactor]"
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, Task
model: opencode-go/deepseek-v4-flash
---

When this skill is invoked:

## 0. Load Context

Read these files first:
- `.opencode/docs/ts-reference/VERSION.md` — pinned version, post-cutoff changes
- `.opencode/docs/ts-reference/patterns.md` — allowed and banned patterns
- `.opencode/docs/ts-reference/module-architecture.md` — dependency rules

## 1. Mode Dispatch

### `review` mode — TypeScript code review
Check each file for:
1. `any` usage (banned except in type guard signatures)
2. `as` type assertions (flag with reason required)
3. `!` non-null assertions (suggest narrowing instead)
4. `// @ts-ignore` or `// @ts-expect-error` (flag as blocker)
5. Missing return types on public functions
6. Implicit `any` on parameters
7. Runtime `enum` (should be `const enum` or `as const`)
8. Imports from wrong module layer (flag boundary violations)
9. `Function` or `object` as types

Report as:
```
TS Review: [file]
- PASS: (list of checked items that pass)
- WARN: (non-blocking concerns)
- FAIL: (blocking issues)
```

### `lint` mode — auto-fix common issues
Suggest fixes for:
- Replace `any` with `unknown` + type guard
- Replace `as` assertions with narrowing
- Replace `!` with early return
- Replace runtime `enum` with `const enum`
- Add explicit return types
- Add parameter types where missing

### `refactor` mode — architecture-aware refactoring
1. Map the file's imports and exports
2. Check module boundaries against `.opencode/docs/ts-reference/module-architecture.md`
3. Propose refactoring plan that respects the dependency direction
4. Show the plan before making changes

## 2. Compiler-Backed Analysis

For any type-level question, suggest running:
```bash
npx ts-morph eval "find symbol X, show type, show references"
```

Or use the `ts-compiler-mcp` tools if available:
- `findSymbol(name)` — locate a symbol
- `findReferences(name)` — find all usages
- `checkAnyUsage(path)` — audit a file for `any`
- `traceImports(path)` — trace dependency graph
- `checkBoundaryViolation(path)` — validate module isolation

## 3. Code Generation Standards

Always generate TypeScript that:
- Uses `strict: true` idioms
- Has explicit return types on public API
- Uses discriminated unions for state machines
- Uses branded types for entity identifiers
- Uses `Readonly` for immutable game state
- Has proper error boundaries on async operations
- Uses `AbortController` for cancellable async work

## 4. Anti-Pattern Enforcement

Never generate:
- `any` except in type guard functions
- `as` without documented justification
- `!` non-null assertions
- `// @ts-ignore` or `// @ts-expect-error`
- Runtime `enum` outside data layer
- Circular module imports
- Gameplay -> UI direct imports
- Core imports from gameplay, ai, ui, or rendering
