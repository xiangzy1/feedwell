# Stats Window Build Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the stats window so it displays statistics data instead of the main RSS reader UI.

**Architecture:** `electron-vite` only builds the three standard entries (`main`, `preload`, `renderer`). The `renderer-stats` entry in `electron.vite.config.ts` is silently ignored. We create a standalone vite config for renderer-stats and chain it into the build script.

**Tech Stack:** electron-vite, vite, React

---

### Task 1: Create standalone vite config for renderer-stats

**Files:**
- Create: `vite.stats.config.ts`

- [ ] **Step 1: Create the config file**

```typescript
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default {
  root: resolve('src/renderer-stats'),
  build: {
    outDir: resolve('out/renderer-stats'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve('src/renderer-stats/index.html')
    }
  },
  plugins: [react()]
}
```

- [ ] **Step 2: Test the build**

Run: `pnpm exec vite build --config vite.stats.config.ts`

Expected: `out/renderer-stats/index.html` exists with stats app content.

- [ ] **Step 3: Commit**

```bash
git add vite.stats.config.ts
git commit -m "build: add standalone vite config for renderer-stats"
```

---

### Task 2: Update build scripts in package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update build and preview scripts**

Change `package.json` scripts from:

```json
"build": "electron-vite build",
"preview": "electron-vite preview",
"package": "electron-vite build && electron-builder"
```

To:

```json
"build": "electron-vite build && vite build --config vite.stats.config.ts",
"preview": "electron-vite preview",
"package": "electron-vite build && vite build --config vite.stats.config.ts && electron-builder"
```

- [ ] **Step 2: Test the full build**

Run: `pnpm run build`

Expected: Both `out/renderer/index.html` and `out/renderer-stats/index.html` exist.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "build: include renderer-stats in build pipeline"
```

---

### Task 3: Remove dead config from electron.vite.config.ts

**Files:**
- Modify: `electron.vite.config.ts`

- [ ] **Step 1: Remove the ignored `renderer-stats` entry**

Delete lines 31-41 (the `'renderer-stats'` block) from `electron.vite.config.ts`, leaving only `main`, `preload`, and `renderer`.

- [ ] **Step 2: Verify main build still works**

Run: `pnpm exec electron-vite build`

Expected: `out/main/`, `out/preload/`, `out/renderer/` all rebuilt successfully.

- [ ] **Step 3: Commit**

```bash
git add electron.vite.config.ts
git commit -m "build: remove dead renderer-stats entry from electron-vite config"
```

---

### Task 4: Verify end-to-end in dev mode

**Files:**
- None (verification only)

- [ ] **Step 1: Build both outputs**

Run: `pnpm run build`

- [ ] **Step 2: Launch the app**

Run: `pnpm run preview`

- [ ] **Step 3: Click the stats button (📊) in the sidebar toolbar**

Expected: A new window opens showing overview cards, monthly chart, health table, and anomaly filter — NOT the RSS reader main UI.

- [ ] **Step 4: Verify dark mode works in stats window**

Toggle dark mode via settings, then open stats window. The stats window should follow the theme.
