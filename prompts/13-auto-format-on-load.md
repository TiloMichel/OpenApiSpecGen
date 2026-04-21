# Prompt 13 — Auto-Format Spec on Upload

## User
please also execute one formatting of the input file, after it is uploaded

## Assistant
Added a `formatSpec` helper in `app.ts` that runs once when a file is uploaded or the example is loaded, before the content is passed to the editor.

**`src/app/app.ts`**
- Imported `js-yaml`
- Added `private formatSpec(content: string, filename: string): string` — detects JSON from the `.json` extension and formats with `JSON.stringify(..., null, 2)`; treats everything else as YAML and formats with `jsYaml.dump(..., { indent: 2, lineWidth: -1 })`; silently falls back to the raw content if parsing fails
- `loadFile` — wraps `reader.result` in `formatSpec` before calling `specContent.set`
- `loadExample` — wraps `EXAMPLE_SPEC` in `formatSpec` before calling `specContent.set`
