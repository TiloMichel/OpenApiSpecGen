# 23 - C# Record Closing Parenthesis Formatting

## Prompt

The dtos in csharp look like this:

```csharp
public record UserDto(
    int Id,
    string Name,
    string Email,
    int Age,
    UserStatus Status
);
```

but rather should look like this:

```csharp
public record UserDto(
    int Id,
    string Name,
    string Email,
    int Age,
    UserStatus Status);
```

can you fix that please?

## Change

In `src/app/services/csharp-generator.service.ts`, the `genRecord` method was appending `);` as a separate array element, causing it to render on its own line.

Fixed by appending `);` directly to the last parameter instead:

```ts
// before
const comma = i < schema.properties.length - 1 ? ',' : '';
return `    ${this.toCsType(p.type, !p.isNullable)} ${p.pascalName}${comma}`;
// ...
return [`public record ${schema.name}(`, ...params, ');'];

// after
const suffix = i < schema.properties.length - 1 ? ',' : ');';
return `    ${this.toCsType(p.type, !p.isNullable)} ${p.pascalName}${suffix}`;
// ...
return [`public record ${schema.name}(`, ...params];
```
