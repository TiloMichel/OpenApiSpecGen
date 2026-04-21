# Prompt 11 — Zod: Never Generate Optional Fields

## User
for the typescript zod generation please don't use optional even if the required: True is missing in the specification

## Assistant
Removed the `.optional()` modifier from Zod schema generation in `toZodType`.

**`src/app/services/typescript-generator.service.ts`** — renamed the `isRequired` parameter to `_isRequired` and deleted the `if (!isRequired) result = \`${result}.optional()\`` line. Fields are now always generated without `.optional()` regardless of whether they appear in the OpenAPI `required` array.
