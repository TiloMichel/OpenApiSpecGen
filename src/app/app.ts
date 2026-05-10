import { Component, signal, computed, inject, effect } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as jsYaml from 'js-yaml';
import { CodeGeneratorService } from './services/code-generator.service';
import { FileDownloadService } from './services/file-download.service';
import { YouTrackService } from './services/youtrack.service';
import type {
  GenerationOptions, GenerationResult,
  YouTrackConfig, YouTrackIssueResult,
  YouTrackProject, YouTrackIssueType, YouTrackStagedIssue,
} from './models/openapi.model';
import { SpecEditorComponent } from './components/spec-editor/spec-editor';
import { CodeEditorComponent } from './components/code-editor/code-editor';

const EXAMPLE_SPEC = `openapi: "3.0.0"
info:
  title: User Management API
  version: "1.0.0"
components:
  schemas:
    UserStatus:
      type: string
      enum: [Active, Inactive, Pending]
    UserDto:
      type: object
      required: [id, name, email, status]
      properties:
        id:
          type: integer
          format: int32
        name:
          type: string
        email:
          type: string
        age:
          type: integer
        status:
          $ref: '#/components/schemas/UserStatus'
    CreateUserRequest:
      type: object
      required: [name, email]
      properties:
        name:
          type: string
        email:
          type: string
        age:
          type: integer
paths:
  /users:
    get:
      tags: [Users]
      operationId: getUsers
      summary: Get all users
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/UserDto'
    post:
      tags: [Users]
      operationId: createUser
      summary: Create a user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserDto'
  /users/{id}:
    get:
      tags: [Users]
      operationId: getUserById
      summary: Get user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserDto'
    put:
      tags: [Users]
      operationId: updateUser
      summary: Update a user
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserDto'
    delete:
      tags: [Users]
      operationId: deleteUser
      summary: Delete a user
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '204':
          description: No content
`;

@Component({
  selector: 'app-root',
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTabsModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatProgressSpinnerModule,
    SpecEditorComponent,
    CodeEditorComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly generator = inject(CodeGeneratorService);
  private readonly downloader = inject(FileDownloadService);
  private readonly youTrack = inject(YouTrackService);
  private readonly snackBar = inject(MatSnackBar);

  protected darkMode = signal<boolean>(
    localStorage.getItem('darkMode') !== null
      ? localStorage.getItem('darkMode') === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  public constructor() {
    effect(() => {
      const dark = this.darkMode();
      document.body.classList.toggle('dark', dark);
      document.body.classList.toggle('light', !dark);
      localStorage.setItem('darkMode', dark ? 'dark' : 'light');
    });
  }

  protected toggleDarkMode(): void {
    this.darkMode.update(v => !v);
  }

  protected specContent = signal<string>('');
  protected specFilename = signal<string>('spec.yaml');
  protected result = signal<GenerationResult | null>(null);
  protected isDragOver = signal<boolean>(false);

  protected options = signal<GenerationOptions>({
    includeCsharpDtos: true,
    includeCsharpControllers: true,
    includeTypescriptSchemas: true,
    includeTypescriptServices: true,
    splitFiles: true,
    includeUseCaseDocs: true,
  });

  protected selectedDtoFile = signal(0);
  protected selectedControllerFile = signal(0);
  protected selectedSchemaFile = signal(0);
  protected selectedServiceFile = signal(0);
  protected selectedUseCaseFile = signal(0);

  protected youTrackConfig = signal<YouTrackConfig>({
    url: localStorage.getItem('youtrackUrl') ?? '',
    token: '',
    projectId: localStorage.getItem('youtrackProjectId') ?? '',
    useProxy: localStorage.getItem('youtrackUseProxy') !== 'false',
  });
  protected youTrackProjects = signal<YouTrackProject[]>([]);
  protected youTrackIssueTypes = signal<YouTrackIssueType[]>([]);
  protected youTrackProjectsLoading = signal(false);
  protected youTrackIssueTypesLoading = signal(false);
  protected youTrackResults = signal<YouTrackIssueResult[] | null>(null);
  protected youTrackLoading = signal(false);
  protected stagedIssues = signal<YouTrackStagedIssue[]>([]);

  protected readonly stagedIssueColumns = ['select', 'operation', 'file', 'summary', 'issueType'];
  protected readonly trackByStagedIssue = (_: number, item: YouTrackStagedIssue) => item.id;

  protected useCaseCount = computed(() =>
    (this.result()?.useCaseFiles ?? []).filter(f => !f.filename.includes('/')).length,
  );
  protected allIssuesSelected = computed(() => {
    const issues = this.stagedIssues();
    return issues.length > 0 && issues.every(i => i.selected);
  });
  protected someIssuesSelected = computed(
    () => this.stagedIssues().some(i => i.selected) && !this.allIssuesSelected(),
  );
  protected selectedIssueCount = computed(() => this.stagedIssues().filter(i => i.selected).length);

  protected hasAnyOption = computed(() => {
    const o = this.options();
    return (
      o.includeCsharpDtos ||
      o.includeCsharpControllers ||
      o.includeTypescriptSchemas ||
      o.includeTypescriptServices ||
      o.includeUseCaseDocs
    );
  });

  protected setOption<K extends keyof GenerationOptions>(key: K, value: GenerationOptions[K]): void {
    this.options.update(o => ({ ...o, [key]: value }));
    this.result.set(null);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.loadFile(file);
    input.value = '';
  }

  protected onSpecContentChange(content: string): void {
    this.specContent.set(content);
    this.result.set(null);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  protected onDragLeave(): void {
    this.isDragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.loadFile(file);
  }

  private loadFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.specContent.set(this.formatSpec(reader.result as string, file.name));
      this.specFilename.set(file.name);
      this.result.set(null);
      this.snackBar.open(`Loaded: ${file.name}`, 'OK', { duration: 3000 });
    };
    reader.readAsText(file);
  }

  private formatSpec(content: string, filename: string): string {
    try {
      const name = filename.toLowerCase();
      if (name.endsWith('.json')) {
        return JSON.stringify(JSON.parse(content), null, 2);
      }
      return jsYaml.dump(jsYaml.load(content) as object, { indent: 2, lineWidth: -1 });
    } catch {
      return content;
    }
  }

  protected generate(): void {
    try {
      const result = this.generator.generate(this.specContent(), this.options());
      this.result.set(result);
      this.selectedDtoFile.set(0);
      this.selectedControllerFile.set(0);
      this.selectedSchemaFile.set(0);
      this.selectedServiceFile.set(0);
      this.selectedUseCaseFile.set(0);
      if (result.useCaseFiles.length > 0) {
        const staged = this.youTrack.buildStagedIssues(result.useCaseFiles);
        const types = this.youTrackIssueTypes();
        if (types.length > 0) {
          staged.forEach(s => {
            s.issueTypeId = types[0].id;
          });
        }
        this.stagedIssues.set(staged);
      } else {
        this.stagedIssues.set([]);
      }
      this.snackBar.open('Code generated successfully!', 'OK', { duration: 3000 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.snackBar.open(`Error: ${msg}`, 'OK', { duration: 6000 });
    }
  }

  protected downloadSpec(): void {
    this.downloader.downloadText(this.specContent(), this.specFilename());
  }

  protected downloadFile(content: string, filename: string): void {
    this.downloader.downloadText(content, filename);
  }

  protected async downloadAll(): Promise<void> {
    const result = this.result();
    if (!result) return;
    await this.downloader.downloadZip(result, this.specContent(), this.specFilename());
  }

  protected updateResultFile(
    key: 'csharpDtoFiles' | 'csharpControllerFiles' | 'typescriptSchemaFiles' | 'typescriptServiceFiles' | 'useCaseFiles',
    index: number,
    content: string,
  ): void {
    this.result.update(r => {
      if (!r) return r;
      const files = [...r[key]];
      files[index] = { ...files[index], content };
      return { ...r, [key]: files };
    });
  }

  protected copyToClipboard(content: string): void {
    navigator.clipboard.writeText(content).then(() => this.snackBar.open('Copied!', 'OK', { duration: 2000 }));
  }

  protected loadExample(): void {
    this.specContent.set(this.formatSpec(EXAMPLE_SPEC, 'example.yaml'));
    this.specFilename.set('example.yaml');
    this.result.set(null);
    this.snackBar.open('Example spec loaded', 'OK', { duration: 2000 });
  }

  protected setYouTrackConfig<K extends keyof YouTrackConfig>(key: K, value: YouTrackConfig[K]): void {
    this.youTrackConfig.update(c => {
      if (key === 'url') localStorage.setItem('youtrackUrl', value as string);
      if (key === 'projectId') localStorage.setItem('youtrackProjectId', value as string);
      if (key === 'useProxy') localStorage.setItem('youtrackUseProxy', String(value));
      return { ...c, [key]: value };
    });
  }

  protected async loadYouTrackProjects(): Promise<void> {
    this.youTrackProjectsLoading.set(true);
    try {
      const projects = await this.youTrack.getProjects(this.youTrackConfig());
      this.youTrackProjects.set(projects);
      const projectId = this.youTrackConfig().projectId || projects[0]?.id;
      if (projectId) {
        await this.loadYouTrackIssueTypes(projectId);
      }
    } catch (e: unknown) {
      this.snackBar.open(
        `Failed to load projects: ${e instanceof Error ? e.message : String(e)}`,
        'OK',
        { duration: 6000 },
      );
    } finally {
      this.youTrackProjectsLoading.set(false);
    }
  }

  protected async onYouTrackProjectChange(projectId: string): Promise<void> {
    this.setYouTrackConfig('projectId', projectId);
    await this.loadYouTrackIssueTypes(projectId);
  }

  private async loadYouTrackIssueTypes(projectId: string): Promise<void> {
    this.youTrackIssueTypes.set([]);
    this.youTrackIssueTypesLoading.set(true);
    try {
      const types = await this.youTrack.getIssueTypes(this.youTrackConfig(), projectId);
      console.log('youtrack types');
      console.log(types);
      this.youTrackIssueTypes.set(types);
      if (types.length > 0) {
        this.stagedIssues.update(issues =>
          issues.map(i => ({ ...i, issueTypeId: i.issueTypeId || types[0].id })),
        );
      }
    } catch (e: unknown) {
      this.snackBar.open(
        `Failed to load "Typ" field: ${e instanceof Error ? e.message : String(e)}`,
        'OK',
        { duration: 6000 },
      );
    } finally {
      this.youTrackIssueTypesLoading.set(false);
    }
  }

  protected setStagedIssueSelected(id: string, selected: boolean): void {
    this.stagedIssues.update(issues => issues.map(i => (i.id === id ? { ...i, selected } : i)));
  }

  protected setStagedIssueType(id: string, issueTypeId: string): void {
    this.stagedIssues.update(issues => issues.map(i => (i.id === id ? { ...i, issueTypeId } : i)));
  }

  protected selectAllIssues(selected: boolean): void {
    this.stagedIssues.update(issues => issues.map(i => ({ ...i, selected })));
  }

  protected async createYouTrackIssues(): Promise<void> {
    const staged = this.stagedIssues();
    if (!staged.some(s => s.selected)) return;
    this.youTrackLoading.set(true);
    this.youTrackResults.set(null);
    try {
      const results = await this.youTrack.createUseCaseIssues(this.youTrackConfig(), staged);
      this.youTrackResults.set(results);
      const ok = results.filter(r => r.success).length;
      this.snackBar.open(`Created ${ok} of ${results.length} issues`, 'OK', { duration: 4000 });
    } catch (e: unknown) {
      this.snackBar.open(
        `YouTrack error: ${e instanceof Error ? e.message : String(e)}`,
        'OK',
        { duration: 6000 },
      );
    } finally {
      this.youTrackLoading.set(false);
    }
  }
}
