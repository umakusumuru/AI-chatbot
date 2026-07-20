import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { spawnSync } from 'child_process';
import {
  generateApiTestsFromDirectory,
  generateApiTestsFromFile,
} from '../src/agent';

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
    } else if (!apiFile) {
      apiFile = arg;
    } else if (outputDir === 'src') {
      outputDir = arg;
    }
  }

  return { outputDir, definitionsDir, apiFile };
}

function resolveLocation(loc: string): string {
  return path.isAbsolute(loc) ? loc : path.resolve(process.cwd(), loc);
}

function existsSync(pathToCheck: string): boolean {
  try {
    fs.accessSync(pathToCheck);
    return true;
  } catch {
    return false;
  }
}

function isDirectory(pathToCheck: string): boolean {
  return existsSync(pathToCheck) && fs.statSync(pathToCheck).isDirectory();
}

function isFile(pathToCheck: string): boolean {
  return existsSync(pathToCheck) && fs.statSync(pathToCheck).isFile();
}

function findSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const resolvedPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSourceFiles(resolvedPath));
    } else if (
      entry.isFile() &&
      (resolvedPath.endsWith('.controller.ts') ||
        resolvedPath.endsWith('.service.ts'))
    ) {
      files.push(resolvedPath);
    }
  }
  return files;
}

interface SourceMethod {
  name: string;
  parameters: { name: string; type?: string }[];
  returnType?: string;
  privateMethodCalls: string[];
}

interface SourceClassMetadata {
  className: string;
  methods: SourceMethod[];
  privateMethodLogs: Map<string, Array<number | string | undefined>>;
}

// Evaluate simple literal/arithmetic expressions for constant folding
function evaluateExpression(
  node: ts.Node,
  vars: Map<string, number | string>,
  sf: ts.SourceFile
): number | string | undefined {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isIdentifier(node)) return vars.get(node.getText(sf));
  if (ts.isBinaryExpression(node)) {
    const l = evaluateExpression(node.left, vars, sf);
    const r = evaluateExpression(node.right, vars, sf);
    if (l === undefined || r === undefined) return undefined;
    if (typeof l === 'number' && typeof r === 'number') {
      if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) return l + r;
      if (node.operatorToken.kind === ts.SyntaxKind.MinusToken) return l - r;
      if (node.operatorToken.kind === ts.SyntaxKind.AsteriskToken) return l * r;
      if (node.operatorToken.kind === ts.SyntaxKind.SlashToken) return l / r;
    }
    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken)
      return String(l) + String(r);
  }
  return undefined;
}

// Scan a private method body: track variable assignments and collect console.log args
function analyzePrivateMethodBody(
  body: ts.Block,
  sf: ts.SourceFile
): Array<number | string | undefined> {
  const vars = new Map<string, number | string>();
  const logs: Array<number | string | undefined> = [];

  function walk(node: ts.Node) {
    // let/const/var x = <expr>
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && ts.isIdentifier(decl.name)) {
          const val = evaluateExpression(decl.initializer, vars, sf);
          if (val !== undefined) vars.set(decl.name.getText(sf), val);
        }
      }
    }
    // x = <expr>
    if (
      ts.isExpressionStatement(node) &&
      ts.isBinaryExpression(node.expression) &&
      node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.expression.left)
    ) {
      const val = evaluateExpression(node.expression.right, vars, sf);
      if (val !== undefined) vars.set(node.expression.left.getText(sf), val);
    }
    // console.log(...)
    if (
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      ts.isIdentifier(node.expression.expression.expression) &&
      node.expression.expression.expression.getText(sf) === 'console' &&
      node.expression.expression.name.getText(sf) === 'log'
    ) {
      const args = node.expression.arguments;
      logs.push(args.length === 1 ? evaluateExpression(args[0], vars, sf) : undefined);
    }
    ts.forEachChild(node, walk);
  }

  walk(body);
  return logs;
}

function parseSourceClass(filePath: string): SourceClassMetadata {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  let className = '';
  const methods: SourceMethod[] = [];
  const privateMethodLogs = new Map<string, Array<number | string | undefined>>();

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name) {
      className = node.name.text;

      // Pass 1: collect all private/protected method names + analyze their bodies
      const privateMethodNames = new Set<string>();
      node.members.forEach((member) => {
        if (!ts.isMethodDeclaration(member) || !member.name) return;
        const isPrivate =
          member.modifiers &&
          member.modifiers.some(
            (m) =>
              m.kind === ts.SyntaxKind.PrivateKeyword ||
              m.kind === ts.SyntaxKind.ProtectedKeyword
          );
        if (isPrivate) {
          const name = member.name.getText(sourceFile);
          privateMethodNames.add(name);
          if (member.body) {
            privateMethodLogs.set(name, analyzePrivateMethodBody(member.body, sourceFile));
          }
        }
      });

      // Pass 2: collect public methods and scan their bodies for private calls
      node.members.forEach((member) => {
        if (!ts.isMethodDeclaration(member) || !member.name) return;
        const isPrivate =
          member.modifiers &&
          member.modifiers.some(
            (m) =>
              m.kind === ts.SyntaxKind.PrivateKeyword ||
              m.kind === ts.SyntaxKind.ProtectedKeyword
          );
        if (isPrivate) return;

        const methodName = member.name.getText(sourceFile);
        if (methodName === 'constructor') return;

        const parameters = member.parameters.map((param) => ({
          name: param.name.getText(sourceFile),
          type: param.type ? param.type.getText(sourceFile) : undefined,
        }));

        const returnType = member.type
          ? member.type.getText(sourceFile)
          : undefined;

        // Detect this.xxx() calls where xxx is a private method
        const privateMethodCalls: string[] = [];
        function findPrivateCalls(n: ts.Node) {
          if (
            ts.isCallExpression(n) &&
            ts.isPropertyAccessExpression(n.expression) &&
            n.expression.expression.kind === ts.SyntaxKind.ThisKeyword
          ) {
            const calledName = n.expression.name.text;
            if (
              privateMethodNames.has(calledName) &&
              !privateMethodCalls.includes(calledName)
            ) {
              privateMethodCalls.push(calledName);
            }
          }
          ts.forEachChild(n, findPrivateCalls);
        }
        if (member.body) findPrivateCalls(member.body);

        methods.push({ name: methodName, parameters, returnType, privateMethodCalls });
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!className) {
    throw new Error(`No exported class found in ${filePath}`);
  }

  return { className, methods, privateMethodLogs };
}

function sampleArg(param: { name: string; type?: string }): string {
  const name = param.name.toLowerCase();
  const type = param.type?.toLowerCase() ?? '';

  if (type.includes('string')) return "'sample'";
  if (type.includes('number')) return '1';
  if (type.includes('boolean')) return 'true';
  if (name.includes('id')) return "'1'";
  if (type.includes('dto')) return '{} as any';
  return '{} as any';
}

function buildServiceSpecFromSource(
  filePath: string,
  metadata: SourceClassMetadata
): string {
  const importPath = `./${path.basename(filePath, '.ts')}`;
  const methodTests = metadata.methods
    .map((method) => {
      const args = method.parameters.map(sampleArg).join(', ');
      const subscribe = method.returnType?.includes('Observable');

      const mainTest = subscribe
        ? `  it('should ${method.name}', (done) => {
    service.${method.name}(${args}).subscribe({
      next: (result) => {
        expect(result).toBeDefined();
        done();
      },
      error: done,
    });
  });
`
        : `  it('should ${method.name}', () => {
    const result = service.${method.name}(${args});
    expect(result).toBeDefined();
  });
`;

      const spyTests = method.privateMethodCalls
        .map((privateMeth) => {
          const logs = metadata.privateMethodLogs.get(privateMeth) ?? [];
          const consoleSetup = logs.length > 0 ? `\n    const consoleSpy = jest.spyOn(console, 'log');` : '';
          const consoleAsserts = logs
            .map((v) =>
              v !== undefined
                ? `\n        expect(consoleSpy).toHaveBeenCalledWith(${typeof v === 'string' ? `'${v}'` : v});`
                : `\n        expect(consoleSpy).toHaveBeenCalled();`
            )
            .join('');

          return subscribe
            ? `
  it('calls ${privateMeth} during ${method.name}', (done) => {
    const spy = jest.spyOn(service as any, '${privateMeth}');${consoleSetup}

    service.${method.name}(${args}).subscribe({
      next: () => {
        expect(spy).toHaveBeenCalled();${consoleAsserts}
        done();
      },
      error: done,
    });
  });
`
            : `
  it('calls ${privateMeth} during ${method.name}', () => {
    const spy = jest.spyOn(service as any, '${privateMeth}');${consoleSetup}

    service.${method.name}(${args});
    expect(spy).toHaveBeenCalled();${consoleAsserts}
  });
`;
        })
        .join('');

      return mainTest + spyTests;
    })
    .join('\n');

  return `import { Test, TestingModule } from '@nestjs/testing';
import { ${metadata.className} } from '${importPath}';

describe('${metadata.className}', () => {
  let service: ${metadata.className};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [${metadata.className}],
    }).compile();

    service = module.get<${metadata.className}>(${metadata.className});
  });

${methodTests}});
`;
}

function buildControllerSpecFromSource(
  filePath: string,
  metadata: SourceClassMetadata
): string {
  const controllerImportPath = `./${path.basename(filePath, '.ts')}`;
  const serviceClassName = metadata.className.replace('Controller', 'Service');
  const serviceImportPath = `./${path.basename(
    filePath,
    '.controller.ts'
  )}.service`;

  // Build richer tests: mock the service, assert calls and returns, and test error propagation
  const methodTests = metadata.methods
    .map((method) => {
      const argsList = method.parameters.map((p) => sampleArg(p));
      const argsCall = argsList.join(', ');
      const subscribe = method.returnType?.includes('Observable');

      const successTest = subscribe
        ? `  it('calls service.${
            method.name
          } and returns its Observable result', (done) => {\n    const mockVal = ${
            argsList.length ? argsList[0] : "{ result: 'ok' }"
          };\n    const mockService: any = moduleRefMocks.mockService;\n    mockService.${
            method.name
          }.mockReturnValue(of(mockVal));\n\n    controller.${
            method.name
          }(${argsCall}).subscribe({\n      next: (res) => {\n        expect(mockService.${
            method.name
          }).toHaveBeenCalledWith(${argsCall});\n        expect(res).toEqual(mockVal);\n        done();\n      },\n      error: done,\n    });\n  });\n`
        : `  it('calls service.${
            method.name
          } and returns its value', () => {\n    const mockVal = ${
            argsList.length ? argsList[0] : "{ result: 'ok' }"
          };\n    const mockService: any = moduleRefMocks.mockService;\n    mockService.${
            method.name
          }.mockReturnValue(mockVal);\n\n    const res = controller.${
            method.name
          }(${argsCall});\n    expect(mockService.${
            method.name
          }).toHaveBeenCalledWith(${argsCall});\n    expect(res).toEqual(mockVal);\n  });\n`;

      const errorTest = subscribe
        ? `  it('propagates errors from service.${method.name}', (done) => {\n    const mockService: any = moduleRefMocks.mockService;\n    mockService.${method.name}.mockReturnValue(throwError(() => new Error('svc-fail')));\n\n    controller.${method.name}(${argsCall}).subscribe({\n      next: () => done(new Error('Expected error')),\n      error: (err) => {\n        expect(err).toBeInstanceOf(Error);\n        done();\n      },\n    });\n  });\n`
        : `  it('propagates errors from service.${method.name}', () => {\n    const mockService: any = moduleRefMocks.mockService;\n    mockService.${method.name}.mockImplementation(() => { throw new Error('svc-fail'); });\n\n    expect(() => controller.${method.name}(${argsCall})).toThrow();\n  });\n`;

      const spyTests = method.privateMethodCalls
        .map((privateMeth) => {
          const logs = metadata.privateMethodLogs.get(privateMeth) ?? [];
          const consoleSetup = logs.length > 0 ? `\n    const consoleSpy = jest.spyOn(console, 'log');` : '';
          const consoleAsserts = logs
            .map((v) =>
              v !== undefined
                ? `\n        expect(consoleSpy).toHaveBeenCalledWith(${typeof v === 'string' ? `'${v}'` : v});`
                : `\n        expect(consoleSpy).toHaveBeenCalled();`
            )
            .join('');

          return subscribe
            ? `
  it('calls ${privateMeth} during ${method.name}', (done) => {
    const spy = jest.spyOn(controller as any, '${privateMeth}');${consoleSetup}
    const mockService: any = moduleRefMocks.mockService;
    mockService.${method.name}.mockReturnValue(of({}));

    controller.${method.name}(${argsCall}).subscribe({
      next: () => {
        expect(spy).toHaveBeenCalled();${consoleAsserts}
        done();
      },
      error: done,
    });
  });
`
            : `
  it('calls ${privateMeth} during ${method.name}', () => {
    const spy = jest.spyOn(controller as any, '${privateMeth}');${consoleSetup}
    const mockService: any = moduleRefMocks.mockService;
    mockService.${method.name}.mockReturnValue({});

    controller.${method.name}(${argsCall});
    expect(spy).toHaveBeenCalled();${consoleAsserts}
  });
`;
        })
        .join('');

      return successTest + '\n' + errorTest + spyTests;
    })
    .join('\n');

  return `import { Test, TestingModule } from '@nestjs/testing';\nimport { ${
    metadata.className
  } } from '${controllerImportPath}';\nimport { ${serviceClassName} } from '${serviceImportPath}';\nimport { of, throwError } from 'rxjs';\n\nconst moduleRefMocks: any = {\n  mockService: {\n    ${metadata.methods
    .map((m) => `${m.name}: jest.fn(),`)
    .join('\n    ')}\n  }\n};\n\ndescribe('${
    metadata.className
  }', () => {\n  let controller: ${
    metadata.className
  };\n\n  beforeEach(async () => {\n    const module: TestingModule = await Test.createTestingModule({\n      controllers: [${
    metadata.className
  }],\n      providers: [\n        { provide: ${serviceClassName}, useValue: moduleRefMocks.mockService },\n      ],\n    }).compile();\n\n    controller = module.get<${
    metadata.className
  }>(${metadata.className});\n  });\n\n${methodTests}});\n`;
}

function writeSpecFile(filePath: string, content: string) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function generateSourceTestFile(sourceFile: string): void {
  const metadata = parseSourceClass(sourceFile);
  const specFile = sourceFile.replace(/\.ts$/, '.spec.ts');

  if (sourceFile.endsWith('.service.ts')) {
    writeSpecFile(specFile, buildServiceSpecFromSource(sourceFile, metadata));
    return;
  }

  if (sourceFile.endsWith('.controller.ts')) {
    writeSpecFile(
      specFile,
      buildControllerSpecFromSource(sourceFile, metadata)
    );
    return;
  }

  throw new Error(`Unsupported source file type: ${sourceFile}`);
}

function runScopedJestTests(featureName: string) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const resultsFile = path.join(process.cwd(), 'coverage', 'jest-results.json');
  const jestArgs = [
    'run', 'test', '--',
    '--runInBand',
    '--json',
    `--outputFile=${resultsFile}`,
    `--testPathPattern=${featureName}`,
  ];

  console.log(`\n🧪 Running tests scoped to "${featureName}"...`);
  const result = spawnSync(npmCommand, jestArgs, { stdio: 'inherit', shell: true });

  // Print test summary
  try {
    const r = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
    const passed  = r.numPassedTests  ?? 0;
    const failed  = r.numFailedTests  ?? 0;
    const pending = r.numPendingTests ?? 0;
    const total   = r.numTotalTests   ?? 0;
    const duration = r.testResults
      ? (r.testResults.reduce((s: number, t: any) => s + (t.endTime - t.startTime), 0) / 1000).toFixed(2)
      : '?';

    console.log('\n══════════════════════════════════════════');
    console.log(`  📊 Test Summary  [${featureName}]`);
    console.log('══════════════════════════════════════════');
    console.log(`  Total    : ${total}`);
    console.log(`  ✅ Passed : ${passed}`);
    if (failed  > 0) console.log(`  ❌ Failed : ${failed}`);
    if (pending > 0) console.log(`  ⏭  Skipped: ${pending}`);
    console.log(`  ⏱  Time   : ${duration}s`);
    console.log('══════════════════════════════════════════');
  } catch { /* Jest already printed the summary */ }

  // Print coverage summary
  const summaryPath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
  try {
    const cov = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    const entries = Object.entries(cov).filter(([f]) => f !== 'total' && f.includes(featureName));
    if (entries.length > 0) {
      console.log('\n══════════════════════════════════════════');
      console.log(`  📈 Coverage  [${featureName}]`);
      console.log('══════════════════════════════════════════');
      for (const [file, data] of entries) {
        const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
        const d   = data as any;
        const pct = (k: string) => String(d[k].pct).padStart(6);
        console.log(`  ${rel}`);
        console.log(`    Stmts:${pct('statements')}%  Branch:${pct('branches')}%  Funcs:${pct('functions')}%  Lines:${pct('lines')}%`);
      }
      const t = (cov as any).total;
      if (t) {
        const pct = (k: string) => String(t[k].pct).padStart(6);
        console.log('  ──────────────────────────────────────');
        console.log(`  Total  Stmts:${pct('statements')}%  Branch:${pct('branches')}%  Funcs:${pct('functions')}%  Lines:${pct('lines')}%`);
      }
      console.log('══════════════════════════════════════════\n');
    }
  } catch { /* coverage-summary.json not available */ }

  if (result.status !== 0) {
    throw new Error(`Tests failed for "${featureName}". See output above.`);
  }
}

async function main() {
  const { outputDir, definitionsDir, apiFile } = parseArgs();
  const absoluteOutput = path.resolve(process.cwd(), outputDir);
  const absoluteDefinitions = path.resolve(process.cwd(), definitionsDir);

  console.log('🚀 Starting API test generation...');
  console.log(`Definitions: ${absoluteDefinitions}`);
  console.log(`Output: ${absoluteOutput}\n`);

  let generatedCount = 0;

  if (apiFile) {
    const candidatePath = resolveLocation(apiFile);

    if (existsSync(candidatePath) && isDirectory(candidatePath)) {
      const sourceFiles = findSourceFiles(candidatePath);
      sourceFiles.forEach((source) => {
        generateSourceTestFile(source);
        generatedCount += 1;
      });
    } else if (existsSync(candidatePath) && isFile(candidatePath)) {
      if (
        candidatePath.endsWith('.controller.ts') ||
        candidatePath.endsWith('.service.ts')
      ) {
        generateSourceTestFile(candidatePath);
        generatedCount += 1;
      } else if (candidatePath.endsWith('.api.json')) {
        const descriptions = [
          await generateApiTestsFromFile(candidatePath, absoluteOutput),
        ];
        generatedCount = descriptions.length;
      } else {
        throw new Error(`Unsupported source file type: ${candidatePath}`);
      }
    } else {
      const relativeCandidate = path.join(absoluteDefinitions, apiFile);
      if (existsSync(relativeCandidate) && isDirectory(relativeCandidate)) {
        const sourceFiles = findSourceFiles(relativeCandidate);
        sourceFiles.forEach((source) => {
          generateSourceTestFile(source);
          generatedCount += 1;
        });
      } else if (existsSync(relativeCandidate) && isFile(relativeCandidate)) {
        if (
          relativeCandidate.endsWith('.controller.ts') ||
          relativeCandidate.endsWith('.service.ts')
        ) {
          generateSourceTestFile(relativeCandidate);
          generatedCount += 1;
        } else if (relativeCandidate.endsWith('.api.json')) {
          const descriptions = [
            await generateApiTestsFromFile(relativeCandidate, absoluteOutput),
          ];
          generatedCount = descriptions.length;
        } else {
          throw new Error(`Unsupported source file type: ${relativeCandidate}`);
        }
      } else {
        const normalizedFile = apiFile.endsWith('.api.json')
          ? apiFile
          : `${apiFile}.api.json`;
        const apiFilePath = path.join(absoluteDefinitions, normalizedFile);
        if (!existsSync(apiFilePath)) {
          throw new Error(`Path not found: ${apiFile}`);
        }
        const descriptions = [
          await generateApiTestsFromFile(apiFilePath, absoluteOutput),
        ];
        generatedCount = descriptions.length;
      }
    }
  } else {
    const descriptions = await generateApiTestsFromDirectory(
      absoluteDefinitions,
      absoluteOutput
    );
    generatedCount = descriptions.length;
  }

  console.log(`\n✅ Generated unit tests for ${generatedCount} file(s)`);

  // When a specific feature was targeted, run Jest scoped to that feature only
  if (apiFile) {
    const featureName = path
      .basename(apiFile)
      .replace(/\.api\.json$/, '')   // chat.api.json  → chat
      .replace(/\.(controller|service)\.ts$/, '') // chat.controller.ts → chat
      .replace(/\/$/, '');           // src/chat/ → src/chat
    const scopedName = path.basename(featureName); // src/chat → chat
    runScopedJestTests(scopedName);
  }
}

main().catch((error) => {
  console.error('❌ Failed to generate API test files:', error);
  process.exit(1);
});
