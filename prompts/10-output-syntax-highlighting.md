# Prompt 10 — Output Syntax Highlighting, Formatting, and Editability

## User
Also add syntax highlighting and formatting for the output files, they should also be editable

## Assistant
Created a new `CodeEditorComponent` wrapping CodeMirror 6 for the four generated output panels, and wired edits back into the result signal.

**New file — `src/app/components/code-editor/code-editor.ts`**
- Standalone Angular component with `ViewEncapsulation.None`
- Inputs: `content`, `language` (`'typescript' | 'csharp'`), `darkMode`
- Output: `contentChange`
- TypeScript: `javascript({ typescript: true })` from `@codemirror/lang-javascript`
- C#: `StreamLanguage.define(csharp)` from `@codemirror/legacy-modes/mode/clike`
- Theme compartment: `oneDark` in dark mode, custom `LIGHT_THEME` (light grey background, matching VS Code light aesthetic) in light mode
- Same `externalUpdate` flag pattern as `SpecEditorComponent` to prevent signal feedback loops
- `max-height: 520px` matching the previous `.code-block` size

**New file — `src/app/components/code-editor/code-editor.scss`**
- Minimal wrapper styles scoped under `.code-editor-host`

**`src/app/app.ts`**
- Imported and added `CodeEditorComponent` to `@Component.imports`
- Added `updateResultFile(key, index, content)` which immutably updates the targeted `GeneratedFile` array inside the `result` signal, preserving filename and path while replacing content

**`src/app/app.html`**
- Replaced all four `<pre class="code-block"><code>` blocks with `<app-code-editor>`:
  - C# DTOs → `language="csharp"`, bound to `csharpDtoFiles[selectedDtoFile()]`
  - C# Controllers → `language="csharp"`, bound to `csharpControllerFiles[selectedControllerFile()]`
  - TypeScript Schemas → `language="typescript"`, bound to `typescriptSchemaFiles[selectedSchemaFile()]`
  - Angular HTTP Services → `language="typescript"`, bound to `typescriptServiceFiles[selectedServiceFile()]`
