import { mkdir, writeFile, readFile, access } from 'fs/promises';
import { dirname, join, relative } from 'path';
import { ApiDescription, ApiDtoProperty, ApiRoute } from '../agent';


function toSnakeCase(s: string): string {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function mapPyType(type: string, required = true): string {
  const base = type.includes('number') || type === 'int'
    ? 'int'
    : type.includes('boolean')
    ? 'bool'
    : type.includes('[]') || type === 'array'
    ? 'List[str]'
    : 'str';
  return required ? base : `Optional[${base}]`;
}

async function write(filePath: string, content: string) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

function buildSchema(description: ApiDescription): string {
  const models: string[] = [];
  const seen = new Set<string>();

  function buildModel(name: string, props: ApiDtoProperty[]) {
    if (seen.has(name)) return;
    seen.add(name);

    for (const p of props) {
      if (p.properties?.length) {
        buildModel(`${name}${capitalize(p.name)}`, p.properties);
      }
    }

    const fields = props.map(p => {
      if (p.properties?.length) {
        const nested = `${name}${capitalize(p.name)}`;
        return p.required
          ? `    ${toSnakeCase(p.name)}: ${nested}`
          : `    ${toSnakeCase(p.name)}: Optional[${nested}] = None`;
      }
      const pyType = mapPyType(p.type || 'str', p.required !== false);
      return p.required
        ? `    ${toSnakeCase(p.name)}: ${pyType}`
        : `    ${toSnakeCase(p.name)}: ${pyType} = None`;
    });

    models.push(`class ${name}(BaseModel):\n${fields.join('\n')}`);
  }

  for (const route of description.routes) {
    if (route.requestDto) buildModel(route.requestDto.name, route.requestDto.properties);
  }

  const entityName = capitalize(description.featureName);
  models.push(`class ${entityName}Response(BaseModel):\n    id: str\n    name: str\n    email: Optional[str] = None`);

  return `from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, List

${models.join('\n\n')}
`;
}

function buildService(description: ApiDescription): string {
  const className = capitalize(description.featureName) + 'Service';

  const methods = description.routes.map(route => {
    const hasPathParam = /:(\w+)/.test(route.path);
    const paramName = toSnakeCase(route.path.match(/:(\w+)/)?.[1] ?? 'id');
    const params: string[] = ['self'];
    if (hasPathParam) params.push(`${paramName}: str`);
    if (route.requestDto) params.push(`body: "${route.requestDto.name}"`);

    const isList = (route.responseType ?? '').includes('[]');
    const returnType = isList ? 'List[dict]' : 'dict';
    const sampleReturn = isList
      ? 'return [{"id": "1", "name": "Sample Item 1"}, {"id": "2", "name": "Sample Item 2"}]'
      : `return {"id": ${hasPathParam ? paramName : '"1"'}, "name": "Sample ${route.actionName}"}`;

    const argsDocs = params.slice(1).length
      ? params.slice(1).map(p => `            ${p.split(':')[0].trim()}: ${p.split(':')[1]?.trim() ?? 'value'}`).join('\n')
      : '            (no parameters)';

    return `    def ${toSnakeCase(route.actionName)}(${params.join(', ')}) -> ${returnType}:
        """${route.summary || route.actionName}.

        Args:
${argsDocs}

        Returns:
            ${returnType}
        """
        # TODO: replace with actual business logic
        ${sampleReturn}`;
  }).join('\n\n');

  return `from typing import List

class ${className}:
    """Service layer for the ${capitalize(description.featureName)} feature.

    Contains business logic for all ${description.baseRoute} operations.
    Replace the stub implementations with real data access logic.
    """

${methods}
`;
}

function buildRouter(description: ApiDescription): string {
  const methodMap: Record<string, string> = {
    get: 'get', post: 'post', put: 'put', delete: 'delete', patch: 'patch',
  };

  const schemaName = toSnakeCase(description.featureName) + '_schema';
  const serviceName = toSnakeCase(description.featureName) + '_service';
  const serviceClass = capitalize(description.featureName) + 'Service';

  const dtoNames = [...new Set(description.routes.filter(r => r.requestDto).map(r => r.requestDto!.name))];
  const schemaImport = dtoNames.length
    ? `from .${schemaName} import ${dtoNames.join(', ')}, ${capitalize(description.featureName)}Response`
    : `from .${schemaName} import ${capitalize(description.featureName)}Response`;

  const routes = description.routes.map(route => {
    const hasPathParam = /:(\w+)/.test(route.path);
    const paramName = toSnakeCase(route.path.match(/:(\w+)/)?.[1] ?? 'id');
    const urlPath = '/' + route.path.replace(/^\//, '').replace(/:(\w+)/g, '{$1}') || '/';
    const isList = (route.responseType ?? '').includes('[]');
    const responseModel = isList
      ? `List[${capitalize(description.featureName)}Response]`
      : capitalize(description.featureName) + 'Response';

    const funcParams: string[] = [];
    if (hasPathParam) funcParams.push(`${paramName}: str`);
    if (route.requestDto) funcParams.push(`body: ${route.requestDto.name}`);

    const serviceArgs = [
      hasPathParam ? paramName : '',
      route.requestDto ? 'body' : '',
    ].filter(Boolean).join(', ');

    const argsDocs = funcParams.length
      ? `\n    Args:\n${funcParams.map(p => `        ${p.split(':')[0].trim()}: ${p.split(':')[1]?.trim() ?? 'value'}`).join('\n')}\n\n    Returns:\n        ${responseModel}`
      : `\n    Returns:\n        ${responseModel}`;

    return `@router.${methodMap[route.method]}("${urlPath}", response_model=${responseModel}, summary="${route.summary || route.actionName}")
async def ${toSnakeCase(route.actionName)}(${funcParams.join(', ')}):
    """${route.summary || route.actionName}.
${argsDocs}
    """
    return service.${toSnakeCase(route.actionName)}(${serviceArgs})`;
  }).join('\n\n');

  return `from fastapi import APIRouter, HTTPException
from typing import List
${schemaImport}
from .${serviceName} import ${serviceClass}

router = APIRouter(prefix="/api/${description.baseRoute}", tags=["${description.featureName}"])
service = ${serviceClass}()

${routes}
`;
}

async function updateMainPy(mainPyPath: string, featureName: string, featureBase: string, rootDir: string): Promise<void> {
  // Skip entirely if main.py does not exist
  try { await access(mainPyPath); } catch { return; }

  const name = toSnakeCase(featureName);

  // Compute import module path relative to rootDir (where main.py lives)
  const relPath = relative(rootDir, featureBase).replace(/\\/g, '/');
  const modulePath = relPath ? `${relPath.replace(/\//g, '.')}.${name}_router` : `${name}_router`;

  const importLine = `from ${modulePath} import router as ${name}_router`;
  const includeRouterLine = `app.include_router(${name}_router)`;

  const content = await readFile(mainPyPath, 'utf-8');

  // Nothing to do if already registered
  if (content.includes(includeRouterLine)) return;

  const lines = content.split('\n');

  // Insert import after the last router import line (or after 'from fastapi import FastAPI')
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('from ') && lines[i].includes('_router')) lastImportIdx = i;
  }
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
  } else {
    const fastapiIdx = lines.findIndex(l => l.startsWith('from fastapi import'));
    lines.splice(fastapiIdx >= 0 ? fastapiIdx + 1 : 0, 0, importLine);
  }

  // Insert include_router after the last app.include_router(...) line
  let lastIncludeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('app.include_router(')) lastIncludeIdx = i;
  }
  if (lastIncludeIdx >= 0) {
    lines.splice(lastIncludeIdx + 1, 0, includeRouterLine);
  }

  await writeFile(mainPyPath, lines.join('\n'), 'utf-8');
  console.log(`✓ [FastAPI] Updated main.py — added ${name}_router`);
}



function buildVendorService(description: ApiDescription): string {
  const name = toSnakeCase(description.featureName);
  const vendorRoutes = description.routes.filter(r => r.vendor);

  const methods = vendorRoutes.length > 0
    ? vendorRoutes.map(route => {
        const v = route.vendor!;
        const httpMethod = (v.method ?? route.method).toLowerCase();
        const hasPathParam = /:(\w+)/.test(route.path);
        const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
        const params = [
          hasPathParam ? `${paramName}: str` : '',
          route.requestDto ? `body: dict` : '',
        ].filter(Boolean).join(', ');
        const url = `f"${v.url.replace(/:(\w+)/g, (_: string, k: string) => `{${k}}`)}"`;
        const sendArg = route.requestDto ? ', json=body' : '';
        return `    async def ${toSnakeCase(route.actionName)}(self${params ? ', ' + params : ''}) -> dict:
        if os.getenv("VENDOR_MOCK") == "true":
            return {"mocked": True, "action": "${route.actionName}"}
        async with httpx.AsyncClient() as client:
            response = await client.${httpMethod}(${url}${sendArg},
                headers={"Content-Type": "application/json"})
            response.raise_for_status()
            return response.json()`;
      }).join('\n\n')
    : `    async def fetch_external(self, url: str, body: dict | None = None) -> dict:
        if os.getenv("VENDOR_MOCK") == "true":
            return {"mocked": True}
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=body,
                headers={"Content-Type": "application/json"})
            response.raise_for_status()
            return response.json()`;

  return `import os
import httpx


class ${toPascalCase(name)}VendorService:

${methods}


${name}_vendor_service = ${toPascalCase(name)}VendorService()
`;

  function toPascalCase(s: string): string {
    return s.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  }
}

function buildTests(description: ApiDescription): string {
  const name = toSnakeCase(description.featureName);
  const useUnittest = description.testFramework === 'unittest';

  const routeTests = description.routes.map(route => {
    const testPath = '/api/' + description.baseRoute + '/' +
      route.path.replace(/^\//, '').replace(/:(\w+)/g, 'test-id');
    const cleanPath = testPath.replace(/\/+$/, '');
    const method = route.method;
    let bodyLine = '';
    if (route.requestDto) {
      const sample = Object.fromEntries(
        route.requestDto.properties.map(p => [
          p.name,
          (p.type ?? 'string').includes('number') ? 1 : `${p.name}-test`,
        ])
      );
      bodyLine = `, json=${JSON.stringify(sample)}`;
    }

    if (useUnittest) {
      return `    def test_${toSnakeCase(route.actionName)}(self):
        response = self.client.${method}("${cleanPath}"${bodyLine})
        self.assertLess(response.status_code, 500)`;
    }
    return `def test_${toSnakeCase(route.actionName)}():
    response = client.${method}("${cleanPath}"${bodyLine})
    assert response.status_code < 500`;
  }).join('\n\n');

  if (useUnittest) {
    return `import unittest
from fastapi.testclient import TestClient
from main import app


class Test${toPascalCase(name)}(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

${routeTests}


if __name__ == "__main__":
    unittest.main()
`;

    function toPascalCase(s: string): string {
      return s.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    }
  }

  return `import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


${routeTests}
`;
}

function toPascalCase(s: string): string {
  return s.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

export async function createFastApiFiles(description: ApiDescription, rootDir: string) {
  const base = description.outputMode === 'path'
    ? rootDir
    : join(rootDir, description.featureName);
  const name = toSnakeCase(description.featureName);

  await write(join(base, `${name}_router.py`), buildRouter(description));
  await write(join(base, `${name}_service.py`), buildService(description));
  await write(join(base, `${name}_schema.py`), buildSchema(description));
  await write(join(base, `${name}_vendor_service.py`), buildVendorService(description));
  await write(join(base, `test_${name}.py`), buildTests(description));
  await write(join(base, '__init__.py'), '');
  await updateMainPy(join(rootDir, 'main.py'), description.featureName, base, rootDir);

  console.log(`✓ [FastAPI] Generated for '${description.featureName}' → ${base}`);
}
