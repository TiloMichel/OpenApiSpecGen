# 28 - Nullable and Optional Properties

## Prompts

1. For C# code generation, non-required properties should be nullable.
2. For TypeScript code generation, non-required properties should be nullable (not optional).

## Changes

### C# — non-required properties are nullable

`genRecord` in `csharp-generator.service.ts` and `renderCsharpSchema` in `use-case-generator.service.ts` changed the `isRequired` argument passed to `toCsType`:

```typescript
// before
this.toCsType(p.type, !p.isNullable)

// after
this.toCsType(p.type, p.isRequired && !p.isNullable)
```

A property now gets `?` if it is non-required **or** explicitly nullable in the spec. Tests updated and a new test added to each spec file covering the `isRequired: false, isNullable: false` → `Type?` case.

### TypeScript — non-required properties are nullable

`toZodType` in `typescript-generator.service.ts` had its `_isRequired` parameter (previously ignored) renamed to `isRequired` and wired up. Non-required properties use `.nullable()` rather than `.optional()` to match the C# convention:

```typescript
// before
public toZodType(type: ParsedType, _isRequired: boolean, isNullable = false): string {
  let result = this.zodBase(type);
  if (isNullable) result = `${result}.nullable()`;
  return result;
}

// after
public toZodType(type: ParsedType, isRequired: boolean, isNullable = false): string {
  let result = this.zodBase(type);
  if (isNullable || !isRequired) result = `${result}.nullable()`;
  return result;
}
```

A property gets `.nullable()` if it is explicitly nullable **or** non-required (or both — the conditions collapse into a single modifier). Two stale test assertions updated (`Status` and `Tags` fields, both non-required), and three new `toZodType` unit tests and one `generateSchemas` integration test added.
