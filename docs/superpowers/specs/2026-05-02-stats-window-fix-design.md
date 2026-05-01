# Stats Window Build Fix

## Problem

The stats window (`openStats`) displays the main RSS reader UI instead of the stats dashboard. Root cause: `out/renderer-stats/` build output does not exist, so `src/main/windows/stats.ts` falls back to loading the main renderer's `index.html` (line 28).

## Root Cause

`electron.vite.config.ts` defines a `renderer-stats` entry with correct `root` and `rollupOptions.input`, but the build may not produce output because `electron-vite`'s `defineConfig` only processes the three standard keys (`main`, `preload`, `renderer`). A fourth key like `renderer-stats` is ignored unless the build tool explicitly handles it.

## Fix

Build the `renderer-stats` entry as a separate vite build step. Two options:

1. **If `electron-vite` supports extra entries**: Add the entry correctly and ensure `electron-vite build` picks it up.
2. **Fallback**: Add a post-build script that runs a standalone `vite build` for `src/renderer-stats`, outputting to `out/renderer-stats`.

After the fix, `out/renderer-stats/index.html` must exist and contain the stats React app. The existing fallback in `stats.ts` becomes a safety net rather than the active path.

## Verification

1. Run build command, confirm `out/renderer-stats/index.html` exists
2. Open app, click stats button in sidebar
3. Verify the window shows overview cards, monthly chart, health table, and anomaly filter — not the RSS reader UI
4. Verify dark mode works in stats window
