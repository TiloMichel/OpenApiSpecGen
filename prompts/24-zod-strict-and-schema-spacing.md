# 24 - Zod `.strict()` and Empty Line After Schema Definition

## Prompt

The typescript code should contain the .strict() after the object, also add an empty line after the schema definition in typescript files

## Changes

Applied to both `src/app/services/typescript-generator.service.ts` (`genZodObject`) and `src/app/services/use-case-generator.service.ts` (`renderZodSchema`):

1. Append `.strict()` to `z.object({...})` calls
2. Add an empty line between the `export const` schema block and the `export type` line

### Before

```typescript
export const UserDtoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});
export type UserDto = z.infer<typeof UserDtoSchema>;
```

### After

```typescript
export const UserDtoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
}).strict();

export type UserDto = z.infer<typeof UserDtoSchema>;
```
