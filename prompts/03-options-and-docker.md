# Prompt 03 — Generation Options & Docker

**Date:** 2026-04-19

## User Prompt

> For the download please introduce options in the UI in which the user can pick what should be generated. Also if the Dtos and Components and services should be generated in different files. Also add docker compatibility for the angular application.

## My Response

### Changes Implemented

#### Generation Options Card

A new "Generation Options" card was added between the spec upload card and the output card. It is always visible so users can configure before uploading or generating.

**Checkboxes — choose which artifacts to generate:**

| Option | Default |
| --- | --- |
| C# DTOs | ✅ enabled |
| C# Controllers | ✅ enabled |
| TypeScript Schemas (Zod) | ✅ enabled |
| Angular HTTP Services | ✅ enabled |

- The Generate button is disabled when no options are selected.
- Changing any option clears the previous result to avoid stale output.

#### Split Files Toggle

A slide toggle allows splitting output into separate files per tag / schema instead of one large file per artifact type.

| Artifact | Single-file mode | Split-file mode |
| --- | --- | --- |
| C# DTOs | `csharp/Dtos.cs` | `csharp/Dtos/{SchemaName}.cs` per schema |
| C# Controllers | `csharp/Controllers.cs` | `csharp/Controllers/{Tag}Controller.cs` per tag |
| TypeScript Schemas | `typescript/schemas.ts` | `typescript/schemas.ts` (kept as one module — cross-refs make per-file splitting impractical) |
| Angular HTTP Services | `typescript/services.ts` | `typescript/services/{Tag}Service.ts` per tag |

When multiple files exist in a tab, a file picker row appears at the top of the code panel. Copy and download actions apply to the currently selected file. The ZIP download preserves the full folder structure.

Also fixed a latent bug: the C# `Controllers.cs` single-file output was repeating the file-scoped `namespace` declaration once per controller. It now appears once at the top.

#### Docker Support

Three new files were added to the project root:

| File | Purpose |
| --- | --- |
| `Dockerfile` | Multi-stage build: `node:22-alpine` compiles the Angular app, `nginx:alpine` serves the static output |
| `nginx.conf` | SPA-friendly routing (`try_files $uri /index.html`) with gzip enabled |
| `.dockerignore` | Excludes `node_modules`, `dist`, `.git`, `prompts` from the build context |

**Build and run:**

```bash
docker build -t openapi-gen .
docker run -p 8080:80 openapi-gen
# App available at http://localhost:8080
```

### Files Modified

| File | Change |
| --- | --- |
| `src/app/models/openapi.model.ts` | Added `GenerationOptions`, `GeneratedFile`, replaced `GenerationResult` with file-array–based version |
| `src/app/services/csharp-generator.service.ts` | Added `generateDtoFiles()`, `generateControllerFiles()`; fixed namespace bug in `generateControllers()` |
| `src/app/services/typescript-generator.service.ts` | Added `generateServiceFiles()` |
| `src/app/services/code-generator.service.ts` | `generate()` now accepts `GenerationOptions` and returns new `GenerationResult` |
| `src/app/services/file-download.service.ts` | `downloadZip()` iterates `GeneratedFile[]` arrays |
| `src/app/app.ts` | Added `options`, `hasAnyOption`, `selectedXxxFile` signals; `setOption()` helper; updated `generate()` |
| `src/app/app.html` | Added options card; output tabs are conditional per option; file picker in split mode |
| `src/app/app.scss` | Styles for options grid, split toggle hint, file picker buttons, tab count badge |

### Files Created

| File | Purpose |
| --- | --- |
| `Dockerfile` | Multi-stage Docker build |
| `nginx.conf` | Nginx SPA config |
| `.dockerignore` | Docker build context exclusions |