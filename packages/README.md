# packages/ — shared workspace libraries

Reusable, app-agnostic code shared across `apps/*`. Declared in the root
`package.json` `workspaces`.

## Planned packages (next focused step)

The editor's engine and data model currently live inside `apps/studio-web/src/editor`
and are imported with relative paths. The clean‑architecture target is to lift the
**app-agnostic** parts here as standalone packages:

- **`@milystudio/shared-types`** — the project data model and pure helpers
  (`Project`, `Track`, `Clip`, `createEmptyProject`, `projectDuration`, …).
  Source today: `apps/studio-web/src/editor/state/project.ts`.
- **`@milystudio/editor-engine`** — the rendering/compositing/export engine
  (`Compositor`, `MediaSync`, `exportProject`, the Lottie cache).
  Source today: `apps/studio-web/src/editor/engine/*`.

Extraction = move those files here, add Vite/TS path aliases, and rewrite imports
(`../state/project.ts` → `@milystudio/shared-types`, `../engine/*` → `@milystudio/editor-engine`).
Deferred deliberately: it touches ~25 import sites in the working editor, so it is
best done as its own verified change rather than bundled with the directory move.

App-level state/logic (`state/store.tsx`, `state/media.ts`, `lib/*`) stays in
`apps/studio-web` — it depends on `@milystudio/shared-types` but is not itself shared.
