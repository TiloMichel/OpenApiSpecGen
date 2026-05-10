# 26 - Use z.strictObject() Instead of z.object().strict()

## Prompt

Instead of using object({}).strict() rather use the strictObject({}) syntax please.

## Changes

Replaced `z.object({...}).strict()` with `z.strictObject({...})` in both generator services and updated the corresponding test assertions.

### `typescript-generator.service.ts` and `use-case-generator.service.ts`

```ts
// before
`export const ${schema.name}Schema = z.object({}).strict();`
// ...
`export const ${schema.name}Schema = z.object({`,
...props,
`}).strict();`,

// after
`export const ${schema.name}Schema = z.strictObject({});`
// ...
`export const ${schema.name}Schema = z.strictObject({`,
...props,
`});`,
```

### Test assertions updated

In `typescript-generator.service.spec.ts` and `use-case-generator.service.spec.ts`:

```ts
// before
expect(output).toContain('export const EmptySchema = z.object({}).strict();');
expect(output).toContain('export const PetSchema = z.object({');

// after
expect(output).toContain('export const EmptySchema = z.strictObject({});');
expect(output).toContain('export const PetSchema = z.strictObject({');
```
