# Prompt 06 — Dark Mode

**Date:** 2026-04-21

## User Prompt

> Hi claude, i want you to add darkmode to my angular application. Please position a button to switch from it on the top right of the application. Also use the clients system default as the default setting for this

## Changes Made

### `src/styles.scss`
- Changed `color-scheme: light` to `color-scheme: light dark` so the app follows the system preference by default.
- Added `.dark` and `.light` class overrides on `body` to allow explicit toggling.

### `src/app/app.ts`
- Added `darkMode` signal initialized from `localStorage` (if a previous preference was saved) or `window.matchMedia('(prefers-color-scheme: dark)').matches` (system default).
- Added a constructor with an `effect()` that keeps `document.body` class (`dark`/`light`) and `localStorage` in sync whenever the signal changes.
- Added `toggleDarkMode()` method that flips the signal.

### `src/app/app.html`
- Added an icon button (`dark_mode` / `light_mode`) to the right of the toolbar badge, using `mat-icon-button` with a `matTooltip`.

### `src/app/app.scss`
- Added `.dark-mode-btn { margin-left: 8px; }` for spacing.

## Behaviour

- First visit: matches the OS/browser color scheme.
- User clicks the button: toggles between dark and light, choice persisted in `localStorage`.
- Subsequent visits: restores the last explicitly chosen preference.
