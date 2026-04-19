# Prompt 01 — Initial Request

**Date:** 2026-04-19

## User Prompt

> Please record all prompts i do in this project in a markdown file per prompt plus your answer. I want to create an angular app which translates an open api specification to Data Transfer Objects in c# and typescript classes and endpoints which use that classes. The Angular app should have a user interface where the user can upload and download and openapi specification as yaml or json. There should be a button to generate from specification to the c# and typescript classes. Additionally i want a http service in typescript and a controller in c#. If you need clarity ask questions please.

## My Response

I asked the following clarifying questions before starting:

1. **Backend**: Should the Angular app do all generation client-side (in the browser), or do you want a backend API (e.g., .NET or Node) that does the heavy lifting?
2. **C# style**: Do you prefer records (`public record FooDto(...)`) or classes with properties? Nullable annotations (`string?`)?
3. **TypeScript style**: Interfaces or classes? `PascalCase` or `camelCase` for property names?
4. **Controller style**: Minimal API (`.MapGet(...)`) or MVC-style (`[ApiController]` with `[HttpGet]`)?
5. **HTTP service**: Angular `HttpClient`-based service with typed methods per endpoint?
6. **Scope of generation**: Should it handle all OpenAPI features or a practical subset to start?
