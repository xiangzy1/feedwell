---
name: Dark Mode Support
date: 2026-05-02
status: approved
---

# Dark Mode Support

Add dark mode to the RSS reader using the existing CSS Custom Properties infrastructure. No new dependencies.

## Approach

Extend existing CSS variables with a `[data-theme="dark"]` override block. Manage theme state via a React hook with system preference detection and localStorage persistence. Provide a settings dialog for manual override.

## Design

### CSS Variable System

Add 6 new CSS variables to `:root` in `global.css` to replace hardcoded values, plus a `[data-theme="dark"]` block that overrides all variables:

```css
:root {
  /* existing variables unchanged */
  --bg-hover: rgba(0,0,0,0.05);
  --bg-selected: #e8f0fe;
  --bg-surface: #ffffff;
  --bg-overlay: rgba(0,0,0,0.3);
  --shadow-color: rgba(0,0,0,0.12);
  --scrollbar-thumb: #ccc;
  --selection-bg: #b3d4fc;
}

[data-theme="dark"] {
  --bg-primary: #252525;
  --bg-secondary: #1e1e1e;
  --border-color: #3a3a3a;
  --text-primary: #e0e0e0;
  --text-secondary: #888888;
  --accent: #4a9eff;
  --bg-hover: rgba(255,255,255,0.06);
  --bg-selected: rgba(0,96,223,0.25);
  --bg-surface: #2a2a2a;
  --bg-overlay: rgba(0,0,0,0.6);
  --shadow-color: rgba(0,0,0,0.3);
  --scrollbar-thumb: #555;
  --selection-bg: rgba(0,96,223,0.4);
}
```

### Hardcoded Color Migration

Replace all 47 hardcoded color values across 5 CSS files with variable references:

| File | Instances | Key replacements |
|------|-----------|-----------------|
| `global.css` | 3 | scrollbar thumb, selection bg |
| `sidebar.css` | 14 | `white` → `var(--bg-surface)`, hover states → `var(--bg-hover)`, overlay → `var(--bg-overlay)`, shadow → `var(--shadow-color)` |
| `article-list.css` | 2 | hover → `var(--bg-hover)`, selected → `var(--bg-selected)` |
| `article-view.css` | 5 | `white` → `var(--bg-surface)`, overlay bg → `var(--bg-surface)`, retry btn → `var(--bg-surface)` |
| `stats.css` | 23 | `white` → `var(--bg-surface)`, `#e0e0e0` → `var(--border-color)`, `#666`/`#999` → `var(--text-secondary)`, badge colors → new variables |

Badge status colors need dedicated variables for dark mode:

```css
:root {
  --badge-healthy-bg: #e8f5e9;  --badge-healthy-text: #2e7d32;
  --badge-failed-bg: #fbe9e7;   --badge-failed-text: #c62828;
  --badge-inactive-bg: #fff3e0; --badge-inactive-text: #e65100;
}
[data-theme="dark"] {
  --badge-healthy-bg: rgba(46,125,50,0.2);  --badge-healthy-text: #66bb6a;
  --badge-failed-bg: rgba(198,40,40,0.2);   --badge-failed-text: #ef5350;
  --badge-inactive-bg: rgba(230,81,0,0.2);  --badge-inactive-text: #ffa726;
}
```

Error-related colors (`#c00`, `#dc2626`, `#fef2f2`) also get variables:

```css
:root {
  --error-bg: #fef2f2;  --error-text: #dc2626;  --danger: #c00;
}
[data-theme="dark"] {
  --error-bg: rgba(220,38,38,0.15);  --error-text: #ef5350;  --danger: #ef5350;
}
```

### React Theme Hook

New file: `src/renderer/src/hooks/useTheme.ts`

```typescript
type Theme = 'light' | 'dark' | 'system'

useTheme():
  - State: theme preference from localStorage (default: 'system')
  - Effect: watch `matchMedia('(prefers-color-scheme: dark)')` for system changes
  - Effect: resolve actual theme (light/dark) and set `document.documentElement.dataset.theme`
  - Persist preference to localStorage on change
  - Expose: { theme, setTheme, resolvedTheme }
```

Called once in `src/renderer/src/App.tsx`. Theme context provided via React context so settings dialog can read/write it.

### Settings Dialog

New component: `src/renderer/src/components/Settings/SettingsDialog.tsx`

- Gear icon button added to sidebar toolbar
- Click opens a dialog (reusing existing `.dialog` styles)
- Three radio options: 跟随系统 / 浅色 / 深色
- Selection calls `setTheme()` from context

### Stats Window

`renderer-stats` has its own entry point and CSS. Apply same pattern:
- Copy `useTheme.ts` to `src/renderer-stats/src/hooks/`
- Call in `src/renderer-stats/src/App.tsx`
- Migrate `stats.css` hardcoded colors to variables
- Both windows share the same localStorage key for theme preference

## Files Changed

| Action | File |
|--------|------|
| Modify | `src/renderer/src/styles/global.css` |
| Modify | `src/renderer/src/styles/sidebar.css` |
| Modify | `src/renderer/src/styles/article-list.css` |
| Modify | `src/renderer/src/styles/article-view.css` |
| Modify | `src/renderer/src/styles/stats.css` (stats window) |
| New | `src/renderer/src/hooks/useTheme.ts` |
| New | `src/renderer/src/components/Settings/SettingsDialog.tsx` |
| Modify | `src/renderer/src/App.tsx` |
| New | `src/renderer-stats/src/hooks/useTheme.ts` |
| Modify | `src/renderer-stats/src/App.tsx` |

## Out of Scope

- WebView content theming (third-party pages cannot be themed)
- Auto-sync theme between main and stats windows (they share localStorage, so they stay in sync on next open)
