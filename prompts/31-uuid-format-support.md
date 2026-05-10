# 31 - UUID Format Support

## Prompt

If the openapi spec for a property type string contains a format uuid it should be a Guid in c# and in typescript and zod it should contain a string().uuid() type. Please fix that

## Changes

Added a dedicated `'uuid'` kind to the internal parsed type system so that OpenAPI properties with `type: string, format: uuid` generate the correct target-language types.

### `src/app/models/openapi.model.ts`

Added `'uuid'` to the `ParsedTypeKind` union:

```typescript
// before
export type ParsedTypeKind = 'string' | 'int' | 'long' | 'float' | 'double' | 'bool' | 'enum' | 'ref' | 'any';

// after
export type ParsedTypeKind = 'string' | 'uuid' | 'int' | 'long' | 'float' | 'double' | 'bool' | 'enum' | 'ref' | 'any';
```

### `src/app/services/openapi-parser.service.ts`

`primitiveKind()` now checks `format` when the OpenAPI type is `string`:

```typescript
// before
case 'string': return 'string';

// after
case 'string': return schema.format === 'uuid' ? 'uuid' : 'string';
```

### `src/app/services/csharp-generator.service.ts`

`csBase()` maps the `uuid` kind to `Guid`:

```typescript
// before
case 'string': return 'string';

// after
case 'string': return 'string';
case 'uuid':   return 'Guid';
```

### `src/app/services/typescript-generator.service.ts`

`zodBase()` maps the `uuid` kind to `z.string().uuid()`:

```typescript
// before
case 'string': return 'z.string()';

// after
case 'string': return 'z.string()';
case 'uuid':   return 'z.string().uuid()';
```

`toTsType()` maps `uuid` to `string` (TypeScript has no native UUID type):

```typescript
// before
case 'string':              return 'string';

// after
case 'string': case 'uuid': return 'string';
```
