import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import type { GenerationResult } from '../models/openapi.model';

@Injectable({ providedIn: 'root' })
export class FileDownloadService {

  downloadText(content: string, filename: string): void {
    this.trigger(new Blob([content], { type: 'text/plain' }), filename);
  }

  async downloadZip(result: GenerationResult, specContent: string, specFilename: string): Promise<void> {
    const zip = new JSZip();
    const allFiles = [
      ...result.csharpDtoFiles,
      ...result.csharpControllerFiles,
      ...result.typescriptSchemaFiles,
      ...result.typescriptServiceFiles,
    ];
    for (const file of allFiles) {
      zip.file(file.path, file.content);
    }
    zip.file(specFilename, specContent);
    const blob = await zip.generateAsync({ type: 'blob' });
    this.trigger(blob, 'generated-code.zip');
  }

  private trigger(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }
}
