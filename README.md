# C# and Typescript with Zod OpenAPI Spec Generator

Angular App with UI to generate code. The openapi schema is transformed to controllers, services and DTOs for C# backend (Record DTOs, MVC-Controllers) and Typescript with [zod](https://github.com/colinhacks/zod) DTOs and angular http-service.

Vibecoded with [claude.ai](https://claude.ai/)
See the prompts [in the prompts directory](prompts)

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.7.

## Docker

**Build and run:**

```bash
docker build -t openapi-gen .
```

```bash
docker run -p 8080:80 openapi-gen
```

App available at <http://localhost:8080>

**Test**
Test with docker

```bash
docker build --target test -t openapi-gen-test .
```

```bash
docker run --rm openapi-gen-test
```

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
