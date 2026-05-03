# Prompt 19 — YouTrack Issue Grid & Per-File Issues

## User

Please change the YouTrack issue generation so that for each of the three use case files (markdown, C# and TypeScript) an issue is generated. The Project ID should be a select box and the selectable options should be queried by a REST call to the URL. Also please add that the issues to be generated are displayed in a data grid and can be selected and unselected before creating issues. Also the issue type should be queried from the REST API and should be selectable for each issue.

## Assistant

Rewrote the YouTrack integration from one combined issue per operation to one issue per file, added API-driven project and issue-type selects, and replaced the plain form with a pre-flight data grid.

### New model interfaces — `src/app/models/openapi.model.ts`

Three interfaces added after `YouTrackIssueResult`:

- **`YouTrackProject`** — `id`, `name`, `shortName` (returned by the projects API)
- **`YouTrackIssueType`** — `id`, `name` (returned per-project from the issue-types API)
- **`YouTrackStagedIssue`** — one row in the pre-flight grid:
  - `id` — `"{operationId}:{fileType}"` — used as change key and `@for` track
  - `operationId`, `fileType: 'overview' | 'csharp' | 'typescript'`
  - `summary` — e.g. `[Use Case] Get Pets — C#`
  - `description` — the raw file content
  - `selected: boolean`, `issueTypeId: string`

### Service rewrite — `src/app/services/youtrack.service.ts`

Old `groupFiles` / `buildDescription` logic removed. New public methods:

**`getProjects(config)`**
```
GET {base}/api/admin/projects?fields=id,name,shortName
```
Returns `YouTrackProject[]`.

**`getIssueTypes(config, projectId)`**
```
GET {base}/api/admin/projects/{projectId}/issueTypes?fields=id,name
```
Returns `YouTrackIssueType[]`.

**`buildStagedIssues(useCaseFiles)`**

Converts the flat `GeneratedFile[]` into `YouTrackStagedIssue[]` — one entry per file. Filename prefix determines `fileType`; the `# Title` heading is extracted for the summary; type label (` — C#` / ` — TypeScript`) is appended for non-overview files.

**`createUseCaseIssues(config, staged)`**

Iterates only `staged.filter(s => s.selected)`. Each issue is POSTed to `/api/issues?fields=id,idReadable,webUrl` with body:
```json
{ "summary": "...", "description": "...", "project": { "id": "..." }, "type": { "id": "..." } }
```
The `type` field is omitted when `issueTypeId` is empty. Failures are caught per-issue so one error does not abort the rest.

A shared `buildHeaders(token)` helper was extracted to avoid repeating the `Authorization` / `Content-Type` / `Accept` header object across the three HTTP calls.

### App state — `src/app/app.ts`

New imports: `MatSelectModule`, `MatTableModule`, `YouTrackProject`, `YouTrackIssueType`, `YouTrackStagedIssue`.

New signals:

| Signal | Type | Purpose |
|---|---|---|
| `youTrackProjects` | `YouTrackProject[]` | Loaded project list for the select |
| `youTrackIssueTypes` | `YouTrackIssueType[]` | Loaded types for the selected project |
| `youTrackProjectsLoading` | `boolean` | Spinner state on the Load button |
| `youTrackIssueTypesLoading` | `boolean` | Hint text below the project select |
| `stagedIssues` | `YouTrackStagedIssue[]` | Pre-flight grid rows |

New computed signals: `allIssuesSelected`, `someIssuesSelected` (drives header checkbox indeterminate state), `selectedIssueCount`.

`readonly stagedIssueColumns = ['select', 'operation', 'file', 'summary', 'issueType']` drives `mat-table`.

`generate()` now rebuilds `stagedIssues` after generation; if issue types are already loaded (project was selected before re-generating) the first type is pre-applied to all rows.

New methods:

- `loadYouTrackProjects()` — calls service, populates `youTrackProjects`
- `onYouTrackProjectChange(projectId)` — updates config, loads issue types, pre-fills `issueTypeId` on all staged rows that have none
- `setStagedIssueSelected(id, selected)` / `setStagedIssueType(id, typeId)` — immutable signal updates by id
- `selectAllIssues(selected)` — bulk select / deselect

`createYouTrackIssues()` now passes `stagedIssues()` to the service instead of the raw file list.

### UI — `src/app/app.html`

YouTrack card layout:

1. **URL + Token row** — unchanged
2. **Project row** — `mat-select` fed from `youTrackProjects()`; disabled until projects are loaded; shows a hint with the loaded issue-type count (or "Loading issue types…"). Adjacent "Load Projects" `mat-stroked-button` with spinner — enabled only when URL and token are non-empty.
3. **Proxy toggle** — unchanged
4. **Staged issues grid** (shown when `stagedIssues().length > 0`):
   - Toolbar: `"N of M issues selected"` label + Select All / Deselect All buttons
   - `mat-table` with columns: checkbox (header checkbox drives `allIssuesSelected` + `someIssuesSelected`), operation (monospace), file-type badge, summary, issue-type `mat-select` per row (pre-filled from loaded types; disabled until a project is selected)
   - Deselected rows styled with `row-deselected` (40 % opacity)
5. **Create button** — label shows `Create N Issue(s) in YouTrack`; disabled when no issues are selected or project is unset

### Styles — `src/app/app.scss`

New blocks inside `.youtrack-card`:

- `.youtrack-project-row` — flex row for the project select + load button
- `.staged-issues-section` — wraps the toolbar and table
- `.staged-issues-table` — `min-width: 620px` with `overflow-x: auto` wrapper for narrow viewports; `.file-type-badge` uses Material semantic container tokens (`--mat-sys-primary-container`, `--mat-sys-secondary-container`, `--mat-sys-tertiary-container`) so badges adapt to light/dark theme; `.issue-type-field` fixed at 150 px
