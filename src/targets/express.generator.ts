import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { ApiDescription, ApiDtoProperty, ApiRoute } from '../agent';
import { VERSIONS } from './versions.config';

const V = VERSIONS.express;
const VT = VERSIONS.expressTest;

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mapTsType(type: string): string {
  if (type.includes('number')) return 'number';
  if (type.includes('boolean')) return 'boolean';
  if (type.includes('[]') || type === 'array') return 'string[]';
  return 'string';
}

async function write(filePath: string, content: string) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

function buildDtoInterface(dtoName: string, properties: ApiDtoProperty[]): string {
  function buildInterface(name: string, props: ApiDtoProperty[]): string[] {
    const results: string[] = [];
    const fields = props.map(p => {
      if (p.properties?.length) {
        const nested = `${name}${capitalize(p.name)}`;
        results.push(...buildInterface(nested, p.properties));
        return `  ${p.name}${p.required ? '' : '?'}: ${nested};`;
      }
      return `  ${p.name}${p.required ? '' : '?'}: ${mapTsType(p.type || 'string')};`;
    });
    results.push(`export interface ${name} {\n${fields.join('\n')}\n}`);
    return results;
  }
  return buildInterface(dtoName, properties).join('\n\n');
}

function buildValidators(route: ApiRoute): string {
  if (!route.requestDto) return '';
  return route.requestDto.properties
    .filter(p => p.required)
    .map(p => {
      const validator = (p.type || 'string').includes('number')
        ? `  body('${p.name}').notEmpty().isNumeric().withMessage('${p.name} must be a number')`
        : `  body('${p.name}').notEmpty().withMessage('${p.name} is required')`;
      return validator;
    })
    .join(',\n');
}

function buildHandler(route: ApiRoute): string {
  const hasPathParam = /:(\w+)/.test(route.path);
  const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
  const validators = buildValidators(route);
  const validationCheck = validators
    ? `\n  const errors = validationResult(req);\n  if (!errors.isEmpty()) {\n    return res.status(400).json({ errors: errors.array() });\n  }\n`
    : '';

  let body = '';
  if (route.requestDto) {
    const fields = route.requestDto.properties
      .map(p => `    ${p.name}: req.body.${p.name}`)
      .join(',\n');
    body = `{\n    id: Math.random().toString(36).substr(2, 9),\n${fields}\n  }`;
  } else if (route.method === 'get' && (route.responseType ?? '').includes('[]')) {
    body = `[\n    { id: '1', name: 'Sample Item 1' },\n    { id: '2', name: 'Sample Item 2' }\n  ]`;
  } else if (hasPathParam) {
    body = `{ id: req.params.${paramName}, name: 'Sample ${route.actionName}' }`;
  } else {
    body = `{ status: 'ok', message: '${route.actionName} executed' }`;
  }

  const validatorsExport = validators
    ? `\nexport const ${route.actionName}Validators = [\n${validators}\n];\n`
    : `\nexport const ${route.actionName}Validators: any[] = [];\n`;

  const paramDocs = [
    hasPathParam ? ` * @param req.params.${paramName} - Path parameter` : '',
    route.requestDto ? ` * @param req.body - ${route.requestDto.name} payload` : '',
    ` * @param res - Express Response`,
  ].filter(Boolean).join('\n');

  return `${validatorsExport}
/**
 * ${route.summary || route.actionName}
 *
${paramDocs}
 * @returns JSON response
 */
export const ${route.actionName} = async (req: Request, res: Response): Promise<void> => {
  try {${validationCheck}
    // TODO: replace with actual business logic
    res.json(${body});
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};`;
}

function buildRouter(description: ApiDescription): string {
  const methodMap: Record<string, string> = {
    get: 'get', post: 'post', put: 'put', delete: 'delete', patch: 'patch',
  };

  const handlerImports = description.routes
    .map(r => `  ${r.actionName},\n  ${r.actionName}Validators`)
    .join(',\n');

  const routes = description.routes.map(route => {
    const path = '/' + route.path.replace(/^\//, '');
    return `router.${methodMap[route.method]}('${path}', ${route.actionName}Validators, ${route.actionName});`;
  }).join('\n');

  return `import { Router } from 'express';
import {
${handlerImports}
} from './${description.featureName}.handler';

const router = Router();

// ${description.featureName} routes — prefix: /api/${description.baseRoute}
${routes}

export default router;
`;
}

function buildHandlerFile(description: ApiDescription): string {
  const dtoInterfaces = description.routes
    .filter(r => r.requestDto)
    .map(r => buildDtoInterface(r.requestDto!.name, r.requestDto!.properties))
    .join('\n\n');

  const handlers = description.routes.map(buildHandler).join('\n');

  return `/**
 * @file ${description.featureName}.handler.ts
 * @description Express route handlers for the ${description.featureName} feature.
 * Replace the TODO stubs with real business logic or inject a service.
 */
import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';

// ---- DTOs ----
${dtoInterfaces}

// ---- Handlers ----
${handlers}
`;
}

function buildSwaggerSpec(description: ApiDescription): string {
  function mapOasType(type: string): Record<string, unknown> {
    if (type.includes('number')) return { type: 'integer' };
    if (type.includes('boolean')) return { type: 'boolean' };
    if (type.includes('[]') || type === 'array') return { type: 'array', items: { type: 'string' } };
    return { type: 'string' };
  }

  function buildSchema(props: ApiDtoProperty[]): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const p of props) {
      if (p.properties?.length) {
        properties[p.name] = buildSchema(p.properties);
      } else {
        properties[p.name] = mapOasType(p.type || 'string');
      }
      if (p.required) required.push(p.name);
    }
    return { type: 'object', properties, ...(required.length ? { required } : {}) };
  }

  // Build component schemas from all request DTOs
  const schemas: Record<string, unknown> = {};
  for (const route of description.routes) {
    if (route.requestDto) {
      schemas[route.requestDto.name] = buildSchema(route.requestDto.properties);
    }
  }

  // Build paths
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of description.routes) {
    const hasPathParam = /:(\w+)/.test(route.path);
    const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
    const oasPath = '/api/' + route.path.replace(/^\//, '').replace(/:(\w+)/g, '{$1}');
    const isList = (route.responseType ?? '').includes('[]');

    if (!paths[oasPath]) paths[oasPath] = {};

    const parameters: unknown[] = [];
    if (hasPathParam) {
      parameters.push({
        name: paramName,
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: `${paramName} identifier`,
      });
    }

    const operation: Record<string, unknown> = {
      tags: [description.featureName],
      summary: route.summary ?? route.actionName,
      operationId: route.actionName,
      parameters,
      responses: {
        200: {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: isList
                ? { type: 'array', items: { type: 'object' } }
                : { type: 'object' },
            },
          },
        },
        400: { description: 'Bad request — missing or invalid fields' },
        404: hasPathParam ? { description: 'Resource not found' } : undefined,
        500: { description: 'Internal server error' },
      },
    };

    // Remove undefined response entries
    operation.responses = Object.fromEntries(
      Object.entries(operation.responses as Record<string, unknown>).filter(([, v]) => v !== undefined)
    );

    if (route.requestDto) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${route.requestDto.name}` },
          },
        },
      };
    }

    paths[oasPath][route.method] = operation;
  }

  const spec = {
    openapi: '3.0.3',
    info: {
      title: `${description.featureName.charAt(0).toUpperCase() + description.featureName.slice(1)} API`,
      description: `REST API for the ${description.featureName} feature — generated by api-generator`,
      version: '1.0.0',
    },
    tags: [{ name: description.featureName, description: `${description.featureName} endpoints` }],
    paths,
    components: { schemas },
  };

  return `import swaggerUi from 'swagger-ui-express';
import { Router } from 'express';

export const swaggerSpec = ${JSON.stringify(spec, null, 2)};

const swaggerRouter = Router();
swaggerRouter.use('/', swaggerUi.serve);
swaggerRouter.get('/', swaggerUi.setup(swaggerSpec));

export default swaggerRouter;
`;
}

function buildAppEntry(description: ApiDescription): string {
  return `import express from 'express';
import ${description.featureName}Router from './${description.featureName}.router';
import swaggerRouter, { swaggerSpec } from './swagger';

const app = express();
app.use(express.json());

// Swagger UI — http://localhost:3000/api-docs
app.use('/api-docs', swaggerRouter);

// OpenAPI JSON spec — http://localhost:3000/api-docs.json
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

// Feature routes
app.use('/api/${description.baseRoute}', ${description.featureName}Router);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
  console.log(\`Swagger UI  → http://localhost:\${PORT}/api-docs\`);
  console.log(\`OpenAPI JSON→ http://localhost:\${PORT}/api-docs.json\`);
});

export default app;
`;
}

function buildPackageJson(description: ApiDescription): string {
  return JSON.stringify(
    {
      name: `${description.featureName}-api`,
      version: '0.0.1',
      scripts: {
        build: 'tsc',
        start: 'node dist/app.js',
        dev: 'ts-node-dev --respawn src/app.ts',
      },
      dependencies: {
        express: V.express,
        'express-validator': V.expressValidator,
        'swagger-ui-express': V.swaggerUiExpress,
      },
      devDependencies: {
        '@types/express': V.typesExpress,
        '@types/node': V.typesNode,
        '@types/swagger-ui-express': V.typesSwaggerUiExpress,
        typescript: V.typescript,
        'ts-node-dev': V.tsNodeDev,
      },
    },
    null,
    2
  );
}

function buildVendorService(description: ApiDescription): string {
  const cap = capitalize(description.featureName);
  const vendorRoutes = description.routes.filter(r => r.vendor);

  const methods = vendorRoutes.length > 0
    ? vendorRoutes.map(route => {
        const v = route.vendor!;
        const hasPathParam = /:(\w+)/.test(route.path);
        const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
        const httpMethod = (v.method ?? route.method).toLowerCase();
        const params = [
          hasPathParam ? `${paramName}: string` : '',
          route.requestDto ? `body: Record<string, unknown>` : '',
        ].filter(Boolean).join(', ');
        const urlExpr = v.url.replace(/:(\w+)/g, (_: string, k: string) => `\${${k}}`);
        const axiosCall = route.requestDto
          ? `axios.${httpMethod}(\`${urlExpr}\`, body, { headers })`
          : `axios.${httpMethod}(\`${urlExpr}\`, { headers })`;
        return `  async ${route.actionName}(${params}): Promise<unknown> {
    if (process.env.VENDOR_MOCK === 'true') {
      return { mocked: true, action: '${route.actionName}' };
    }
    const headers = ${JSON.stringify(v.headers ?? { 'Content-Type': 'application/json' })};
    const response = await ${axiosCall};
    return response.data;
  }`;
      }).join('\n\n')
    : `  async fetchExternal(url: string, data?: unknown): Promise<unknown> {
    if (process.env.VENDOR_MOCK === 'true') {
      return { mocked: true };
    }
    const response = await axios.post(url, data, {
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  }`;

  return `import axios from 'axios';

/**
 * ${cap}VendorService
 *
 * HTTP client for calling external APIs on behalf of the ${description.featureName} feature.
 * Set VENDOR_MOCK=true to skip real HTTP calls during testing.
 */
export class ${cap}VendorService {
${methods}
}

export const ${description.featureName}VendorService = new ${cap}VendorService();
`;
}

function buildSampleBody(route: ApiRoute): string {
  if (!route.requestDto) return '';
  const obj = Object.fromEntries(
    route.requestDto.properties.map(p => [
      p.name,
      (p.type ?? 'string').includes('number') ? 1 : `${p.name}-test`,
    ])
  );
  return JSON.stringify(obj);
}

function buildHandlerSpec(description: ApiDescription): string {
  const cap = capitalize(description.featureName);
  const useVitest = description.testFramework === 'vitest';
  const testImport = useVitest
    ? `import { describe, it, expect } from 'vitest';`
    : '';

  const tests = description.routes.map(route => {
    const rawPath = '/api/' + description.baseRoute + '/' + route.path.replace(/^\//, '').replace(/:(\w+)/g, '1');
    const cleanPath = rawPath.replace(/\/+$/, '');
    const body = buildSampleBody(route);
    const sendLine = body ? `\n      .send(${body})` : '';
    return `  it('${route.method.toUpperCase()} ${cleanPath} — ${route.actionName}', async () => {
    const res = await request(app).${route.method}('${cleanPath}')${sendLine};
    expect(res.status).toBeLessThan(500);
    expect(res.body).toBeDefined();
  });`;
  }).join('\n\n');

  return `import request from 'supertest';
import app from './app';
${testImport}

describe('${cap} API', () => {
${tests}
});
`;
}

function buildTestConfig(description: ApiDescription): { filename: string; content: string } {
  const useVitest = description.testFramework === 'vitest';

  if (useVitest) {
    return {
      filename: 'vitest.config.ts',
      content: `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.spec.ts'],
  },
});
`,
    };
  }

  return {
    filename: 'jest.config.json',
    content: JSON.stringify(
      { preset: 'ts-jest', testEnvironment: 'node', testMatch: ['**/*.spec.ts'] },
      null,
      2
    ),
  };
}

function buildPackageJsonWithTests(description: ApiDescription): string {
  const VV = VERSIONS.vitest;
  const useVitest = description.testFramework === 'vitest';

  const testDeps = useVitest
    ? {
        vitest: VV.vitest,
        '@vitest/coverage-v8': VV.vitestCoverage,
        supertest: VV.supertest,
        '@types/supertest': VV.typesSupertest,
      }
    : {
        jest: VT.jest,
        'ts-jest': VT.tsJest,
        supertest: VT.supertest,
        '@types/jest': VT.typesJest,
        '@types/supertest': VT.typesSupertest,
      };

  const testScript = useVitest ? 'vitest run' : 'jest --passWithNoTests';
  const testWatchScript = useVitest ? 'vitest' : 'jest --watch';

  return JSON.stringify(
    {
      name: `${description.featureName}-api`,
      version: '0.0.1',
      scripts: {
        build: 'tsc',
        start: 'node dist/app.js',
        dev: 'ts-node-dev --respawn src/app.ts',
        test: testScript,
        'test:watch': testWatchScript,
      },
      dependencies: {
        express: V.express,
        'express-validator': V.expressValidator,
        'swagger-ui-express': V.swaggerUiExpress,
        axios: VT.axios,
      },
      devDependencies: {
        '@types/express': V.typesExpress,
        '@types/node': V.typesNode,
        '@types/swagger-ui-express': V.typesSwaggerUiExpress,
        typescript: V.typescript,
        'ts-node-dev': V.tsNodeDev,
        ...testDeps,
      },
    },
    null,
    2
  );
}

export async function createExpressFiles(description: ApiDescription, rootDir: string) {
  const base = join(rootDir, description.baseRoute);
  const testConfig = buildTestConfig(description);

  await write(join(base, `${description.featureName}.handler.ts`), buildHandlerFile(description));
  await write(join(base, `${description.featureName}.router.ts`), buildRouter(description));
  await write(join(base, `${description.featureName}.vendor.service.ts`), buildVendorService(description));
  await write(join(base, `${description.featureName}.handler.spec.ts`), buildHandlerSpec(description));
  await write(join(base, testConfig.filename), testConfig.content);
  await write(join(base, 'swagger.ts'), buildSwaggerSpec(description));
  await write(join(base, 'app.ts'), buildAppEntry(description));
  await write(join(base, 'package.json'), buildPackageJsonWithTests(description));

  console.log(`✓ [Express] Generated for '${description.featureName}' → ${base}`);
}
