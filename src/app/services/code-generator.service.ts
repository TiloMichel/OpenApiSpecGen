import { Injectable } from '@angular/core';
import { OpenApiParserService } from './openapi-parser.service';
import { CsharpGeneratorService } from './csharp-generator.service';
import { TypescriptGeneratorService } from './typescript-generator.service';
import type { GenerationOptions, GenerationResult } from '../models/openapi.model';

@Injectable({ providedIn: 'root' })
export class CodeGeneratorService {
  constructor(
    private parser: OpenApiParserService,
    private csharp: CsharpGeneratorService,
    private typescript: TypescriptGeneratorService,
  ) {}

  generate(specContent: string, options: GenerationOptions): GenerationResult {
    const format = this.parser.detectFormat(specContent);
    const spec = this.parser.parse(specContent, format);
    const { splitFiles } = options;

    return {
      options,
      csharpDtoFiles: options.includeCsharpDtos
        ? (splitFiles
            ? this.csharp.generateDtoFiles(spec)
            : [{ filename: 'Dtos.cs', path: 'csharp/Dtos.cs', content: this.csharp.generateDtos(spec) }])
        : [],
      csharpControllerFiles: options.includeCsharpControllers
        ? (splitFiles
            ? this.csharp.generateControllerFiles(spec)
            : [{ filename: 'Controllers.cs', path: 'csharp/Controllers.cs', content: this.csharp.generateControllers(spec) }])
        : [],
      typescriptSchemaFiles: options.includeTypescriptSchemas
        ? (splitFiles
            ? this.typescript.generateSchemaFiles(spec)
            : [{ filename: 'schemas.ts', path: 'typescript/schemas.ts', content: this.typescript.generateSchemas(spec) }])
        : [],
      typescriptServiceFiles: options.includeTypescriptServices
        ? (splitFiles
            ? this.typescript.generateServiceFiles(spec)
            : [{ filename: 'services.ts', path: 'typescript/services.ts', content: this.typescript.generateServices(spec) }])
        : [],
    };
  }
}
