# 32 - Byte and Date-Time Format Support

## Prompt

Please make following changes to the c# code generation for the specification, if the string is of format byte the Datatype of the generated property should be a byte array. If the string format is date-time the generated Property should be of type DateTimeOffset. For typescript only change the date-time format to the following zod call: z.string().datetime({offset: true})

## Changes

Added `'byte'` and `'date-time'` kinds to the internal parsed type system so that OpenAPI properties with `type: string, format: byte` and `type: string, format: date-time` generate the correct target-language types.

### `src/app/models/openapi.model.ts`

Added `'byte'` and `'date-time'` to the `ParsedTypeKind` union:

```typescript
// before
export type ParsedTypeKind = 'string' | 'uuid' | 'int' | 'long' | 'float' | 'double' | 'bool' | 'enum' | 'ref' | 'any';

// after
export type ParsedTypeKind = 'string' | 'uuid' | 'byte' | 'date-time' | 'int' | 'long' | 'float' | 'double' | 'bool' | 'enum' | 'ref' | 'any';
```

### `src/app/services/openapi-parser.service.ts`

`primitiveKind()` now checks `format` for `byte` and `date-time` when the OpenAPI type is `string`:

```typescript
// before
case 'string': return schema.format === 'uuid' ? 'uuid' : 'string';

// after
case 'string':
  if (schema.format === 'uuid') return 'uuid';
  if (schema.format === 'byte') return 'byte';
  if (schema.format === 'date-time') return 'date-time';
  return 'string';
```

### `src/app/services/csharp-generator.service.ts`

`csBase()` maps `byte` to `byte[]` and `date-time` to `DateTimeOffset`:

```typescript
// before
case 'string': return 'string';
case 'uuid':   return 'Guid';

// after
case 'string':    return 'string';
case 'uuid':      return 'Guid';
case 'byte':      return 'byte[]';
case 'date-time': return 'DateTimeOffset';
```

### `src/app/services/typescript-generator.service.ts`

`zodBase()` maps `byte` to `z.string()` and `date-time` to `z.string().datetime({offset: true})`:

```typescript
// before
case 'string': return 'z.string()';
case 'uuid':   return 'z.string().uuid()';

// after
case 'string':    return 'z.string()';
case 'uuid':      return 'z.string().uuid()';
case 'byte':      return 'z.string()';
case 'date-time': return 'z.string().datetime({offset: true})';
```

`toTsType()` maps both new kinds to `string` (TypeScript has no native byte array or date-time type):

```typescript
// before
case 'string': case 'uuid':                              return 'string';

// after
case 'string': case 'uuid': case 'byte': case 'date-time': return 'string';
```

## Tests

### `src/app/services/openapi-parser.service.spec.ts`

Added two cases to the `parse – type mapping` suite:

- `maps string format byte to byte kind` — verifies `{ type: 'string', format: 'byte' }` produces kind `'byte'`
- `maps string format date-time to date-time kind` — verifies `{ type: 'string', format: 'date-time' }` produces kind `'date-time'`

### `src/app/services/csharp-generator.service.spec.ts`

Added two cases to the `toCsType` suite:

- `maps byte to byte[]` — verifies required produces `byte[]` and optional produces `byte[]?` (`byte[]` is a reference type so nullable annotation applies)
- `maps date-time to DateTimeOffset` — verifies required produces `DateTimeOffset` and optional produces `DateTimeOffset?`

### `src/app/services/typescript-generator.service.spec.ts`

Added two cases to the `toZodType` suite:

- `maps byte to z.string()` — verifies byte kind produces `z.string()`
- `maps date-time to z.string().datetime({offset: true})` — verifies date-time kind produces the offset-aware datetime validator

Added two cases to the `toTsType` suite:

- `maps byte to string` — verifies byte kind produces `string`
- `maps date-time to string` — verifies date-time kind produces `string`
