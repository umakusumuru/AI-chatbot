## Quick Start Guide - Auto API Generation

### 📋 Workflow

1. **Create API Definition**
   ```bash
   # Create a new file in src/api-definitions/yourfeature.api.json
   ```

2. **Define Routes and DTOs**
   - See `example.api.template.json` for structure
   - Use proper HTTP methods and TypeScript types

3. **Generate APIs**
   ```bash
   npm run generate:api
   ```

4. **Import Module**
   - Add your module to `src/generated.module.ts` imports

5. **Run Server**
   ```bash
   npm run start:dev
   ```

### 📂 File Locations

- **API Definitions**: `src/api-definitions/*.api.json`
- **Generated Modules**: `src/{baseRoute}/`
- **Generated DTOs**: `src/{baseRoute}/dto/`
- **Module Registry**: `src/generated.module.ts`

### 🚀 Common Commands

```bash
# Generate all APIs from definitions
npm run generate:api

# Start with auto-reload
npm run start:dev

# Build for production
npm run build

# Run production build
npm start
```

### ✅ Checklist for New API

- [ ] Created `.api.json` file in `src/api-definitions/`
- [ ] Defined routes with proper methods and paths
- [ ] Defined request/response DTOs
- [ ] Ran `npm run generate:api`
- [ ] Updated `src/generated.module.ts` with new module
- [ ] Server compiles without errors

### 💡 Tips

- Copy `example.api.template.json` and modify
- Use consistent naming: `featureName` should match folder/route name
- TypeScript types in responseType should be valid TS syntax
- Mark required DTO properties with `"required": true`
- Run `npm run generate:api` anytime you modify API definitions
