# Prompt 04 — Schema File Picker Fix

**Date:** 2026-04-19

## User Prompt

> On the user interface the different schemas are not selectable like the c# dtos, can you fix that please

## My Response

### Root Cause

The TypeScript Schemas tab in `src/app/app.html` was missing the file picker block and tab count badge that the other three tabs (C# DTOs, C# Controllers, Angular HTTP Services) all had. The `@if (... .length > 1)` file picker section and the `<span class="tab-count">` were simply never added when the schema tab was written.

### Fix

Added the missing elements to the TypeScript Schemas tab in `src/app/app.html`:

- **Tab count badge** — shows `(N)` next to the tab label when multiple schema files exist
- **File picker row** — renders a clickable button per file when `typescriptSchemaFiles.length > 1`, bound to the existing `selectedSchemaFile` signal

### Files Modified

| File | Change |
| --- | --- |
| `src/app/app.html` | Added file picker `@if` block and tab count badge to the TypeScript Schemas tab |
