# 25 - Fix Vitest Config and Failing Tests

## Prompt

Tests are failing, please fix them.

## Problem

Running `npx vitest run` produced two categories of failures:

1. `ReferenceError: describe is not defined` in all service spec files — no `vitest.config.ts` existed, so vitest globals were not enabled.
2. `ReferenceError: window is not defined` / `TestBed.initTestEnvironment()` errors in `app.spec.ts` — Angular component tests that require the Angular CLI test runner, not plain vitest.

Additionally, both `typescript-generator.service.ts` and `use-case-generator.service.ts` had been reverted by the linter (undoing the `.strict()` and empty line changes from prompt 24), and one test assertion was stale.

## Changes

### Created `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: ['src/app/app.spec.ts', 'node_modules/**'],
  },
});
```

- `globals: true` — makes `describe`, `it`, `expect`, `beforeEach` available without imports
- `environment: 'jsdom'` — provides browser-like globals (e.g. `window`)
- `exclude: ['src/app/app.spec.ts']` — excludes the Angular TestBed component test, which must be run via `ng test` instead

### Re-applied `.strict()` and empty line changes

Both `genZodObject` in `typescript-generator.service.ts` and `renderZodSchema` in `use-case-generator.service.ts` were reverted to their old state by the linter. The `.strict()` and empty line changes from prompt 24 were re-applied to both files.

### Updated stale test assertion

In `typescript-generator.service.spec.ts`, the empty object schema test was updated:

```ts
// before
expect(output).toContain('export const EmptySchema = z.object({});');

// after
expect(output).toContain('export const EmptySchema = z.object({}).strict();');
```

## Result

157 tests passing across 4 service spec files.
