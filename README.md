# AI-chatbot

A configuration-driven NestJS backend scaffold that generates API modules, controllers, services, and DTOs from JSON definitions.

## Features

- Generate APIs automatically from `src/api-definitions/*.api.json`
- Auto-create NestJS feature modules, controllers, services, and DTOs
- **Swagger/OpenAPI documentation** with error scenarios automatically generated
- Run a full workflow that generates, builds, starts, and tests the application
- Uses sample test data in generated services for quick verification

## Setup

Install project dependencies:

```bash
npm install
```

## API Generation

Create or update API definition files in `src/api-definitions/` using the `.api.json` format.

Example definition file structure:

```json
{
  "featureName": "chat",
  "baseRoute": "chat",
  "moduleClassName": "ChatModule",
  "controllerClassName": "ChatController",
  "serviceClassName": "ChatService",
  "routes": [
    {
      "method": "get",
      "path": "health",
      "actionName": "getHealth",
      "summary": "Returns API health status",
      "responseType": "{ status: string; message: string }"
    },
    {
      "method": "post",
      "path": "message",
      "actionName": "sendMessage",
      "summary": "Sends a chat message and returns a response",
      "requestDto": {
        "name": "SendMessageDto",
        "properties": [
          { "name": "message", "type": "string", "required": true },
          { "name": "sessionId", "type": "string", "required": false }
        ]
      },
      "responseType": "{ reply: string }"
    }
  ]
}
```

## Generate APIs

Run the API generation script:

```bash
npm run generate:api
```

This will scan `src/api-definitions/`, create feature folders, and generate the NestJS files.

Generate a single API definition file instead of all definitions:

```bash
npm run generate:api -- --file=chat.api.json
```

Or use the feature name directly:

```bash
npm run generate:api -- --api=chat
```

Specify the output path and definitions path when generating from another repo or from a different directory layout:

```bash
npm run generate:api -- --definitions=./src/api-definitions --output=./generated-api
```

This will generate files into `./generated-api` and read definitions from `./src/api-definitions`.

If you install this generator as a package in another project, place your `.api.json` definitions in that project under:

```bash
<project-root>/src/api-definitions/
```

Or use a custom definitions folder by passing `--definitions`:

```bash
npm run generate:api -- --definitions=./my-api-definitions --output=./generated-api
```

For a single API file and a custom output folder:

```bash
npm run generate:api -- --file=chat.api.json --definitions=./src/api-definitions --output=./generated-api
```

This will generate only `chat.api.json` and update `./generated-api/generated.module.ts`.

### Gemini/OpenAI-driven generation

Use Gemini-style generation with OpenAI by setting your API key and running:

```bash
set OPENAI_API_KEY=your_key_here
npm run generate:api:geminii
```

This command reads API definitions from `src/api-definitions/` and uses `openai` to generate NestJS feature modules, controllers, services, and DTO files.

## Build, Run, and Test

To generate APIs with automatic unit test cases, build the project, validate tests, start the app, and test endpoints in one command:

```bash
npm run generate:api:run
```

This command automatically:

1. Generates API modules, controllers, and services
2. Generates Jest unit test files (`.controller.spec.ts` and `.service.spec.ts`)
3. Builds the TypeScript project
4. **Runs all Jest unit tests** (must pass before continuing)
5. Starts the built server on `http://localhost:4000/api`
6. Validates generated API endpoints

When Prettier and ESLint are installed locally, generated files are also formatted and linted automatically during generation.

If any unit tests fail, the command stops and reports errors without starting the server.

### Individual Command Options

Run the full workflow for a single API definition:

```bash
npm run generate:api:run -- --file=chat.api.json
```

Or use the feature name directly:

```bash
npm run generate:api:run -- --api=chat
```

Specify paths for custom layouts:

```bash
npm run generate:api:run -- --definitions=./src/api-definitions --output=./generated-api
```

For a single API definition with custom paths:

```bash
npm run generate:api:run -- --file=chat.api.json --definitions=./src/api-definitions --output=./src/api
```

By default, this uses script-based generation. To use AI-driven generation with OpenAI:

```bash
set OPENAI_API_KEY=your_key_here
set USE_GEMINII=true
npm run generate:api:run
```

### Just Generate APIs (Without Tests/Build)

If you only want to generate API files without building or testing:

```bash
npm run generate:api
```

### ESLint / Prettier

This project supports ESLint and Prettier for generated files.

Install the dev dependencies first:

```bash
npm install --save-dev prettier eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

Then run formatting and linting manually:

```bash
npm run format
npm run lint:fix
```

When these tools are installed locally, generation will also attempt to format and lint generated files automatically.

## Testing Both Generation Methods

You can test the API generation using either script-based or AI-driven methods. Both approaches generate the same structure but use different generation logic.

### Option 1: Script-Based Generation (Default)

This uses template-based code generation for consistent, predictable results:

```bash
# Generate APIs using scripts
npm run generate:api

# Or run the full workflow (generate, build, run, test)
npm run generate:api:run
```

### Option 2: AI-Driven Generation (OpenAI)

This uses OpenAI's GPT model to generate more creative or complex code based on your API descriptions:

```bash
# Set your OpenAI API key
set OPENAI_API_KEY=<YOUR_OPENAI_API_KEY_HERE>


$env:OPENAI_API_KEY="<YOUR_OPENAI_API_KEY_HERE>"
npm run generate:api:geminii


# Generate APIs using AI
npm run generate:api:geminii

# Or run the full workflow with AI generation
set USE_GEMINII=true
npm run generate:api:run
```

### Comparison

| Method       | Pros                                      | Cons                               |
| ------------ | ----------------------------------------- | ---------------------------------- |
| Script-Based | Fast, consistent, no API key needed       | Limited to predefined templates    |
| AI-Driven    | Creative, handles complex logic, flexible | Requires API key, may vary results |

Both methods produce fully functional NestJS APIs with Observables, automatic module registration, and test endpoints.

Start development server:

```bash
npm run start:dev
```

Start production build:

```bash
npm run build
npm start
```

## Unit Testing

Generated APIs include automatic Jest unit tests for controllers and services. Tests validate:

- Basic operation of all routes
- Bad request errors for missing required fields
- Not found errors for routes with path parameters

### Run all tests

```bash
npm test
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Run tests for a specific API

```bash
npx jest src/chat/chat.service.spec.ts
npx jest src/chat/chat.controller.spec.ts
```

Unit tests are generated automatically in each feature directory:

- `src/{feature}/{feature}.service.spec.ts`
- `src/{feature}/{feature}.controller.spec.ts`

When you run `npm run generate:api:run`, Jest tests are executed and must pass before the server starts.

## Notes

- Add new API definitions in `src/api-definitions/`.
- Run `npm run generate:api` or `npm run generate:api:run` to regenerate APIs.
- `src/generated.module.ts` is automatically updated with generated feature modules.
- Generated services return placeholder sample data; replace with real business logic as needed.

## Vendor / Third-Party Proxy Routes

You can call external/vendor APIs directly from generated routes by adding a `vendor` block to a route in your `.api.json` file. Example (see `src/api-definitions/vendor.api.json`):

```json
"vendor": {
  "url": "https://api.vendor.com/v1/translate",
  "method": "post",
  "headers": { "Content-Type": "application/json", "Authorization": "Bearer {{body.apiKey}}" },
  "mapRequest": { "text": "{{body.text}}", "lang": "{{body.lang}}" },
  "mapResponse": { "translated": "{{vendorResponse.translatedText}}" }
}
```

Notes:

- The generator will emit code that templates `url`, `headers`, and `mapRequest` using `{{...}}` placeholders.
- `mapResponse` (optional) lets you reshape the vendor response before returning it from your API.
- The generated services use the global `fetch` API; on Node versions older than v18, install a fetch polyfill such as `node-fetch`.
