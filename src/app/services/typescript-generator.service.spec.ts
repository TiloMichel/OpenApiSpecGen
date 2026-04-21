import { TypescriptGeneratorService } from './typescript-generator.service';
import type { ParsedSpec, ParsedType } from '../models/openapi.model';

describe('TypescriptGeneratorService', () => {
  let service: TypescriptGeneratorService;

  beforeEach(() => {
    service = new TypescriptGeneratorService();
  });

  // ── Fixtures ─────────────────────────────────────────────────────────────────

  const simpleSpec: ParsedSpec = {
    title: 'Pet Store',
    version: '1.0',
    schemas: [
      {
        name: 'Status',
        kind: 'enum',
        enumValues: ['active', 'inactive'],
        properties: [],
      },
      {
        name: 'Pet',
        kind: 'object',
        enumValues: [],
        properties: [
          { originalName: 'id', pascalName: 'Id', type: { kind: 'int', isArray: false }, isRequired: true, isNullable: false },
          { originalName: 'name', pascalName: 'Name', type: { kind: 'string', isArray: false }, isRequired: true, isNullable: false },
          { originalName: 'status', pascalName: 'Status', type: { kind: 'ref', isArray: false, refName: 'Status', enumValues: ['active', 'inactive'] }, isRequired: false, isNullable: false },
          { originalName: 'tags', pascalName: 'Tags', type: { kind: 'string', isArray: true }, isRequired: false, isNullable: false },
        ],
      },
    ],
    tags: [
      {
        name: 'pets',
        operations: [
          {
            method: 'get',
            path: '/pets',
            operationId: 'listPets',
            summary: 'List all pets',
            pathParams: [],
            queryParams: [{ originalName: 'status', camelName: 'status', type: { kind: 'string', isArray: false }, isRequired: false }],
            requestBodyType: undefined,
            responseType: { kind: 'ref', isArray: true, refName: 'Pet' },
          },
          {
            method: 'get',
            path: '/pets/{petId}',
            operationId: 'getPetById',
            pathParams: [{ originalName: 'petId', camelName: 'petId', type: { kind: 'int', isArray: false }, isRequired: true }],
            queryParams: [],
            requestBodyType: undefined,
            responseType: { kind: 'ref', isArray: false, refName: 'Pet' },
          },
          {
            method: 'post',
            path: '/pets',
            operationId: 'createPet',
            pathParams: [],
            queryParams: [],
            requestBodyType: { kind: 'ref', isArray: false, refName: 'Pet' },
            responseType: { kind: 'ref', isArray: false, refName: 'Pet' },
          },
          {
            method: 'put',
            path: '/pets/{petId}',
            operationId: 'updatePet',
            pathParams: [{ originalName: 'petId', camelName: 'petId', type: { kind: 'int', isArray: false }, isRequired: true }],
            queryParams: [],
            requestBodyType: { kind: 'ref', isArray: false, refName: 'Pet' },
            responseType: { kind: 'ref', isArray: false, refName: 'Pet' },
          },
          {
            method: 'delete',
            path: '/pets/{petId}',
            operationId: 'deletePet',
            pathParams: [{ originalName: 'petId', camelName: 'petId', type: { kind: 'int', isArray: false }, isRequired: true }],
            queryParams: [],
            requestBodyType: undefined,
            responseType: undefined,
          },
        ],
      },
    ],
  };

  // ── toZodType ────────────────────────────────────────────────────────────────

  describe('toZodType', () => {
    function t(kind: ParsedType['kind'], isArray = false, opts: Partial<ParsedType> = {}): ParsedType {
      return { kind, isArray, ...opts };
    }

    it('maps string', () => expect(service.toZodType(t('string'), true)).toBe('z.string()'));
    it('maps int', () => expect(service.toZodType(t('int'), true)).toBe('z.number().int()'));
    it('maps long', () => expect(service.toZodType(t('long'), true)).toBe('z.number().int()'));
    it('maps float', () => expect(service.toZodType(t('float'), true)).toBe('z.number()'));
    it('maps double', () => expect(service.toZodType(t('double'), true)).toBe('z.number()'));
    it('maps bool', () => expect(service.toZodType(t('bool'), true)).toBe('z.boolean()'));
    it('maps unknown to z.unknown()', () => expect(service.toZodType(t('any'), true)).toBe('z.unknown()'));

    it('maps ref without enum values to SchemaRef', () => {
      expect(service.toZodType(t('ref', false, { refName: 'Pet' }), true)).toBe('PetSchema');
    });

    it('inlines enum values for ref with enumValues', () => {
      expect(service.toZodType(t('ref', false, { refName: 'Status', enumValues: ['a', 'b'] }), true)).toBe("z.enum(['a', 'b'])");
    });

    it('maps inline enum', () => {
      expect(service.toZodType(t('enum', false, { enumValues: ['x', 'y'] }), true)).toBe("z.enum(['x', 'y'])");
    });

    it('wraps in z.array for array types', () => {
      expect(service.toZodType(t('string', true), true)).toBe('z.array(z.string())');
    });

    it('appends .nullable() for nullable', () => {
      expect(service.toZodType(t('string'), true, true)).toBe('z.string().nullable()');
    });
  });

  // ── toTsType ─────────────────────────────────────────────────────────────────

  describe('toTsType', () => {
    function t(kind: ParsedType['kind'], isArray = false, opts: Partial<ParsedType> = {}): ParsedType {
      return { kind, isArray, ...opts };
    }

    it('maps string', () => expect(service.toTsType(t('string'))).toBe('string'));
    it('maps int/long/float/double to number', () => {
      expect(service.toTsType(t('int'))).toBe('number');
      expect(service.toTsType(t('long'))).toBe('number');
      expect(service.toTsType(t('float'))).toBe('number');
      expect(service.toTsType(t('double'))).toBe('number');
    });
    it('maps bool', () => expect(service.toTsType(t('bool'))).toBe('boolean'));
    it('maps ref', () => expect(service.toTsType(t('ref', false, { refName: 'Pet' }))).toBe('Pet'));
    it('maps inline enum to union', () => {
      expect(service.toTsType(t('enum', false, { enumValues: ['a', 'b'] }))).toBe("'a' | 'b'");
    });
    it('appends [] for arrays', () => expect(service.toTsType(t('string', true))).toBe('string[]'));
  });

  // ── generateSchemas ──────────────────────────────────────────────────────────

  describe('generateSchemas', () => {
    it('includes auto-generated comment and zod import', () => {
      const output = service.generateSchemas(simpleSpec);
      expect(output).toContain('// <auto-generated />');
      expect(output).toContain("import { z } from 'zod';");
    });

    it('generates an enum schema', () => {
      const output = service.generateSchemas(simpleSpec);
      expect(output).toContain("export const StatusSchema = z.enum(['active', 'inactive']);");
      expect(output).toContain('export type Status = z.infer<typeof StatusSchema>;');
    });

    it('generates an object schema', () => {
      const output = service.generateSchemas(simpleSpec);
      expect(output).toContain('export const PetSchema = z.object({');
      expect(output).toContain('Id: z.number().int(),');
      expect(output).toContain('Name: z.string(),');
    });

    it('inlines enum refs in object schema', () => {
      const output = service.generateSchemas(simpleSpec);
      expect(output).toContain("Status: z.enum(['active', 'inactive']),");
    });

    it('generates array zod type', () => {
      const output = service.generateSchemas(simpleSpec);
      expect(output).toContain('Tags: z.array(z.string()),');
    });

    it('handles empty object schema', () => {
      const spec: ParsedSpec = {
        ...simpleSpec,
        schemas: [{ name: 'Empty', kind: 'object', properties: [], enumValues: [] }],
        tags: [],
      };
      const output = service.generateSchemas(spec);
      expect(output).toContain('export const EmptySchema = z.object({});');
    });
  });

  // ── generateSchemaFiles ──────────────────────────────────────────────────────

  describe('generateSchemaFiles', () => {
    it('produces one file per schema plus a barrel index', () => {
      const files = service.generateSchemaFiles(simpleSpec);
      expect(files).toHaveLength(3); // Status.schema.ts + Pet.schema.ts + index.ts
    });

    it('sets correct filename and path for a schema', () => {
      const files = service.generateSchemaFiles(simpleSpec);
      const petFile = files.find(f => f.filename === 'Pet.schema.ts')!;
      expect(petFile.path).toBe('typescript/schemas/Pet.schema.ts');
    });

    it('barrel index re-exports all schemas', () => {
      const files = service.generateSchemaFiles(simpleSpec);
      const index = files.find(f => f.filename === 'index.ts')!;
      expect(index.content).toContain("export * from './Status.schema';");
      expect(index.content).toContain("export * from './Pet.schema';");
    });

    it('schema file imports non-enum refs from sibling schema files', () => {
      const specWithObjRef: ParsedSpec = {
        ...simpleSpec,
        schemas: [
          { name: 'Owner', kind: 'object', enumValues: [], properties: [] },
          {
            name: 'Pet',
            kind: 'object',
            enumValues: [],
            properties: [
              { originalName: 'owner', pascalName: 'Owner', type: { kind: 'ref', isArray: false, refName: 'Owner' }, isRequired: false, isNullable: false },
            ],
          },
        ],
      };
      const petFile = service.generateSchemaFiles(specWithObjRef).find(f => f.filename === 'Pet.schema.ts')!;
      expect(petFile.content).toContain("import { OwnerSchema } from './Owner.schema';");
    });

    it('schema file does not import enum refs (they are inlined)', () => {
      const petFile = service.generateSchemaFiles(simpleSpec).find(f => f.filename === 'Pet.schema.ts')!;
      expect(petFile.content).not.toContain("import { StatusSchema }");
    });
  });

  // ── generateServices ─────────────────────────────────────────────────────────

  describe('generateServices', () => {
    it('includes Angular and RxJS imports', () => {
      const output = service.generateServices(simpleSpec);
      expect(output).toContain("import { Injectable } from '@angular/core';");
      expect(output).toContain("import { HttpClient } from '@angular/common/http';");
      expect(output).toContain("import { Observable } from 'rxjs';");
    });

    it('generates an Injectable service class', () => {
      const output = service.generateServices(simpleSpec);
      expect(output).toContain("@Injectable({ providedIn: 'root' })");
      expect(output).toContain('export class PetsService {');
    });

    it('generates a GET method with no body for list', () => {
      const output = service.generateServices(simpleSpec);
      expect(output).toContain('listPets(status?: string): Observable<Schemas.Pet[]>');
      expect(output).toContain("return this.http.get<Schemas.Pet[]>('/pets');");
    });

    it('generates a GET method with path param', () => {
      const output = service.generateServices(simpleSpec);
      expect(output).toContain('getPetById(petId: number): Observable<Schemas.Pet>');
      expect(output).toContain('return this.http.get<Schemas.Pet>(`/pets/${petId}`);');
    });

    it('generates a POST method with request body', () => {
      const output = service.generateServices(simpleSpec);
      expect(output).toContain('createPet(request: Schemas.Pet): Observable<Schemas.Pet>');
      expect(output).toContain("return this.http.post<Schemas.Pet>('/pets', request);");
    });

    it('generates a PUT method with path param and request body', () => {
      const output = service.generateServices(simpleSpec);
      expect(output).toContain('updatePet(petId: number, request: Schemas.Pet): Observable<Schemas.Pet>');
      expect(output).toContain('return this.http.put<Schemas.Pet>(`/pets/${petId}`, request);');
    });

    it('generates a DELETE method returning void', () => {
      const output = service.generateServices(simpleSpec);
      expect(output).toContain('deletePet(petId: number): Observable<void>');
      expect(output).toContain('return this.http.delete(`/pets/${petId}`);');
    });

    it('includes summary as JSDoc comment', () => {
      const output = service.generateServices(simpleSpec);
      expect(output).toContain('/** List all pets */');
    });
  });

  // ── generateServiceFiles ─────────────────────────────────────────────────────

  describe('generateServiceFiles', () => {
    it('produces one file per tag', () => {
      const files = service.generateServiceFiles(simpleSpec);
      expect(files).toHaveLength(1);
    });

    it('sets correct filename and path', () => {
      const file = service.generateServiceFiles(simpleSpec)[0];
      expect(file.filename).toBe('PetsService.ts');
      expect(file.path).toBe('typescript/services/PetsService.ts');
    });

    it('service file imports from ../schemas', () => {
      const file = service.generateServiceFiles(simpleSpec)[0];
      expect(file.content).toContain("import type * as Schemas from '../schemas';");
    });
  });
});
