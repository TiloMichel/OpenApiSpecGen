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
import { CodeGeneratorService } from './services/code-generator.service';
import { FileDownloadService } from './services/file-download.service';
import type { GenerationOptions, GenerationResult } from './models/openapi.model';
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
    SpecEditorComponent,
    CodeEditorComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private generator = inject(CodeGeneratorService);
  private downloader = inject(FileDownloadService);
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
  });

  selectedDtoFile = signal(0);
  selectedControllerFile = signal(0);
  selectedSchemaFile = signal(0);
  selectedServiceFile = signal(0);

  hasAnyOption = computed(() => {
    const o = this.options();
    return o.includeCsharpDtos || o.includeCsharpControllers || o.includeTypescriptSchemas || o.includeTypescriptServices;
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
      this.specContent.set(reader.result as string);
      this.specFilename.set(file.name);
      this.result.set(null);
      this.snackBar.open(`Loaded: ${file.name}`, 'OK', { duration: 3000 });
    };
    reader.readAsText(file);
  }

  generate(): void {
    try {
      this.result.set(this.generator.generate(this.specContent(), this.options()));
      this.selectedDtoFile.set(0);
      this.selectedControllerFile.set(0);
      this.selectedSchemaFile.set(0);
      this.selectedServiceFile.set(0);
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
    key: 'csharpDtoFiles' | 'csharpControllerFiles' | 'typescriptSchemaFiles' | 'typescriptServiceFiles',
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
    this.specContent.set(EXAMPLE_SPEC);
    this.specFilename.set('example.yaml');
    this.result.set(null);
    this.snackBar.open('Example spec loaded', 'OK', { duration: 2000 });
  }
}
