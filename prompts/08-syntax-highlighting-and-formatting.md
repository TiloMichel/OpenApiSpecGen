# Prompt 08 — Syntax Highlighting and Formatting

## User
please also introduce syntax highlighting and formatting to the text area for json and yaml

## Assistant
Replaced the plain `<textarea>` with a full CodeMirror 6 editor wrapped in a new `SpecEditorComponent`. CodeMirror 6 was already present in `package.json` along with `@codemirror/lang-json`, `@codemirror/legacy-modes` (for YAML), and `@codemirror/theme-one-dark`.

**New file — `src/app/components/spec-editor/spec-editor.ts`**
- Angular standalone component with `ViewEncapsulation.None` (needed to style CodeMirror internals)
- Inputs: `content`, `darkMode`, `filename` (all signal-based)
- Output: `contentChange` (emits the current doc string on every edit)
- Language auto-detected from filename extension, falling back to content inspection (leading `{`/`[` → JSON, otherwise YAML); uses a `Compartment` so it can be reconfigured live without destroying the editor
- Theme uses a second `Compartment`: `oneDark` in dark mode, a custom `LIGHT_THEME` that maps CodeMirror surfaces to Material Design CSS custom properties (`--mat-sys-surface-variant`, etc.) in light mode
- Three `effect()` calls in the constructor keep content, language, and theme in sync with parent signal changes without rebuilding the editor
- `externalUpdate` flag prevents the `updateListener` from re-emitting when the editor is being programmatically updated (avoids signal loops)
- `format()` method: JSON → `JSON.stringify(JSON.parse(...), null, 2)`, YAML → `jsYaml.dump(jsYaml.load(...), { indent: 2, lineWidth: -1 })`; errors shown via `MatSnackBar`

**New file — `src/app/components/spec-editor/spec-editor.scss`**
- Toolbar row with language badge (uppercase, monospace) and a format icon button (`auto_fix_high`)
- Editor host sized to `280px` height; CodeMirror's scroller fills it

**`app.html`** — replaced `<textarea>` with `<app-spec-editor [content] [darkMode] [filename] (contentChange)>`

**`app.ts`** — imported `SpecEditorComponent`, added it to `@Component.imports`, renamed `onSpecInput` → `onSpecContentChange` to match the new output name

**`app.scss`** — removed textarea-specific `.spec-content` rules; added `app-spec-editor { display: block }`
