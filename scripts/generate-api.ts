import * as path from "path";
import {
  createAgentApiFiles,
  generateApisFromDirectory,
  writeGeneratedModuleFile,
  sampleApiDescription,
  generateModuleImports,
  generateModuleReferences,
} from "../src/agent";

async function main() {
  const outputDir = process.argv[2] ?? "src";
  const absoluteOutput = path.resolve(process.cwd(), outputDir);
  const definitionsDir = path.resolve(
    process.cwd(),
    outputDir,
    "api-definitions"
  );

  console.log("🚀 Starting API generation...\n");

  // Generate APIs from definition files
  const descriptions = await generateApisFromDirectory(
    definitionsDir,
    absoluteOutput
  );

  if (descriptions.length > 0) {
    await writeGeneratedModuleFile(descriptions, absoluteOutput);
    console.log(`\n✅ Generated ${descriptions.length} API(s)\n`);
    console.log("Generated modules:");
    descriptions.forEach((desc) => {
      console.log(`  - ${desc.moduleClassName} (route: /${desc.baseRoute})`);
    });

    console.log(
      "\n✅ Updated src/generated.module.ts with generated feature module imports."
    );
  } else {
    console.log(
      "⚠️  No API definition files found. Create .api.json files in src/api-definitions/"
    );
    console.log("\nGenerating sample API as fallback...");
    await createAgentApiFiles(sampleApiDescription, absoluteOutput);
    await writeGeneratedModuleFile([sampleApiDescription], absoluteOutput);
    console.log(
      `✓ Generated sample API for feature '${sampleApiDescription.featureName}'`
    );
  }
}

main().catch((error) => {
  console.error("❌ Failed to generate API files:", error);
  process.exit(1);
});
