# Prompt 21 — Bruno Collection for YouTrack API

## User

I want the integration test now to be in the Bruno software as different requests. Can you create a file for me?

## Assistant

Created a Bruno API collection at `bruno/youtrack/` covering the three HTTP calls made by `YouTrackService`.

### Files created

```
bruno/
└── youtrack/
    ├── bruno.json                  Collection manifest
    ├── environments/
    │   └── local.bru               Environment variables (baseUrl, token, projectId)
    ├── get-projects.bru            GET /api/admin/projects
    ├── get-issue-types.bru         GET /api/admin/projects/{{projectId}}/customFields
    └── create-issue.bru            POST /api/issues
```

### Requests

**Get Projects** (`get-projects.bru`)

```
GET {{baseUrl}}/api/admin/projects?fields=id,name,shortName
Authorization: Bearer {{token}}
```

Returns all projects with `id`, `name`, and `shortName`.

**Get Issue Types** (`get-issue-types.bru`)

```
GET {{baseUrl}}/api/admin/projects/{{projectId}}/customFields?fields=id,field(id,name),bundle(values(id,name))
Authorization: Bearer {{token}}
```

Returns all custom fields for the project. The "Typ" field entry contains the `bundle.values` array used to populate the issue type selector.

**Create Issue** (`create-issue.bru`)

```
POST {{baseUrl}}/api/issues?fields=id,idReadable,webUrl
Authorization: Bearer {{token}}
Content-Type: application/json
```

Body:
```json
{
  "summary": "[Test] Sample issue — safe to delete",
  "description": "Created via Bruno. Please delete.",
  "project": { "id": "{{projectId}}" },
  "customFields": [{
    "$type": "SingleEnumIssueCustomField",
    "name": "Typ",
    "value": { "$type": "EnumBundleElement", "id": "your-issue-type-id-here" }
  }]
}
```

The `$type` values are required by YouTrack's polymorphic REST API. `issueTypeId` must be copied from a "Get Issue Types" response.

### Environment (`environments/local.bru`)

| Variable   | Description                                   |
|------------|-----------------------------------------------|
| `baseUrl`  | YouTrack base URL, e.g. `http://127.0.0.1:8080` |
| `token`    | Permanent token (`perm:...`) — marked secret  |
| `projectId`| Internal project ID, e.g. `00-01`             |

`token` is declared in `vars:secret` so Bruno does not commit it to the environment file.

### How to open

Bruno → **Open Collection** → select `bruno/youtrack/`, then activate the `local` environment and enter your token in the environment editor.
