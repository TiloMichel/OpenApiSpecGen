# 33 - Nullable oneOf Response Support

## Prompt

If the return type of an endpoint is oneOf and it contains an object and null, make the response nullable in typescript service and c#. For C# this means for example Dto? and for typescript Dto | null.

## Changes

When an operation's response schema is `oneOf` containing exactly one non-null entry and one `{ type: 'null' }` entry, the parsed type carries `isNullable: true`. Both generators read that flag to emit the appropriate nullable syntax.

### `src/app/models/openapi.model.ts`

Added `oneOf` to `RawSchema` so the parser can read it:

```typescript
// added
oneOf?: RawSchema[];
```

Added `isNullable` to `ParsedType` so generators can act on it:

```typescript
// before
export interface ParsedType {
  kind: ParsedTypeKind;
  isArray: boolean;
  refName?: string;
  enumValues?: string[];
}

// after
export interface ParsedType {
  kind: ParsedTypeKind;
  isArray: boolean;
  isNullable?: boolean;
  refName?: string;
  enumValues?: string[];
}
```

### `src/app/services/openapi-parser.service.ts`

`parseType()` now checks for the oneOf + null pattern before all other checks:

```typescript
// added at the top of parseType()
if (schema.oneOf) {
  const nonNull = schema.oneOf.filter(s => s.type !== 'null');
  const hasNull = nonNull.length < schema.oneOf.length;
  if (hasNull && nonNull.length === 1) {
    return { ...this.parseType(nonNull[0], all), isNullable: true };
  }
}
```

Only triggers when there is exactly one non-null entry and at least one null entry; all other `oneOf` shapes fall through to the default handling.

### `src/app/services/csharp-generator.service.ts`

`actionReturnType()` passes `isRequired = false` when the response is nullable, which causes `toCsType` to append `?`:

```typescript
// before
return `Task<${this.toCsType(op.responseType, true)}>`;

// after
return `Task<${this.toCsType(op.responseType, !op.responseType.isNullable)}>`;
```

Result: `Task<Pet?>` for a nullable ref, `Task<Pet>` for a non-nullable one.

### `src/app/services/typescript-generator.service.ts`

`toSchemasType()` appends ` | null` when the type is nullable:

```typescript
// before
private toSchemasType(type: ParsedType): string {
  if (type.isArray) return `${this.toSchemasType({ ...type, isArray: false })}[]`;
  if (type.kind === 'ref') return `Schemas.${type.refName}`;
  return this.toTsType(type);
}

// after
private toSchemasType(type: ParsedType): string {
  if (type.isArray) return `${this.toSchemasType({ ...type, isArray: false })}[]`;
  const base = type.kind === 'ref' ? `Schemas.${type.refName}` : this.toTsType(type);
  return type.isNullable ? `${base} | null` : base;
}
```

Result: `Observable<Schemas.Pet | null>` and `this.http.get<Schemas.Pet | null>(...)`.

## Tests

### `src/app/services/openapi-parser.service.spec.ts`

New `parse – response oneOf null` suite with two cases:

- `sets isNullable on response type when oneOf contains a $ref and null` — parses a spec where the 200 response schema is `oneOf: [$ref, { type: 'null' }]`; verifies `kind === 'ref'`, `refName === 'Item'`, and `isNullable === true`
- `does not set isNullable when oneOf has no null entry` — single-entry `oneOf` without null; verifies `isNullable` is falsy

### `src/app/services/csharp-generator.service.spec.ts`

Added to the `generateControllers` suite:

- `uses Task<T?> for nullable response type` — builds a spec with `responseType: { ..., isNullable: true }` and asserts the controller contains `public Task<Pet?> GetPetById`

### `src/app/services/typescript-generator.service.spec.ts`

Added to the `generateServices` suite:

- `generates Observable<T | null> for nullable response type` — builds a spec with `responseType: { ..., isNullable: true }` and asserts the service contains `Observable<Schemas.Pet | null>` in both the method signature and the HTTP call
