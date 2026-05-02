# Prompt 17 — YouTrack Integration

## User

Thanks claude, i now want to add the possibility for the use cases to be added as an issue to a youtrack system with the youtrack rest api. For each use case file and the corresponding code files there should be created a issue with the content of the markdown file. The user authorizes with permament token authorization there should be an input field for the api key. Also the url of the youtrack system should be provided by the user with an input file. Write a documentation in the prompts directory for me please

## Assistant

Added a YouTrack integration card that appears whenever use-case documentation has been generated. One issue is created per operation by combining the overview, C# and TypeScript files into a single Markdown description.

### New file: `src/app/models/openapi.model.ts` additions

Two new interfaces added before the generation options:

- **`YouTrackConfig`** — `url: string`, `token: string`, `projectId: string`
- **`YouTrackIssueResult`** — per-operation outcome: `operationId`, `title`, `success`, optional `issueId`, `issueUrl`, `error`

### New file: `src/app/services/youtrack.service.ts`

Injectable service that uses Angular `HttpClient` (already provided via `provideHttpClient()` in `app.config.ts`).

**`createUseCaseIssues(config, useCaseFiles)`** — public entry point:

1. Groups the flat `GeneratedFile[]` into per-operation buckets (`overview`, `csharp`, `typescript`) by matching filename prefixes
2. Iterates groups sequentially, calling `createIssue` for each
3. Returns `YouTrackIssueResult[]` — failures are caught per-issue so one error does not abort the rest

**`createIssue(config, summary, description)`** — private:

- `POST {url}/api/issues?fields=id,idReadable,webUrl`
- `Authorization: Bearer {token}` header
- Body: `{ summary, description, project: { id: projectId } }`
- Uses `firstValueFrom` to bridge the `HttpClient` Observable to `async/await`

**`buildDescription(group)`** — concatenates all three files separated by `---` horizontal rules, producing a single Markdown document per issue.

**`errorMessage(e)`** — normalises `HttpErrorResponse` (extracts `error_description` from the body if present) and plain `Error` objects into a display string.

**Note on CORS:** The YouTrack REST API is called directly from the browser. YouTrack Cloud allows cross-origin requests by default. Self-hosted instances may require enabling CORS in the YouTrack server configuration.

### Modified files

**`src/app/app.ts`**

New Material imports: `MatFormFieldModule`, `MatInputModule`, `MatProgressSpinnerModule` — added to both the import statements and the component `imports` array.

New signals:

- `youTrackConfig` — `Signal<YouTrackConfig>`, initialised from `localStorage` for `url` and `projectId` (token is never persisted for security)
- `youTrackResults` — `Signal<YouTrackIssueResult[] | null>`
- `youTrackLoading` — `Signal<boolean>`
- `useCaseCount` — `computed` counting overview files (no `/` in filename) from `result.useCaseFiles`

New methods:

- `setYouTrackConfig(key, value)` — updates the config signal; persists `url` and `projectId` to `localStorage`
- `createYouTrackIssues()` — sets loading state, calls the service, updates results signal, shows a snackbar summary

**`src/app/app.html`**

New `YouTrack Integration` card rendered when `useCaseCount() > 0`:

- Three `mat-form-field` inputs with `appearance="outline"`: YouTrack URL (wider flex), Permanent Token (password type, hint "Not stored between sessions"), Project ID (hint "Project short name, e.g. MYPROJ")
- `Create Issues in YouTrack` button — disabled while loading or if any field is empty; shows a `mat-spinner` while `youTrackLoading()` is true (icon and label text split into separate nodes to avoid Angular content-projection warning with `@if/@else` inside a button)
- Results section (shown after a run): a row per operation with a `check_circle` or `error` icon; successes link to the created issue via `issueUrl`; failures show the error message inline

**`src/app/app.scss`**

New `.youtrack-card` block with:

- `.youtrack-form` flex row that wraps on small screens; `.youtrack-field--url` takes double flex weight
- `.youtrack-results` flex column; `.youtrack-result` rows with icon + text, coloured by `--mat-sys-primary` (success) or `--mat-sys-error` (failure)
- `.btn-spinner` inline-block alignment for the loading spinner inside the button
