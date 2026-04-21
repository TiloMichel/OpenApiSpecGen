# Prompt 15 — Docker Test Container

## User
add the capability to run the tests in a separate docker container similar to the current docker setup please

## Assistant
Added a `test` stage to the existing `Dockerfile` and a new GitHub Actions workflow that builds and runs it.

### `Dockerfile`
Added a `test` stage (stage 2) between the existing `builder` and `serve` stages:
- Based directly on `node:22-alpine` (not derived from `builder`, so the test image stays lean and independent of the production build output)
- Installs dependencies with `npm ci`, copies the full source tree
- Default command: `npx ng test --watch=false` — runs all Vitest specs once and exits with the appropriate exit code

The production `serve` stage is unchanged and renumbered to stage 3.

To build and run tests locally:
```bash
docker build --target test -t openapi-gen-test .
docker run --rm openapi-gen-test
```

### `.github/workflows/test.yml`
New workflow `Tests` that runs on every push and pull-request to `main`:
1. **Build test image** — `docker build --target test -t openapi-gen-test .`
2. **Run tests** — `docker run --rm openapi-gen-test` (non-zero exit code from `ng test` fails the job)

The existing `docker-image.yml` workflow is unchanged — it continues to build and tag the production image independently.
