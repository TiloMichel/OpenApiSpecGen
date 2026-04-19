export interface RawOpenApiSpec {
  openapi?: string;
  info?: { title?: string; version?: string };
  components?: { schemas?: Record<string, RawSchema> };
  paths?: Record<string, RawPathItem>;
}

export interface RawSchema {
  type?: string;
  format?: string;
  properties?: Record<string, RawSchema>;
  items?: RawSchema;
  required?: string[];
  enum?: (string | number)[];
  $ref?: string;
  allOf?: RawSchema[];
  nullable?: boolean;
  description?: string;
}

export interface RawPathItem {
  get?: RawOperation;
  post?: RawOperation;
  put?: RawOperation;
  patch?: RawOperation;
  delete?: RawOperation;
}

export interface RawOperation {
  tags?: string[];
  operationId?: string;
  summary?: string;
  parameters?: RawParameter[];
  requestBody?: { required?: boolean; content?: Record<string, { schema?: RawSchema }> };
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: RawSchema }> }>;
}

export interface RawParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema?: RawSchema;
}

// ── Internal parsed representation ──────────────────────────────────────────

export interface ParsedSpec {
  title: string;
  version: string;
  schemas: ParsedSchema[];
  tags: ParsedTag[];
}

export interface ParsedSchema {
  name: string;
  kind: 'object' | 'enum';
  properties: ParsedProperty[];
  enumValues: string[];
}

export interface ParsedProperty {
  originalName: string;
  pascalName: string;
  type: ParsedType;
  isRequired: boolean;
  isNullable: boolean;
}

export type ParsedTypeKind = 'string' | 'int' | 'long' | 'float' | 'double' | 'bool' | 'enum' | 'ref' | 'any';

export interface ParsedType {
  kind: ParsedTypeKind;
  isArray: boolean;
  refName?: string;
  enumValues?: string[];
}

export interface ParsedTag {
  name: string;
  operations: ParsedOperation[];
}

export interface ParsedOperation {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  operationId: string;
  summary?: string;
  pathParams: ParsedParam[];
  queryParams: ParsedParam[];
  requestBodyType?: ParsedType;
  responseType?: ParsedType;
}

export interface ParsedParam {
  originalName: string;
  camelName: string;
  type: ParsedType;
  isRequired: boolean;
}

// ── Generation options & result ──────────────────────────────────────────────

export interface GenerationOptions {
  includeCsharpDtos: boolean;
  includeCsharpControllers: boolean;
  includeTypescriptSchemas: boolean;
  includeTypescriptServices: boolean;
  splitFiles: boolean;
}

export interface GeneratedFile {
  filename: string;
  path: string;
  content: string;
}

export interface GenerationResult {
  options: GenerationOptions;
  csharpDtoFiles: GeneratedFile[];
  csharpControllerFiles: GeneratedFile[];
  typescriptSchemaFiles: GeneratedFile[];
  typescriptServiceFiles: GeneratedFile[];
}
