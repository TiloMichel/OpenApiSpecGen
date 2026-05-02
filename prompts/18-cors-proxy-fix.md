# Prompt 18 — CORS Proxy Fix

## User

I get the following error when trying to create the issues:

```
(index):1 Access to XMLHttpRequest at 'http://127.0.0.1:8080/api/issues?fields=id,idReadable,webUrl'
from origin 'http://localhost:8080' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

Can you help me with that?

## Assistant

The browser's same-origin policy blocks cross-origin XHR when the YouTrack server does not send an `Access-Control-Allow-Origin` response header. Self-hosted YouTrack instances do not emit this header for arbitrary origins by default.

The solution routes all YouTrack API calls through a same-origin proxy path (`/youtrack-proxy/`) so the browser never sees a cross-origin request. The YouTrack server URL is configured once at startup via the `YOUTRACK_URL` environment variable rather than at runtime, keeping the proxy target stable.

### New file: `proxy.conf.js`

Angular CLI dev-server proxy configuration:

```js
const YOUTRACK_URL = process.env['YOUTRACK_URL'] || 'http://localhost:8080';

module.exports = [{
  context: ['/youtrack-proxy'],
  target: YOUTRACK_URL,
  secure: false,
  changeOrigin: true,
  pathRewrite: { '^/youtrack-proxy': '' },
  logLevel: 'warn',
}];
```

Usage: `YOUTRACK_URL=http://127.0.0.1:8080 ng serve`

### Modified files

**`angular.json`**

Added `proxyConfig` to the `serve` architect target so the Angular CLI picks up the file:

```json
"serve": {
  "options": { "proxyConfig": "proxy.conf.js" },
  ...
}
```

**`nginx.conf`**

Added a `/youtrack-proxy/` location inside the server block that forwards requests to the YouTrack host at container runtime. The `${YOUTRACK_URL}` placeholder is substituted by `envsubst` on container start:

```nginx
location /youtrack-proxy/ {
  proxy_pass ${YOUTRACK_URL}/;
  proxy_set_header Host             $proxy_host;
  proxy_set_header X-Real-IP        $remote_addr;
  proxy_set_header Authorization    $http_authorization;
  proxy_pass_header Authorization;
}
```

The `Authorization` header must be forwarded explicitly because nginx strips it by default.

**`Dockerfile`** (serve stage)

Switched from a static `nginx.conf` copy to a template-based approach: the file is copied as `nginx.conf.template` and `envsubst` renders it at container start:

```dockerfile
COPY nginx.conf /etc/nginx/nginx.conf.template
EXPOSE 80
ENV YOUTRACK_URL="http://127.0.0.1:8080"
CMD ["/bin/sh", "-c", "envsubst '${YOUTRACK_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]
```

The default `YOUTRACK_URL` points to a no-op address so nginx starts cleanly even without the variable set.

Usage: `docker run -e YOUTRACK_URL=http://127.0.0.1:8080 -p 80:80 openapi-spec-gen`

**`src/app/models/openapi.model.ts`**

Added `useProxy: boolean` to `YouTrackConfig`:

```typescript
export interface YouTrackConfig {
  url: string;
  token: string;
  projectId: string;
  useProxy: boolean;
}
```

**`src/app/services/youtrack.service.ts`**

Added `getApiBase()` that returns `/youtrack-proxy` when `useProxy` is on, or strips a trailing slash from the user-entered URL otherwise:

```typescript
private getApiBase(config: YouTrackConfig): string {
  return config.useProxy ? '/youtrack-proxy' : config.url.replace(/\/$/, '');
}
```

`createIssue` now calls `this.getApiBase(config)` instead of using `config.url` directly.

**`src/app/app.ts`**

- Default `youTrackConfig` signal reads `localStorage.getItem('youtrackUseProxy') === 'true'` for the initial value
- `setYouTrackConfig` persists `useProxy` via `localStorage.setItem('youtrackUseProxy', String(value))`

**`src/app/app.html`**

A `mat-slide-toggle` added below the three form fields in the YouTrack card:

```html
<mat-slide-toggle
  [checked]="youTrackConfig().useProxy"
  (change)="setYouTrackConfig('useProxy', $event.checked)">
  Route via proxy (<code>/youtrack-proxy</code>)
</mat-slide-toggle>
```

Accompanied by a hint paragraph explaining how to set `YOUTRACK_URL` for both `ng serve` and `docker run`.

**`src/app/app.scss`**

New `.youtrack-proxy-toggle` and `.youtrack-proxy-hint` blocks inside `.youtrack-card` style the toggle and its explanatory text, including inline `<code>` chip styling using `--mat-sys-surface-variant`.
