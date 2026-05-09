import path from 'path';
import { createAgentApiFiles, sampleApiDescription } from '../src/agent';

async function main() {
  const outputDir = process.argv[2] ?? 'src';
  const absoluteOutput = path.resolve(process.cwd(), outputDir);

  await createAgentApiFiles(sampleApiDescription, absoluteOutput);
  console.log(`Generated API files for feature '${sampleApiDescription.featureName}' in ${absoluteOutput}`);
}

main().catch((error) => {
  console.error('Failed to generate API files:', error);
  process.exit(1);
});
