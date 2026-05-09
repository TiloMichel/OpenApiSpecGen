# Prompt 22 — YouTrack Issue Linking

## User

In YouTrack it is possible to link issues with each other by REST API. I want the specific code tickets (C# and TypeScript) to be linked to the overview ticket with a "Parent for" link.

## Assistant

After all issues are created, `createUseCaseIssues` now groups the created issues by `operationId` and posts a "Parent for" link from the overview issue to each code issue (C# and TypeScript).

### Service changes — `src/app/services/youtrack.service.ts`

**`createUseCaseIssues` — tracks internal IDs and links after creation**

A second `Map` is built alongside the results array, keyed by `operationId` → `fileType` → YouTrack internal ID (`2-123` style). After all issues are created the map is iterated: for each operation group that has an overview, `linkIssue` is called once per non-overview sibling.

Linking failures are caught and logged as `console.warn` — they do not affect the success/failure result returned to the UI.

```typescript
const internalIds = new Map<string, Map<string, string>>();

// inside the creation loop, on success:
if (!internalIds.has(issue.operationId)) internalIds.set(issue.operationId, new Map());
internalIds.get(issue.operationId)!.set(issue.fileType, created.id);

// after the loop:
for (const byFileType of internalIds.values()) {
  const overviewId = byFileType.get('overview');
  if (!overviewId) continue;
  for (const [fileType, internalId] of byFileType) {
    if (fileType === 'overview') continue;
    try {
      await this.linkIssue(config, overviewId, internalId);
    } catch (e) {
      console.warn(`Failed to link overview ${overviewId} to ${internalId}:`, e);
    }
  }
}
```

**New private method `linkIssue`**

Posts from the overview (parent) to the code issue (child) so YouTrack records the overview as "parent for" the code ticket:

```typescript
private async linkIssue(config: YouTrackConfig, parentId: string, childId: string): Promise<void> {
  await firstValueFrom(
    this.http.post(
      `${this.getApiBase(config)}/api/issues/${parentId}/links`,
      { linkType: { name: 'Parent for' }, issues: [{ id: childId }] },
      { headers: this.buildHeaders(config.token) },
    ),
  );
}
```

The `parentId` / `childId` values are the internal YouTrack IDs (`2-123` form) returned by the create endpoint — not the human-readable `PROJ-1` form.

### Bruno collection additions

**`get-link-types.bru`** — `GET /api/issueLinkTypes?fields=name,sourceToTarget,targetToSource`

Utility request to inspect all link types configured in the YouTrack instance. Use this to verify that `"Parent for"` is the correct link type name; if not, update the `name` value in `linkIssue`.

**`link-issue.bru`** — `POST /api/issues/{{parentIssueId}}/links`

Manual test request for the linking call. `parentIssueId` and `childIssueId` are environment variables set in `environments/local.bru`.

```json
{
  "linkType": { "name": "Parent for" },
  "issues": [{ "id": "{{childIssueId}}" }]
}
```
