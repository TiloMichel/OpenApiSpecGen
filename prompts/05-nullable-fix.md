# Prompt 05 — Nullable vs Optional Fix

**Date:** 2026-04-19

## User Prompt

> please check the code generation, most properties are generated as nullable while the specification does not use nullable: true

## Root Cause

The generator was conflating two separate OpenAPI concepts:

- **required** — whether the property must be present in the payload
- **nullable** — whether the property value can be `null`

Any property absent from the `required` array was getting `?` in C# and `.nullable().optional()` in Zod, even when the spec never set `nullable: true`. The fix separates these two axes.

## Changes

### `src/app/models/openapi.model.ts`

Added `isNullable: boolean` to `ParsedProperty` to carry the explicit nullability flag from the spec independently of `isRequired`.

### `src/app/services/openapi-parser.service.ts`

Set `isNullable: s.nullable ?? false` when building each `ParsedProperty`. Reads the `nullable` field directly from the property's raw schema.

### `src/app/services/csharp-generator.service.ts`

Changed `genRecord` to pass `!p.isNullable` (instead of `p.isRequired`) as the `isRequired` argument to `toCsType`. A C# property now gets `?` only when `nullable: true` is set in the spec.

### `src/app/services/typescript-generator.service.ts`

Updated `toZodType` signature from `(type, isRequired)` to `(type, isRequired, isNullable = false)`. The method now appends modifiers independently:

- `.nullable()` — only when `isNullable` is `true`
- `.optional()` — only when `isRequired` is `false`

Updated the call in `genZodObject` to pass `p.isNullable` as the third argument.

## Behaviour After Fix

| Property | C# | Zod |
| --- | --- | --- |
| Required, not nullable | `string Name` | `z.string()` |
| Optional, not nullable | `string Age` | `z.string().optional()` |
| Required, `nullable: true` | `string? Foo` | `z.string().nullable()` |
| Optional, `nullable: true` | `string? Foo` | `z.string().nullable().optional()` |

Query and path parameters retain the previous behaviour — optional parameters still produce `?` in C# because a missing query param maps naturally to `null` at the controller boundary.
