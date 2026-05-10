# AI-chatbot

A configuration-driven NestJS backend scaffold that generates API modules, controllers, services, and DTOs from JSON definitions.

## Features

- Generate APIs automatically from `src/api-definitions/*.api.json`
- Auto-create NestJS feature modules, controllers, services, and DTOs
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

### Gemini/OpenAI-driven generation

Use Gemini-style generation with OpenAI by setting your API key and running:

```bash
set OPENAI_API_KEY=your_key_here
npm run generate:api:geminii
```

This command reads API definitions from `src/api-definitions/` and uses `openai` to generate NestJS feature modules, controllers, services, and DTO files.

## Build, Run, and Test

To generate APIs, build the project, start the compiled app, and validate generated endpoints in one command:

```bash
npm run generate:api:run
```

By default, this uses script-based generation. To use AI-driven generation with OpenAI:

```bash
set OPENAI_API_KEY=your_key_here
set USE_GEMINII=true
npm run generate:api:run
```

The command:

1. scans API definition files
2. generates code for each API (script or AI-based)
3. compiles TypeScript output
4. starts the built server on `http://localhost:4000/api`
5. sends test requests to generated routes

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
set OPENAI_API_KEY=your_openai_api_key_here

# Generate APIs using AI
npm run generate:api:geminii

# Or run the full workflow with AI generation
set USE_GEMINII=true
npm run generate:api:run
```

### Comparison

| Method | Pros | Cons |
|--------|------|------|
| Script-Based | Fast, consistent, no API key needed | Limited to predefined templates |
| AI-Driven | Creative, handles complex logic, flexible | Requires API key, may vary results |

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

## Notes

- Add new API definitions in `src/api-definitions/`.
- Run `npm run generate:api` or `npm run generate:api:run` to regenerate APIs.
- `src/generated.module.ts` is automatically updated with generated feature modules.
- Generated services return placeholder sample data; replace with real business logic as needed.
