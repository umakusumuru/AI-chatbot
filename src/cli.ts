#!/usr/bin/env node
/**
 * api-generator CLI
 * Technology-independent API generator.
 *
 * Usage:
 *   api-generator generate --file=user.api.json --target=aspnet --output=./MyProject
 *   api-generator generate --definitions=./my-defs --target=springboot --output=./src
 *   api-generator generate --file=user.api.json --protocol=graphql --output=./src
 *   api-generator generate --file=user.api.json --protocol=grpc --output=./src
 */

import { join } from 'path';
import { generateApiFromFile, generateApisFromDirectory, TargetFramework, ApiProtocol, TestFramework } from './agent';

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : undefined;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const SUPPORTED_TARGETS: TargetFramework[] = ['nestjs', 'express', 'springboot', 'aspnet', 'fastapi', 'django', 'laravel', 'gin'];
const SUPPORTED_PROTOCOLS: ApiProtocol[] = ['rest', 'graphql', 'grpc'];
const SUPPORTED_TEST_FRAMEWORKS: TestFramework[] = ['jest', 'vitest', 'junit5', 'testng', 'xunit', 'nunit', 'mstest', 'pytest', 'unittest'];

function printHelp() {
  console.log(`
api-generator — Technology-Independent API Generator
--------------------------------------------------
Generates REST, GraphQL, or gRPC API code for any framework
from a single .api.json definition file.

Usage:
  api-generator generate [options]

Options:
  --file=<path>               Path to a single .api.json definition file
  --definitions=<path>        Directory containing .api.json files (default: src/api-definitions)
  --output=<path>             Output directory (default: src)
  --target=<framework>        Override target framework in the definition
  --protocol=<protocol>       Override protocol in the definition
  --test-framework=<name>     Override test framework in the definition
  --help                      Show this help message

Supported Targets (--target):
  nestjs       NestJS  (TypeScript)        [default]
  express      Express (TypeScript)
  springboot   Spring Boot (Java)
  aspnet       ASP.NET Core (C#)
  fastapi      FastAPI (Python)

Supported Protocols (--protocol):
  rest         REST / JSON                 [default]
  graphql      GraphQL schema + resolvers
  grpc         gRPC .proto + service stubs

Supported Test Frameworks (--test-framework):
  jest         TypeScript — NestJS / Express / GraphQL / gRPC  [default]
  vitest       TypeScript — faster alternative to Jest
  junit5       Java (Spring Boot)                              [default]
  testng       Java — alternative to JUnit 5
  xunit        C# (ASP.NET Core)                              [default]
  nunit        C# — NUnit alternative
  mstest       C# — MSTest alternative
  pytest       Python (FastAPI)                                [default]
  unittest     Python — built-in unittest module

Examples:
  # Generate NestJS REST API (default)
  api-generator generate --file=user.api.json

  # Generate ASP.NET Core REST API
  api-generator generate --file=user.api.json --target=aspnet --output=./MyDotNetProject

  # Generate Spring Boot REST API
  api-generator generate --file=user.api.json --target=springboot --output=./my-java-project

  # Generate FastAPI (Python) REST API
  api-generator generate --file=user.api.json --target=fastapi --output=./my-python-project

  # Generate Express.js REST API
  api-generator generate --file=user.api.json --target=express --output=./my-express-project

  # Generate GraphQL schema + resolver
  api-generator generate --file=user.api.json --protocol=graphql --output=./src

  # Generate gRPC .proto + service
  api-generator generate --file=user.api.json --protocol=grpc --output=./src

  # Generate all definitions in a directory
  api-generator generate --definitions=./api-defs --target=aspnet --output=./MyProject
`);
}

async function main() {
  const command = args[0];

  if (!command || command === '--help' || hasFlag('help')) {
    printHelp();
    return;
  }

  if (command !== 'generate') {
    console.error(`Unknown command: ${command}. Run "api-generator --help" for usage.`);
    process.exit(1);
  }

  const file = getArg('file');
  const definitionsDir = getArg('definitions') ?? join(process.cwd(), 'src', 'api-definitions');
  const output = getArg('output') ?? join(process.cwd(), 'src');
  const targetOverride = getArg('target') as TargetFramework | undefined;
  const protocolOverride = getArg('protocol') as ApiProtocol | undefined;
  const testFrameworkOverride = getArg('test-framework') as TestFramework | undefined;

  if (targetOverride && !SUPPORTED_TARGETS.includes(targetOverride)) {
    console.error(`Unsupported target: "${targetOverride}". Supported: ${SUPPORTED_TARGETS.join(', ')}`);
    process.exit(1);
  }

  if (protocolOverride && !SUPPORTED_PROTOCOLS.includes(protocolOverride)) {
    console.error(`Unsupported protocol: "${protocolOverride}". Supported: ${SUPPORTED_PROTOCOLS.join(', ')}`);
    process.exit(1);
  }

  if (testFrameworkOverride && !SUPPORTED_TEST_FRAMEWORKS.includes(testFrameworkOverride)) {
    console.error(`Unsupported test framework: "${testFrameworkOverride}". Supported: ${SUPPORTED_TEST_FRAMEWORKS.join(', ')}`);
    process.exit(1);
  }

  console.log('api-generator API Generator');
  console.log(`Target:         ${targetOverride ?? 'from definition file'}`);
  console.log(`Protocol:       ${protocolOverride ?? 'from definition file'}`);
  console.log(`Test framework: ${testFrameworkOverride ?? 'from definition file (or language default)'}`);
  console.log(`Output:         ${output}`);
  console.log('');

  // Patch override into the description at load time
  const originalReadApi = await import('./agent').then(m => m.readApiDescriptionFile);

  async function generateWithOverride(filePath: string, outDir: string) {
    const { readApiDescriptionFile, createAgentApiFiles } = await import('./agent');
    const description = await readApiDescriptionFile(filePath);
    if (targetOverride) description.target = targetOverride;
    if (protocolOverride) description.protocol = protocolOverride;
    if (testFrameworkOverride) description.testFramework = testFrameworkOverride;
    await createAgentApiFiles(description, outDir);
    console.log(`✓ Generated '${description.featureName}' [${description.target ?? 'nestjs'}/${description.protocol ?? 'rest'}]`);
  }

  if (file) {
    const filePath = file.startsWith('.') ? join(process.cwd(), file) : file;
    await generateWithOverride(filePath, output);
  } else {
    const { readdir } = await import('fs/promises');
    const files = await readdir(definitionsDir);
    const apiFiles = files.filter(f => f.endsWith('.api.json'));
    if (apiFiles.length === 0) {
      console.log(`No .api.json files found in ${definitionsDir}`);
      return;
    }
    for (const f of apiFiles) {
      await generateWithOverride(join(definitionsDir, f), output);
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
