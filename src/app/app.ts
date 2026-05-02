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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as jsYaml from 'js-yaml';
import { CodeGeneratorService } from './services/code-generator.service';
import { FileDownloadService } from './services/file-download.service';
import { YouTrackService } from './services/youtrack.service';
import type { GenerationOptions, GenerationResult, YouTrackConfig, YouTrackIssueResult } from './models/openapi.model';
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
    MatProgressSpinnerModule,
    SpecEditorComponent,
    CodeEditorComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private generator = inject(CodeGeneratorService);
  private downloader = inject(FileDownloadService);
  private youTrack = inject(YouTrackService);
  private snackBar = inject(MatSnackBar);

  darkMode = signal<boolean>(
    localStorage.getItem('darkMode') !== null
      ? localStorage.getItem('darkMode') === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  constructor() {
    effect(() => {
      const dark = this.darkMode();
      document.body.classList.toggle('dark', dark);
      document.body.classList.toggle('light', !dark);
      localStorage.setItem('darkMode', dark ? 'dark' : 'light');
    });
  }

  toggleDarkMode(): void {
    this.darkMode.update(v => !v);
  }

  specContent = signal<string>('');
  specFilename = signal<string>('spec.yaml');
  result = signal<GenerationResult | null>(null);
  isDragOver = signal<boolean>(false);

  options = signal<GenerationOptions>({
    includeCsharpDtos: true,
    includeCsharpControllers: true,
    includeTypescriptSchemas: true,
    includeTypescriptServices: true,
    splitFiles: true,
    includeUseCaseDocs: false,
  });

  selectedDtoFile = signal(0);
  selectedControllerFile = signal(0);
  selectedSchemaFile = signal(0);
  selectedServiceFile = signal(0);
  selectedUseCaseFile = signal(0);

  youTrackConfig = signal<YouTrackConfig>({
    url: localStorage.getItem('youtrackUrl') ?? '',
    token: '',
    projectId: localStorage.getItem('youtrackProjectId') ?? '',
    useProxy: localStorage.getItem('youtrackUseProxy') === 'true',
  });
  youTrackResults = signal<YouTrackIssueResult[] | null>(null);
  youTrackLoading = signal(false);

  useCaseCount = computed(() =>
    (this.result()?.useCaseFiles ?? []).filter(f => !f.filename.includes('/')).length
  );

  hasAnyOption = computed(() => {
    const o = this.options();
    return o.includeCsharpDtos || o.includeCsharpControllers || o.includeTypescriptSchemas || o.includeTypescriptServices || o.includeUseCaseDocs;
  });

  setOption<K extends keyof GenerationOptions>(key: K, value: GenerationOptions[K]): void {
    this.options.update(o => ({ ...o, [key]: value }));
    this.result.set(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.loadFile(file);
    input.value = '';
  }

  onSpecContentChange(content: string): void {
    this.specContent.set(content);
    this.result.set(null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(): void {
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
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

  generate(): void {
    try {
      this.result.set(this.generator.generate(this.specContent(), this.options()));
      this.selectedDtoFile.set(0);
      this.selectedControllerFile.set(0);
      this.selectedSchemaFile.set(0);
      this.selectedServiceFile.set(0);
      this.selectedUseCaseFile.set(0);
      this.snackBar.open('Code generated successfully!', 'OK', { duration: 3000 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.snackBar.open(`Error: ${msg}`, 'OK', { duration: 6000 });
    }
  }

  downloadSpec(): void {
    this.downloader.downloadText(this.specContent(), this.specFilename());
  }

  downloadFile(content: string, filename: string): void {
    this.downloader.downloadText(content, filename);
  }

  async downloadAll(): Promise<void> {
    const result = this.result();
    if (!result) return;
    await this.downloader.downloadZip(result, this.specContent(), this.specFilename());
  }

  updateResultFile(
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

  copyToClipboard(content: string): void {
    navigator.clipboard.writeText(content).then(
      () => this.snackBar.open('Copied!', 'OK', { duration: 2000 }),
    );
  }

  loadExample(): void {
    this.specContent.set(this.formatSpec(EXAMPLE_SPEC, 'example.yaml'));
    this.specFilename.set('example.yaml');
    this.result.set(null);
    this.snackBar.open('Example spec loaded', 'OK', { duration: 2000 });
  }

  setYouTrackConfig<K extends keyof YouTrackConfig>(key: K, value: YouTrackConfig[K]): void {
    this.youTrackConfig.update(c => {
      if (key === 'url') localStorage.setItem('youtrackUrl', value as string);
      if (key === 'projectId') localStorage.setItem('youtrackProjectId', value as string);
      if (key === 'useProxy') localStorage.setItem('youtrackUseProxy', String(value));
      return { ...c, [key]: value };
    });
  }

  async createYouTrackIssues(): Promise<void> {
    const files = this.result()?.useCaseFiles;
    if (!files?.length) return;
    this.youTrackLoading.set(true);
    this.youTrackResults.set(null);
    try {
      const results = await this.youTrack.createUseCaseIssues(this.youTrackConfig(), files);
      this.youTrackResults.set(results);
      const ok = results.filter(r => r.success).length;
      this.snackBar.open(`Created ${ok} of ${results.length} issues`, 'OK', { duration: 4000 });
    } catch (e: unknown) {
      this.snackBar.open(`YouTrack error: ${e instanceof Error ? e.message : String(e)}`, 'OK', { duration: 6000 });
    } finally {
      this.youTrackLoading.set(false);
    }
  }
}
