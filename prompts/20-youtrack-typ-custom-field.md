# Prompt 20 — YouTrack "Typ" Custom Field

## User

The Issue Type field is not working because i didnt give clear instructions how to use it. The Issue Type is a user defined field in YouTrack. In YouTrack it is called Typ and it has a list of enums. This should be used to select the issue type. The Typ should be loaded when the user uses the Load Projects button.

## Assistant

The previous implementation used YouTrack's built-in issue type endpoint (`/issueTypes`) and the built-in `type` field on the issue body. The correct approach is to read the user-defined enum field named "Typ" from the project's custom fields, and set it via `customFields` when creating an issue.

### Service changes — `src/app/services/youtrack.service.ts`

**New local interface `CustomFieldResponse`**

Typed representation of the `/customFields` API response, used only within the service:

```typescript
interface CustomFieldResponse {
  id: string;
  field?: { id: string; name: string };
  bundle?: { values: YouTrackIssueType[] };
}
```

**`getIssueTypes` — endpoint and parsing changed**

Old endpoint (built-in types, returned nothing useful):
```
GET /api/admin/projects/{projectId}/issueTypes?fields=id,name
```

New endpoint (project custom fields, parsed for "Typ"):
```
GET /api/admin/projects/{projectId}/customFields?fields=id,field(id,name),bundle(values(id,name))
```

The response is filtered for the entry where `field.name === 'Typ'`, and its `bundle.values` are returned as `YouTrackIssueType[]`. If the field is not found, an empty array is returned.

**`createIssue` — body changed from `type` to `customFields`**

Old (built-in type field):
```typescript
body['type'] = { id: issueTypeId };
```

New (custom enum field "Typ"):
```typescript
body['customFields'] = [{
  '$type': 'SingleEnumIssueCustomField',
  'name': 'Typ',
  'value': { '$type': 'EnumBundleElement', 'id': issueTypeId },
}];
```

### App changes — `src/app/app.ts`

The Typ values are now loaded as part of the "Load Projects" button click rather than only when a project is selected, so the Issue Type column is populated immediately after the project list appears.

**Extracted `private loadYouTrackIssueTypes(projectId)`**

The issue-types loading logic was moved out of `onYouTrackProjectChange` into a private helper so it can be called from two places:

```typescript
private async loadYouTrackIssueTypes(projectId: string): Promise<void> {
  this.youTrackIssueTypes.set([]);
  this.youTrackIssueTypesLoading.set(true);
  try {
    const types = await this.youTrack.getIssueTypes(this.youTrackConfig(), projectId);
    this.youTrackIssueTypes.set(types);
    if (types.length > 0) {
      this.stagedIssues.update(issues =>
        issues.map(i => ({ ...i, issueTypeId: i.issueTypeId || types[0].id }))
      );
    }
  } catch (e: unknown) {
    this.snackBar.open(`Failed to load "Typ" field: …`, 'OK', { duration: 6000 });
  } finally {
    this.youTrackIssueTypesLoading.set(false);
  }
}
```

**`loadYouTrackProjects` — also loads Typ values**

After the project list is fetched, `loadYouTrackIssueTypes` is called with the currently selected project ID (from `youTrackConfig().projectId`) or, if none is set, with the first project in the returned list:

```typescript
const projectId = this.youTrackConfig().projectId || projects[0]?.id;
if (projectId) {
  await this.loadYouTrackIssueTypes(projectId);
}
```

**`onYouTrackProjectChange` — simplified**

Now just updates the config and delegates to the shared helper:
```typescript
async onYouTrackProjectChange(projectId: string): Promise<void> {
  this.setYouTrackConfig('projectId', projectId);
  await this.loadYouTrackIssueTypes(projectId);
}
```
