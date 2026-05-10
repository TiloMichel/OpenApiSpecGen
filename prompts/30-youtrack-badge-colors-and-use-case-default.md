# 30 - YouTrack Badge Colors and Use Case Docs Default

## Prompts

1. Change the file-type-csharp badge to a purple color tone which suits C#. Change the overview badge to a green color tone.
2. Make the use case documentation a default true option.

## Changes

### YouTrack file-type badge colors

`src/app/app.scss` — the `overview` and `csharp` badge variants were changed from Angular Material system tokens to fixed color pairs:

| Badge | Background | Text |
|-------|------------|------|
| `overview` | `#c8e6c9` (light green) | `#1b5e20` (deep green) |
| `csharp` | `#e1bee7` (light purple) | `#4a148c` (deep purple) |
| `typescript` | `var(--mat-sys-tertiary-container)` | `var(--mat-sys-on-tertiary-container)` (unchanged) |

### Use case documentation enabled by default

`src/app/app.ts` — `includeUseCaseDocs` in the default options signal changed from `false` to `true`:

```typescript
// before
includeUseCaseDocs: false,

// after
includeUseCaseDocs: true,
```
