import { Injectable } from '@angular/core';
import type { ParsedSpec, ParsedSchema, ParsedType, ParsedTag, ParsedOperation, GeneratedFile } from '../models/openapi.model';

@Injectable({ providedIn: 'root' })
export class TypescriptGeneratorService {

  // ── Zod schemas ─────────────────────────────────────────────────────────────

  public generateSchemas(spec: ParsedSpec): string {
    const lines: string[] = [`import { z } from 'zod';`];

    for (const schema of spec.schemas) {
      lines.push(...(schema.kind === 'enum' ? this.genZodEnum(schema) : this.genZodObject(schema)));
      lines.push('');
    }

    return lines.join('\n');
  }

  private genZodEnum(schema: ParsedSchema): string[] {
    return [
      `export enum ${schema.name} {`,
      ...schema.enumValues.map((v, i) => `  ${v} = ${i},`),
      `}`,
    ];
  }

  private genZodObject(schema: ParsedSchema): string[] {
    if (schema.properties.length === 0) {
      return [
        `export const ${schema.name}Schema = z.strictObject({});`,
        ``,
        `export type ${schema.name} = z.infer<typeof ${schema.name}Schema>;`,
      ];
    }

    const props = schema.properties.map(p => `  ${p.pascalName}: ${this.toZodType(p.type, p.isRequired, p.isNullable)},`);

    return [
      `export const ${schema.name}Schema = z.strictObject({`,
      ...props,
      `});`,
      ``,
      `export type ${schema.name} = z.infer<typeof ${schema.name}Schema>;`,
    ];
  }

  // ── Angular HTTP services ───────────────────────────────────────────────────

  public generateServices(spec: ParsedSpec): string {
    const lines: string[] = [
      `import { Injectable } from '@angular/core';`,
      `import { HttpClient } from '@angular/common/http';`,
      `import { Observable } from 'rxjs';`,
      `import type * as Schemas from './schemas';`,
      '',
    ];

    for (const tag of spec.tags) {
      lines.push(...this.genService(tag));
      lines.push('');
    }

    return lines.join('\n');
  }

  public generateSchemaFiles(spec: ParsedSpec): GeneratedFile[] {
    const schemaNames = new Set(spec.schemas.map(s => s.name));

    const files: GeneratedFile[] = spec.schemas.map(schema => {
      const enumRefs = new Set<string>();
      const objectRefs = new Set<string>();
      for (const prop of schema.properties) {
        const t = prop.type.isArray ? { ...prop.type, isArray: false } : prop.type;
        if (t.kind === 'ref' && t.refName && schemaNames.has(t.refName)) {
          (t.enumValues ? enumRefs : objectRefs).add(t.refName);
        }
      }

      const lines: string[] = [];
      if (schema.kind !== 'enum') lines.push(`import { z } from 'zod';`);
      for (const ref of [...enumRefs].sort()) {
        lines.push(`import { ${ref} } from './${ref}.schema';`);
      }
      for (const ref of [...objectRefs].sort()) {
        lines.push(`import { ${ref}Schema } from './${ref}.schema';`);
      }
      lines.push('');
      lines.push(...(schema.kind === 'enum' ? this.genZodEnum(schema) : this.genZodObject(schema)));
      lines.push('');

      return {
        filename: `${schema.name}.schema.ts`,
        path: `typescript/schemas/${schema.name}.schema.ts`,
        content: lines.join('\n'),
      };
    });

    // Barrel so services can import type * as Schemas from '../schemas'
    files.push({
      filename: 'index.ts',
      path: 'typescript/schemas/index.ts',
      content: [...spec.schemas.map(s => `export * from './${s.name}.schema';`), ''].join('\n'),
    });

    return files;
  }

  public generateServiceFiles(spec: ParsedSpec): GeneratedFile[] {
    return spec.tags.map(tag => {
      const name = this.toPascalCase(tag.name);
      const content = [
        `import { Injectable } from '@angular/core';`,
        `import { HttpClient } from '@angular/common/http';`,
        `import { Observable } from 'rxjs';`,
        `import type * as Schemas from '../schemas';`,
        '',
        ...this.genService(tag),
        '',
      ].join('\n');
      return { filename: `${name}Service.ts`, path: `typescript/services/${name}Service.ts`, content };
    });
  }

  private genService(tag: ParsedTag): string[] {
    const name = this.toPascalCase(tag.name);
    const lines: string[] = [
      `@Injectable({ providedIn: 'root' })`,
      `export class ${name}Service {`,
      `  public constructor(private http: HttpClient) {}`,
    ];

    for (const op of tag.operations) {
      lines.push('');
      lines.push(...this.genMethod(op).map(l => `  ${l}`));
    }

    lines.push('}');
    return lines;
  }

  private genMethod(op: ParsedOperation): string[] {
    const methodName = this.toCamelCase(op.operationId);
    const returnTsType = op.responseType ? this.toSchemasType(op.responseType) : 'void';
    const params = this.methodParams(op);
    const urlExpr = this.urlExpression(op);
    const httpCall = this.httpCall(op, urlExpr, returnTsType);

    const lines: string[] = [];
    if (op.summary) lines.push(`/** ${op.summary} */`);
    lines.push(`public ${methodName}(${params}): Observable<${returnTsType}> {`);
    lines.push(`  return ${httpCall};`);
    lines.push(`}`);
    return lines;
  }

  private methodParams(op: ParsedOperation): string {
    const parts: string[] = [
      ...op.pathParams.map(p => `${p.camelName}: ${this.toTsType(p.type)}`),
      ...op.queryParams.map(p => `${p.camelName}${p.isRequired ? '' : '?'}: ${this.toTsType(p.type)}`),
      ...(op.requestBodyType ? [`request: ${this.toSchemasType(op.requestBodyType)}`] : []),
    ];
    return parts.join(', ');
  }

  private urlExpression(op: ParsedOperation): string {
    const path = op.path.replace(/\{(\w+)\}/g, (_, name) => `\${${this.toCamelCase(name)}}`);
    return op.pathParams.length > 0 ? `\`${path}\`` : `'${path}'`;
  }

  private httpCall(op: ParsedOperation, url: string, returnType: string): string {
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

  // ── Type mapping ────────────────────────────────────────────────────────────

  public toZodType(type: ParsedType, isRequired: boolean, isNullable = false): string {
    let result = this.zodBase(type);
    if (isNullable || !isRequired) result = `${result}.nullable()`;
    return result;
  }

  private zodBase(type: ParsedType): string {
    if (type.isArray) return `z.array(${this.zodBase({ ...type, isArray: false })})`;

    switch (type.kind) {
      case 'string': return 'z.string()';
      case 'int':
      case 'long':   return 'z.number().int()';
      case 'float':
      case 'double': return 'z.number()';
      case 'bool':   return 'z.boolean()';
      case 'ref':
        return type.enumValues
          ? `z.nativeEnum(${type.refName})`
          : `${type.refName}Schema`;
      case 'enum':
        return `z.enum([${(type.enumValues ?? []).map(v => `'${v}'`).join(', ')}])`;
      default: return 'z.unknown()';
    }
  }

  public toTsType(type: ParsedType): string {
    if (type.isArray) return `${this.toTsType({ ...type, isArray: false })}[]`;
    switch (type.kind) {
      case 'string':                    return 'string';
      case 'int': case 'long':
      case 'float': case 'double':      return 'number';
      case 'bool':                      return 'boolean';
      case 'ref':                       return type.refName ?? 'unknown';
      case 'enum':                      return (type.enumValues ?? []).map(v => `'${v}'`).join(' | ');
      default:                          return 'unknown';
    }
  }

  private toSchemasType(type: ParsedType): string {
    if (type.isArray) return `${this.toSchemasType({ ...type, isArray: false })}[]`;
    if (type.kind === 'ref') return `Schemas.${type.refName}`;
    return this.toTsType(type);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private toPascalCase(str: string): string {
    return str.replace(/[-_\s]+(.)/g, (_, c) => (c as string).toUpperCase())
              .replace(/^(.)/, (_, c) => (c as string).toUpperCase());
  }

  private toCamelCase(str: string): string {
    const p = this.toPascalCase(str);
    return p.charAt(0).toLowerCase() + p.slice(1);
  }
}
