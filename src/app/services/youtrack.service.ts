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
    return fields.find(f => f.field?.name === 'Type')?.bundle?.values ?? [];
  }

  buildStagedIssues(useCaseFiles: GeneratedFile[]): YouTrackStagedIssue[] {
    return useCaseFiles.map(file => {
      let opId: string;
      let fileType: 'overview' | 'csharp' | 'typescript';
      if (file.filename.startsWith('csharp/')) {
        opId = file.filename.slice('csharp/'.length, -'.md'.length);
        fileType = 'csharp';
      } else if (file.filename.startsWith('typescript/')) {
        opId = file.filename.slice('typescript/'.length, -'.md'.length);
        fileType = 'typescript';
      } else {
        opId = file.filename.slice(0, -'.md'.length);
        fileType = 'overview';
      }

      const title = this.extractTitle(file.content);
      return {
        id: `${opId}:${fileType}`,
        operationId: opId,
        fileType,
        summary: title,
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
    const created = new Map<string, Map<string, { internalId: string; readableId: string }>>();

    for (const issue of staged.filter(s => s.selected)) {
      try {
        const response = await this.createIssue(config, issue.summary, issue.description, issue.issueTypeId);
        results.push({
          operationId: issue.id,
          title: issue.summary,
          success: true,
          issueId: response.idReadable,
          issueUrl: `${config.url.replace(/\/$/, '')}/issue/${response.idReadable}`,
        });
        if (!created.has(issue.operationId)) created.set(issue.operationId, new Map());
        created.get(issue.operationId)!.set(issue.fileType, {
          internalId: response.id,
          readableId: response.idReadable,
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

    for (const byFileType of created.values()) {
      const overview = byFileType.get('overview');
      if (!overview) continue;
      for (const [fileType, issue] of byFileType) {
        if (fileType === 'overview') continue;
        try {
          await this.linkIssue(config, overview.internalId, issue.readableId);
        } catch (e) {
          console.warn(`Failed to link overview ${overview.internalId} to ${issue.readableId}:`, e);
        }
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
        'name': 'Type',
        'value': { '$type': 'EnumBundleElement', 'id': issueTypeId },
      }];
    }
    return firstValueFrom(
      this.http.post<YouTrackIssueResponse>(
        `${this.getApiBase(config)}/api/issues?fields=id,idReadable`,
        body,
        { headers: this.buildHeaders(config.token) },
      ),
    );
  }

  private async linkIssue(config: YouTrackConfig, parentInternalId: string, childReadableId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${this.getApiBase(config)}/api/commands`,
        { query: `parent for ${childReadableId}`, issues: [{ id: parentInternalId }] },
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
