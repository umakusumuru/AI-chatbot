import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { ApiDescription, ApiDtoProperty, ApiRoute } from '../agent';

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
function toSnakeCase(s: string) { return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''); }

function mapProtoType(type: string): string {
  if (type.includes('number') || type === 'int') return 'int32';
  if (type.includes('boolean')) return 'bool';
  if (type.includes('[]') || type === 'array') return 'repeated string';
  return 'string';
}

async function write(filePath: string, content: string) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

function buildProto(description: ApiDescription): string {
  const entityName = capitalize(description.featureName);
  const packageName = toSnakeCase(description.featureName);

  // Build request messages from DTOs
  const seen = new Set<string>();
  const messages: string[] = [];

  function buildMessage(name: string, props: ApiDtoProperty[]) {
    if (seen.has(name)) return;
    seen.add(name);

    for (const p of props) {
      if (p.properties?.length) buildMessage(`${name}${capitalize(p.name)}`, p.properties);
    }

    const fields = props.map((p, i) => {
      if (p.properties?.length) {
        const nested = `${name}${capitalize(p.name)}`;
        return `  ${nested} ${toSnakeCase(p.name)} = ${i + 1};`;
      }
      const protoType = mapProtoType(p.type || 'string');
      const optional = !p.required ? 'optional ' : '';
      return `  ${optional}${protoType} ${toSnakeCase(p.name)} = ${i + 1};`;
    });

    messages.push(`message ${name} {\n${fields.join('\n')}\n}`);
  }

  for (const route of description.routes) {
    if (route.requestDto) buildMessage(route.requestDto.name, route.requestDto.properties);
  }

  // Path param request messages
  const pathParamMessages = new Map<string, string>();
  for (const route of description.routes) {
    const match = route.path.match(/:(\w+)/);
    if (match) {
      const paramName = match[1];
      const msgName = `Get${entityName}By${capitalize(paramName)}Request`;
      if (!seen.has(msgName)) {
        seen.add(msgName);
        pathParamMessages.set(msgName, `message ${msgName} {\n  string ${toSnakeCase(paramName)} = 1;\n}`);
      }
    }
  }

  // Response messages
  const responseMsg = `message ${entityName} {\n  string id = 1;\n  string name = 2;\n  string email = 3;\n}`;
  const listMsg = `message ${entityName}List {\n  repeated ${entityName} items = 1;\n}`;
  const emptyMsg = `message Empty {}`;

  // RPC definitions
  const rpcs = description.routes.map(route => {
    const hasPathParam = /:(\w+)/.test(route.path);
    const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
    let requestMsg = 'Empty';
    if (route.requestDto) requestMsg = route.requestDto.name;
    else if (hasPathParam) requestMsg = `Get${entityName}By${capitalize(paramName)}Request`;
    const isList = (route.responseType ?? '').includes('[]');
    const responseType = isList ? `${entityName}List` : entityName;
    return `  rpc ${capitalize(route.actionName)} (${requestMsg}) returns (${responseType});`;
  }).join('\n');

  return `syntax = "proto3";

package ${packageName};

option java_package = "com.example.grpc.${packageName}";
option java_outer_classname = "${entityName}Proto";
option csharp_namespace = "GrpcService";

// Service definition
service ${entityName}Service {
${rpcs}
}

// Response messages
${responseMsg}

${listMsg}

${emptyMsg}

// Request messages
${messages.join('\n\n')}

${[...pathParamMessages.values()].join('\n\n')}
`;
}

function buildNestGrpcController(description: ApiDescription): string {
  const entityName = capitalize(description.featureName);
  const controllerName = `${entityName}GrpcController`;

  const methods = description.routes.map(route => {
    const hasPathParam = /:(\w+)/.test(route.path);
    const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
    let requestType = 'any';
    if (route.requestDto) requestType = route.requestDto.name;
    else if (hasPathParam) requestType = `{ ${paramName}: string }`;

    const isList = (route.responseType ?? '').includes('[]');
    const returnType = isList ? 'any[]' : 'any';
    const sampleReturn = isList
      ? `[{ id: '1', name: 'Sample Item 1' }, { id: '2', name: 'Sample Item 2' }]`
      : `{ id: '1', name: 'Sample ${route.actionName}', email: 'sample@example.com' }`;

    return `  /**
   * ${route.summary || route.actionName}
   *
   * @param data - ${requestType} gRPC request message
   * @returns ${isList ? `array of ${entityName} objects` : `${entityName} response message`}
   */
  @GrpcMethod('${entityName}Service', '${capitalize(route.actionName)}')
  ${route.actionName}(data: ${requestType}): ${returnType} {
    // TODO: replace with actual business logic
    return ${sampleReturn};
  }`;
  }).join('\n\n');

  const dtoImports = [...new Set(description.routes.filter(r => r.requestDto).map(r => r.requestDto!.name))];
  const importLine = dtoImports.length
    ? `\nimport { ${dtoImports.join(', ')} } from './dto/${description.featureName}.grpc.dto';\n`
    : '';

  return `import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
${importLine}
/**
 * gRPC controller for the ${entityName} service.
 * Each method maps to an RPC defined in ${toSnakeCase(description.featureName)}.proto.
 * The .proto file is the source of truth — keep method names in sync.
 */
@Controller()
export class ${controllerName} {

${methods}
}
`;
}

function buildGrpcDtos(description: ApiDescription): string {
  const classes: string[] = [];
  const seen = new Set<string>();

  function buildClass(name: string, props: ApiDtoProperty[]) {
    if (seen.has(name)) return;
    seen.add(name);
    for (const p of props) {
      if (p.properties?.length) buildClass(`${name}${capitalize(p.name)}`, p.properties);
    }
    const fields = props.map(p => {
      if (p.properties?.length) {
        const nested = `${name}${capitalize(p.name)}`;
        return `  ${p.name}${p.required ? '' : '?'}: ${nested};`;
      }
      const tsType = (p.type || 'string').includes('number') ? 'number' : (p.type || 'string').includes('boolean') ? 'boolean' : 'string';
      return `  ${p.name}${p.required ? '' : '?'}: ${tsType};`;
    });
    classes.push(`export interface ${name} {\n${fields.join('\n')}\n}`);
  }

  for (const route of description.routes) {
    if (route.requestDto) buildClass(route.requestDto.name, route.requestDto.properties);
  }

  return classes.join('\n\n') + '\n';
}

function buildVendorService(description: ApiDescription): string {
  const cap = capitalize(description.featureName);
  const vendorRoutes = description.routes.filter(r => r.vendor);

  const methods = vendorRoutes.length > 0
    ? vendorRoutes.map(route => {
        const v = route.vendor!;
        const httpMethod = (v.method ?? route.method).toUpperCase();
        const hasPathParam = /:(\w+)/.test(route.path);
        const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
        const params = [
          hasPathParam ? `${paramName}: string` : '',
          route.requestDto ? `body?: Record<string, unknown>` : '',
        ].filter(Boolean).join(', ');
        const urlExpr = v.url.replace(/:(\w+)/g, (_: string, k: string) => `\${${k}}`);
        return `  async ${route.actionName}(${params}): Promise<unknown> {
    if (process.env.VENDOR_MOCK === 'true') {
      return { mocked: true, action: '${route.actionName}' };
    }
    const response = await fetch(\`${urlExpr}\`, {
      method: '${httpMethod}',
      headers: ${JSON.stringify(v.headers ?? { 'Content-Type': 'application/json' })},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(\`Vendor error \${response.status}\`);
    return response.json();
  }`;
      }).join('\n\n')
    : `  async fetchExternal(url: string, body?: unknown): Promise<unknown> {
    if (process.env.VENDOR_MOCK === 'true') {
      return { mocked: true };
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(\`Vendor error \${response.status}\`);
    return response.json();
  }`;

  return `import { Injectable } from '@nestjs/common';

@Injectable()
export class ${cap}VendorService {
${methods}
}
`;
}

function buildControllerSpec(description: ApiDescription): string {
  const cap = capitalize(description.featureName);
  const controllerClass = cap + 'GrpcController';
  const name = toSnakeCase(description.featureName);
  const vitestImport = description.testFramework === 'vitest'
    ? `import { describe, it, expect, beforeEach } from 'vitest';\n`
    : '';

  const tests = description.routes.map(route => {
    const hasPathParam = /:(\w+)/.test(route.path);
    const args = [
      hasPathParam ? `{ id: '1' }` : '',
      route.requestDto
        ? `{ ${route.requestDto.properties.map(p => `${p.name}: '${p.name}-test'`).join(', ')} }`
        : '',
    ].filter(Boolean).join(', ') || '{}';

    return `  it('should ${route.actionName}', async () => {
    const result = await controller.${route.actionName}(${args});
    expect(result).toBeDefined();
  });`;
  }).join('\n\n');

  return `${vitestImport}import { Test, TestingModule } from '@nestjs/testing';
import { ${controllerClass} } from './${name}.grpc.controller';

describe('${controllerClass}', () => {
  let controller: ${controllerClass};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [${controllerClass}],
    }).compile();
    controller = module.get<${controllerClass}>(${controllerClass});
  });

${tests}
});
`;
}

export async function createGrpcFiles(description: ApiDescription, rootDir: string) {
  const base = join(rootDir, description.baseRoute);
  const name = toSnakeCase(description.featureName);

  await write(join(base, `${name}.proto`), buildProto(description));
  await write(join(base, `${name}.grpc.controller.ts`), buildNestGrpcController(description));
  await write(join(base, `${name}.vendor.service.ts`), buildVendorService(description));
  await write(join(base, `${name}.grpc.controller.spec.ts`), buildControllerSpec(description));

  const hasDtos = description.routes.some(r => r.requestDto);
  if (hasDtos) {
    await write(join(base, 'dto', `${name}.grpc.dto.ts`), buildGrpcDtos(description));
  }

  console.log(`✓ [gRPC] Generated for '${description.featureName}' → ${base}`);
}
