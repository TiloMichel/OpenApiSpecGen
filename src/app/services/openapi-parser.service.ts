import { Injectable } from '@angular/core';
import * as yaml from 'js-yaml';
import type {
  ParsedSpec, ParsedSchema, ParsedProperty, ParsedType, ParsedTypeKind,
  ParsedTag, ParsedOperation, ParsedParam,
  RawOpenApiSpec, RawSchema, RawOperation, RawParameter,
} from '../models/openapi.model';

@Injectable({ providedIn: 'root' })
export class OpenApiParserService {

  parse(content: string, format: 'yaml' | 'json'): ParsedSpec {
    const raw: RawOpenApiSpec = format === 'yaml'
      ? (yaml.load(content) as RawOpenApiSpec)
      : JSON.parse(content);

    const rawSchemas = raw.components?.schemas ?? {};

    return {
      title: raw.info?.title ?? 'Api',
      version: raw.info?.version ?? '1.0',
      schemas: Object.entries(rawSchemas).map(([name, s]) => this.parseSchema(name, s, rawSchemas)),
      tags: this.parsePaths(raw.paths ?? {}, rawSchemas),
    };
  }

  // ── Schema parsing ──────────────────────────────────────────────────────────

  private parseSchema(name: string, schema: RawSchema, all: Record<string, RawSchema>): ParsedSchema {
    if (schema.$ref) {
      return this.parseSchema(name, all[this.refName(schema.$ref)] ?? schema, all);
    }
    if (schema.allOf) {
      return this.parseSchema(name, this.mergeAllOf(schema.allOf, all), all);
    }
    if (schema.enum) {
      return { name, kind: 'enum', properties: [], enumValues: schema.enum.map(String) };
    }

    const required = schema.required ?? [];
    const properties: ParsedProperty[] = Object.entries(schema.properties ?? {}).map(([prop, s]) => ({
      originalName: prop,
      pascalName: this.toPascalCase(prop),
      type: this.parseType(s, all),
      isRequired: required.includes(prop),
      isNullable: s.nullable ?? false,
    }));

    return { name, kind: 'object', properties, enumValues: [] };
  }

  private mergeAllOf(schemas: RawSchema[], all: Record<string, RawSchema>): RawSchema {
    const merged: RawSchema = { type: 'object', properties: {}, required: [] };
    for (const s of schemas) {
      const resolved = s.$ref ? (all[this.refName(s.$ref)] ?? s) : s;
      if (resolved.properties) Object.assign(merged.properties!, resolved.properties);
      if (resolved.required) merged.required = [...(merged.required ?? []), ...resolved.required];
    }
    return merged;
  }

  private parseType(schema: RawSchema, all: Record<string, RawSchema>): ParsedType {
    if (schema.$ref) {
      const name = this.refName(schema.$ref);
      const refSchema = all[name];
      return { kind: 'ref', isArray: false, refName: name, enumValues: refSchema?.enum?.map(String) };
    }
    if (schema.type === 'array') {
      const inner = this.parseType(schema.items ?? { type: 'string' }, all);
      return { ...inner, isArray: true };
    }
    if (schema.enum) {
      return { kind: 'enum', isArray: false, enumValues: schema.enum.map(String) };
    }
    return { kind: this.primitiveKind(schema), isArray: false };
  }

  private primitiveKind(schema: RawSchema): ParsedTypeKind {
    switch (schema.type) {
      case 'string':  return 'string';
      case 'boolean': return 'bool';
      case 'integer': return schema.format === 'int64' ? 'long' : 'int';
      case 'number':  return schema.format === 'float' ? 'float' : 'double';
      default:        return 'any';
    }
  }

  // ── Path / operation parsing ────────────────────────────────────────────────

  private parsePaths(paths: Record<string, any>, all: Record<string, RawSchema>): ParsedTag[] {
    const tagMap = new Map<string, ParsedOperation[]>();
    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;

    for (const [path, item] of Object.entries(paths)) {
      for (const method of methods) {
        const op: RawOperation | undefined = item[method];
        if (!op) continue;

        const tag = op.tags?.[0] ?? 'Default';
        if (!tagMap.has(tag)) tagMap.set(tag, []);

        const pathParams = (op.parameters ?? []).filter(p => p.in === 'path').map(p => this.parseParam(p, all));
        const queryParams = (op.parameters ?? []).filter(p => p.in === 'query').map(p => this.parseParam(p, all));

        tagMap.get(tag)!.push({
          method,
          path,
          operationId: op.operationId ?? this.generateOperationId(method, path, tag),
          summary: op.summary,
          pathParams,
          queryParams,
          requestBodyType: this.extractBodyType(op, all),
          responseType: this.extractResponseType(op, all),
        });
      }
    }

    return Array.from(tagMap.entries()).map(([name, operations]) => ({ name, operations }));
  }

  private parseParam(p: RawParameter, all: Record<string, RawSchema>): ParsedParam {
    return {
      originalName: p.name,
      camelName: this.toCamelCase(p.name),
      type: this.parseType(p.schema ?? { type: 'string' }, all),
      isRequired: p.required ?? false,
    };
  }

  private extractBodyType(op: RawOperation, all: Record<string, RawSchema>): ParsedType | undefined {
    const schema = op.requestBody?.content?.['application/json']?.schema;
    return schema ? this.parseType(schema, all) : undefined;
  }

  private extractResponseType(op: RawOperation, all: Record<string, RawSchema>): ParsedType | undefined {
    const response = op.responses?.['200'] ?? op.responses?.['201'];
    const schema = response?.content?.['application/json']?.schema;
    return schema ? this.parseType(schema, all) : undefined;
  }

  private generateOperationId(method: string, path: string, tag: string): string {
    const hasPathParam = path.includes('{');
    const pascal = this.toPascalCase(tag);
    const singular = pascal.endsWith('s') ? pascal.slice(0, -1) : pascal;
    const map: Record<string, string> = {
      get: hasPathParam ? `Get${singular}ById` : `GetAll${pascal}`,
      post:   `Create${singular}`,
      put:    `Update${singular}`,
      patch:  `Patch${singular}`,
      delete: `Delete${singular}`,
    };
    return map[method] ?? `${method}${pascal}`;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private refName(ref: string): string {
    return ref.split('/').pop() ?? ref;
  }

  toPascalCase(str: string): string {
    return str.replace(/[-_\s]+(.)/g, (_, c) => (c as string).toUpperCase())
              .replace(/^(.)/, (_, c) => (c as string).toUpperCase());
  }

  toCamelCase(str: string): string {
    const p = this.toPascalCase(str);
    return p.charAt(0).toLowerCase() + p.slice(1);
  }

  detectFormat(content: string): 'yaml' | 'json' {
    const t = content.trim();
    return t.startsWith('{') || t.startsWith('[') ? 'json' : 'yaml';
  }
}
