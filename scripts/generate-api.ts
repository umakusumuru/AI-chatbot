import * as path from 'path';
import * as agent from '../src/agent';

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

async function main() {
  const { outputDir, definitionsDir, apiFile } = parseArgs();
  const absoluteOutput = path.resolve(process.cwd(), outputDir);
  const absoluteDefinitions = path.resolve(process.cwd(), definitionsDir);

  console.log('🚀 Starting API generation...');
  console.log(`Definitions: ${absoluteDefinitions}`);
  console.log(`Output: ${absoluteOutput}\n`);

  let descriptions;
  if (apiFile) {
    const normalizedFile = apiFile.endsWith('.api.json')
      ? apiFile
      : `${apiFile}.api.json`;
    const apiFilePath = path.isAbsolute(normalizedFile)
      ? normalizedFile
      : path.join(absoluteDefinitions, normalizedFile);

    descriptions = [
      await agent.generateApiFromFile(apiFilePath, absoluteOutput),
    ];
  } else {
    // Generate APIs from definition files
    descriptions = await agent.generateApisFromDirectory(
      absoluteDefinitions,
      absoluteOutput
    );
  }

  if (descriptions.length > 0) {
    await agent.writeGeneratedModuleFile(descriptions, absoluteOutput);
    console.log(`\n✅ Generated ${descriptions.length} API(s)\n`);
    console.log('Generated modules:');
    descriptions.forEach((desc: any) => {
      console.log(`  - ${desc.moduleClassName} (route: /${desc.baseRoute})`);
    });

    console.log(
      `\n✅ Updated ${path.join(
        absoluteOutput,
        'generated.module.ts'
      )} with generated feature module imports.`
    );
    // Format and lint generated files (best-effort)
    try {
      await agent.formatGeneratedFiles(absoluteOutput, descriptions);
      console.log(
        '✅ Formatted generated files with Prettier and ESLint (if available).'
      );
    } catch (e) {
      console.warn('⚠️ Formatting step failed or tools not available:', e);
    }
  } else {
    console.log(
      '⚠️  No API definition files found. Create .api.json files in src/api-definitions/'
    );
    console.log('\nGenerating sample API as fallback...');
    await agent.createAgentApiFiles(agent.sampleApiDescription, absoluteOutput);
    await agent.writeGeneratedModuleFile(
      [agent.sampleApiDescription],
      absoluteOutput
    );
    console.log(
      `✓ Generated sample API for feature '${agent.sampleApiDescription.featureName}'`
    );
  }
}

main().catch((error) => {
  console.error('❌ Failed to generate API files:', error);
  process.exit(1);
});
