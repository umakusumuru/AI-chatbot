import { mkdir, writeFile } from 'fs/promises';
import { basename, dirname, join } from 'path';

export interface ApiDtoProperty {
  name: string;
  type: string;
  required?: boolean;
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
      responseType: '{ status: string; message: string }'
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
          { name: 'sessionId', type: 'string', required: false }
        ]
      },
      responseType: '{ reply: string }'
    }
  ]
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildDtoSource(dtoName: string, properties: ApiDtoProperty[]) {
  const lines = properties.map((prop) => {
    const optional = prop.required ? '' : '?';
    return `  ${prop.name}${optional}: ${prop.type};`;
  });

  return `export class ${dtoName} {
${lines.join('\n')}
}`;
}

function createRouteMethod(route: ApiRoute) {
  const httpDecorator = `@${route.method.toUpperCase()}('${route.path}')`;
  const bodyParam = route.requestDto ? `@Body() body: ${route.requestDto.name}` : '';
  const params = [bodyParam].filter(Boolean).join(', ');
  const returnType = route.responseType ?? 'any';
  const descriptionComment = route.summary ? `  // ${route.summary}\n` : '';

  return `${descriptionComment}  ${httpDecorator}
  async ${route.actionName}(${params}): Promise<${returnType}> {
    return this.service.${route.actionName}(${route.requestDto ? 'body' : ''});
  }
`;
}

function buildControllerSource(description: ApiDescription) {
  const imports = [`import { Controller, Body, Get, Post, Put, Delete, Patch } from '@nestjs/common';`, `import { ${description.serviceClassName} } from './${description.baseRoute}.service';`];

  const dtoImports = description.routes
    .filter((route) => route.requestDto)
    .map((route) => `import { ${route.requestDto!.name} } from './dto/${route.requestDto!.name}.dto';`);

  const methods = description.routes.map(createRouteMethod).join('\n');

  return `${[...imports, ...dtoImports].join('\n')}

@Controller('${description.baseRoute}')
export class ${description.controllerClassName} {
  constructor(private readonly service: ${description.serviceClassName}) {}

${methods}
}
`;
}

function buildServiceSource(description: ApiDescription) {
  const methods = description.routes
    .map((route) => {
      const params = route.requestDto ? `body: ${route.requestDto.name}` : '';
      const returnType = route.responseType ?? 'any';
      const responseValue = route.requestDto
        ? `{
      reply: \`Received ${route.requestDto.properties[0].name}: \${body.${route.requestDto.properties[0].name}}\`
    }`
        : `{
      status: 'ok',
      message: 'API is healthy'
    }`;

      return `  async ${route.actionName}(${params}): Promise<${returnType}> {
    return ${responseValue};
  }
`;
    })
    .join('\n');

  const dtoImports = description.routes
    .filter((route) => route.requestDto)
    .map((route) => `import { ${route.requestDto!.name} } from './dto/${route.requestDto!.name}.dto';`);

  return `${['import { Injectable } from '@nestjs/common';', ...dtoImports].join('\n')}

@Injectable()
export class ${description.serviceClassName} {
${methods}}
`;
}

function buildModuleSource(description: ApiDescription) {
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

async function ensureDirectory(pathSegments: string) {
  await mkdir(pathSegments, { recursive: true });
}

async function writeFileContent(filePath: string, content: string) {
  await ensureDirectory(dirname(filePath));
  await writeFile(filePath, content, 'utf8');
}

export async function createAgentApiFiles(description: ApiDescription, rootDir: string) {
  const featureDir = join(rootDir, description.baseRoute);
  const dtoDir = join(featureDir, 'dto');

  await ensureDirectory(featureDir);
  await ensureDirectory(dtoDir);

  await writeFileContent(join(featureDir, `${description.baseRoute}.module.ts`), buildModuleSource(description));
  await writeFileContent(join(featureDir, `${description.baseRoute}.controller.ts`), buildControllerSource(description));
  await writeFileContent(join(featureDir, `${description.baseRoute}.service.ts`), buildServiceSource(description));

  for (const route of description.routes) {
    if (route.requestDto) {
      await writeFileContent(join(dtoDir, `${route.requestDto.name}.dto.ts`), buildDtoSource(route.requestDto.name, route.requestDto.properties));
    }
  }
}
