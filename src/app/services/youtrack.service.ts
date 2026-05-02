import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { GeneratedFile, YouTrackConfig, YouTrackIssueResult } from '../models/openapi.model';

interface YouTrackIssueResponse {
  id: string;
  idReadable: string;
  webUrl: string;
}

interface UseCaseGroup {
  overview?: GeneratedFile;
  csharp?: GeneratedFile;
  typescript?: GeneratedFile;
}

@Injectable({ providedIn: 'root' })
export class YouTrackService {
  constructor(private http: HttpClient) {}

  async createUseCaseIssues(
    config: YouTrackConfig,
    useCaseFiles: GeneratedFile[],
  ): Promise<YouTrackIssueResult[]> {
    const groups = this.groupFiles(useCaseFiles);
    const results: YouTrackIssueResult[] = [];

    for (const [opId, group] of groups) {
      const title = this.extractTitle(group.overview?.content ?? opId);
      try {
        const issue = await this.createIssue(
          config,
          `[Use Case] ${title}`,
          this.buildDescription(group),
        );
        results.push({
          operationId: opId,
          title,
          success: true,
          issueId: issue.idReadable,
          issueUrl: issue.webUrl,
        });
      } catch (e) {
        results.push({
          operationId: opId,
          title,
          success: false,
          error: this.errorMessage(e),
        });
      }
    }

    return results;
  }

  private async createIssue(
    config: YouTrackConfig,
    summary: string,
    description: string,
  ): Promise<YouTrackIssueResponse> {
    const baseUrl = config.url.replace(/\/$/, '');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    });
    return firstValueFrom(
      this.http.post<YouTrackIssueResponse>(
        `${baseUrl}/api/issues?fields=id,idReadable,webUrl`,
        { summary, description, project: { id: config.projectId } },
        { headers },
      ),
    );
  }

  private groupFiles(files: GeneratedFile[]): Map<string, UseCaseGroup> {
    const groups = new Map<string, UseCaseGroup>();
    for (const file of files) {
      let opId: string;
      let key: keyof UseCaseGroup;
      if (file.filename.startsWith('csharp/')) {
        opId = file.filename.slice('csharp/'.length, -'.md'.length);
        key = 'csharp';
      } else if (file.filename.startsWith('typescript/')) {
        opId = file.filename.slice('typescript/'.length, -'.md'.length);
        key = 'typescript';
      } else {
        opId = file.filename.slice(0, -'.md'.length);
        key = 'overview';
      }
      const g = groups.get(opId) ?? {};
      groups.set(opId, { ...g, [key]: file });
    }
    return groups;
  }

  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : 'Use Case';
  }

  private buildDescription(group: UseCaseGroup): string {
    const parts: string[] = [];
    if (group.overview) parts.push(group.overview.content);
    if (group.csharp) parts.push('---\n\n' + group.csharp.content);
    if (group.typescript) parts.push('---\n\n' + group.typescript.content);
    return parts.join('\n\n');
  }

  private errorMessage(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      const body = typeof e.error === 'object' && e.error !== null
        ? ((e.error as Record<string, unknown>)['error_description'] ?? e.message)
        : e.message;
      return `HTTP ${e.status}: ${body}`;
    }
    return e instanceof Error ? e.message : String(e);
  }
}
