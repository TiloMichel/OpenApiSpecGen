# Prompt 12 — Fix Spec Editor to 400px Height

## User
The input specification part is very large, please reduce it to a fixed size of 400 pixel in height

## Assistant
Removed `flex: 1` from `.spec-editor-host` (which was causing it to grow unbounded inside the flex column) and set a fixed `height: 400px`.

**`src/app/components/spec-editor/spec-editor.scss`** — replaced `flex: 1; height: 280px` with `height: 400px` on `.spec-editor-host`.
