# Prompt 02 — Clarifications

**Date:** 2026-04-19

## User Prompt

> 1. There should be no backend. Just the angular application with UI
> 2. For c# please use record syntax and nullable annotations
> 3. typescript should use zod and PascalCase for Classes
> 4. Controllers should be written in mvc style.
> 5 yes
> 6. a practical subset should be enough

## My Response

Started implementing the Angular application with the following architecture:

### Architecture Decisions

- **Pure client-side**: All OpenAPI parsing and code generation happens in the browser — no backend required.
- **C# output**: Records with primary constructor syntax (`public record FooDto(...)`), nullable reference types for optional properties.
- **TypeScript output**: Zod schemas (`z.object({...})`) with PascalCase property names plus inferred TypeScript types (`z.infer<typeof FooSchema>`).
- **C# Controller**: MVC-style with `[ApiController]`, `[Route]`, `[HttpGet/Post/Put/Delete]` attributes, `ControllerBase` inheritance.
- **Angular HTTP service**: `@Injectable({ providedIn: 'root' })` with typed `Observable<T>` return types per endpoint.

### Practical Subset Supported

- Schema types: `string`, `integer`, `number`, `boolean`, `array`, `object`, `$ref`
- Enums (string enums → C# enum + Zod z.enum)
- Required vs optional properties → nullable annotations
- Path parameters, query parameters, request body, response body
- Tags → one controller + one service per tag
- YAML and JSON input
- ZIP download of all generated files

### Tech Stack

- Angular 21 (standalone components)
- Angular Material (UI)
- `js-yaml` (YAML parsing)
- `jszip` (ZIP bundling for download)

### Files Created

| File | Purpose |
| --- | --- |
| `src/app/models/openapi.model.ts` | Raw OpenAPI + parsed internal types |
| `src/app/services/openapi-parser.service.ts` | Parses YAML/JSON → internal `ParsedSpec` |
| `src/app/services/csharp-generator.service.ts` | Generates C# records + MVC controllers |
| `src/app/services/typescript-generator.service.ts` | Generates Zod schemas + Angular HTTP services |
| `src/app/services/file-download.service.ts` | Single-file and ZIP downloads |
| `src/app/services/code-generator.service.ts` | Orchestrates parse → generate |
| `src/app/app.ts` | Main component with drag-drop, signals, snackbar |
| `src/app/app.html` | Material UI: drop zone, 4-tab code viewer |
| `src/app/app.scss` | Dark code blocks, drop zone, layout |
