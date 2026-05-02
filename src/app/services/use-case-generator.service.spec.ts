import { CsharpGeneratorService } from './csharp-generator.service';
import { TypescriptGeneratorService } from './typescript-generator.service';
import { UseCaseGeneratorService } from './use-case-generator.service';
import type { ParsedSpec } from '../models/openapi.model';

describe('UseCaseGeneratorService', () => {
  let csharp: CsharpGeneratorService;
  let typescript: TypescriptGeneratorService;
  let service: UseCaseGeneratorService;

  beforeEach(() => {
    csharp = new CsharpGeneratorService();
    typescript = new TypescriptGeneratorService();
    service = new UseCaseGeneratorService(csharp, typescript);
  });

  // ── Fixtures ─────────────────────────────────────────────────────────────────

  const simpleSpec: ParsedSpec = {
    title: 'Pet Store',
    version: '1.0',
    schemas: [
      {
        name: 'Pet',
        kind: 'object',
        enumValues: [],
        properties: [
          { originalName: 'id',     pascalName: 'Id',     type: { kind: 'int',    isArray: false },              isRequired: true,  isNullable: false },
          { originalName: 'name',   pascalName: 'Name',   type: { kind: 'string', isArray: false },              isRequired: true,  isNullable: false },
          { originalName: 'status', pascalName: 'Status', type: { kind: 'ref',    isArray: false, refName: 'PetStatus' }, isRequired: true, isNullable: false },
        ],
      },
      {
        name: 'PetStatus',
        kind: 'enum',
        enumValues: ['available', 'sold'],
        properties: [],
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
            summary: 'Get pet by ID',
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

  // helpers
  const overview  = (files: ReturnType<typeof service.generateUseCaseFiles>, id: string) => files.find(f => f.filename === `${id}.md`)!;
  const csharpDoc = (files: ReturnType<typeof service.generateUseCaseFiles>, id: string) => files.find(f => f.filename === `csharp/${id}.md`)!;
  const tsDoc     = (files: ReturnType<typeof service.generateUseCaseFiles>, id: string) => files.find(f => f.filename === `typescript/${id}.md`)!;

  // ── File structure ───────────────────────────────────────────────────────────

  describe('file structure', () => {
    it('produces 3 files per operation', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(files).toHaveLength(12); // 4 ops × 3 files
    });

    it('creates overview, csharp, and typescript files for each operation', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      for (const op of simpleSpec.tags[0].operations) {
        expect(overview(files, op.operationId)).toBeDefined();
        expect(csharpDoc(files, op.operationId)).toBeDefined();
        expect(tsDoc(files, op.operationId)).toBeDefined();
      }
    });

    it('sets correct paths for all three file types', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(overview(files, 'listPets').path).toBe('docs/use-cases/listPets.md');
      expect(csharpDoc(files, 'listPets').path).toBe('docs/use-cases/csharp/listPets.md');
      expect(tsDoc(files, 'listPets').path).toBe('docs/use-cases/typescript/listPets.md');
    });

    it('produces files across multiple tags', () => {
      const spec: ParsedSpec = {
        ...simpleSpec,
        tags: [
          { name: 'pets', operations: [simpleSpec.tags[0].operations[0]] },
          { name: 'users', operations: [
            { method: 'get', path: '/users', operationId: 'listUsers', pathParams: [], queryParams: [], requestBodyType: undefined, responseType: undefined },
          ]},
        ],
      };
      expect(service.generateUseCaseFiles(spec)).toHaveLength(6);
    });

    it('returns empty array when spec has no tags', () => {
      expect(service.generateUseCaseFiles({ ...simpleSpec, tags: [] })).toHaveLength(0);
    });
  });

  // ── Overview — general ───────────────────────────────────────────────────────

  describe('overview — general', () => {
    it('uses summary as the heading', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(overview(files, 'listPets').content).toContain('# List all pets');
    });

    it('falls back to PascalCase operationId when no summary', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(overview(files, 'createPet').content).toContain('# CreatePet');
    });

    it('shows the HTTP method in uppercase', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(overview(files, 'listPets').content).toContain('**Method:** `GET`');
    });

    it('shows the full path', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(overview(files, 'getPetById').content).toContain('**Path:** `/pets/{petId}`');
    });
  });

  // ── Overview — parameters ────────────────────────────────────────────────────

  describe('overview — parameters', () => {
    it('renders path parameters table', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      const c = overview(files, 'getPetById').content;
      expect(c).toContain('### Path Parameters');
      expect(c).toContain('`petId`');
      expect(c).toContain('`int`');
    });

    it('renders query parameters table', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      const c = overview(files, 'listPets').content;
      expect(c).toContain('### Query Parameters');
      expect(c).toContain('`status`');
      expect(c).toContain('No');
    });

    it('omits parameters section when there are none', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(overview(files, 'createPet').content).not.toContain('## Parameters');
    });
  });

  // ── Overview — schema tables ─────────────────────────────────────────────────

  describe('overview — schema tables', () => {
    it('renders request body heading with type label', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(overview(files, 'createPet').content).toContain('## Request Body: `Pet`');
    });

    it('renders response heading with type label', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(overview(files, 'getPetById').content).toContain('## Response: `Pet`');
    });

    it('renders array response heading with [] notation', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(overview(files, 'listPets').content).toContain('## Response: `Pet[]`');
    });

    it('renders object schema as a property table', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      const c = overview(files, 'getPetById').content;
      expect(c).toContain('| Field | Type | Required |');
      expect(c).toContain('`id`');
      expect(c).toContain('`int`');
      expect(c).toContain('`name`');
      expect(c).toContain('`string`');
    });

    it('renders nested enum schema as a sub-section table', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      const c = overview(files, 'getPetById').content;
      expect(c).toContain('### PetStatus (enum)');
      expect(c).toContain('| Value |');
      expect(c).toContain('`available`');
      expect(c).toContain('`sold`');
    });

    it('renders the array item schema table for array response types', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      const c = overview(files, 'listPets').content;
      // Pet schema table should still appear even though response is Pet[]
      expect(c).toContain('| Field | Type | Required |');
      expect(c).toContain('`id`');
    });

    it('omits request body section when no body', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(overview(files, 'listPets').content).not.toContain('## Request Body');
    });

    it('omits response section when no response type', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(overview(files, 'deletePet').content).not.toContain('## Response');
    });

    it('does not render schema tables for primitive response types', () => {
      const spec: ParsedSpec = {
        ...simpleSpec,
        tags: [{
          name: 'test',
          operations: [{
            method: 'get', path: '/test', operationId: 'getTest',
            pathParams: [], queryParams: [],
            requestBodyType: undefined,
            responseType: { kind: 'string', isArray: false },
          }],
        }],
      };
      const files = service.generateUseCaseFiles(spec);
      expect(overview(files, 'getTest').content).not.toContain('| Field |');
    });
  });

  // ── C# file ──────────────────────────────────────────────────────────────────

  describe('C# file', () => {
    it('has "— C#" in the title', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(csharpDoc(files, 'listPets').content).toContain('# List all pets — C#');
    });

    it('contains a Controller Action section', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(csharpDoc(files, 'getPetById').content).toContain('## Controller Action');
    });

    it('contains a csharp fenced code block', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      for (const op of simpleSpec.tags[0].operations) {
        expect(csharpDoc(files, op.operationId).content).toContain('```csharp');
      }
    });

    it('renders correct HTTP method attribute', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(csharpDoc(files, 'listPets').content).toContain('[HttpGet]');
      expect(csharpDoc(files, 'createPet').content).toContain('[HttpPost]');
      expect(csharpDoc(files, 'deletePet').content).toContain('[HttpDelete');
    });

    it('includes route argument for path params', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(csharpDoc(files, 'getPetById').content).toContain('[HttpGet("{petId}")]');
    });

    it('includes [FromRoute] parameter', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(csharpDoc(files, 'getPetById').content).toContain('[FromRoute] int petId');
    });

    it('includes [FromQuery] parameter', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(csharpDoc(files, 'listPets').content).toContain('[FromQuery] string? status');
    });

    it('includes [FromBody] parameter', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(csharpDoc(files, 'createPet').content).toContain('[FromBody] Pet request');
    });

    it('uses ActionResult<T> when response present', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(csharpDoc(files, 'getPetById').content).toContain('ActionResult<Pet>');
    });

    it('uses IActionResult when no response', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(csharpDoc(files, 'deletePet').content).toContain('public IActionResult DeletePet');
    });

    it('uses ActionResult<IReadOnlyList<T>> for array responses', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(csharpDoc(files, 'listPets').content).toContain('ActionResult<IReadOnlyList<Pet>>');
    });

    it('includes XML doc summary', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(csharpDoc(files, 'listPets').content).toContain('/// <summary>List all pets</summary>');
    });

    it('contains a DTOs section for referenced schemas', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      const c = csharpDoc(files, 'getPetById').content;
      expect(c).toContain('## DTOs');
      expect(c).toContain('### Pet');
      expect(c).toContain('public record Pet(');
    });

    it('includes recursively referenced enum in DTOs', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      const c = csharpDoc(files, 'getPetById').content;
      expect(c).toContain('### PetStatus');
      expect(c).toContain('public enum PetStatus');
    });

    it('deduplicates schemas referenced in both body and response', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      const c = csharpDoc(files, 'createPet').content;
      expect((c.match(/### Pet\b/g) ?? []).length).toBe(1);
    });

    it('omits DTOs section when no refs', () => {
      const spec: ParsedSpec = {
        ...simpleSpec,
        tags: [{
          name: 'ping',
          operations: [{
            method: 'get', path: '/ping', operationId: 'ping',
            pathParams: [], queryParams: [],
            requestBodyType: undefined,
            responseType: { kind: 'string', isArray: false },
          }],
        }],
      };
      const files = service.generateUseCaseFiles(spec);
      expect(csharpDoc(files, 'ping').content).not.toContain('## DTOs');
    });
  });

  // ── TypeScript file ───────────────────────────────────────────────────────────

  describe('TypeScript file', () => {
    it('has "— TypeScript" in the title', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(tsDoc(files, 'listPets').content).toContain('# List all pets — TypeScript');
    });

    it('contains a Service Call section', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      for (const op of simpleSpec.tags[0].operations) {
        expect(tsDoc(files, op.operationId).content).toContain('## Service Call');
      }
    });

    it('contains a typescript fenced code block in Service Call', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(tsDoc(files, 'getPetById').content).toContain('```typescript');
    });

    it('renders the service method name in camelCase', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(tsDoc(files, 'getPetById').content).toContain('getPetById(');
      expect(tsDoc(files, 'listPets').content).toContain('listPets(');
    });

    it('uses correct Observable return type for ref response', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(tsDoc(files, 'getPetById').content).toContain('Observable<Pet>');
    });

    it('uses Observable<T[]> for array response', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(tsDoc(files, 'listPets').content).toContain('Observable<Pet[]>');
    });

    it('uses Observable<void> when no response', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(tsDoc(files, 'deletePet').content).toContain('Observable<void>');
    });

    it('includes path param in method signature with correct type', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(tsDoc(files, 'getPetById').content).toContain('petId: number');
    });

    it('includes optional query param with ? in method signature', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(tsDoc(files, 'listPets').content).toContain('status?: string');
    });

    it('includes request body param in method signature', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(tsDoc(files, 'createPet').content).toContain('request: Pet');
    });

    it('uses template literal for path with path params', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(tsDoc(files, 'getPetById').content).toContain('this.http.get<Pet>(`/pets/${petId}`)');
    });

    it('uses string literal for path without path params', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(tsDoc(files, 'listPets').content).toContain("this.http.get<Pet[]>('/pets')");
    });

    it('includes post body in http call', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(tsDoc(files, 'createPet').content).toContain("this.http.post<Pet>('/pets', request)");
    });

    it('includes JSDoc summary when present', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      expect(tsDoc(files, 'listPets').content).toContain('/** List all pets */');
    });

    it('contains a DTOs section with Zod import for ref schemas', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      const c = tsDoc(files, 'getPetById').content;
      expect(c).toContain("## DTOs");
      expect(c).toContain("import { z } from 'zod'");
    });

    it('renders object schema as Zod object', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      const c = tsDoc(files, 'getPetById').content;
      expect(c).toContain('export const PetSchema = z.object({');
      expect(c).toContain('export type Pet = z.infer<typeof PetSchema>;');
    });

    it('renders enum schema as Zod enum', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      const c = tsDoc(files, 'getPetById').content;
      expect(c).toContain("export const PetStatusSchema = z.enum(['available', 'sold']);");
      expect(c).toContain('export type PetStatus = z.infer<typeof PetStatusSchema>;');
    });

    it('renders Zod properties using correct types', () => {
      const files = service.generateUseCaseFiles(simpleSpec);
      const c = tsDoc(files, 'getPetById').content;
      expect(c).toContain('Id: z.number().int(),');
      expect(c).toContain('Name: z.string(),');
      expect(c).toContain('Status: PetStatusSchema,');
    });

    it('omits DTOs section when no refs', () => {
      const spec: ParsedSpec = {
        ...simpleSpec,
        tags: [{
          name: 'ping',
          operations: [{
            method: 'get', path: '/ping', operationId: 'ping',
            pathParams: [], queryParams: [],
            requestBodyType: undefined,
            responseType: { kind: 'string', isArray: false },
          }],
        }],
      };
      const files = service.generateUseCaseFiles(spec);
      expect(tsDoc(files, 'ping').content).not.toContain('## DTOs');
    });
  });
});
