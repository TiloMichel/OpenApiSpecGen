# Prompt 09 — Split Files Default

## User
please make spliting into multiple output files the default option in the generation options

## Assistant
Changed the `splitFiles` default from `false` to `true` in the initial `options` signal in `app.ts`.

**`src/app/app.ts`** — `splitFiles: false` → `splitFiles: true`
