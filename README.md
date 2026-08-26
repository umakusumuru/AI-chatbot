# api-generator — Technology-Independent API Generator

Generate production-ready REST, GraphQL, and gRPC APIs for **any framework** from a single JSON definition file.

Write your API once in `.api.json` — the generator outputs native code for NestJS, Express, Spring Boot, ASP.NET Core, FastAPI, or generates GraphQL schemas and gRPC `.proto` files. No NestJS packages land in your Java or .NET project. The generator runs at build time and walks away.

---

## Supported Technologies

| Target (`--target`) | Language | Protocol |
|---|---|---|
| `nestjs` *(default)* | TypeScript | REST |
| `express` | TypeScript | REST |
| `springboot` | Java | REST |
| `aspnet` | C# | REST |
| `fastapi` | Python | REST |
| *(any target)* | TypeScript | `graphql` |
| *(any target)* | Proto + TypeScript | `grpc` |

---

## What Gets Generated

### REST — NestJS (`target: "nestjs"`)
```
src/{feature}/
  {feature}.controller.ts      HTTP route handlers + Swagger decorators
  {feature}.service.ts         Business logic stub (fill in your logic)
  {feature}.module.ts          NestJS module wiring
  dto/{Name}.dto.ts            Validated DTOs (class-validator)
  {feature}.controller.spec.ts Jest unit tests
  {feature}.service.spec.ts    Jest unit tests
```

### REST — ASP.NET Core (`target: "aspnet"`)
```
{feature}/
  Controllers/{Feature}Controller.cs   [ApiController] with Swagger annotations
  Services/I{Feature}Service.cs        Interface
  Services/{Feature}Service.cs         Implementation stub
  DTOs/{Name}.cs                       Data annotations + nullable types
  Program.cs                           DI wiring + Swagger setup
  {feature}-api.csproj                 .NET 8 project file
```

### REST — Spring Boot (`target: "springboot"`)
```
{feature}/src/main/java/com/example/{feature}/
  controller/{Feature}Controller.java  @RestController + SpringDoc annotations
  service/{Feature}Service.java        @Service stub
  dto/{Name}.java                      Jakarta validation annotations
  {Feature}Application.java            @SpringBootApplication entry
  pom.xml                              Maven dependencies
```

### REST — FastAPI (`target: "fastapi"`)
```
{feature}/
  {feature}_router.py    APIRouter with response_model typing
  {feature}_service.py   Service class stub
  {feature}_schema.py    Pydantic BaseModel classes
  main.py                FastAPI app entry point
  requirements.txt       fastapi, uvicorn, pydantic
```

### REST — Express (`target: "express"`)
```
{feature}/
  {feature}.handler.ts   Route handlers + express-validator
  {feature}.router.ts    Express Router registration
  app.ts                 Express app entry point
  package.json           express, express-validator dependencies
```

### GraphQL (`protocol: "graphql"`)
```
{feature}/
  {feature}.schema.graphql   Type, Query, Mutation definitions
  {feature}.resolver.ts      NestJS @Resolver with @Query/@Mutation
  {feature}.model.ts         @ObjectType class
```

### gRPC (`protocol: "grpc"`)
```
{feature}/
  {feature}.proto              Protobuf service + message definitions
  {feature}.grpc.controller.ts NestJS @GrpcMethod controller
  dto/{feature}.grpc.dto.ts   TypeScript interfaces for request types
```

---

## Installation

```bash
npm install
```

### Install globally (use from any project)

```bash
npm run build
npm install -g .
```

Then from any project directory:

```bash
api-generator generate --file=user.api.json --target=aspnet --output=./MyProject
```

### Use without installing (npx)

```bash
npx api-generator generate --file=user.api.json --target=springboot --output=./my-java-app
```

---

## API Definition Format

Create `.api.json` files in `src/api-definitions/`. All fields are the same regardless of target technology.

```json
{
  "featureName": "user",
  "baseRoute": "user",
  "moduleClassName": "UserModule",
  "controllerClassName": "UserController",
  "serviceClassName": "UserService",
  "target": "nestjs",
  "protocol": "rest",
  "routes": [
    {
      "method": "get",
      "path": "",
      "actionName": "getAllUsers",
      "summary": "Fetch all users",
      "responseType": "{ id: string; name: string; email: string }[]"
    },
    {
      "method": "post",
      "path": "create",
      "actionName": "createUser",
      "summary": "Create a new user",
      "requestDto": {
        "name": "CreateUserDto",
        "properties": [
          { "name": "name",  "type": "string", "required": true  },
          { "name": "email", "type": "string", "required": true  },
          { "name": "age",   "type": "number", "required": false }
        ]
      },
      "responseType": "{ id: string; name: string; email: string }"
    },
    {
      "method": "get",
      "path": ":id",
      "actionName": "getUserById",
      "summary": "Get user by ID",
      "responseType": "{ id: string; name: string; email: string }"
    },
    {
      "method": "put",
      "path": ":id",
      "actionName": "updateUser",
      "summary": "Update user by ID",
      "requestDto": {
        "name": "UpdateUserDto",
        "properties": [
          { "name": "name",  "type": "string", "required": false },
          { "name": "email", "type": "string", "required": false }
        ]
      },
      "responseType": "{ id: string; name: string; email: string }"
    },
    {
      "method": "delete",
      "path": ":id",
      "actionName": "deleteUser",
      "summary": "Delete user by ID",
      "responseType": "{ message: string }"
    }
  ]
}
```

### Definition Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `featureName` | string | Yes | Feature name in camelCase (`user`, `empProfile`) |
| `baseRoute` | string | Yes | URL base path (`user` → `/api/user`) |
| `moduleClassName` | string | Yes | Must end with `Module` |
| `controllerClassName` | string | Yes | Must end with `Controller` |
| `serviceClassName` | string | Yes | Must end with `Service` |
| `target` | string | No | Framework target (default: `nestjs`) |
| `protocol` | string | No | API protocol (default: `rest`) |
| `routes` | array | Yes | Route definitions |

### Route Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `method` | string | Yes | `get`, `post`, `put`, `delete`, `patch` |
| `path` | string | Yes | Path segment — use `:id` for path params |
| `actionName` | string | Yes | Method name in camelCase |
| `summary` | string | No | Description for Swagger/OpenAPI docs |
| `requestDto` | object | No | Request body schema (name + properties) |
| `responseType` | string | No | TypeScript-style return type string |
| `vendor` | object | No | Proxy to an external API (see Vendor Routes) |

### DTO Property Types

| `type` value | NestJS | Java | C# | Python |
|---|---|---|---|---|
| `"string"` | `string` | `String` | `string` | `str` |
| `"number"` | `number` | `Integer` | `int` | `int` |
| `"boolean"` | `boolean` | `Boolean` | `bool` | `bool` |
| `"string[]"` | `string[]` | `List<String>` | `List<string>` | `List[str]` |
| nested `properties` | nested class | nested class | nested class | nested BaseModel |

---

## Generate Commands

### NestJS (TypeScript) — Default

```bash
npm run generate:nestjs
```

With a specific file:

```bash
npm run generate:nestjs -- --file=user.api.json
```

### Express (TypeScript)

```bash
npm run generate:express -- --file=user.api.json --output=./my-express-app
```

### Spring Boot (Java)

```bash
npm run generate:springboot -- --file=user.api.json --output=./my-java-project
```

### ASP.NET Core (C#)

```bash
npm run generate:aspnet -- --file=user.api.json --output=./MyDotNetProject
```

### FastAPI (Python)

```bash
npm run generate:fastapi -- --file=user.api.json --output=./my-python-project
```

### GraphQL

```bash
npm run generate:graphql -- --file=user.api.json --output=./src
```

### gRPC

```bash
npm run generate:grpc -- --file=user.api.json --output=./src
```

### All definitions in a directory

```bash
# Generate all .api.json files in src/api-definitions/ for a target
npm run generate:aspnet -- --definitions=./src/api-definitions --output=./MyProject
```

---

## CLI Reference

```bash
api-generator generate [options]
```

| Option | Description | Default |
|---|---|---|
| `--file=<path>` | Single `.api.json` file to generate from | — |
| `--definitions=<path>` | Directory of `.api.json` files | `src/api-definitions` |
| `--output=<path>` | Output directory for generated files | `src` |
| `--target=<framework>` | Override target framework | from definition |
| `--protocol=<protocol>` | Override API protocol | from definition |
| `--help` | Show help message | — |

### CLI Examples

```bash
# NestJS REST (default)
api-generator generate --file=user.api.json

# ASP.NET Core — output into an existing .NET project folder
api-generator generate --file=user.api.json --target=aspnet --output=./MyProject

# Spring Boot — output into a Java project folder
api-generator generate --file=user.api.json --target=springboot --output=./my-java-app

# FastAPI — output into a Python project folder
api-generator generate --file=user.api.json --target=fastapi --output=./my-python-app

# Express.js TypeScript
api-generator generate --file=user.api.json --target=express --output=./my-express-app

# GraphQL schema + NestJS resolver
api-generator generate --file=user.api.json --protocol=graphql --output=./src

# gRPC .proto + NestJS gRPC controller
api-generator generate --file=user.api.json --protocol=grpc --output=./src

# Generate ALL definitions for Spring Boot
api-generator generate --definitions=./api-defs --target=springboot --output=./my-java-app
```

---

## NestJS-Specific Commands

These commands are for the NestJS runtime server that ships with this project.

### Generate NestJS APIs only

```bash
npm run generate:api
```

Single file:

```bash
npm run generate:api -- --file=chat.api.json
```

By feature name:

```bash
npm run generate:api -- --api=emp
```

### Full workflow — Generate, Build, Test, Start, Smoke-test

```bash
npm run generate:api:run
```

This command runs in sequence:

1. Validates all `.api.json` files — reports errors before writing any code
2. Generates NestJS modules, controllers, services, and DTOs
3. Generates Jest unit tests
4. Builds TypeScript
5. Runs Jest unit tests (must pass before continuing)
6. Starts the server on `http://localhost:4000/api`
7. Smoke-tests every generated endpoint

Single feature:

```bash
npm run generate:api:run -- --file=chat.api.json
npm run generate:api:run -- --api=chat
```

Custom paths:

```bash
npm run generate:api:run -- --definitions=./src/api-definitions --output=./src
```

### Generate unit tests only (without regenerating source files)

Use this when you have modified service or controller logic manually and do not want to overwrite it.

```bash
npm run generate:api-tests
```

Single file:

```bash
npm run generate:api-tests -- --file=chat.api.json
```

By source file:

```bash
npm run generate:api-tests -- src/chat/chat.controller.ts
npm run generate:api-tests -- src/chat/chat.service.ts
npm run generate:api-tests -- src/chat
```

By feature name:

```bash
npm run generate:api-tests -- --api=chat
```

---

## AI-Driven Generation (OpenAI)

Instead of templates, use GPT-4o-mini to generate NestJS code from your definitions.

**Set your API key:**

```bash
# Windows CMD
set OPENAI_API_KEY=your_key_here

# Windows PowerShell
$env:OPENAI_API_KEY="your_key_here"

# macOS / Linux
export OPENAI_API_KEY=your_key_here
```

**Generate with AI:**

```bash
npm run generate:api:geminii
```

**Full workflow with AI:**

```bash
set USE_GEMINII=true
npm run generate:api:run
```

| Method | Pros | Cons |
|---|---|---|
| Template (default) | Fast, consistent, no API key | Fixed templates |
| AI-driven | Handles complex descriptions, flexible | Requires API key, results may vary |

---

## Start the NestJS Server

Development (hot reload):

```bash
npm run start:dev
```

Production:

```bash
npm run build
npm start
```

Swagger UI is available at:

```
http://localhost:3000/api-docs
```

---

## Unit Tests

Generated APIs include Jest unit tests for all controllers and services.

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Single feature
npx jest src/chat
npx jest src/user/user.service.spec.ts
```

Tests validate:
- All routes return defined responses
- Required fields throw `400 Bad Request` when missing
- Path-param routes throw `404 Not Found` for invalid IDs

---

## API Definition Validation

The generator validates every `.api.json` before writing any code. Errors reported include:

- Missing required fields (`featureName`, `baseRoute`, `moduleClassName`, etc.)
- Class names not following conventions (`Module`, `Controller`, `Service` suffixes)
- Invalid HTTP method (must be `get`, `post`, `put`, `delete`, `patch`)
- Missing or duplicate `actionName` within a file
- Malformed `requestDto` properties (missing `name` or `type`)
- Malformed `vendor` block (missing `url`, wrong `headers` type)
- Invalid JSON syntax

Example error output:

```
❌ API definition validation failed:

  chat.api.json
    • routes[1].method: must be one of [get, post, put, delete, patch], got "fetch"
    • routes[1].requestDto.properties[0].type: required non-empty string, got undefined
```

The command exits immediately — no files are generated until all definitions are clean.

---

## Sample Definition Files

Ready-to-use sample definitions are in `src/api-definitions/`. Each one targets a different technology but describes the same User CRUD API.

| File | Target | Protocol | Use this to generate |
|---|---|---|---|
| [`user.api.json`](src/api-definitions/user.api.json) | `nestjs` | `rest` | NestJS controller + service + DTOs |
| [`user-express.api.json`](src/api-definitions/user-express.api.json) | `express` | `rest` | Express Router + handlers + DTOs |
| [`user-springboot.api.json`](src/api-definitions/user-springboot.api.json) | `springboot` | `rest` | Spring Boot controller + service + Maven |
| [`user-aspnet.api.json`](src/api-definitions/user-aspnet.api.json) | `aspnet` | `rest` | ASP.NET Core controller + service + C# DTOs |
| [`user-fastapi.api.json`](src/api-definitions/user-fastapi.api.json) | `fastapi` | `rest` | FastAPI router + Pydantic models + requirements |
| [`user-graphql.api.json`](src/api-definitions/user-graphql.api.json) | `nestjs` | `graphql` | GraphQL schema + NestJS resolver + ObjectType |
| [`user-grpc.api.json`](src/api-definitions/user-grpc.api.json) | `nestjs` | `grpc` | `.proto` file + NestJS gRPC controller |

### Key difference between files — only `target` and `protocol` change

```json
// user.api.json          → NestJS REST
{ "target": "nestjs",     "protocol": "rest" }

// user-express.api.json  → Express.js REST
{ "target": "express",    "protocol": "rest" }

// user-springboot.api.json → Spring Boot REST
{ "target": "springboot", "protocol": "rest" }

// user-aspnet.api.json   → ASP.NET Core REST
{ "target": "aspnet",     "protocol": "rest" }

// user-fastapi.api.json  → FastAPI REST
{ "target": "fastapi",    "protocol": "rest" }

// user-graphql.api.json  → GraphQL
{ "target": "nestjs",     "protocol": "graphql" }

// user-grpc.api.json     → gRPC
{ "target": "nestjs",     "protocol": "grpc" }
```

Routes, DTOs, and field definitions are identical across all files — only the target changes.

### Try them

```bash
# Generate the Express sample
npm run generate:express -- --file=src/api-definitions/user-express.api.json --output=./generated

# Generate the Spring Boot sample
npm run generate:springboot -- --file=src/api-definitions/user-springboot.api.json --output=./generated

# Generate the ASP.NET Core sample
npm run generate:aspnet -- --file=src/api-definitions/user-aspnet.api.json --output=./generated

# Generate the FastAPI sample
npm run generate:fastapi -- --file=src/api-definitions/user-fastapi.api.json --output=./generated

# Generate the GraphQL sample
npm run generate:graphql -- --file=src/api-definitions/user-graphql.api.json --output=./generated

# Generate the gRPC sample
npm run generate:grpc -- --file=src/api-definitions/user-grpc.api.json --output=./generated
```

---

## Vendor / Proxy Routes

Call external APIs directly from generated routes by adding a `vendor` block.

```json
{
  "method": "post",
  "path": "translate",
  "actionName": "translateText",
  "summary": "Proxy to translation vendor",
  "requestDto": {
    "name": "TranslateDto",
    "properties": [
      { "name": "text", "type": "string", "required": true },
      { "name": "lang", "type": "string", "required": false }
    ]
  },
  "responseType": "any",
  "vendor": {
    "url": "https://api.vendor.com/v1/translate",
    "method": "post",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer {{body.apiKey}}"
    },
    "mapRequest": {
      "text": "{{body.text}}",
      "lang": "{{body.lang}}"
    },
    "mapResponse": {
      "translated": "{{vendorResponse.translatedText}}"
    }
  }
}
```

- `{{body.fieldName}}` — substitutes request body values into URL, headers, or request body
- `mapRequest` — reshapes the outgoing request to the vendor format
- `mapResponse` — reshapes the vendor response before returning it to the caller
- Set `VENDOR_MOCK=true` to bypass real HTTP calls during testing

---

## Use as a Package in Another Project

Install as a dev dependency:

```bash
npm install --save-dev api-generator
```

Place `.api.json` definitions in your project:

```
<your-project>/src/api-definitions/user.api.json
```

Run generation:

```bash
# NestJS
npx api-generator generate --definitions=./src/api-definitions --output=./src

# ASP.NET Core
npx api-generator generate --definitions=./src/api-definitions --target=aspnet --output=./Controllers

# Spring Boot
npx api-generator generate --definitions=./src/api-definitions --target=springboot --output=./src/main/java
```

### Programmatic API

```ts
import {
  generateApiFromFile,
  generateApisFromDirectory,
  createAgentApiFiles,
  writeGeneratedModuleFile,
  TargetFramework,
  ApiProtocol,
} from 'api-generator';

// Generate one file with target override
const description = await generateApiFromFile('./user.api.json', './src');

// Patch target at runtime
description.target = 'aspnet';
await createAgentApiFiles(description, './MyProject');

// Generate all definitions in a directory
await generateApisFromDirectory('./src/api-definitions', './src');
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server listen port | `3000` |
| `OPENAI_API_KEY` | Required for AI-driven generation | — |
| `USE_GEMINII` | Set `true` to enable OpenAI generation | `false` |
| `VENDOR_MOCK` | Set `true` to bypass vendor HTTP calls | `false` |

---

## Code Formatting

```bash
npm run format      # Prettier
npm run lint:fix    # ESLint auto-fix
```

When Prettier and ESLint are installed locally, generation automatically formats and lints generated files.

---

## Project Structure

```
src/
  agent.ts                    Core generation engine + exported types
  cli.ts                      CLI entrypoint (api-generator command)
  geminii.ts                  OpenAI GPT-4o-mini integration
  main.ts                     NestJS server bootstrap
  targets/
    express.generator.ts      Express.js generator
    springboot.generator.ts   Spring Boot generator
    aspnet.generator.ts       ASP.NET Core generator
    fastapi.generator.ts      FastAPI generator
    graphql.generator.ts      GraphQL schema + resolver generator
    grpc.generator.ts         gRPC .proto + controller generator
  api-definitions/
    chat.api.json             Chat — NestJS REST (live module)
    user.api.json             User — NestJS REST (live module)
    emp.api.json              Employee — NestJS REST (live module)
    vendor.api.json           Vendor proxy — NestJS REST (live module)
    test.api.json             Test — NestJS REST (live module)
    user-express.api.json     User — Express.js sample
    user-springboot.api.json  User — Spring Boot (Java) sample
    user-aspnet.api.json      User — ASP.NET Core (C#) sample
    user-fastapi.api.json     User — FastAPI (Python) sample
    user-graphql.api.json     User — GraphQL schema + resolver sample
    user-grpc.api.json        User — gRPC .proto + service sample
  chat/                       Generated NestJS chat module
  user/                       Generated NestJS user module
  emp/                        Generated NestJS employee module
  vendor/                     Generated NestJS vendor proxy module
  filters/
    http-exception.filter.ts  Global exception handler
scripts/
  generate-api.ts             Generate APIs from definitions
  generate-build-test.ts      Full workflow script
  generate-api-tests.ts       Regenerate test files only
  generate-swagger.ts         Export Swagger JSON
```

---

## All npm Scripts

| Script | Description |
|---|---|
| `npm run generate:api` | Generate NestJS APIs from all definitions |
| `npm run generate:api:run` | Full workflow: validate → generate → build → test → start → smoke-test |
| `npm run generate:api:geminii` | AI-driven NestJS generation (requires `OPENAI_API_KEY`) |
| `npm run generate:api-tests` | Regenerate unit tests only (safe when source is modified) |
| `npm run generate:nestjs` | Generate NestJS via CLI |
| `npm run generate:express` | Generate Express.js TypeScript via CLI |
| `npm run generate:springboot` | Generate Spring Boot Java via CLI |
| `npm run generate:aspnet` | Generate ASP.NET Core C# via CLI |
| `npm run generate:fastapi` | Generate FastAPI Python via CLI |
| `npm run generate:graphql` | Generate GraphQL schema + resolver via CLI |
| `npm run generate:grpc` | Generate gRPC .proto + service via CLI |
| `npm run generate:swagger` | Export Swagger JSON to file |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Start production server |
| `npm run start:dev` | Start development server with hot reload |
| `npm test` | Run all Jest unit tests |
| `npm run test:watch` | Run Jest in watch mode |
| `npm run format` | Format all files with Prettier |
| `npm run lint:fix` | Fix ESLint issues automatically |

---

## Swagger / API Documentation Per Technology

Every generated REST target ships with API documentation out of the box.

| Technology | Library | Swagger URL | OpenAPI JSON |
|---|---|---|---|
| **NestJS** | `@nestjs/swagger` + `swagger-ui-express` | `/api-docs` | `/api-json` |
| **Express** | `swagger-ui-express` (spec generated at build time) | `/api-docs` | `/api-docs.json` |
| **Spring Boot** | `springdoc-openapi-starter-webmvc-ui` | `/swagger-ui.html` | `/v3/api-docs` |
| **ASP.NET Core** | `Swashbuckle.AspNetCore` + Annotations | `/swagger` | `/swagger/v1/swagger.json` |
| **FastAPI** | Built-in (no extra package needed) | `/docs` and `/redoc` | `/openapi.json` |
| **GraphQL** | GraphQL Playground (introspection) | `/graphql` | SDL schema file |
| **gRPC** | `.proto` file is the contract | `grpcui` tool | `.proto` file |

### How Swagger is set up per technology

**NestJS** — decorators generated on every route:
```ts
@ApiOperation({ summary: 'Create a new user' })
@ApiResponse({ status: 200, description: 'Successful response.' })
@ApiBadRequestResponse({ description: 'Invalid request.' })
@ApiBody({ type: CreateUserDto })
```

**Express** — full OpenAPI 3.0 spec generated at build time into `swagger.ts`, served via `swagger-ui-express`:
```ts
// swagger.ts — auto-generated, contains complete OpenAPI spec
export const swaggerSpec = { openapi: '3.0.3', info: { ... }, paths: { ... }, components: { ... } };

// app.ts
app.use('/api-docs', swaggerRouter);        // Swagger UI
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec)); // Raw JSON
```

**Spring Boot** — annotations on every controller method:
```java
@Operation(summary = "Create a new user")
@ApiResponse(responseCode = "200", description = "Successful response")
@Tag(name = "user", description = "user API")
```
`springdoc-openapi` reads these at startup and serves Swagger UI automatically.

**ASP.NET Core** — Swashbuckle annotations + `Program.cs` wiring:
```csharp
[SwaggerOperation(Summary = "Create a new user")]
[ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status400BadRequest)]

// Program.cs
builder.Services.AddSwaggerGen(c => c.EnableAnnotations());
app.UseSwagger();
app.UseSwaggerUI();
```

**FastAPI** — zero setup; FastAPI reads Pydantic models and route decorators automatically:
```python
@router.post("/create", response_model=UserResponse, summary="Create a new user")
async def create_user(body: CreateUserDto):
    ...
# Swagger UI at /docs and ReDoc at /redoc are live immediately
```

---

## Notes

- Generated services contain stub logic — replace with real business logic.
- `src/generated.module.ts` is updated automatically on every NestJS generation run.
- For NestJS generation, `--file` or `--api` scopes Jest runs to that feature only.
- The `target` and `protocol` fields in `.api.json` are overridden by `--target` and `--protocol` CLI flags.
- For non-NestJS targets, only the generated source files are written — no `generated.module.ts` update occurs.
