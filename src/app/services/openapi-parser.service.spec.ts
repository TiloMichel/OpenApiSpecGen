import { OpenApiParserService } from './openapi-parser.service';

describe('OpenApiParserService', () => {
  let service: OpenApiParserService;

  beforeEach(() => {
    service = new OpenApiParserService();
  });

  // ── detectFormat ─────────────────────────────────────────────────────────────

  describe('detectFormat', () => {
    it('detects JSON from object start', () => {
      expect(service.detectFormat('{ "openapi": "3.0" }')).toBe('json');
    });

    it('detects JSON from array start', () => {
      expect(service.detectFormat('[1, 2]')).toBe('json');
    });

    it('detects YAML for anything else', () => {
      expect(service.detectFormat('openapi: "3.0"')).toBe('yaml');
    });
  });

  // ── toPascalCase / toCamelCase ───────────────────────────────────────────────

  describe('toPascalCase', () => {
    it('converts kebab-case', () => expect(service.toPascalCase('my-field')).toBe('MyField'));
    it('converts snake_case', () => expect(service.toPascalCase('my_field')).toBe('MyField'));
    it('capitalises single word', () => expect(service.toPascalCase('name')).toBe('Name'));
    it('handles already-pascal input', () => expect(service.toPascalCase('MyModel')).toBe('MyModel'));
  });

  describe('toCamelCase', () => {
    it('converts kebab-case', () => expect(service.toCamelCase('my-field')).toBe('myField'));
    it('lowercases a single word', () => expect(service.toCamelCase('Name')).toBe('name'));
  });

  // ── parse – metadata ─────────────────────────────────────────────────────────

  const minimalJson = JSON.stringify({
    openapi: '3.0.0',
    info: { title: 'Pet Store', version: '2.0' },
    paths: {},
    components: { schemas: {} },
  });

  describe('parse – metadata', () => {
    it('extracts title and version from JSON', () => {
      const spec = service.parse(minimalJson, 'json');
      expect(spec.title).toBe('Pet Store');
      expect(spec.version).toBe('2.0');
    });

    it('uses defaults when info is absent', () => {
      const spec = service.parse(JSON.stringify({ openapi: '3.0.0', paths: {} }), 'json');
      expect(spec.title).toBe('Api');
      expect(spec.version).toBe('1.0');
    });

    it('parses YAML input', () => {
      const yaml = `openapi: "3.0.0"\ninfo:\n  title: YAML API\n  version: "3.0"\npaths: {}\n`;
      const spec = service.parse(yaml, 'yaml');
      expect(spec.title).toBe('YAML API');
      expect(spec.version).toBe('3.0');
    });
  });

  // ── parse – schemas ──────────────────────────────────────────────────────────

  describe('parse – object schema', () => {
    it('parses a simple object schema', () => {
      const raw = {
        openapi: '3.0.0',
        paths: {},
        components: {
          schemas: {
            Pet: {
              type: 'object',
              required: ['id', 'name'],
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                tag: { type: 'string' },
              },
            },
          },
        },
      };
      const spec = service.parse(JSON.stringify(raw), 'json');
      expect(spec.schemas).toHaveLength(1);
      const pet = spec.schemas[0];
      expect(pet.name).toBe('Pet');
      expect(pet.kind).toBe('object');
      expect(pet.properties).toHaveLength(3);

      const idProp = pet.properties.find(p => p.originalName === 'id')!;
      expect(idProp.isRequired).toBe(true);
      expect(idProp.type.kind).toBe('int');

      const tagProp = pet.properties.find(p => p.originalName === 'tag')!;
      expect(tagProp.isRequired).toBe(false);
    });

    it('converts property names to PascalCase', () => {
      const raw = {
        openapi: '3.0.0', paths: {},
        components: { schemas: { Foo: { type: 'object', properties: { first_name: { type: 'string' } } } } },
      };
      const prop = service.parse(JSON.stringify(raw), 'json').schemas[0].properties[0];
      expect(prop.originalName).toBe('first_name');
      expect(prop.pascalName).toBe('FirstName');
    });

    it('marks nullable properties', () => {
      const raw = {
        openapi: '3.0.0', paths: {},
        components: { schemas: { Foo: { type: 'object', properties: { val: { type: 'string', nullable: true } } } } },
      };
      const prop = service.parse(JSON.stringify(raw), 'json').schemas[0].properties[0];
      expect(prop.isNullable).toBe(true);
    });
  });

  describe('parse – enum schema', () => {
    it('parses an enum schema', () => {
      const raw = {
        openapi: '3.0.0', paths: {},
        components: { schemas: { Status: { type: 'string', enum: ['active', 'inactive', 'pending'] } } },
      };
      const schema = service.parse(JSON.stringify(raw), 'json').schemas[0];
      expect(schema.kind).toBe('enum');
      expect(schema.enumValues).toEqual(['active', 'inactive', 'pending']);
    });
  });

  describe('parse – allOf', () => {
    it('merges allOf properties', () => {
      const raw = {
        openapi: '3.0.0', paths: {},
        components: {
          schemas: {
            Base: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
            Child: {
              allOf: [
                { $ref: '#/components/schemas/Base' },
                { type: 'object', properties: { name: { type: 'string' } } },
              ],
            },
          },
        },
      };
      const child = service.parse(JSON.stringify(raw), 'json').schemas.find(s => s.name === 'Child')!;
      expect(child.kind).toBe('object');
      const names = child.properties.map(p => p.originalName);
      expect(names).toContain('id');
      expect(names).toContain('name');
    });
  });

  // ── parse – type mapping ─────────────────────────────────────────────────────

  describe('parse – type mapping', () => {
    function schemaWithProp(propSchema: object) {
      return JSON.stringify({
        openapi: '3.0.0', paths: {},
        components: { schemas: { T: { type: 'object', properties: { val: propSchema } } } },
      });
    }

    it('maps boolean', () => {
      const t = service.parse(schemaWithProp({ type: 'boolean' }), 'json').schemas[0].properties[0].type;
      expect(t.kind).toBe('bool');
    });

    it('maps integer', () => {
      const t = service.parse(schemaWithProp({ type: 'integer' }), 'json').schemas[0].properties[0].type;
      expect(t.kind).toBe('int');
    });

    it('maps int64 to long', () => {
      const t = service.parse(schemaWithProp({ type: 'integer', format: 'int64' }), 'json').schemas[0].properties[0].type;
      expect(t.kind).toBe('long');
    });

    it('maps number (float)', () => {
      const t = service.parse(schemaWithProp({ type: 'number', format: 'float' }), 'json').schemas[0].properties[0].type;
      expect(t.kind).toBe('float');
    });

    it('maps number (double)', () => {
      const t = service.parse(schemaWithProp({ type: 'number' }), 'json').schemas[0].properties[0].type;
      expect(t.kind).toBe('double');
    });

    it('maps $ref to ref kind', () => {
      const raw = JSON.stringify({
        openapi: '3.0.0', paths: {},
        components: {
          schemas: {
            Owner: { type: 'object', properties: {} },
            Pet: { type: 'object', properties: { owner: { $ref: '#/components/schemas/Owner' } } },
          },
        },
      });
      const t = service.parse(raw, 'json').schemas.find(s => s.name === 'Pet')!.properties[0].type;
      expect(t.kind).toBe('ref');
      expect(t.refName).toBe('Owner');
    });

    it('maps array type', () => {
      const t = service.parse(schemaWithProp({ type: 'array', items: { type: 'string' } }), 'json').schemas[0].properties[0].type;
      expect(t.isArray).toBe(true);
      expect(t.kind).toBe('string');
    });

    it('maps inline enum', () => {
      const t = service.parse(schemaWithProp({ type: 'string', enum: ['a', 'b'] }), 'json').schemas[0].properties[0].type;
      expect(t.kind).toBe('enum');
      expect(t.enumValues).toEqual(['a', 'b']);
    });
  });

  // ── parse – paths ────────────────────────────────────────────────────────────

  describe('parse – paths', () => {
    const specWithPaths = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test', version: '1' },
      components: {
        schemas: {
          Pet: { type: 'object', properties: { id: { type: 'integer' } } },
          NewPet: { type: 'object', properties: { name: { type: 'string' } } },
        },
      },
      paths: {
        '/pets': {
          get: {
            tags: ['pets'],
            operationId: 'listPets',
            summary: 'List all pets',
            responses: {
              '200': { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Pet' } } } } },
            },
          },
          post: {
            tags: ['pets'],
            operationId: 'createPet',
            requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/NewPet' } } } },
            responses: { '201': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } } },
          },
        },
        '/pets/{petId}': {
          get: {
            tags: ['pets'],
            operationId: 'getPetById',
            parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } } },
          },
        },
      },
    });

    it('groups operations under the correct tag', () => {
      const spec = service.parse(specWithPaths, 'json');
      expect(spec.tags).toHaveLength(1);
      expect(spec.tags[0].name).toBe('pets');
    });

    it('parses all operations in a tag', () => {
      const ops = service.parse(specWithPaths, 'json').tags[0].operations;
      expect(ops).toHaveLength(3);
    });

    it('populates operationId, method, and path', () => {
      const listOp = service.parse(specWithPaths, 'json').tags[0].operations.find(o => o.operationId === 'listPets')!;
      expect(listOp.method).toBe('get');
      expect(listOp.path).toBe('/pets');
    });

    it('parses path parameters', () => {
      const getByIdOp = service.parse(specWithPaths, 'json').tags[0].operations.find(o => o.operationId === 'getPetById')!;
      expect(getByIdOp.pathParams).toHaveLength(1);
      expect(getByIdOp.pathParams[0].originalName).toBe('petId');
      expect(getByIdOp.pathParams[0].camelName).toBe('petId');
      expect(getByIdOp.pathParams[0].isRequired).toBe(true);
    });

    it('parses request body type', () => {
      const createOp = service.parse(specWithPaths, 'json').tags[0].operations.find(o => o.operationId === 'createPet')!;
      expect(createOp.requestBodyType?.kind).toBe('ref');
      expect(createOp.requestBodyType?.refName).toBe('NewPet');
    });

    it('parses response type', () => {
      const listOp = service.parse(specWithPaths, 'json').tags[0].operations.find(o => o.operationId === 'listPets')!;
      expect(listOp.responseType?.isArray).toBe(true);
      expect(listOp.responseType?.kind).toBe('ref');
    });

    it('generates operationId when absent', () => {
      const raw = JSON.stringify({
        openapi: '3.0.0', paths: {
          '/users': { get: { tags: ['users'], responses: {} } },
          '/users/{id}': { get: { tags: ['users'], responses: {} } },
        },
      });
      const ops = service.parse(raw, 'json').tags[0].operations;
      const listOp = ops.find(o => o.path === '/users')!;
      const getByIdOp = ops.find(o => o.path === '/users/{id}')!;
      expect(listOp.operationId).toBe('GetAllUsers');
      expect(getByIdOp.operationId).toBe('GetUserById');
    });

    it('parses query parameters', () => {
      const raw = JSON.stringify({
        openapi: '3.0.0', paths: {
          '/search': {
            get: {
              tags: ['search'],
              operationId: 'search',
              parameters: [
                { name: 'query', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'page_size', in: 'query', required: false, schema: { type: 'integer' } },
              ],
              responses: {},
            },
          },
        },
      });
      const op = service.parse(raw, 'json').tags[0].operations[0];
      expect(op.queryParams).toHaveLength(2);
      expect(op.queryParams[0].originalName).toBe('query');
      expect(op.queryParams[0].isRequired).toBe(true);
      expect(op.queryParams[1].camelName).toBe('pageSize');
      expect(op.queryParams[1].isRequired).toBe(false);
    });

    it('uses Default tag when operation has no tags', () => {
      const raw = JSON.stringify({
        openapi: '3.0.0', paths: { '/ping': { get: { operationId: 'ping', responses: {} } } },
      });
      const spec = service.parse(raw, 'json');
      expect(spec.tags[0].name).toBe('Default');
    });
  });
});
