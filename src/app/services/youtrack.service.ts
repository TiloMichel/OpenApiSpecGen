import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  GeneratedFile,
  YouTrackConfig,
  YouTrackIssueResult,
  YouTrackProject,
  YouTrackIssueType,
  YouTrackStagedIssue,
} from '../models/openapi.model';

interface YouTrackIssueResponse {
  id: string;
  idReadable: string;
  webUrl: string;
}

interface CustomFieldResponse {
  id: string;
  field?: { id: string; name: string };
  bundle?: { values: YouTrackIssueType[] };
}

@Injectable({ providedIn: 'root' })
export class YouTrackService {
  constructor(private http: HttpClient) {}

  async getProjects(config: YouTrackConfig): Promise<YouTrackProject[]> {
    return firstValueFrom(
      this.http.get<YouTrackProject[]>(
        `${this.getApiBase(config)}/api/admin/projects?fields=id,name,shortName`,
        { headers: this.buildHeaders(config.token) },
      ),
    );
  }

  async getIssueTypes(config: YouTrackConfig, projectId: string): Promise<YouTrackIssueType[]> {
    const fields = await firstValueFrom(
      this.http.get<CustomFieldResponse[]>(
        `${this.getApiBase(config)}/api/admin/projects/${projectId}/customFields?fields=id,field(id,name),bundle(values(id,name))`,
        { headers: this.buildHeaders(config.token) },
      ),
    );
    return fields.find(f => f.field?.name === 'Typ')?.bundle?.values ?? [];
  }

  buildStagedIssues(useCaseFiles: GeneratedFile[]): YouTrackStagedIssue[] {
    return useCaseFiles.map(file => {
      let opId: string;
      let fileType: 'overview' | 'csharp' | 'typescript';
      let typeLabel: string;

      if (file.filename.startsWith('csharp/')) {
        opId = file.filename.slice('csharp/'.length, -'.md'.length);
        fileType = 'csharp';
        typeLabel = ' — C#';
      } else if (file.filename.startsWith('typescript/')) {
        opId = file.filename.slice('typescript/'.length, -'.md'.length);
        fileType = 'typescript';
        typeLabel = ' — TypeScript';
      } else {
        opId = file.filename.slice(0, -'.md'.length);
        fileType = 'overview';
        typeLabel = '';
      }

      const title = this.extractTitle(file.content);
      return {
        id: `${opId}:${fileType}`,
        operationId: opId,
        fileType,
        summary: `[Use Case] ${title}${typeLabel}`,
        description: file.content,
        selected: true,
        issueTypeId: '',
      };
    });
  }

  async createUseCaseIssues(
    config: YouTrackConfig,
    staged: YouTrackStagedIssue[],
  ): Promise<YouTrackIssueResult[]> {
    const results: YouTrackIssueResult[] = [];
    for (const issue of staged.filter(s => s.selected)) {
      try {
        const created = await this.createIssue(config, issue.summary, issue.description, issue.issueTypeId);
        results.push({
          operationId: issue.id,
          title: issue.summary,
          success: true,
          issueId: created.idReadable,
          issueUrl: created.webUrl,
        });
      } catch (e) {
        results.push({
          operationId: issue.id,
          title: issue.summary,
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
    issueTypeId: string,
  ): Promise<YouTrackIssueResponse> {
    const body: Record<string, unknown> = {
      summary,
      description,
      project: { id: config.projectId },
    };
    if (issueTypeId) {
      body['customFields'] = [{
        '$type': 'SingleEnumIssueCustomField',
        'name': 'Typ',
        'value': { '$type': 'EnumBundleElement', 'id': issueTypeId },
      }];
    }
    return firstValueFrom(
      this.http.post<YouTrackIssueResponse>(
        `${this.getApiBase(config)}/api/issues?fields=id,idReadable,webUrl`,
        body,
        { headers: this.buildHeaders(config.token) },
      ),
    );
  }

  private getApiBase(config: YouTrackConfig): string {
    return config.useProxy ? '/youtrack-proxy' : config.url.replace(/\/$/, '');
  }

  private buildHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    });
  }

  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : 'Use Case';
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
