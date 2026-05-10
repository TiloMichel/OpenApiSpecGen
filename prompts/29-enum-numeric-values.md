# 29 - Enum Numeric Values

## Prompts

1. For TypeScript code generation, enums should not be generated as Zod enums. Instead generate them as native TypeScript enums with numeric values (0 to n) and reference them via `z.nativeEnum()` inline at the usage site. Remove the exported `Schema` constant for enums.
2. For C# code generation, enum values should also include their numeric assignments (0 to n).

## Changes

### TypeScript — native enums with inline z.nativeEnum

`genZodEnum` in `typescript-generator.service.ts` and `renderZodSchema` in `use-case-generator.service.ts` were rewritten to emit a plain TypeScript enum instead of a Zod schema constant:

```typescript
// before
export const StatusSchema = z.enum(['active', 'inactive']);
export type Status = z.infer<typeof StatusSchema>;

// after
export enum Status {
  active = 0,
  inactive = 1,
}
```

No `StatusSchema` constant is exported. The enum itself is the type.

At the usage site (inside `z.strictObject`), `zodBase` in `typescript-generator.service.ts` now returns `z.nativeEnum(RefName)` inline for enum refs (detected via `type.enumValues`), while object refs still reference `RefNameSchema`:

```typescript
// before
Status: z.enum(['active', 'inactive']).nullable(),

// after
Status: z.nativeEnum(Status).nullable(),
```

`generateSchemaFiles` was updated accordingly:
- Enum schema files skip the `import { z }` header (no Zod usage)
- Properties referencing an enum import the enum value: `import { Status } from './Status.schema'`
- Properties referencing an object schema import the schema const: `import { PetSchema } from './Pet.schema'` (unchanged)

`collectReferencedSchemas` in `use-case-generator.service.ts` was changed to post-order traversal (push schema after visiting its dependencies) so that enum definitions appear before the object schemas that reference them in the generated TypeScript code block.

### C# — enum numeric values

`genEnum` in `csharp-generator.service.ts` and the enum branch of `renderCsharpSchema` in `use-case-generator.service.ts` now emit `= n` assignments and trailing commas on every value:

```csharp
// before
public enum Status
{
    active,
    inactive,
    pending
}

// after
public enum Status
{
    active = 0,
    inactive = 1,
    pending = 2,
}
```

### Tests updated

- `csharp-generator.service.spec.ts` — `'generates an enum for enum schemas'` updated to assert `active = 0,`, `inactive = 1,`, `pending = 2,`
- `typescript-generator.service.spec.ts`:
  - `toZodType` enum-ref test now expects `'z.nativeEnum(Status)'` instead of `'StatusSchema'`
  - Removed the `'generates a z.nativeEnum schema for enum schemas'` test (no exported schema const)
  - Object schema test updated to expect `'Status: z.nativeEnum(Status).nullable(),'`
  - `generateSchemaFiles` enum import test updated to expect `import { Status }` (value import) and a new test confirms enum schema files contain no `z` import
- `use-case-generator.service.spec.ts`:
  - Fixture updated to include `enumValues` on `Pet.status` ref type so `zodBase` recognises it as an enum ref
  - C# enum test extended to assert `available = 0,` and `sold = 1,`
  - TypeScript enum test checks for native enum definition only and asserts `PetStatusSchema` is absent
  - Zod property type test updated to expect `'Status: z.nativeEnum(PetStatus),'`
