import * as path from 'path';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { GeminiiClient, GeneratedFile } from '../src/geminii';
import {
  writeGeneratedModuleFile,
  sampleApiDescription,
  ApiDescription,
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

async function ensureDirectory(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

async function writeFileContent(filePath: string, content: string) {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, content, 'utf8');
}

async function generateFromDefinitions(
  definitionsDir: string,
  outputDir: string,
  apiKey: string,
  apiFile?: string
): Promise<ApiDescription[]> {
  const client = new GeminiiClient(apiKey);
  const descriptions: ApiDescription[] = [];

  if (apiFile) {
    const normalizedFile = apiFile.endsWith('.api.json')
      ? apiFile
      : `${apiFile}.api.json`;
    const apiFilePath = path.isAbsolute(normalizedFile)
      ? normalizedFile
      : path.join(definitionsDir, normalizedFile);

    const raw = await readFile(apiFilePath, 'utf-8');
    const description: ApiDescription = JSON.parse(raw);
    descriptions.push(description);

    const generatedFiles: GeneratedFile[] = await client.generateFiles(
      description
    );
    for (const generatedFile of generatedFiles) {
      const filePath = path.join(outputDir, generatedFile.path);
      await writeFileContent(filePath, generatedFile.content);
    }
    console.log(
      `✓ Generated feature '${
        description.featureName
      }' via geminii from ${path.basename(apiFilePath)}`
    );
    return descriptions;
  }

  const files = await readdir(definitionsDir);
  const apiFiles = files.filter((file) => file.endsWith('.api.json'));

  if (apiFiles.length === 0) {
    return [];
  }

  for (const file of apiFiles) {
    const raw = await readFile(path.join(definitionsDir, file), 'utf-8');
    const description: ApiDescription = JSON.parse(raw);
    descriptions.push(description);

    const generatedFiles: GeneratedFile[] = await client.generateFiles(
      description
    );
    for (const generatedFile of generatedFiles) {
      const filePath = path.join(outputDir, generatedFile.path);
      await writeFileContent(filePath, generatedFile.content);
    }
    console.log(
      `✓ Generated feature '${description.featureName}' via geminii from ${file}`
    );
  }

  return descriptions;
}

async function main() {
  const { outputDir, definitionsDir, apiFile } = parseArgs();
  const absoluteOutput = path.resolve(process.cwd(), outputDir);
  const absoluteDefinitions = path.resolve(process.cwd(), definitionsDir);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to use geminii generation.');
  }

  console.log('🚀 Starting Geminii API generation...');
  console.log(`Definitions: ${absoluteDefinitions}`);
  console.log(`Output: ${absoluteOutput}`);

  let descriptions = await generateFromDefinitions(
    definitionsDir,
    absoluteOutput,
    apiKey,
    apiFile
  );

  if (descriptions.length === 0) {
    console.log(
      '⚠️ No .api.json definitions found. Using sample API description.'
    );
    descriptions = [sampleApiDescription];
    const generatedFiles = await new GeminiiClient(apiKey).generateFiles(
      sampleApiDescription
    );

    for (const generatedFile of generatedFiles) {
      const filePath = path.join(absoluteOutput, generatedFile.path);
      await writeFileContent(filePath, generatedFile.content);
    }
  }

  await writeGeneratedModuleFile(descriptions, absoluteOutput);
  console.log(
    `\n✅ Geminii generation complete. Wrote ${descriptions.length} feature module(s) into ${absoluteOutput}`
  );
}

main().catch((error) => {
  console.error('❌ Geminii generation failed:', error);
  process.exit(1);
});
