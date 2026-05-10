# 27 - Access Modifiers, Async Return Types, and Linting

## Prompts

1. Add access modifiers to the TypeScript service files. In C# the controller endpoints should return either `Task<T>` or `IAsyncEnumerable<T>`.
2. The C# endpoints shouldn't have `IActionResult` or `ActionResult`. Just use `Task` if there is no return object and `Task<T>` with the return object if it's there.
3. Please also add linting and a prettier config for the code.
4. Also add a lint check to the Docker and to the GitHub workflows with the Docker lint test.
5. The linting step should be its own GitHub workflow.

## Changes

### Access modifiers on TypeScript service files

Added explicit `public` modifiers to all publicly-consumed methods across all service files:

- `openapi-parser.service.ts` — `parse`, `toPascalCase`, `toCamelCase`, `detectFormat`
- `code-generator.service.ts` — `generate`, constructor
- `csharp-generator.service.ts` — `generateDtos`, `generateDtoFiles`, `generateControllers`, `generateControllerFiles`, `toCsType`
- `typescript-generator.service.ts` — `generateSchemas`, `generateSchemaFiles`, `generateServices`, `generateServiceFiles`, `toZodType`, `toTsType`
- `file-download.service.ts` — `downloadText`, `downloadZip`
- `youtrack.service.ts` — `getProjects`, `getIssueTypes`, `buildStagedIssues`, `createUseCaseIssues`, constructor
- `use-case-generator.service.ts` — `generateUseCaseFiles`, constructor

### C# controller return types

`genAction` in `csharp-generator.service.ts` and `renderCsharpAction` in `use-case-generator.service.ts` were updated to generate:

| Response      | Generated return type  |
|---------------|------------------------|
| None          | `Task`                 |
| Single object | `Task<T>`              |
| Array         | `IAsyncEnumerable<T>`  |

A private `actionReturnType(op)` helper was extracted in `CsharpGeneratorService` to keep `genAction` clean. The unused `_ns` parameter was removed from `genController` at the same time.

### ESLint setup

Installed packages:

```text
eslint  typescript-eslint  angular-eslint  eslint-config-prettier  @eslint/js
```

Created `eslint.config.mjs` (flat config) with:

- `@angular-eslint` rules for component/directive selector naming
- `@typescript-eslint/explicit-member-accessibility` — error (enforces access modifiers everywhere)
- `@typescript-eslint/no-unused-vars` — ignores `_`-prefixed names
- `@angular-eslint/prefer-inject` — off (constructor injection is valid; migration is a separate task)
- `@typescript-eslint/no-empty-function` — off for `*.spec.ts` (test mocks need empty stubs)
- Template accessibility rules excluded (too strict for existing markup)
- `eslint-config-prettier` applied last to disable formatting rules that conflict with Prettier

### Prettier config

Added `"trailingComma": "all"` to `.prettierrc` for cleaner diffs.

### npm scripts

```json
"lint":           "eslint src",
"lint:fix":       "eslint src --fix",
"format":         "prettier --write .",
"format:check":   "prettier --check ."
```

### Code fixes required to reach zero lint errors

- `app.ts` — all class members annotated (`private`/`protected`/`public`); template-bound members use `protected`
- `spec-editor.ts`, `code-editor.ts` — same; lifecycle hooks use `public`
- `openapi-parser.service.ts` — `any` in `parsePaths` replaced with the existing `RawPathItem` type

### Docker lint stage

Added a `lint` stage to `Dockerfile`:

```dockerfile
# Stage 3 — lint
FROM node:22-alpine AS lint
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "lint"]
```

### GitHub Actions lint job

Added a `lint` job to `.github/workflows/test.yml` that builds the Docker lint stage and runs it:

```yaml
lint:
  runs-on: ubuntu-latest

  steps:
    - uses: actions/checkout@v4

    - name: Build lint image
      run: docker build --target lint -t openapi-gen-lint .

    - name: Run lint
      run: docker run --rm openapi-gen-lint
```
