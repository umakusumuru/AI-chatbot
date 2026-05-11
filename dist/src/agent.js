"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sampleApiDescription = void 0;
exports.buildGeneratedModuleSource = buildGeneratedModuleSource;
exports.writeGeneratedModuleFile = writeGeneratedModuleFile;
exports.createAgentApiFiles = createAgentApiFiles;
exports.generateApisFromDirectory = generateApisFromDirectory;
exports.generateModuleImports = generateModuleImports;
exports.generateModuleReferences = generateModuleReferences;
const promises_1 = require("fs/promises");
const path_1 = require("path");
exports.sampleApiDescription = {
    featureName: "chat",
    baseRoute: "chat",
    moduleClassName: "ChatModule",
    controllerClassName: "ChatController",
    serviceClassName: "ChatService",
    routes: [
        {
            method: "get",
            path: "health",
            actionName: "getHealth",
            summary: "Returns API health status",
            responseType: "{ status: string; message: string }",
        },
        {
            method: "post",
            path: "message",
            actionName: "sendMessage",
            summary: "Sends a chat message and returns a response",
            requestDto: {
                name: "SendMessageDto",
                properties: [
                    { name: "message", type: "string", required: true },
                    { name: "sessionId", type: "string", required: false },
                ],
            },
            responseType: "{ reply: string }",
        },
    ],
};
function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
function mapSwaggerType(type) {
    if (type.includes("string"))
        return "String";
    if (type.includes("number"))
        return "Number";
    if (type.includes("boolean"))
        return "Boolean";
    if (type.includes("[]"))
        return "Array";
    return "Object";
}
function buildDtoSource(dtoName, properties) {
    const lines = properties.map((prop) => {
        const optional = prop.required ? "!" : "?";
        const swaggerType = mapSwaggerType(prop.type);
        const decorator = prop.required ?
            `  @ApiProperty({ required: true, type: ${swaggerType} })`
            : `  @ApiPropertyOptional({ required: false, type: ${swaggerType} })`;
        return `${decorator}
  ${prop.name}${optional}: ${prop.type};`;
    });
    return `import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ${dtoName} {
${lines.join("\n\n")}
}`;
}
function createRouteMethod(route) {
    const methodMap = {
        get: "Get",
        post: "Post",
        put: "Put",
        delete: "Delete",
        patch: "Patch",
    };
    const httpDecorator = `@${methodMap[route.method]}('${route.path}')`;
    const hasPathParam = /:(\w+)/.test(route.path);
    const paramName = route.path.match(/:(\w+)/)?.[1] ?? "id";
    const pathParam = hasPathParam ? `@Param('${paramName}') ${paramName}: string` : "";
    const bodyParam = route.requestDto ? `@Body() body: ${route.requestDto.name}` : "";
    const params = [pathParam, bodyParam].filter(Boolean).join(", ");
    const serviceArgs = [
        hasPathParam ? paramName : "",
        route.requestDto ? "body" : "",
    ]
        .filter(Boolean)
        .join(", ");
    const returnType = route.responseType ?? "any";
    const descriptionComment = route.summary ? `  // ${route.summary}\n` : "";
    const operationSummary = route.summary ?? route.actionName;
    const requestBodyDecorator = route.requestDto ? `  @ApiBody({ type: ${route.requestDto.name} })\n` : "";
    const notFoundResponse = hasPathParam ?
        "  @ApiNotFoundResponse({ description: 'Resource not found.' })\n"
        : "";
    return `${descriptionComment}  ${httpDecorator}
  @ApiOperation({ summary: '${operationSummary}' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
${notFoundResponse}${requestBodyDecorator}  ${route.actionName}(${params}): Observable<${returnType}> {
    return this.service.${route.actionName}(${serviceArgs});
  }
`;
}
function buildControllerSource(description) {
    const imports = [
        `import { Controller, Body, Param, Get, Post, Put, Delete, Patch } from '@nestjs/common';`,
        `import { ApiBody, ApiBadRequestResponse, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';`,
        `import { Observable } from 'rxjs';`,
        `import { ${description.serviceClassName} } from './${description.baseRoute}.service';`,
    ];
    const dtoImports = description.routes
        .filter((route) => route.requestDto)
        .map((route) => `import { ${route.requestDto.name} } from './dto/${route.requestDto.name}.dto';`);
    const methods = description.routes.map(createRouteMethod).join("\n");
    return `${[...imports, ...dtoImports].join("\n")}

@ApiTags('${description.baseRoute}')
@Controller('${description.baseRoute}')
export class ${description.controllerClassName} {
  constructor(private readonly service: ${description.serviceClassName}) {}

${methods}
}
`;
}
function buildServiceSource(description) {
    const methods = description.routes
        .map((route) => {
        const hasPathParam = /:(\w+)/.test(route.path);
        const paramName = route.path.match(/:(\w+)/)?.[1] ?? "id";
        const params = [
            hasPathParam ? `${paramName}: string` : "",
            route.requestDto ? `body: ${route.requestDto.name}` : "",
        ]
            .filter(Boolean)
            .join(", ");
        const returnType = route.responseType ?? "any";
        const requiredFields = route.requestDto ?
            route.requestDto.properties
                .filter((prop) => prop.required)
                .map((prop) => prop.name)
            : [];
        let validationBlock = "";
        if (requiredFields.length) {
            validationBlock = `    const missingFields = [${requiredFields
                .map((field) => `'${field}'`)
                .join(", ")}].filter((key) => !(body as any)?.[key]);
    if (missingFields.length) {
      return throwError(() => new BadRequestException(\`Missing required field(s): \${missingFields.join(', ')}\`));
    }

`;
        }
        let pathValidationBlock = "";
        if (hasPathParam) {
            pathValidationBlock = `    if (${paramName} === '0') {
      return throwError(() => new NotFoundException('Resource not found'));
    }

`;
        }
        let sampleResponse = "{}";
        if (route.requestDto) {
            sampleResponse = `{
      ...body,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      status: 'success'
    }`;
        }
        else if (route.method === "get" && returnType.includes("[]")) {
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
        }
        else {
            const idValue = hasPathParam ? paramName : "'1'";
            sampleResponse = `{
      id: ${hasPathParam ? paramName : "'1'"},
      name: 'Sample ${capitalize(route.actionName)}',
      email: 'sample@example.com'
    }`;
        }
        return `  ${route.actionName}(${params}): Observable<${returnType}> {
${validationBlock}${pathValidationBlock}    // Test data - Replace with actual business logic
    return of(${sampleResponse} as unknown as ${returnType});
  }
`;
    })
        .join("\n");
    const dtoImports = description.routes
        .filter((route) => route.requestDto)
        .map((route) => `import { ${route.requestDto.name} } from './dto/${route.requestDto.name}.dto';`);
    const allImports = [
        'import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";',
        'import { Observable, of, throwError } from "rxjs";',
        ...dtoImports,
    ];
    return `${allImports.join("\n")}

@Injectable()
export class ${description.serviceClassName} {
${methods}}
`;
}
function buildModuleSource(description) {
    return `import { Module } from '@nestjs/common';
import { ${description.controllerClassName} } from './${description.baseRoute}.controller';
import { ${description.serviceClassName} } from './${description.baseRoute}.service';

@Module({
  controllers: [${description.controllerClassName}],
  providers: [${description.serviceClassName}]
})
export class ${description.moduleClassName} {}
`;
}
function buildGeneratedModuleSource(descriptions) {
    const imports = descriptions
        .map((desc) => `import { ${desc.moduleClassName} } from './${desc.baseRoute}/${desc.baseRoute}.module';`)
        .join("\n");
    const names = descriptions.map((desc) => desc.moduleClassName).join(", ");
    return `import { Module } from '@nestjs/common';
${imports}

@Module({
  imports: [${names}],
  controllers: [],
  providers: [],
})
export class GeneratedModule {}
`;
}
async function writeGeneratedModuleFile(descriptions, rootDir) {
    const moduleSource = buildGeneratedModuleSource(descriptions);
    await writeFileContent((0, path_1.join)(rootDir, "generated.module.ts"), moduleSource);
}
async function ensureDirectory(pathSegments) {
    await (0, promises_1.mkdir)(pathSegments, { recursive: true });
}
async function writeFileContent(filePath, content) {
    await ensureDirectory((0, path_1.dirname)(filePath));
    await (0, promises_1.writeFile)(filePath, content, "utf8");
}
async function createAgentApiFiles(description, rootDir) {
    const featureDir = (0, path_1.join)(rootDir, description.baseRoute);
    const dtoDir = (0, path_1.join)(featureDir, "dto");
    await ensureDirectory(featureDir);
    await ensureDirectory(dtoDir);
    await writeFileContent((0, path_1.join)(featureDir, `${description.baseRoute}.module.ts`), buildModuleSource(description));
    await writeFileContent((0, path_1.join)(featureDir, `${description.baseRoute}.controller.ts`), buildControllerSource(description));
    await writeFileContent((0, path_1.join)(featureDir, `${description.baseRoute}.service.ts`), buildServiceSource(description));
    for (const route of description.routes) {
        if (route.requestDto) {
            await writeFileContent((0, path_1.join)(dtoDir, `${route.requestDto.name}.dto.ts`), buildDtoSource(route.requestDto.name, route.requestDto.properties));
        }
    }
}
async function generateApisFromDirectory(definitionsDir, outputDir) {
    try {
        const files = await (0, promises_1.readdir)(definitionsDir);
        const apiFiles = files.filter((f) => f.endsWith(".api.json"));
        if (apiFiles.length === 0) {
            console.log(`No .api.json files found in ${definitionsDir}`);
            return [];
        }
        const descriptions = [];
        for (const file of apiFiles) {
            const filePath = (0, path_1.join)(definitionsDir, file);
            const content = await (0, promises_1.readFile)(filePath, "utf-8");
            const description = JSON.parse(content);
            await createAgentApiFiles(description, outputDir);
            descriptions.push(description);
            console.log(`✓ Generated API for feature '${description.featureName}' from ${file}`);
        }
        return descriptions;
    }
    catch (error) {
        console.error(`Error scanning definitions directory: ${error}`);
        throw error;
    }
}
function generateModuleImports(descriptions) {
    if (descriptions.length === 0)
        return "";
    const imports = descriptions
        .map((desc) => `import { ${desc.moduleClassName} } from './${desc.baseRoute}/${desc.baseRoute}.module';`)
        .join("\n");
    return imports;
}
function generateModuleReferences(descriptions) {
    if (descriptions.length === 0)
        return "";
    const refs = descriptions.map((desc) => desc.moduleClassName).join(", ");
    return refs;
}
