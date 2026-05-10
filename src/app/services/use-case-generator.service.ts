import { Injectable } from '@angular/core';
import { CsharpGeneratorService } from './csharp-generator.service';
import { TypescriptGeneratorService } from './typescript-generator.service';
import type {
  ParsedSpec,
  ParsedOperation,
  ParsedParam,
  ParsedType,
  ParsedSchema,
  GeneratedFile,
} from '../models/openapi.model';

@Injectable({ providedIn: 'root' })
export class UseCaseGeneratorService {
  public constructor(
    private csharp: CsharpGeneratorService,
    private typescript: TypescriptGeneratorService,
  ) {}

  public generateUseCaseFiles(spec: ParsedSpec): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    for (const tag of spec.tags) {
      const controllerBase = `/${tag.name.toLowerCase()}`;
      for (const op of tag.operations) {
        const id = op.operationId;
        files.push({
          filename: `${id}.md`,
          path: `docs/use-cases/${id}.md`,
          content: this.buildOverview(spec, op),
        });
        files.push({
          filename: `csharp/${id}.md`,
          path: `docs/use-cases/csharp/${id}.md`,
          content: this.buildCsharp(spec, op, controllerBase),
        });
        files.push({
          filename: `typescript/${id}.md`,
          path: `docs/use-cases/typescript/${id}.md`,
          content: this.buildTypescript(spec, op),
        });
      }
    }
    return files;
  }

  // ── Overview ─────────────────────────────────────────────────────────────────

  private buildOverview(spec: ParsedSpec, op: ParsedOperation): string {
    const lines: string[] = [];
    const title = op.summary ?? this.toPascalCase(op.operationId);
    const schemaMap = new Map(spec.schemas.map(s => [s.name, s]));

    lines.push(`# ${title}`);
    lines.push('');
    lines.push(`**Method:** \`${op.method.toUpperCase()}\``);
    lines.push(`**Path:** \`${op.path}\``);
    lines.push('');

    if (op.pathParams.length > 0 || op.queryParams.length > 0) {
      lines.push('## Parameters');
      lines.push('');
      if (op.pathParams.length > 0) {
        lines.push('### Path Parameters');
        lines.push('');
        lines.push(...this.renderParamsDiagram(op.pathParams));
      }
      if (op.queryParams.length > 0) {
        lines.push('### Query Parameters');
        lines.push('');
        lines.push(...this.renderParamsDiagram(op.queryParams));
      }
    }

    if (op.requestBodyType) {
      lines.push(`## Request Body: \`${this.typeLabel(op.requestBodyType)}\``);
      lines.push('');
      lines.push(...this.renderSchemaDiagram(op.requestBodyType, schemaMap));
    }

    if (op.responseType) {
      lines.push(`## Response: \`${this.typeLabel(op.responseType)}\``);
      lines.push('');
      lines.push(...this.renderSchemaDiagram(op.responseType, schemaMap));
    }

    return lines.join('\n');
  }

  private renderParamsDiagram(params: ParsedParam[]): string[] {
    const lines = ['```mermaid', 'classDiagram', '    class Parameters {'];
    for (const p of params) {
      const nullable = p.isRequired ? '' : '?';
      lines.push(`        +${this.mermaidTypeLabel(p.type)}${nullable} ${p.originalName}`);
    }
    lines.push('    }', '```', '');
    return lines;
  }

  private renderSchemaDiagram(
    rootType: ParsedType,
    schemaMap: Map<string, ParsedSchema>,
  ): string[] {
    const toRender: ParsedSchema[] = [];
    const seen = new Set<string>();

    const collect = (type: ParsedType): void => {
      const base = type.isArray ? { ...type, isArray: false } : type;
      if (base.kind !== 'ref' || !base.refName) return;
      const schema = schemaMap.get(base.refName);
      if (!schema || seen.has(schema.name)) return;
      seen.add(schema.name);
      toRender.push(schema);
      for (const p of schema.properties) collect(p.type);
    };
    collect(rootType);

    if (toRender.length === 0) return [];

    const lines = ['```mermaid', 'classDiagram'];

    for (const schema of toRender) {
      lines.push(`    class ${schema.name} {`);
      if (schema.kind === 'enum') {
        lines.push('        <<enumeration>>');
        for (const v of schema.enumValues) lines.push(`        ${v}`);
      } else {
        for (const p of schema.properties) {
          const nullable = (p.isRequired && !p.isNullable) ? '' : '?';
          lines.push(`        +${this.mermaidTypeLabel(p.type)}${nullable} ${p.originalName}`);
        }
      }
      lines.push('    }');
    }

    for (const schema of toRender) {
      if (schema.kind === 'enum') continue;
      for (const p of schema.properties) {
        const base = p.type.isArray ? { ...p.type, isArray: false } : p.type;
        if (base.kind === 'ref' && base.refName && seen.has(base.refName)) {
          lines.push(`    ${schema.name} --> ${base.refName} : ${p.originalName}`);
        }
      }
    }

    lines.push('```', '');
    return lines;
  }

  private mermaidTypeLabel(type: ParsedType): string {
    const base = type.kind === 'ref' ? (type.refName ?? 'object') : type.kind;
    return type.isArray ? `${base}[]` : base;
  }

  // ── C# ───────────────────────────────────────────────────────────────────────

  private buildCsharp(spec: ParsedSpec, op: ParsedOperation, controllerBase: string): string {
    const lines: string[] = [];
    const title = op.summary ?? this.toPascalCase(op.operationId);

    lines.push(`# ${title} — C#`);
    lines.push('');
    lines.push('## Controller Action');
    lines.push('');
    lines.push('```csharp');
    lines.push(...this.renderCsharpAction(op, controllerBase));
    lines.push('```');
    lines.push('');

    const schemas = this.collectReferencedSchemas(spec, op);
    if (schemas.length > 0) {
      lines.push('## DTOs');
      lines.push('');
      for (const schema of schemas) {
        lines.push(`### ${schema.name}`);
        lines.push('');
        lines.push('```csharp');
        lines.push(...this.renderCsharpSchema(schema));
        lines.push('```');
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private renderCsharpAction(op: ParsedOperation, controllerBase: string): string[] {
    const lines: string[] = [];
    if (op.summary) lines.push(`/// <summary>${op.summary}</summary>`);

    const relRoute = this.relativeRoute(op.path, controllerBase);
    const routeArg = relRoute ? `("${relRoute}")` : '';
    lines.push(`[Http${this.capitalize(op.method)}${routeArg}]`);

    let returnType: string;
    if (!op.responseType) {
      returnType = 'Task';
    } else if (op.responseType.isArray) {
      const inner = this.csharp.toCsType({ ...op.responseType, isArray: false }, true);
      returnType = `IAsyncEnumerable<${inner}>`;
    } else {
      returnType = `Task<${this.csharp.toCsType(op.responseType, true)}>`;
    }
    const params = [
      ...op.pathParams.map(p => `[FromRoute] ${this.csharp.toCsType(p.type, true)} ${p.camelName}`),
      ...op.queryParams.map(p => `[FromQuery] ${this.csharp.toCsType(p.type, p.isRequired)} ${p.camelName}`),
      ...(op.requestBodyType ? [`[FromBody] ${this.csharp.toCsType(op.requestBodyType, true)} request`] : []),
    ].join(', ');
    lines.push(`public ${returnType} ${this.toPascalCase(op.operationId)}(${params})`);
    lines.push(`    => throw new NotImplementedException();`);
    return lines;
  }

  private renderCsharpSchema(schema: ParsedSchema): string[] {
    if (schema.kind === 'enum') {
      return [
        `public enum ${schema.name}`,
        '{',
        ...schema.enumValues.map((v, i) => `    ${v} = ${i},`),
        '}',
      ];
    }
    if (schema.properties.length === 0) return [`public record ${schema.name}();`];
    const params = schema.properties.map((p, i) => {
      const suffix = i < schema.properties.length - 1 ? ',' : ');';
      return `    ${this.csharp.toCsType(p.type, p.isRequired && !p.isNullable)} ${p.pascalName}${suffix}`;
    });
    return [`public record ${schema.name}(`, ...params];
  }

  // ── TypeScript ───────────────────────────────────────────────────────────────

  private buildTypescript(spec: ParsedSpec, op: ParsedOperation): string {
    const lines: string[] = [];
    const title = op.summary ?? this.toPascalCase(op.operationId);

    lines.push(`# ${title} — TypeScript`);
    lines.push('');

    const schemas = this.collectReferencedSchemas(spec, op);
    if (schemas.length > 0) {
      lines.push('## DTOs');
      lines.push('');
      lines.push('```typescript');
      lines.push(`import { z } from 'zod';`);
      lines.push('');
      for (const schema of schemas) {
        lines.push(...this.renderZodSchema(schema));
        lines.push('');
      }
      lines.push('```');
      lines.push('');
    }

    lines.push('## Service Call');
    lines.push('');
    lines.push('```typescript');
    lines.push(...this.renderServiceMethod(op));
    lines.push('```');
    lines.push('');

    return lines.join('\n');
  }

  private renderZodSchema(schema: ParsedSchema): string[] {
    if (schema.kind === 'enum') {
      return [
        `export enum ${schema.name} {`,
        ...schema.enumValues.map((v, i) => `  ${v} = ${i},`),
        `}`,
      ];
    }
    if (schema.properties.length === 0) {
      return [
        `export const ${schema.name}Schema = z.strictObject({});`,
        ``,
        `export type ${schema.name} = z.infer<typeof ${schema.name}Schema>;`,
      ];
    }
    const props = schema.properties.map(p =>
      `  ${p.pascalName}: ${this.typescript.toZodType(p.type, p.isRequired, p.isNullable)},`
    );
    return [
      `export const ${schema.name}Schema = z.strictObject({`,
      ...props,
      `});`,
      ``,
      `export type ${schema.name} = z.infer<typeof ${schema.name}Schema>;`,
    ];
  }

  private renderServiceMethod(op: ParsedOperation): string[] {
    const methodName = this.toCamelCase(op.operationId);
    const returnType = op.responseType ? this.toLocalTsType(op.responseType) : 'void';
    const params = [
      ...op.pathParams.map(p => `${p.camelName}: ${this.typescript.toTsType(p.type)}`),
      ...op.queryParams.map(p => `${p.camelName}${p.isRequired ? '' : '?'}: ${this.typescript.toTsType(p.type)}`),
      ...(op.requestBodyType ? [`request: ${this.toLocalTsType(op.requestBodyType)}`] : []),
    ].join(', ');
    const urlExpr = this.urlExpression(op);
    const httpCall = this.buildHttpCall(op, urlExpr, returnType);

    const lines: string[] = [];
    if (op.summary) lines.push(`/** ${op.summary} */`);
    lines.push(`public ${methodName}(${params}): Observable<${returnType}> {`);
    lines.push(`  return ${httpCall};`);
    lines.push(`}`);
    return lines;
  }

  private toLocalTsType(type: ParsedType): string {
    if (type.isArray) return `${this.toLocalTsType({ ...type, isArray: false })}[]`;
    if (type.kind === 'ref') return type.refName ?? 'unknown';
    return this.typescript.toTsType(type);
  }

  private urlExpression(op: ParsedOperation): string {
    const path = op.path.replace(/\{(\w+)\}/g, (_, n: string) => `\${${this.toCamelCase(n)}}`);
    return op.pathParams.length > 0 ? `\`${path}\`` : `'${path}'`;
  }

  private buildHttpCall(op: ParsedOperation, url: string, returnType: string): string {
    const tp = returnType !== 'void' ? `<${returnType}>` : '';
    const body = op.requestBodyType ? 'request' : 'null';
    switch (op.method) {
      case 'get':    return `this.http.get${tp}(${url})`;
      case 'post':   return `this.http.post${tp}(${url}, ${body})`;
      case 'put':    return `this.http.put${tp}(${url}, ${body})`;
      case 'patch':  return `this.http.patch${tp}(${url}, ${body})`;
      case 'delete': return `this.http.delete${tp}(${url})`;
      default:       return `this.http.get${tp}(${url})`;
    }
  }

  // ── Shared ───────────────────────────────────────────────────────────────────

  private collectReferencedSchemas(spec: ParsedSpec, op: ParsedOperation): ParsedSchema[] {
    const schemaMap = new Map(spec.schemas.map(s => [s.name, s]));
    const seen = new Set<string>();
    const result: ParsedSchema[] = [];

    const visit = (type: ParsedType | undefined) => {
      if (!type || type.kind !== 'ref' || !type.refName) return;
      const schema = schemaMap.get(type.refName);
      if (!schema || seen.has(schema.name)) return;
      seen.add(schema.name);
      for (const prop of schema.properties) visit(prop.type);
      result.push(schema);
    };

    for (const p of [...op.pathParams, ...op.queryParams]) visit(p.type);
    visit(op.requestBodyType);
    visit(op.responseType);

    return result;
  }

  private relativeRoute(fullPath: string, base: string): string {
    const norm = fullPath.startsWith('/') ? fullPath : '/' + fullPath;
    if (norm === base) return '';
    if (norm.startsWith(base + '/')) return norm.slice(base.length + 1);
    return norm;
  }

  private typeLabel(type: ParsedType): string {
    const base = type.kind === 'ref' ? (type.refName ?? 'object') : type.kind;
    return type.isArray ? `${base}[]` : base;
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)/g, (_, c) => (c as string).toUpperCase())
      .replace(/^(.)/, (_, c) => (c as string).toUpperCase());
  }

  private toCamelCase(str: string): string {
    const p = this.toPascalCase(str);
    return p.charAt(0).toLowerCase() + p.slice(1);
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
