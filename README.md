# api-generator

Generate production-ready REST, GraphQL, and gRPC APIs for any framework from a single JSON definition file.

Write your API once in `.api.json` — the generator outputs native code for NestJS, Express, Spring Boot, ASP.NET Core, or FastAPI. No framework packages land in a project that doesn't need them. The generator runs at build time and walks away.

---

## Supported Technologies

| `--target` | Language | Protocol |
|---|---|---|
| `nestjs` *(default)* | TypeScript | REST |
| `express` | TypeScript | REST |
| `springboot` | Java | REST |
| `aspnet` | C# | REST |
| `fastapi` | Python | REST |
| *(any)* | TypeScript | `graphql` |
| *(any)* | TypeScript + Proto | `grpc` |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Generate a NestJS API from a definition file
npm run generate:nestjs -- --file=src/api-definitions/emp.api.json

# 3. Start the server
npm run start:dev
```

Swagger UI: `http://localhost:3000/api-docs`

---

## Installation

### Local (this project)

```bash
npm install
```

### Global (use `api-generator` from any directory)

```bash
npm run build
npm install -g .
```

### Without installing (npx)

```bash
npx api-generator generate --file=user.api.json --target=springboot --output=./my-java-app
```

---

## API Definition Format

Create `.api.json` files in `src/api-definitions/`.

```json
{
  "featureName": "emp",
  "baseRoute": "emp",
  "moduleClassName": "EmpModule",
  "controllerClassName": "EmpController",
  "serviceClassName": "EmpService",
  "target": "nestjs",
  "protocol": "rest",
  "outputMode": "folder",
  "routes": [
    {
      "method": "get",
      "path": "getemp",
      "actionName": "getEmp",
      "summary": "Returns employee information",
      "responseType": "{ id: string; name: string; email: string }"
    },
    {
      "method": "post",
      "path": "updateemp",
      "actionName": "updateEmp",
      "summary": "Updates employee information",
      "requestDto": {
        "name": "UpdateEmpDto",
        "properties": [
          { "name": "name",  "type": "string", "required": true },
          { "name": "email", "type": "string", "required": false }
        ]
      },
      "responseType": "{ reply: string }"
    }
  ]
}
```

### Top-Level Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `featureName` | string | Yes | camelCase feature name (`emp`, `userProfile`) |
| `baseRoute` | string | Yes | URL base path — `emp` → `/emp` |
| `moduleClassName` | string | Yes | Must end with `Module` |
| `controllerClassName` | string | Yes | Must end with `Controller` |
| `serviceClassName` | string | Yes | Must end with `Service` |
| `target` | string | No | Framework target (default: `nestjs`) |
| `protocol` | string | No | API protocol (default: `rest`) |
| `outputMode` | string | No | `"folder"` (default) or `"path"` — controls where files are placed |
| `outputPaths` | object | No | Custom output directories (only used when `outputMode` is `"path"`) |
| `routes` | array | Yes | Array of route definitions |

### Route Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `method` | string | Yes | `get`, `post`, `put`, `delete`, `patch` |
| `path` | string | Yes | Path segment — use `:id` for path params |
| `actionName` | string | Yes | Method name in camelCase |
| `summary` | string | No | Description shown in Swagger/OpenAPI |
| `requestDto` | object | No | Request body schema (name + properties array) |
| `responseType` | string | No | TypeScript-style return type |
| `vendor` | object | No | Proxy to an external API |

### DTO Property Types

| `type` | NestJS/Express | Spring Boot | ASP.NET | FastAPI |
|---|---|---|---|---|
| `"string"` | `string` | `String` | `string` | `str` |
| `"number"` | `number` | `Integer` | `int` | `int` |
| `"boolean"` | `boolean` | `Boolean` | `bool` | `bool` |
| `"string[]"` | `string[]` | `List<String>` | `List<string>` | `List[str]` |
| nested `properties` | nested class | nested class | nested class | nested BaseModel |

---

## Output Modes (NestJS only)

### Folder Mode (default)

All features share common category directories under the output root. This is the default — no extra config needed.

**Definition:**
```json
{ "outputMode": "folder" }
```

**Output structure:**
```
src/
  controllers/
    emp.controller.ts
    user.controller.ts
  services/
    emp.service.ts
    user.service.ts
  modules/
    emp.module.ts
    user.module.ts
  dto/
    UpdateEmpDto.dto.ts
    CreateUserDto.dto.ts
  spec/
    emp.controller.spec.ts
    emp.service.spec.ts
```

### Path Mode

Specify exact output directories per file type. Any key you omit falls back to the folder-mode default. All internal import paths are computed automatically.

**Definition:**
```json
{
  "outputMode": "path",
  "outputPaths": {
    "controller": "src/api/v1/controllers",
    "service":    "src/core/services",
    "module":     "src/modules",
    "dto":        "src/shared/dto",
    "spec":       "tests/unit"
  }
}
```

**Output structure:**
```
src/
  api/v1/controllers/
    emp.controller.ts
  core/services/
    emp.service.ts
  modules/
    emp.module.ts
  shared/dto/
    UpdateEmpDto.dto.ts
tests/unit/
  emp.controller.spec.ts
  emp.service.spec.ts
```

---

## What Gets Generated

### NestJS (`target: "nestjs"`, `protocol: "rest"`)

```
src/controllers/<feature>.controller.ts    HTTP handlers + Swagger decorators
src/services/<feature>.service.ts          Business logic stub
src/modules/<feature>.module.ts            NestJS module wiring
src/dto/<DtoName>.dto.ts                   Validated DTO class (class-validator)
src/spec/<feature>.controller.spec.ts      Jest unit test
src/spec/<feature>.service.spec.ts         Jest unit test
src/generated.module.ts                    Auto-updated hub module (all features)
```

### Express (`target: "express"`)

```
<feature>/
  <feature>.handler.ts          Route handlers + express-validator
  <feature>.router.ts           Express Router registration
  <feature>.vendor.service.ts   External API proxy
  <feature>.handler.spec.ts     Supertest integration tests
  swagger.ts                    Auto-generated OpenAPI 3.0 spec
  app.ts                        Express app entry point
  package.json                  express, express-validator, swagger-ui-express
  jest.config.json / vitest.config.ts
```

### Spring Boot (`target: "springboot"`)

```
<feature>/src/main/java/com/example/<feature>/
  controller/<Feature>Controller.java    @RestController + SpringDoc
  service/<Feature>Service.java          @Service stub
  dto/<Name>.java                        Jakarta validation annotations
  vendor/<Feature>VendorService.java     External API proxy
  <Feature>Application.java             @SpringBootApplication entry
  pom.xml                               Spring Boot + springdoc-openapi Maven deps
<feature>/src/test/java/com/example/<feature>/
  controller/<Feature>ControllerTest.java
  service/<Feature>ServiceTest.java
```

### ASP.NET Core (`target: "aspnet"`)

```
<feature>/
  Controllers/<Feature>Controller.cs    [ApiController] + Swashbuckle annotations
  Services/I<Feature>Service.cs         Interface
  Services/<Feature>Service.cs          Implementation stub
  DTOs/<Name>.cs                        Data annotations + nullable types
  Program.cs                            DI wiring + Swagger setup
  <feature>-api.csproj                  .NET 8 project file
```

### FastAPI (`target: "fastapi"`)

```
<feature>/
  <feature>_router.py    APIRouter with response_model typing
  <feature>_service.py   Service class stub
  <feature>_schema.py    Pydantic BaseModel classes
  main.py                FastAPI app entry point
  requirements.txt       fastapi, uvicorn, pydantic
```

### GraphQL (`protocol: "graphql"`)

```
<feature>/
  <feature>.schema.graphql   Type, Query, Mutation definitions
  <feature>.resolver.ts      NestJS @Resolver with @Query / @Mutation
  <feature>.model.ts         @ObjectType class
```

### gRPC (`protocol: "grpc"`)

```
<feature>/
  <feature>.proto              Protobuf service + message definitions
  <feature>.grpc.controller.ts NestJS @GrpcMethod controller
  dto/<feature>.grpc.dto.ts    TypeScript interfaces for request types
```

---

## Generate Commands

### NestJS — all definitions

```bash
npm run generate:api
```

### NestJS — single file

```bash
npm run generate:api -- --file=src/api-definitions/emp.api.json
```

### NestJS — by feature name

```bash
npm run generate:api -- --api=emp
```

### NestJS — custom output directory

```bash
npm run generate:nestjs -- --file=src/api-definitions/emp.api.json --output=./src
```

### Express

```bash
npm run generate:express -- --file=src/api-definitions/user-express.api.json --output=./my-express-app
```

### Spring Boot

```bash
npm run generate:springboot -- --file=src/api-definitions/user-springboot.api.json --output=./my-java-project
```

### ASP.NET Core

```bash
npm run generate:aspnet -- --file=src/api-definitions/user-aspnet.api.json --output=./MyDotNetProject
```

### FastAPI

```bash
npm run generate:fastapi -- --file=api-definitions/user-fastapi.api.json --output=./my-python-project
```

### GraphQL

```bash
npm run generate:graphql -- --file=src/api-definitions/user-graphql.api.json --output=./src
```

### gRPC

```bash
npm run generate:grpc -- --file=src/api-definitions/user-grpc.api.json --output=./src
```

### All definitions in a directory

```bash
npm run generate:aspnet -- --definitions=./src/api-definitions --output=./MyProject
npm run generate:springboot -- --definitions=./src/api-definitions --output=./my-java-app
```

---

## Full Workflow (NestJS)

Generate → Build → Test → Start → Smoke-test in one command:

```bash
npm run generate:api:run
```

Single feature:

```bash
npm run generate:api:run -- --file=src/api-definitions/emp.api.json
npm run generate:api:run -- --api=emp
```

**What it does in order:**

1. Validates all `.api.json` files — reports errors, writes no code if any fail
2. Generates controllers, services, modules, DTOs, and spec files
3. Builds TypeScript (`tsc`)
4. Runs Jest unit tests — stops if any fail
5. Starts the server on `http://localhost:4000/api`
6. Smoke-tests every generated route with an HTTP request

---

## Unit Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Single feature (spec folder)
npx jest src/spec/emp

# Single spec file
npx jest src/spec/emp.service.spec.ts
```

### Regenerate test files only

Use this when you have manually modified controller or service logic and do not want to overwrite it:

```bash
npm run generate:api-tests

# Single file
npm run generate:api-tests -- --file=src/api-definitions/emp.api.json

# By feature name
npm run generate:api-tests -- --api=emp
```

Tests validate:
- All routes return defined responses
- Required fields throw `400 Bad Request` when missing
- Path-param routes throw `404 Not Found` for ID `"0"`

---

## CLI Reference

```bash
api-generator generate [options]
```

| Option | Description | Default |
|---|---|---|
| `--file=<path>` | Single `.api.json` file to generate from | — |
| `--definitions=<dir>` | Directory containing `.api.json` files | `src/api-definitions` |
| `--output=<dir>` | Output root directory for generated files | `src` |
| `--target=<framework>` | Override target framework from definition | from definition |
| `--protocol=<protocol>` | Override API protocol from definition | from definition |
| `--help` | Show help | — |

### CLI Examples

```bash
# NestJS REST (reads target from definition)
api-generator generate --file=src/api-definitions/emp.api.json

# NestJS REST — override output directory
api-generator generate --file=src/api-definitions/emp.api.json --output=./src

# Spring Boot — override target
api-generator generate --file=src/api-definitions/user.api.json --target=springboot --output=./my-java-app

# ASP.NET Core
api-generator generate --file=api-definitions/product.api.json --target=aspnet --output=./aspnet-product-sample

# FastAPI
api-generator generate --file=api-definitions/product.api.json --target=fastapi --output=./python-fast-api

# Express
api-generator generate --file=src/api-definitions/user.api.json --target=express --output=./my-express-app

# GraphQL schema + NestJS resolver
api-generator generate --file=src/api-definitions/user.api.json --protocol=graphql --output=./src

# gRPC .proto + NestJS controller
api-generator generate --file=src/api-definitions/user.api.json --protocol=grpc --output=./src

# Generate all definitions in a directory for Spring Boot
api-generator generate --definitions=./src/api-definitions --target=springboot --output=./my-java-app
```

---

## Start the NestJS Server

```bash
# Development (hot reload)
npm run start:dev

# Production
npm run build
npm start
```

| URL | Description |
|---|---|
| `http://localhost:3000/api-docs` | Swagger UI |
| `http://localhost:3000/api-json` | OpenAPI JSON spec |

---

## AI-Driven Generation (OpenAI)

Use GPT-4o-mini instead of templates to generate NestJS code:

```bash
# Windows PowerShell
$env:OPENAI_API_KEY="your_key_here"

# Windows CMD
set OPENAI_API_KEY=your_key_here

# macOS / Linux
export OPENAI_API_KEY=your_key_here
```

```bash
# Generate with AI
npm run generate:api:geminii

# Full workflow with AI
$env:USE_GEMINII="true"
npm run generate:api:run
```

---

## Vendor / Proxy Routes

Call external APIs directly from generated routes by adding a `vendor` block to any route:

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

| Placeholder | Resolves to |
|---|---|
| `{{body.fieldName}}` | Value from the incoming request body |
| `{{vendorResponse.field}}` | Value from the vendor's response |

Set `VENDOR_MOCK=true` to bypass real HTTP calls during tests.

---

## API Definition Validation

Every `.api.json` is validated before any code is written. Errors include:

- Missing required top-level fields (`featureName`, `baseRoute`, etc.)
- Class names not following suffix conventions (`Module`, `Controller`, `Service`)
- Invalid HTTP method (must be one of `get`, `post`, `put`, `delete`, `patch`)
- Duplicate or missing `actionName` within a file
- Malformed `requestDto` properties (missing `name` or `type`)
- Invalid `vendor` block (missing `url`, wrong `headers` type)
- Invalid JSON syntax

Example output:

```
❌ API definition validation failed:

  emp.api.json
    • routes[1].method: must be one of [get, post, put, delete, patch], got "fetch"
    • routes[1].requestDto.properties[0].type: required non-empty string, got undefined
```

The command exits immediately — no files are generated until all definitions pass.

---

## Use as a Package in Another Project

```bash
npm install --save-dev api-generator
```

Place your definition files anywhere in the consuming project:

```
<your-project>/src/api-definitions/emp.api.json
```

Run generation:

```bash
# NestJS — folder mode (default)
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
} from 'api-generator';

// Generate a single file
const description = await generateApiFromFile('./src/api-definitions/emp.api.json', './src');

// Override target at runtime
description.target = 'aspnet';
await createAgentApiFiles(description, './MyProject');

// Generate all definitions in a directory
await generateApisFromDirectory('./src/api-definitions', './src');
```

---

## Swagger / OpenAPI Documentation

Every REST target ships with API documentation out of the box.

| Technology | URL |
|---|---|
| NestJS | `http://localhost:3000/api-docs` |
| Express | `http://localhost:3000/api-docs` |
| Spring Boot | `http://localhost:8080/swagger-ui.html` |
| ASP.NET Core | `http://localhost:5000/swagger` |
| FastAPI | `http://localhost:8000/docs` |
| GraphQL | `http://localhost:3000/graphql` |

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server listen port | `3000` |
| `OPENAI_API_KEY` | Required for AI-driven generation | — |
| `USE_GEMINII` | Set `true` to enable AI generation | `false` |
| `VENDOR_MOCK` | Set `true` to skip vendor HTTP calls | `false` |

---

## All npm Scripts

| Script | What it does |
|---|---|
| `npm run generate:api` | Generate NestJS APIs from all definitions in `src/api-definitions/` |
| `npm run generate:api:run` | Full workflow: validate → generate → build → test → start → smoke-test |
| `npm run generate:api:geminii` | AI-driven NestJS generation (requires `OPENAI_API_KEY`) |
| `npm run generate:api-tests` | Regenerate spec files only — does not overwrite source files |
| `npm run generate:nestjs` | NestJS via CLI |
| `npm run generate:express` | Express TypeScript via CLI |
| `npm run generate:springboot` | Spring Boot Java via CLI |
| `npm run generate:aspnet` | ASP.NET Core C# via CLI |
| `npm run generate:fastapi` | FastAPI Python via CLI |
| `npm run generate:graphql` | GraphQL schema + NestJS resolver via CLI |
| `npm run generate:grpc` | gRPC `.proto` + NestJS controller via CLI |
| `npm run generate:swagger` | Export Swagger JSON to file |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Start production server |
| `npm run start:dev` | Start development server with hot reload |
| `npm test` | Run all Jest unit tests |
| `npm run test:watch` | Run Jest in watch mode |
| `npm run format` | Format all files with Prettier |
| `npm run lint:fix` | Auto-fix ESLint issues |

---

## Project Structure

```
src/
  agent.ts                    Core generation engine + exported TypeScript types
  cli.ts                      CLI entry point (api-generator command)
  geminii.ts                  OpenAI GPT-4o-mini integration
  main.ts                     NestJS server bootstrap
  generated.module.ts         Auto-updated hub module (imports all generated NestJS modules)
  targets/
    express.generator.ts      Express.js generator
    springboot.generator.ts   Spring Boot generator
    aspnet.generator.ts       ASP.NET Core generator
    fastapi.generator.ts      FastAPI generator
    graphql.generator.ts      GraphQL schema + resolver generator
    grpc.generator.ts         gRPC .proto + controller generator
    versions.config.ts        Pinned dependency versions for all generators
  api-definitions/
    emp.api.json              Employee — NestJS REST
    user.api.json             User — NestJS REST
    chat.api.json             Chat — NestJS REST
    vendor.api.json           Vendor proxy — NestJS REST
    test.api.json             Test — NestJS REST
    user-express.api.json     User — Express.js sample
    user-springboot.api.json  User — Spring Boot sample
    user-aspnet.api.json      User — ASP.NET Core sample
    user-fastapi.api.json     User — FastAPI sample
    user-graphql.api.json     User — GraphQL sample
    user-grpc.api.json        User — gRPC sample
  controllers/                Generated NestJS controllers (all features)
  services/                   Generated NestJS services (all features)
  modules/                    Generated NestJS modules (all features)
  dto/                        Generated DTO classes (all features)
  spec/                       Generated Jest spec files (all features)
  filters/
    http-exception.filter.ts  Global HTTP exception handler
scripts/
  generate-api.ts             Generate APIs from definitions
  generate-build-test.ts      Full workflow script
  generate-api-tests.ts       Regenerate spec files only
  generate-swagger.ts         Export Swagger JSON
```

---

## Notes

- Generated service files contain stub logic — replace with real business logic.
- `src/generated.module.ts` is updated automatically on every NestJS generation run to import all generated modules.
- The `target` and `protocol` fields in `.api.json` are overridden by `--target` and `--protocol` CLI flags when provided.
- `outputMode` and `outputPaths` only apply to NestJS generation — other frameworks use fixed project layouts.
- For non-NestJS targets, `generated.module.ts` is not updated.
- Set `VENDOR_MOCK=true` in tests to skip real HTTP calls in vendor proxy routes.
