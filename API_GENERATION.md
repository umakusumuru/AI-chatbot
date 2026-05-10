# Automatic API Generation System

This repository features an automatic API generation system that creates NestJS modules, controllers, services, and DTOs from JSON configuration files.

## How It Works

### 1. Create API Definition Files

API definitions are stored in `src/api-definitions/` directory as `.api.json` files.

**Directory Structure:**
```
src/
├── api-definitions/
│   ├── chat.api.json          # API definition for chat feature
│   ├── user.api.json          # API definition for user feature
│   └── example.api.template.json  # Template for creating new APIs
├── chat/                       # Auto-generated chat module
├── user/                       # Auto-generated user module
└── ...
```

### 2. API Definition Format

Each `.api.json` file defines a complete API feature:

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

### 3. Generate APIs

Run the API generation script:

```bash
npm run generate:api
```

This script will:
- Scan `src/api-definitions/` for all `.api.json` files
- Generate feature modules, controllers, and services for each
- Create Data Transfer Objects (DTOs) for request bodies
- Output generated files to the respective feature directories

### 4. Update AppModule (One-Time Setup)

After generation, update `src/generated.module.ts` to import your generated modules:

```typescript
import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [ChatModule, UserModule],
  controllers: [],
  providers: []
})
export class GeneratedModule {}
```

The `AppModule` already imports `GeneratedModule`:

```typescript
@Module({
  imports: [GeneratedModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
```

## API Definition Properties

### Top-Level Properties

| Property | Type | Description |
|----------|------|-------------|
| `featureName` | string | Human-readable name of the feature |
| `baseRoute` | string | Base URL route (e.g., `/chat`, `/user`) |
| `moduleClassName` | string | NestJS module class name |
| `controllerClassName` | string | NestJS controller class name |
| `serviceClassName` | string | NestJS service class name |
| `routes` | ApiRoute[] | Array of route definitions |

### Route Properties

| Property | Type | Description |
|----------|------|-------------|
| `method` | string | HTTP method: `get`, `post`, `put`, `delete`, `patch` |
| `path` | string | Route path (e.g., `health`, `:id`) |
| `actionName` | string | Method name in controller/service |
| `summary` | string | Optional description of the endpoint |
| `requestDto` | object | Optional request body DTO definition |
| `responseType` | string | TypeScript type for response |

### DTO Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | DTO class name |
| `properties` | Property[] | Array of property definitions |

### Property Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Property name |
| `type` | string | TypeScript type |
| `required` | boolean | Whether property is required |

## Creating a New API

1. **Create a new file** in `src/api-definitions/` named `{featureName}.api.json`

2. **Use the template** from `example.api.template.json` as a starting point

3. **Define your routes and DTOs**

4. **Run generation**:
   ```bash
   npm run generate:api
   ```

5. **Update `src/generated.module.ts`** to import the new module

6. **Run the app**:
   ```bash
   npm run start:dev
   ```

## Generated File Structure

For each API definition, the following files are generated:

```
src/
├── {baseRoute}/
│   ├── {baseRoute}.module.ts      # NestJS Module
│   ├── {baseRoute}.controller.ts  # NestJS Controller
│   ├── {baseRoute}.service.ts     # NestJS Service
│   └── dto/
│       ├── {DtoName1}.dto.ts      # Request/Response DTOs
│       └── {DtoName2}.dto.ts
```

## Example: Creating a Products API

1. Create `src/api-definitions/product.api.json`:

```json
{
  "featureName": "product",
  "baseRoute": "product",
  "moduleClassName": "ProductModule",
  "controllerClassName": "ProductController",
  "serviceClassName": "ProductService",
  "routes": [
    {
      "method": "get",
      "path": "",
      "actionName": "getAll",
      "summary": "Get all products",
      "responseType": "{ id: string; name: string; price: number }[]"
    },
    {
      "method": "post",
      "path": "create",
      "actionName": "create",
      "summary": "Create a new product",
      "requestDto": {
        "name": "CreateProductDto",
        "properties": [
          { "name": "name", "type": "string", "required": true },
          { "name": "price", "type": "number", "required": true }
        ]
      },
      "responseType": "{ id: string; name: string; price: number }"
    }
  ]
}
```

2. Run generation:
```bash
npm run generate:api
```

3. Update `src/generated.module.ts`:
```typescript
import { ProductModule } from './product/product.module';

@Module({
  imports: [ChatModule, UserModule, ProductModule],
  // ...
})
export class GeneratedModule {}
```

4. Start the server:
```bash
npm run start:dev
```

5. Access the API at `http://localhost:3000/api/product`

## Commands

```bash
# Generate APIs from definitions
npm run generate:api

# Start development server
npm run start:dev

# Build for production
npm run build

# Start production server
npm start
```

## Notes

- All API definitions should follow the JSON schema defined in `src/agent.ts`
- DTOs are automatically generated from route definitions
- Controllers and services contain placeholder implementations
- Modify generated files as needed for your business logic
- Re-running `npm run generate:api` will overwrite generated files

## Tips

- Use descriptive names for features and routes
- Define DTOs clearly with accurate TypeScript types
- Include helpful summaries for each route
- Keep one API definition per `.api.json` file for organization
