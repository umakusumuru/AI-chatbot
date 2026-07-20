import * as path from 'path';
import * as fs from 'fs';
import { spawnSync, spawn } from 'child_process';
import {
  createAgentApiFiles,
  generateApisFromDirectory,
  generateApiFromFile,
  writeGeneratedModuleFile,
  formatGeneratedFiles,
  ApiDescription,
  ApiRoute,
  sampleApiDescription,
} from '../src/agent';
import * as http from 'http';
import { URL } from 'url';
import { GeminiiClient } from '../src/geminii';
import { readdir, readFile } from 'fs/promises';

const TEST_PORT = 4000;
const SERVER_URL = `http://localhost:${TEST_PORT}/api`;
const START_TIMEOUT_MS = 15000;
const TEST_ROUTE_TIMEOUT_MS = 10000;

function parseArgs() {
  const args = process.argv.slice(2);
  let outputDir = 'src';
  let definitionsDir = 'src/api-definitions';
  let apiFile: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--file=')) {
      apiFile = arg.slice('--file='.length);
    } else if (arg.startsWith('--api=')) {
      apiFile = arg.slice('--api='.length);
    } else if (arg.startsWith('--output=')) {
      outputDir = arg.slice('--output='.length);
    } else if (arg.startsWith('--output-dir=')) {
      outputDir = arg.slice('--output-dir='.length);
    } else if (arg.startsWith('--definitions=')) {
      definitionsDir = arg.slice('--definitions='.length);
    } else if (arg.startsWith('--definitions-dir=')) {
      definitionsDir = arg.slice('--definitions-dir='.length);
    } else if (arg.startsWith('--')) {
      continue;
    } else if (outputDir === 'src') {
      outputDir = arg;
    } else if (definitionsDir === 'src/api-definitions') {
      definitionsDir = arg;
    } else {
      apiFile = arg;
    }
  }

  return { outputDir, definitionsDir, apiFile };
}

// ─── API Definition Validation ────────────────────────────────────────────────

const VALID_HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const;

function validateDtoProperties(
  properties: unknown,
  fieldPath: string,
  errors: string[]
): void {
  if (!Array.isArray(properties)) {
    errors.push(`${fieldPath}: must be an array`);
    return;
  }

  properties.forEach((prop: unknown, i: number) => {
    const propPath = `${fieldPath}[${i}]`;

    if (typeof prop !== 'object' || prop === null) {
      errors.push(`${propPath}: must be an object`);
      return;
    }

    const p = prop as Record<string, unknown>;

    if (typeof p.name !== 'string' || p.name.trim() === '') {
      errors.push(
        `${propPath}.name: required non-empty string, got ${JSON.stringify(p.name)}`
      );
    }

    if (typeof p.type !== 'string' || p.type.trim() === '') {
      errors.push(
        `${propPath}.type: required non-empty string, got ${JSON.stringify(p.type)}`
      );
    }

    if (p.required !== undefined && typeof p.required !== 'boolean') {
      errors.push(
        `${propPath}.required: must be boolean, got ${JSON.stringify(p.required)}`
      );
    }

    if (p.properties !== undefined) {
      validateDtoProperties(p.properties, `${propPath}.properties`, errors);
    }
  });
}

function validateApiDescription(data: unknown, fileName: string): string[] {
  const errors: string[] = [];

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return [`${fileName}: root value must be a JSON object`];
  }

  const d = data as Record<string, unknown>;

  for (const field of [
    'featureName',
    'baseRoute',
    'moduleClassName',
    'controllerClassName',
    'serviceClassName',
  ] as const) {
    if (typeof d[field] !== 'string' || (d[field] as string).trim() === '') {
      errors.push(
        `${fileName} → ${field}: required non-empty string, got ${JSON.stringify(d[field])}`
      );
    }
  }

  if (
    typeof d.moduleClassName === 'string' &&
    !d.moduleClassName.endsWith('Module')
  ) {
    errors.push(
      `${fileName} → moduleClassName: should end with "Module" (got "${d.moduleClassName}")`
    );
  }
  if (
    typeof d.controllerClassName === 'string' &&
    !d.controllerClassName.endsWith('Controller')
  ) {
    errors.push(
      `${fileName} → controllerClassName: should end with "Controller" (got "${d.controllerClassName}")`
    );
  }
  if (
    typeof d.serviceClassName === 'string' &&
    !d.serviceClassName.endsWith('Service')
  ) {
    errors.push(
      `${fileName} → serviceClassName: should end with "Service" (got "${d.serviceClassName}")`
    );
  }

  if (!Array.isArray(d.routes)) {
    errors.push(`${fileName} → routes: must be an array`);
    return errors;
  }

  if (d.routes.length === 0) {
    errors.push(`${fileName} → routes: must contain at least one route`);
  }

  const seenActionNames = new Set<string>();

  d.routes.forEach((route: unknown, i: number) => {
    const routePath = `${fileName} → routes[${i}]`;

    if (typeof route !== 'object' || route === null) {
      errors.push(`${routePath}: must be an object`);
      return;
    }

    const r = route as Record<string, unknown>;

    if (!VALID_HTTP_METHODS.includes(r.method as never)) {
      errors.push(
        `${routePath}.method: must be one of [${VALID_HTTP_METHODS.join(', ')}], got ${JSON.stringify(r.method)}`
      );
    }

    if (typeof r.path !== 'string') {
      errors.push(
        `${routePath}.path: must be a string, got ${JSON.stringify(r.path)}`
      );
    }

    if (typeof r.actionName !== 'string' || r.actionName.trim() === '') {
      errors.push(
        `${routePath}.actionName: required non-empty string, got ${JSON.stringify(r.actionName)}`
      );
    } else {
      if (seenActionNames.has(r.actionName)) {
        errors.push(
          `${routePath}.actionName: duplicate action name "${r.actionName}"`
        );
      } else {
        seenActionNames.add(r.actionName);
      }
    }

    if (r.requestDto !== undefined) {
      const dtoPath = `${routePath}.requestDto`;
      if (typeof r.requestDto !== 'object' || r.requestDto === null) {
        errors.push(`${dtoPath}: must be an object`);
      } else {
        const dto = r.requestDto as Record<string, unknown>;
        if (typeof dto.name !== 'string' || dto.name.trim() === '') {
          errors.push(
            `${dtoPath}.name: required non-empty string, got ${JSON.stringify(dto.name)}`
          );
        }
        validateDtoProperties(dto.properties, `${dtoPath}.properties`, errors);
      }
    }

    if (r.vendor !== undefined) {
      const vendorPath = `${routePath}.vendor`;
      if (typeof r.vendor !== 'object' || r.vendor === null) {
        errors.push(`${vendorPath}: must be an object`);
      } else {
        const v = r.vendor as Record<string, unknown>;
        if (typeof v.url !== 'string' || v.url.trim() === '') {
          errors.push(
            `${vendorPath}.url: required non-empty string, got ${JSON.stringify(v.url)}`
          );
        }
        if (
          v.method !== undefined &&
          !VALID_HTTP_METHODS.includes(v.method as never)
        ) {
          errors.push(
            `${vendorPath}.method: must be one of [${VALID_HTTP_METHODS.join(', ')}], got ${JSON.stringify(v.method)}`
          );
        }
        if (
          v.headers !== undefined &&
          (typeof v.headers !== 'object' || Array.isArray(v.headers))
        ) {
          errors.push(
            `${vendorPath}.headers: must be a key-value object, got ${JSON.stringify(v.headers)}`
          );
        }
      }
    }
  });

  return errors;
}

async function validateApiFiles(
  definitionsDir: string,
  apiFile?: string
): Promise<void> {
  const filesToCheck: string[] = [];

  if (apiFile) {
    const normalizedFile = apiFile.endsWith('.api.json')
      ? apiFile
      : `${apiFile}.api.json`;
    const apiFilePath = path.isAbsolute(normalizedFile)
      ? normalizedFile
      : path.join(definitionsDir, normalizedFile);
    filesToCheck.push(apiFilePath);
  } else {
    const files = await readdir(definitionsDir).catch(() => [] as string[]);
    filesToCheck.push(
      ...files
        .filter((f) => f.endsWith('.api.json'))
        .map((f) => path.join(definitionsDir, f))
    );
  }

  const allErrors: { file: string; errors: string[] }[] = [];

  for (const filePath of filesToCheck) {
    const fileName = path.basename(filePath);
    let raw: string;

    try {
      raw = await readFile(filePath, 'utf-8');
    } catch {
      allErrors.push({
        file: fileName,
        errors: [`Cannot read file: ${filePath}`],
      });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      allErrors.push({
        file: fileName,
        errors: [`Invalid JSON — ${(e as Error).message}`],
      });
      continue;
    }

    const errors = validateApiDescription(parsed, fileName);
    if (errors.length > 0) {
      allErrors.push({ file: fileName, errors });
    }
  }

  if (allErrors.length > 0) {
    const lines: string[] = ['❌ API definition validation failed:\n'];
    for (const { file, errors } of allErrors) {
      lines.push(`  ${file}`);
      for (const err of errors) {
        lines.push(`    • ${err}`);
      }
      lines.push('');
    }
    throw new Error(lines.join('\n'));
  }

  const count = filesToCheck.length;
  console.log(
    `✅ Validated ${count} API definition file${count !== 1 ? 's' : ''}.`
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function formatRoutePath(baseRoute: string, routePath: string): string {
  const cleanedPath = routePath.replace(/(^\/)|(\/$)/g, '');
  const normalized = cleanedPath.replace(/:[^/]+/g, '1');
  return normalized ? `${baseRoute}/${normalized}` : baseRoute;
}

interface RequestDtoDefinition {
  name: string;
  properties: { name: string; type: string; required?: boolean }[];
}

function sampleBodyForDto(dto: RequestDtoDefinition) {
  const body: Record<string, unknown> = {};

  for (const property of dto.properties) {
    if (property.type.includes('string')) {
      body[property.name] = `${property.name}-sample`;
    } else if (property.type.includes('number')) {
      body[property.name] = 1;
    } else if (property.type.includes('boolean')) {
      body[property.name] = true;
    } else if (property.type.includes('[]')) {
      body[property.name] = [];
    } else {
      body[property.name] = null;
    }
  }

  return body;
}

function httpRequest(
  method: string,
  url: string,
  body?: unknown
): Promise<{ statusCode: number; data: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const request = http.request(
      {
        hostname: parsedUrl.hostname,
        port: Number(parsedUrl.port),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            data: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );

    request.on('error', reject);

    if (body) {
      request.write(JSON.stringify(body));
    }

    request.end();
  });
}

async function generateApisFromDirectoryGeminii(
  definitionsDir: string,
  outputDir: string,
  apiKey: string,
  apiFile?: string
): Promise<ApiDescription[]> {
  const client = new GeminiiClient(apiKey);
  const descriptions: ApiDescription[] = [];

  const apiFiles: string[] = [];
  if (apiFile) {
    const normalizedFile = apiFile.endsWith('.api.json')
      ? apiFile
      : `${apiFile}.api.json`;
    const apiFilePath = path.isAbsolute(normalizedFile)
      ? normalizedFile
      : path.join(definitionsDir, normalizedFile);
    apiFiles.push(path.basename(apiFilePath));
    const raw = await readFile(apiFilePath, 'utf-8');
    const description: ApiDescription = JSON.parse(raw);
    descriptions.push(description);

    const generatedFiles = await client.generateFiles(description);
    for (const generatedFile of generatedFiles) {
      const filePath = path.join(outputDir, generatedFile.path);
      await ensureDirectory(path.dirname(filePath));
      await writeFile(filePath, generatedFile.content, 'utf8');
    }
    console.log(
      `✓ Generated feature '${description.featureName}' via geminii from ${apiFiles[0]}`
    );
    return descriptions;
  }

  const files = await readdir(definitionsDir);
  const definitionFiles = files.filter((file) => file.endsWith('.api.json'));

  if (definitionFiles.length === 0) {
    return [];
  }

  for (const file of definitionFiles) {
    const raw = await readFile(path.join(definitionsDir, file), 'utf-8');
    const description: ApiDescription = JSON.parse(raw);
    descriptions.push(description);

    const generatedFiles = await client.generateFiles(description);
    for (const generatedFile of generatedFiles) {
      const filePath = path.join(outputDir, generatedFile.path);
      await ensureDirectory(path.dirname(filePath));
      await writeFile(filePath, generatedFile.content, 'utf8');
    }
    console.log(
      `✓ Generated feature '${description.featureName}' via geminii from ${file}`
    );
  }

  return descriptions;
}

async function ensureDirectory(dirPath: string) {
  const { mkdir } = await import('fs/promises');
  await mkdir(dirPath, { recursive: true });
}

async function writeFile(
  filePath: string,
  content: string,
  encoding: BufferEncoding
) {
  const { writeFile } = await import('fs/promises');
  await writeFile(filePath, content, encoding);
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await httpRequest('GET', url);
      if (result.statusCode >= 200 && result.statusCode < 500) {
        return;
      }
    } catch {
      // ignore and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

async function testGeneratedApis(descriptions: ApiDescription[]) {
  const failures: string[] = [];

  for (const description of descriptions) {
    for (const route of description.routes) {
      const routePath = formatRoutePath(description.baseRoute, route.path);
      const url = `${SERVER_URL}/${routePath}`;
      const method = route.method.toUpperCase();
      const body = route.requestDto
        ? sampleBodyForDto(route.requestDto)
        : undefined;

      try {
        const result = await httpRequest(method, url, body);
        if (![200, 201, 204].includes(result.statusCode)) {
          failures.push(`${method} ${url} returned ${result.statusCode}`);
        }
      } catch (error) {
        failures.push(`${method} ${url} failed: ${error}`);
      }
    }
  }

  if (failures.length) {
    throw new Error(`API tests failed:\n${failures.join('\n')}`);
  }
}

function printTestSummary(resultsFile: string) {
  try {
    const raw = fs.readFileSync(resultsFile, 'utf-8');
    const r = JSON.parse(raw);
    const passed = r.numPassedTests ?? 0;
    const failed = r.numFailedTests ?? 0;
    const pending = r.numPendingTests ?? 0;
    const total = r.numTotalTests ?? 0;
    const suites = r.numTotalTestSuites ?? 0;
    const duration = r.testResults
      ? (r.testResults.reduce((sum: number, t: any) => sum + (t.endTime - t.startTime), 0) / 1000).toFixed(2)
      : '?';

    console.log('\n══════════════════════════════════════════');
    console.log('  📊 Test Summary');
    console.log('══════════════════════════════════════════');
    console.log(`  Suites : ${suites}`);
    console.log(`  Total  : ${total}`);
    console.log(`  ✅ Passed : ${passed}`);
    if (failed > 0)  console.log(`  ❌ Failed : ${failed}`);
    if (pending > 0) console.log(`  ⏭  Skipped: ${pending}`);
    console.log(`  ⏱  Time   : ${duration}s`);
    console.log('══════════════════════════════════════════\n');
  } catch {
    // results file missing or malformed — Jest already printed the summary
  }
}

function printCoverageSummary(featureName?: string) {
  const summaryPath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
  try {
    const raw = fs.readFileSync(summaryPath, 'utf-8');
    const cov = JSON.parse(raw);

    console.log('══════════════════════════════════════════');
    console.log('  📈 Coverage Summary');
    console.log('══════════════════════════════════════════');

    const entries = Object.entries(cov).filter(([file]) => file !== 'total');
    for (const [file, data] of entries) {
      const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
      if (featureName && !rel.includes(featureName)) continue;
      const d = data as any;
      const pct = (k: string) => String(d[k].pct).padStart(6);
      console.log(`  ${rel}`);
      console.log(`    Stmts:${pct('statements')}%  Branch:${pct('branches')}%  Funcs:${pct('functions')}%  Lines:${pct('lines')}%`);
    }

    const t = (cov as any).total;
    if (t) {
      const pct = (k: string) => String(t[k].pct).padStart(6);
      console.log('  ──────────────────────────────────────');
      console.log(`  Total`);
      console.log(`    Stmts:${pct('statements')}%  Branch:${pct('branches')}%  Funcs:${pct('functions')}%  Lines:${pct('lines')}%`);
    }
    console.log('══════════════════════════════════════════\n');
  } catch {
    // coverage-summary.json missing — coverage reporters may not include 'json-summary'
  }
}

function runJestTests(featureName?: string) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const resultsFile = path.join(process.cwd(), 'coverage', 'jest-results.json');
  const jestArgs = [
    'run', 'test', '--',
    '--runInBand',
    '--json',
    `--outputFile=${resultsFile}`,
  ];

  if (featureName) {
    // Scope to spec files inside the feature folder (e.g. src/chat/*.spec.ts)
    jestArgs.push(`--testPathPattern=${featureName}`);
  }

  const result = spawnSync(npmCommand, jestArgs, {
    stdio: 'inherit',
    shell: true,
  });

  printTestSummary(resultsFile);
  printCoverageSummary(featureName);

  if (result.status !== 0) {
    throw new Error('Jest tests failed. See output above.');
  }
}

async function main() {
  const { outputDir: outputDirArg, definitionsDir, apiFile } = parseArgs();
  const outputDir = path.resolve(process.cwd(), outputDirArg);
  const absoluteDefinitions = path.resolve(process.cwd(), definitionsDir);

  console.log('🔍 Validating API definitions...');
  await validateApiFiles(absoluteDefinitions, apiFile);

  console.log('🚀 Generating APIs from definitions...');
  console.log(`Definitions: ${absoluteDefinitions}`);
  console.log(`Output: ${outputDir}`);
  let descriptions: ApiDescription[];

  if (process.env.USE_GEMINII === 'true') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required when USE_GEMINII=true');
    }
    console.log('🤖 Using Gemini/OpenAI for generation...');
    descriptions = await generateApisFromDirectoryGeminii(
      definitionsDir,
      outputDir,
      apiKey,
      apiFile
    );
  } else if (apiFile) {
    console.log('📜 Using script-based generation for a single API...');
    const normalizedFile = apiFile.endsWith('.api.json')
      ? apiFile
      : `${apiFile}.api.json`;
    const apiFilePath = path.isAbsolute(normalizedFile)
      ? normalizedFile
      : path.join(definitionsDir, normalizedFile);
    descriptions = [await generateApiFromFile(apiFilePath, outputDir)];
  } else {
    console.log('📜 Using script-based generation...');
    descriptions = await generateApisFromDirectory(definitionsDir, outputDir);
  }

  if (descriptions.length === 0) {
    console.log('⚠️ No API definitions found. Generating sample API instead.');
    await createAgentApiFiles(sampleApiDescription, outputDir);
    descriptions = [sampleApiDescription];
  }

  console.log(
    `📝 Writing generated module with ${descriptions.length} descriptions...`
  );
  await writeGeneratedModuleFile(descriptions, outputDir);
  console.log('✅ Generated module written successfully.');
  // Format and lint generated files (best-effort)
  try {
    await formatGeneratedFiles(outputDir, descriptions);
    console.log(
      '✅ Formatted generated files with Prettier and ESLint (if available).'
    );
  } catch (e) {
    console.warn('⚠️ Formatting step failed or tools not available:', e);
  }

  console.log('🔧 Building project...');
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const buildCommand = `${npmCommand} run build`;
  const buildResult = spawnSync(buildCommand, {
    stdio: 'inherit',
    shell: true,
  });

  if (buildResult.status !== 0) {
    throw new Error('Build failed. See output above.');
  }

  // When a single file is targeted, derive the feature name (e.g. "chat" from "chat.api.json")
  // so Jest only runs spec files inside that feature folder.
  const jestFeatureFilter = apiFile
    ? path.basename(apiFile).replace(/\.api\.json$/, '')
    : undefined;

  console.log(
    jestFeatureFilter
      ? `🧪 Running Jest unit tests for feature "${jestFeatureFilter}"...`
      : '🧪 Running Jest unit tests...'
  );
  runJestTests(jestFeatureFilter);

  console.log('▶️ Starting built application...');
  const server = spawn('node', ['dist/src/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      VENDOR_MOCK: 'true',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  try {
    await waitForServer(SERVER_URL, START_TIMEOUT_MS);
    console.log(`✅ Server started at ${SERVER_URL}`);

    console.log('🧪 Running test requests against generated APIs...');
    const apiDescriptions = descriptions.length
      ? descriptions
      : [sampleApiDescription];
    await testGeneratedApis(apiDescriptions);
    console.log('✅ All generated API routes returned successful responses.');
  } finally {
    if (!server.killed) {
      server.kill();
    }
  }
}

main().catch((error) => {
  console.error('❌ generate-build-test failed:', error);
  process.exit(1);
});
