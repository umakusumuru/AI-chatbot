import { access, mkdir, writeFile, readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { basename, dirname, join } from 'path';
import { spawnSync } from 'child_process';

export interface ApiDtoProperty {
  name: string;
  type: string;
  required?: boolean;
  properties?: ApiDtoProperty[];
  items?: any;
}

export interface ApiRoute {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  path: string;
  actionName: string;
  summary?: string;
  requestDto?: {
    name: string;
    properties: ApiDtoProperty[];
  };
  responseType?: string;
  vendor?: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    mapRequest?: any;
    mapResponse?: any;
  };
}

export interface ApiDescription {
  featureName: string;
  baseRoute: string;
  moduleClassName: string;
  controllerClassName: string;
  serviceClassName: string;
  routes: ApiRoute[];
}

export const sampleApiDescription: ApiDescription = {
  featureName: 'chat',
  baseRoute: 'chat',
  moduleClassName: 'ChatModule',
  controllerClassName: 'ChatController',
  serviceClassName: 'ChatService',
  routes: [
    {
      method: 'get',
      path: 'health',
      actionName: 'getHealth',
      summary: 'Returns API health status',
      responseType: '{ status: string; message: string }',
    },
    {
      method: 'post',
      path: 'message',
      actionName: 'sendMessage',
      summary: 'Sends a chat message and returns a response',
      requestDto: {
        name: 'SendMessageDto',
        properties: [
          { name: 'message', type: 'string', required: true },
          { name: 'sessionId', type: 'string', required: false },
        ],
      },
      responseType: '{ reply: string }',
    },
  ],
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function mapSwaggerType(type: string) {
  if (type.includes('string')) return 'String';
  if (type.includes('number')) return 'Number';
  if (type.includes('boolean')) return 'Boolean';
  if (type.includes('[]')) return 'Array';
  return 'Object';
}

function buildDtoSource(dtoName: string, properties: ApiDtoProperty[]) {
  const classes: string[] = [];

  function buildClass(name: string, props: ApiDtoProperty[]) {
    const propLines: string[] = [];

    for (const prop of props) {
      const optional = prop.required ? '!' : '?';

      // Nested object
      if (prop.properties && prop.properties.length) {
        const nestedName = `${name}${capitalize(prop.name)}`;
        // recurse to build nested class
        buildClass(nestedName, prop.properties);

        const decorator = prop.required
          ? `  @ApiProperty({ required: true, type: ${nestedName} })`
          : `  @ApiPropertyOptional({ required: false, type: ${nestedName} })`;

        propLines.push(
          `${decorator}\n  /** ${prop.name} field${
            prop.required ? ' (required)' : ' (optional)'
          } */\n  ${prop.name}${optional}: ${nestedName};`
        );
        continue;
      }

      // Array type
      if (
        prop.type &&
        (prop.type.includes('[]') ||
          prop.type === 'array' ||
          (prop as any).items)
      ) {
        const items = (prop as any).items;
        if (items && items.type === 'object' && items.properties) {
          const nestedName = `${name}${capitalize(prop.name)}Item`;
          buildClass(nestedName, items.properties as ApiDtoProperty[]);
          const decorator = prop.required
            ? `  @ApiProperty({ required: true, type: ${nestedName}, isArray: true })`
            : `  @ApiPropertyOptional({ required: false, type: ${nestedName}, isArray: true })`;
          propLines.push(
            `${decorator}\n  /** ${prop.name} field${
              prop.required ? ' (required)' : ' (optional)'
            } */\n  ${prop.name}${optional}: ${nestedName}[];`
          );
        } else {
          const swaggerType = mapSwaggerType(items?.type || 'string');
          const tsType =
            items?.type && items.type.includes('number') ? 'number' : 'string';
          const decorator = prop.required
            ? `  @ApiProperty({ required: true, type: ${swaggerType}, isArray: true })`
            : `  @ApiPropertyOptional({ required: false, type: ${swaggerType}, isArray: true })`;
          propLines.push(
            `${decorator}\n  /** ${prop.name} field${
              prop.required ? ' (required)' : ' (optional)'
            } */\n  ${prop.name}${optional}: ${tsType}[];`
          );
        }
        continue;
      }

      // Primitive types
      const swaggerType = mapSwaggerType(prop.type || 'string');
      const tsType =
        prop.type && prop.type.includes('number')
          ? 'number'
          : prop.type && prop.type.includes('boolean')
          ? 'boolean'
          : 'string';
      const decorator = prop.required
        ? `  @ApiProperty({ required: true, type: ${swaggerType} })`
        : `  @ApiPropertyOptional({ required: false, type: ${swaggerType} })`;

      propLines.push(
        `${decorator}\n  /** ${prop.name} field${
          prop.required ? ' (required)' : ' (optional)'
        } */\n  ${prop.name}${optional}: ${tsType};`
      );
    }

    const classSrc = `export class ${name} {\n${propLines.join('\n\n')}\n}`;
    classes.push(classSrc);
  }

  // start building from root DTO
  buildClass(dtoName, properties);

  const header = `import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';\n\n/**\n * Data Transfer Object for ${dtoName}\n * Defines the structure of request/response data\n */`;

  return `${header}\n\n${classes.join('\n\n')}`;
}

function createRouteMethod(route: ApiRoute) {
  const methodMap: Record<string, string> = {
    get: 'Get',
    post: 'Post',
    put: 'Put',
    delete: 'Delete',
    patch: 'Patch',
  };
  const httpDecorator = `@${methodMap[route.method]}('${route.path}')`;
  const hasPathParam = /:(\w+)/.test(route.path);
  const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
  const pathParam = hasPathParam
    ? `@Param('${paramName}') ${paramName}: string`
    : '';
  const bodyParam = route.requestDto
    ? `@Body() body: ${route.requestDto.name}`
    : '';
  const params = [pathParam, bodyParam].filter(Boolean).join(', ');
  const serviceArgs = [
    hasPathParam ? paramName : '',
    route.requestDto ? 'body' : '',
  ]
    .filter(Boolean)
    .join(', ');
  const returnType = route.responseType ?? 'any';
  const operationSummary = route.summary ?? route.actionName;
  const requestBodyDecorator = route.requestDto
    ? `  @ApiBody({ type: ${route.requestDto.name} })\n`
    : '';
  const notFoundResponse = hasPathParam
    ? "  @ApiNotFoundResponse({ description: 'Resource not found.' })\n"
    : '';

  const jsdocParam = hasPathParam
    ? `\n   * @param ${paramName} - The resource identifier`
    : '';
  const jsdocBody = route.requestDto
    ? `\n   * @param body - The request payload (${route.requestDto.name})`
    : '';
  const jsdocReturn = `\n   * @returns Observable of type ${returnType}`;

  return `  /**
   * ${operationSummary}${jsdocParam}${jsdocBody}${jsdocReturn}
   */
  ${httpDecorator}
  @ApiOperation({ summary: '${operationSummary}' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
${notFoundResponse}${requestBodyDecorator}  ${route.actionName}(${params}): Observable<${returnType}> {
    return this.service.${route.actionName}(${serviceArgs});
  }
`;
}

function buildControllerSource(description: ApiDescription) {
  const imports = [
    `import { Controller, Body, Param, Get, Post, Put, Delete, Patch } from '@nestjs/common';`,
    `import { ApiBody, ApiBadRequestResponse, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';`,
    `import { Observable } from 'rxjs';`,
    `import { ${description.serviceClassName} } from './${description.baseRoute}.service';`,
  ];

  const dtoImports = description.routes
    .filter((route) => route.requestDto)
    .map(
      (route) =>
        `import { ${route.requestDto!.name} } from './dto/${
          route.requestDto!.name
        }.dto';`
    );

  const methods = description.routes.map(createRouteMethod).join('\n');

  return `${[...imports, ...dtoImports].join('\n')}

/**
 * ${description.controllerClassName}
 * 
 * Handles HTTP requests for the ${description.featureName} feature.
 * Routes are prefixed with /${description.baseRoute}.
 */
@ApiTags('${description.baseRoute}')
@Controller('${description.baseRoute}')
export class ${description.controllerClassName} {
  /**
   * Constructor
   * @param service - The ${description.serviceClassName} instance
   */
  constructor(private readonly service: ${description.serviceClassName}) {}

${methods}
}
`;
}

function buildServiceSource(description: ApiDescription) {
  const methods = description.routes
    .map((route) => {
      const hasPathParam = /:(\w+)/.test(route.path);
      const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
      const params = [
        hasPathParam ? `${paramName}: string` : '',
        route.requestDto ? `body: ${route.requestDto.name}` : '',
      ]
        .filter(Boolean)
        .join(', ');
      const returnType = route.responseType ?? 'any';
      const requiredFields = route.requestDto
        ? route.requestDto.properties
            .filter((prop) => prop.required)
            .map((prop) => prop.name)
        : [];

      let validationBlock = '';
      if (requiredFields.length) {
        validationBlock = `    const missingFields = [${requiredFields
          .map((field) => `'${field}'`)
          .join(', ')}].filter((key) => !(body as any)?.[key]);
    if (missingFields.length) {
      return throwError(() => new BadRequestException(\`Missing required field(s): \${missingFields.join(', ')}\`));
    }

`;
      }

      let pathValidationBlock = '';
      if (hasPathParam) {
        pathValidationBlock = `    if (${paramName} === '0') {
      return throwError(() => new NotFoundException('Resource not found'));
    }

`;
      }

      let sampleResponse = '{}';
      if (route.requestDto) {
        sampleResponse = `{
      ...body,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      status: 'success'
    }`;
      } else if (route.method === 'get' && returnType.includes('[]')) {
        sampleResponse = `[
      {
        id: '1',
        name: 'Sample Item 1',
        email: 'item1@example.com'
      },
      {
        id: '2',
        name: 'Sample Item 2',
        email: 'item2@example.com'
      }
    ]`;
      } else {
        const idValue = hasPathParam ? paramName : "'1'";
        sampleResponse = `{
      id: ${hasPathParam ? paramName : "'1'"},
      name: 'Sample ${capitalize(route.actionName)}',
      email: 'sample@example.com'
    }`;
      }

      // vendor proxy handling
      if ((route as any).vendor) {
        const vendor = (route as any).vendor;
        const vendorMethod = (vendor.method ?? route.method).toUpperCase();
        const vendorUrlJson = JSON.stringify(vendor.url);
        const vendorHeadersJson = JSON.stringify(vendor.headers ?? {});
        const vendorMapRequestJson = vendor.mapRequest
          ? JSON.stringify(vendor.mapRequest)
          : null;
        const vendorMapResponseJson = vendor.mapResponse
          ? JSON.stringify(vendor.mapResponse)
          : null;

        const mapResponseStatement = vendorMapResponseJson
          ? `return __applyTemplate(${vendorMapResponseJson}, { vendorResponse: vendorRes }) as unknown as ${returnType};`
          : `return vendorRes as unknown as ${returnType};`;

        return (
          '  ' +
          route.actionName +
          '(' +
          params +
          `): Observable<${returnType}> {\n` +
          validationBlock +
          pathValidationBlock +
          '    // Vendor proxy - forwards request to external API\n' +
          '    const vendorUrl = __applyTemplate(' +
          vendorUrlJson +
          ', { body' +
          (hasPathParam ? `, ${paramName}: ${paramName}` : '') +
          ' });\n' +
          '    const vendorBody = ' +
          (vendorMapRequestJson
            ? `__applyTemplate(${vendorMapRequestJson}, { body` +
              (hasPathParam ? `, ${paramName}: ${paramName}` : '') +
              ` })`
            : route.requestDto
            ? 'body'
            : 'undefined') +
          ';\n' +
          '    const vendorHeaders = __applyTemplate(' +
          vendorHeadersJson +
          ', { body' +
          (hasPathParam ? `, ${paramName}: ${paramName}` : '') +
          ' });\n' +
          "    if (process.env.VENDOR_MOCK === 'true') {\n" +
          '      const mock = vendorBody ?? { mocked: true };\n' +
          '      return of(mock as unknown as ' +
          returnType +
          ');\n' +
          '    }\n' +
          "    return from(fetch(vendorUrl, { method: '" +
          vendorMethod +
          "', headers: vendorHeaders, body: vendorBody === undefined ? undefined : JSON.stringify(vendorBody) })\n" +
          '      .then(res => res.json())\n' +
          '      .then((vendorRes) => {\n' +
          '        if (vendorRes == null) return vendorRes as unknown as ' +
          returnType +
          ';\n' +
          '        ' +
          mapResponseStatement +
          '\n' +
          '      }));\n' +
          '  }\n'
        );
      }

      return `  /**
   * ${route.summary || `Handle ${route.actionName} operation`}
   * ${hasPathParam ? `@param ${paramName} - The resource identifier` : ''}${
        route.requestDto
          ? `\n   * @param body - The request payload (${route.requestDto.name})`
          : ''
      }
   * @returns Observable of type ${returnType}
   */
  ${
    route.actionName
  }(${params}): Observable<${returnType}> {\n${validationBlock}${pathValidationBlock}    // Test data - Replace with actual business logic\n    return of(${sampleResponse} as unknown as ${returnType});\n  }\n`;
    })
    .join('\n');

  const dtoImports = description.routes
    .filter((route) => route.requestDto)
    .map(
      (route) =>
        `import { ${route.requestDto!.name} } from './dto/${
          route.requestDto!.name
        }.dto';`
    );

  const hasVendorRoutes = description.routes.some((route) => route.vendor);

  const rxjsImports = hasVendorRoutes
    ? 'Observable, of, throwError, from'
    : 'Observable, of, throwError';

  const allImports = [
    'import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";',
    `import { ${rxjsImports} } from "rxjs";`,
    ...dtoImports,
  ];

  const helper = hasVendorRoutes
    ? `\n// Helper: simple template resolver for objects/strings containing {{...}} placeholders\nfunction __resolvePath(path: string, ctx: any) {\n  try {\n    const parts = path.split('.');\n    let cur: any = ctx;\n    for (const p of parts) {\n      if (cur == null) return undefined;\n      cur = cur[p];\n    }\n    return cur;\n  } catch (e) {\n    return undefined;\n  }\n}\n\nfunction __applyTemplate(template: any, ctx: any): any {\n  if (template == null) return template;\n  if (Array.isArray(template)) return template.map((t) => __applyTemplate(t, ctx));\n  if (typeof template === 'object') {\n    const out: any = {};\n    for (const k of Object.keys(template)) {\n      out[k] = __applyTemplate((template as any)[k], ctx);\n    }\n    return out;\n  }\n  if (typeof template === 'string') {\n    return template.replace(/\\{\\{(.+?)\\}\\}/g, (_m, expr) => {\n      const val = __resolvePath(expr.trim(), ctx);\n      return val == null ? '' : String(val);\n    });\n  }\n  return template;\n}\n`
    : '\n';

  return `${allImports.join('\n')}${helper}
/**
 * ${description.serviceClassName}
 * 
 * Service for the ${description.featureName} feature.
 * Contains business logic for all ${description.baseRoute} operations.
 */
@Injectable()
export class ${description.serviceClassName} {
${methods}}\n`;
}

function buildSampleDtoBody(properties: ApiDtoProperty[]) {
  function buildObj(props: ApiDtoProperty[], indent = 6): string {
    const lines: string[] = [];
    const pad = ' '.repeat(indent);
    for (const prop of props) {
      if (prop.properties && prop.properties.length) {
        const nested = buildObj(prop.properties, indent + 2);
        lines.push(`${pad}${prop.name}: ${nested},`);
        continue;
      }

      if (
        prop.type &&
        (prop.type.includes('[]') ||
          prop.type === 'array' ||
          (prop as any).items)
      ) {
        const items = (prop as any).items;
        if (items && items.type === 'object' && items.properties) {
          const itemSample = buildObj(items.properties, indent + 4);
          lines.push(`${pad}${prop.name}: [${itemSample}],`);
        } else if (items && items.type && items.type.includes('number')) {
          lines.push(`${pad}${prop.name}: [1],`);
        } else {
          lines.push(`${pad}${prop.name}: ['${prop.name}-sample'],`);
        }
        continue;
      }

      if (prop.type && prop.type.includes('string'))
        lines.push(`${pad}${prop.name}: '${prop.name}-sample',`);
      else if (prop.type && prop.type.includes('number'))
        lines.push(`${pad}${prop.name}: 1,`);
      else if (prop.type && prop.type.includes('boolean'))
        lines.push(`${pad}${prop.name}: true,`);
      else lines.push(`${pad}${prop.name}: null,`);
    }
    return `{\n${lines.join('\n')}\n${' '.repeat(indent - 2)}}`;
  }

  return buildObj(properties, 6);
}

function buildServiceSpecSource(description: ApiDescription) {
  const imports = [
    `import { Test, TestingModule } from "@nestjs/testing";`,
    `import { ${description.serviceClassName} } from "./${description.baseRoute}.service";`,
  ];

  const exceptionImports = new Set<string>();
  const routes = description.routes;

  for (const route of routes) {
    if (route.requestDto?.properties.some((prop) => prop.required)) {
      exceptionImports.add('BadRequestException');
    }
    if (/:(\w+)/.test(route.path)) {
      exceptionImports.add('NotFoundException');
    }
  }

  if (exceptionImports.size > 0) {
    imports.push(
      `import { ${[...exceptionImports].join(', ')} } from "@nestjs/common";`
    );
  }

  const createBody = (route: ApiRoute) =>
    route.requestDto ? buildSampleDtoBody(route.requestDto.properties) : '';

  const specTests = routes
    .map((route) => {
      const hasPathParam = /:(\w+)/.test(route.path);
      const actionArgs = [];
      if (hasPathParam) {
        actionArgs.push('"1"');
      }
      if (route.requestDto) {
        actionArgs.push(`${createBody(route)} as any`);
      }
      const successTest = `  it("should ${
        route.actionName
      }", (done) => {\n    service.${route.actionName}(${actionArgs.join(
        ', '
      )}).subscribe({\n      next: (result) => {\n        expect(result).toBeDefined();\n        done();\n      },\n      error: done,\n    });\n  });\n`;

      const failureTests: string[] = [];
      if (route.requestDto?.properties.some((prop) => prop.required)) {
        const missingBody = hasPathParam ? '"1", {} as any' : '{} as any';
        failureTests.push(
          `  it("should return bad request when required fields are missing for ${route.actionName}", (done) => {\n    service.${route.actionName}(${missingBody}).subscribe({\n      next: () => done(new Error("Expected error")),\n      error: (error) => {\n        expect(error).toBeInstanceOf(BadRequestException);\n        done();\n      },\n    });\n  });\n`
        );
      }

      if (hasPathParam) {
        const idArg = '"0"';
        const bodyArg = route.requestDto ? `, ${createBody(route)} as any` : '';
        failureTests.push(
          `  it("should return not found for id 0 on ${route.actionName}", (done) => {\n    service.${route.actionName}(${idArg}${bodyArg}).subscribe({\n      next: () => done(new Error("Expected error")),\n      error: (error) => {\n        expect(error).toBeInstanceOf(NotFoundException);\n        done();\n      },\n    });\n  });\n`
        );
      }

      return [successTest, ...failureTests].join('\n');
    })
    .join('\n');

  return `${imports.join('\n')}\n\ndescribe("${
    description.serviceClassName
  }", () => {\n  let service: ${
    description.serviceClassName
  };\n\n  beforeEach(async () => {\n    const module: TestingModule = await Test.createTestingModule({\n      providers: [${
    description.serviceClassName
  }],\n    }).compile();\n\n    service = module.get<${
    description.serviceClassName
  }>(${description.serviceClassName});\n  });\n\n${specTests}});\n`;
}

function buildControllerSpecSource(description: ApiDescription) {
  const imports = [
    `import { Test, TestingModule } from "@nestjs/testing";`,
    `import { ${description.controllerClassName} } from "./${description.baseRoute}.controller";`,
    `import { ${description.serviceClassName} } from "./${description.baseRoute}.service";`,
  ];

  const specTests = description.routes
    .map((route) => {
      const hasPathParam = /:(\w+)/.test(route.path);
      const actionArgs = [];
      if (hasPathParam) {
        actionArgs.push('"1"');
      }
      if (route.requestDto) {
        actionArgs.push(buildSampleDtoBody(route.requestDto.properties));
      }
      return `  it("should ${route.actionName}", (done) => {\n    controller.${
        route.actionName
      }(${actionArgs.join(
        ', '
      )}).subscribe({\n      next: (result) => {\n        expect(result).toBeDefined();\n        done();\n      },\n      error: done,\n    });\n  });\n`;
    })
    .join('\n');

  return `${imports.join('\n')}\n\ndescribe("${
    description.controllerClassName
  }", () => {\n  let controller: ${
    description.controllerClassName
  };\n\n  beforeEach(async () => {\n    const module: TestingModule = await Test.createTestingModule({\n      controllers: [${
    description.controllerClassName
  }],\n      providers: [${
    description.serviceClassName
  }],\n    }).compile();\n\n    controller = module.get<${
    description.controllerClassName
  }>(${description.controllerClassName});\n  });\n\n${specTests}});\n`;
}

function buildModuleSource(description: ApiDescription) {
  return `import { Module } from '@nestjs/common';
import { ${description.controllerClassName} } from './${description.baseRoute}.controller';
import { ${description.serviceClassName} } from './${description.baseRoute}.service';

/**
 * ${description.moduleClassName}
 * 
 * NestJS module for the ${description.featureName} feature.
 * Declares and exports the controller and service for this domain.
 */
@Module({
  controllers: [${description.controllerClassName}],
  providers: [${description.serviceClassName}]
})
export class ${description.moduleClassName} {}
`;
}

function normalizeImportLine(line: string) {
  return line
    .replace(/\s+/g, ' ')
    .replace(/from\s+["'](.+?)["'];/, "from '$1';")
    .trim();
}

export function buildGeneratedModuleSource(
  descriptions: ApiDescription[],
  extraImports: string[] = []
) {
  const generatedImports = descriptions.map(
    (desc) =>
      `import { ${desc.moduleClassName} } from './${desc.baseRoute}/${desc.baseRoute}.module';`
  );

  const importLines = [
    `import { Module } from '@nestjs/common';`,
    ...extraImports,
    ...generatedImports,
  ];

  const uniqueImportLines: string[] = [];
  const normalizedImportSet = new Set<string>();

  for (const line of importLines) {
    const normalized = normalizeImportLine(line);
    if (!normalizedImportSet.has(normalized)) {
      normalizedImportSet.add(normalized);
      uniqueImportLines.push(line);
    }
  }

  const names = descriptions.map((desc) => desc.moduleClassName).join(', ');

  return `${uniqueImportLines.join('\n')}

@Module({
  imports: [${names}],
  controllers: [],
  providers: [],
})
export class GeneratedModule {}
`;
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeGeneratedModuleFile(
  descriptions: ApiDescription[],
  rootDir: string
) {
  const generatedModulePath = join(rootDir, 'generated.module.ts');
  const combinedDescriptions = descriptions;
  let extraImports: string[] = [];

  if (await fileExists(generatedModulePath)) {
    const existingSource = await readFile(generatedModulePath, 'utf-8');
    const existingLines = existingSource.split('\n');
    const moduleImportPattern =
      /^import\s+\{[^}]+\}\s+from\s+["']\.\/[^"]+\/[^"]+["'];$/;

    const existingImports = existingLines
      .map((line) => line.trim())
      .filter((line) => line.startsWith('import '));

    extraImports = existingImports.filter(
      (line) => !moduleImportPattern.test(line)
    );

    const existingModuleImports = existingImports.filter((line) =>
      moduleImportPattern.test(line)
    );

    const existingModules = existingModuleImports
      .map((line) => {
        const match = line.match(
          /import \{ ([^}]+) \} from ["']\.\/([^/]+)\/[^"']+["'];/
        );
        if (!match) return [] as string[];
        const moduleClassNames = match[1].split(',').map((item) => item.trim());
        return moduleClassNames;
      })
      .flat();

    const descriptionsByName = new Map(
      combinedDescriptions.map((desc) => [desc.moduleClassName, desc])
    );

    for (const moduleClassName of existingModules) {
      if (!descriptionsByName.has(moduleClassName)) {
        const routeMatch = moduleClassName.match(/^(.*)Module$/);
        const baseRoute = routeMatch ? routeMatch[1].toLowerCase() : '';
        const description = {
          featureName: baseRoute,
          baseRoute,
          moduleClassName,
          controllerClassName: `${
            routeMatch ? routeMatch[1] : baseRoute
          }Controller`,
          serviceClassName: `${routeMatch ? routeMatch[1] : baseRoute}Service`,
          routes: [],
        } as ApiDescription;
        combinedDescriptions.push(description);
      }
    }
  }

  const moduleSource = buildGeneratedModuleSource(
    combinedDescriptions,
    extraImports
  );
  await writeFileContent(generatedModulePath, moduleSource);
}

async function ensureDirectory(pathSegments: string) {
  await mkdir(pathSegments, { recursive: true });
}

async function writeFileContent(filePath: string, content: string) {
  await ensureDirectory(dirname(filePath));
  await writeFile(filePath, content, 'utf8');
}

export async function createAgentApiFiles(
  description: ApiDescription,
  rootDir: string
) {
  const featureDir = join(rootDir, description.baseRoute);
  const dtoDir = join(featureDir, 'dto');

  await ensureDirectory(featureDir);
  await ensureDirectory(dtoDir);

  await writeFileContent(
    join(featureDir, `${description.baseRoute}.module.ts`),
    buildModuleSource(description)
  );
  await writeFileContent(
    join(featureDir, `${description.baseRoute}.controller.ts`),
    buildControllerSource(description)
  );
  await writeFileContent(
    join(featureDir, `${description.baseRoute}.service.ts`),
    buildServiceSource(description)
  );
  await writeFileContent(
    join(featureDir, `${description.baseRoute}.controller.spec.ts`),
    buildControllerSpecSource(description)
  );
  await writeFileContent(
    join(featureDir, `${description.baseRoute}.service.spec.ts`),
    buildServiceSpecSource(description)
  );

  for (const route of description.routes) {
    if (route.requestDto) {
      await writeFileContent(
        join(dtoDir, `${route.requestDto.name}.dto.ts`),
        buildDtoSource(route.requestDto.name, route.requestDto.properties)
      );
    }
  }
}

export async function createAgentApiTestFiles(
  description: ApiDescription,
  rootDir: string
) {
  const featureDir = join(rootDir, description.baseRoute);

  await ensureDirectory(featureDir);

  await writeFileContent(
    join(featureDir, `${description.baseRoute}.controller.spec.ts`),
    buildControllerSpecSource(description)
  );
  await writeFileContent(
    join(featureDir, `${description.baseRoute}.service.spec.ts`),
    buildServiceSpecSource(description)
  );
}

export async function generateApiTestsFromFile(
  definitionFilePath: string,
  outputDir: string
): Promise<ApiDescription> {
  const description = await readApiDescriptionFile(definitionFilePath);
  await createAgentApiTestFiles(description, outputDir);
  console.log(
    `✓ Generated test files for feature '${description.featureName}' from ${definitionFilePath}`
  );
  return description;
}

export async function generateApiTestsFromDirectory(
  definitionsDir: string,
  outputDir: string
): Promise<ApiDescription[]> {
  const files = await readdir(definitionsDir);
  const apiFiles = files.filter((f) => f.endsWith('.api.json'));

  if (apiFiles.length === 0) {
    console.log(`No .api.json files found in ${definitionsDir}`);
    return [];
  }

  const descriptions: ApiDescription[] = [];

  for (const file of apiFiles) {
    const filePath = join(definitionsDir, file);
    const description = await readApiDescriptionFile(filePath);
    await createAgentApiTestFiles(description, outputDir);
    descriptions.push(description);
    console.log(
      `✓ Generated test files for feature '${description.featureName}' from ${file}`
    );
  }

  return descriptions;
}

export async function readApiDescriptionFile(
  definitionFilePath: string
): Promise<ApiDescription> {
  const content = await readFile(definitionFilePath, 'utf-8');
  return JSON.parse(content) as ApiDescription;
}

export async function generateApiFromFile(
  definitionFilePath: string,
  outputDir: string
): Promise<ApiDescription> {
  const description = await readApiDescriptionFile(definitionFilePath);
  await createAgentApiFiles(description, outputDir);
  console.log(
    `✓ Generated API for feature '${description.featureName}' from ${definitionFilePath}`
  );
  return description;
}

/**
 * Scans a directory for .api.json files and generates APIs for each
 */
export async function generateApisFromDirectory(
  definitionsDir: string,
  outputDir: string
): Promise<ApiDescription[]> {
  try {
    const files = await readdir(definitionsDir);
    const apiFiles = files.filter((f) => f.endsWith('.api.json'));

    if (apiFiles.length === 0) {
      console.log(`No .api.json files found in ${definitionsDir}`);
      return [];
    }

    const descriptions: ApiDescription[] = [];

    for (const file of apiFiles) {
      const filePath = join(definitionsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const description: ApiDescription = JSON.parse(content);

      await createAgentApiFiles(description, outputDir);
      descriptions.push(description);
      console.log(
        `✓ Generated API for feature '${description.featureName}' from ${file}`
      );
    }

    return descriptions;
  } catch (error) {
    console.error(`Error scanning definitions directory: ${error}`);
    throw error;
  }
}

/**
 * Generates module imports string for use in AppModule
 */
export function generateModuleImports(descriptions: ApiDescription[]): string {
  if (descriptions.length === 0) return '';

  const imports = descriptions
    .map(
      (desc) =>
        `import { ${desc.moduleClassName} } from './${desc.baseRoute}/${desc.baseRoute}.module';`
    )
    .join('\n');

  return imports;
}

/**
 * Generates module references for AppModule
 */
export function generateModuleReferences(
  descriptions: ApiDescription[]
): string {
  if (descriptions.length === 0) return '';

  const refs = descriptions.map((desc) => desc.moduleClassName).join(', ');
  return refs;
}

/**
 * Format generated files using locally-installed Prettier and ESLint (--fix).
 * Skips formatting if the tools are not installed locally to avoid interactive installs.
 */
export async function formatGeneratedFiles(
  rootDir: string,
  descriptions?: ApiDescription[]
) {
  try {
    const targets: string[] = [];
    if (descriptions && descriptions.length > 0) {
      for (const d of descriptions) {
        targets.push(join(rootDir, d.baseRoute));
      }
    } else {
      targets.push(rootDir);
    }

    const prettierBin = existsSync(
      join(
        process.cwd(),
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'prettier.cmd' : 'prettier'
      )
    )
      ? join(
          process.cwd(),
          'node_modules',
          '.bin',
          process.platform === 'win32' ? 'prettier.cmd' : 'prettier'
        )
      : null;
    const eslintBin = existsSync(
      join(
        process.cwd(),
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'eslint.cmd' : 'eslint'
      )
    )
      ? join(
          process.cwd(),
          'node_modules',
          '.bin',
          process.platform === 'win32' ? 'eslint.cmd' : 'eslint'
        )
      : null;

    if (!prettierBin && !eslintBin) {
      console.warn(
        "⚠️ Prettier and ESLint not installed locally. Skipping formatting step. Run 'npm install' to enable formatting."
      );
      return;
    }

    for (const t of targets) {
      if (prettierBin) {
        try {
          spawnSync(prettierBin, ['--write', t], {
            stdio: 'inherit',
            shell: true,
          });
        } catch (e) {
          // ignore
        }
      }

      if (eslintBin) {
        try {
          spawnSync(eslintBin, ['--fix', t, '--ext', '.ts'], {
            stdio: 'inherit',
            shell: true,
          });
        } catch (e) {
          // ignore
        }
      }
    }
  } catch (err) {
    return;
  }
}
