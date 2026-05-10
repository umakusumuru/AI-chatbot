"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const agent_1 = require("../src/agent");
async function main() {
    const outputDir = process.argv[2] ?? "src";
    const absoluteOutput = path.resolve(process.cwd(), outputDir);
    const definitionsDir = path.resolve(process.cwd(), outputDir, "api-definitions");
    console.log("🚀 Starting API generation...\n");
    const descriptions = await (0, agent_1.generateApisFromDirectory)(definitionsDir, absoluteOutput);
    if (descriptions.length > 0) {
        await (0, agent_1.writeGeneratedModuleFile)(descriptions, absoluteOutput);
        console.log(`\n✅ Generated ${descriptions.length} API(s)\n`);
        console.log("Generated modules:");
        descriptions.forEach((desc) => {
            console.log(`  - ${desc.moduleClassName} (route: /${desc.baseRoute})`);
        });
        console.log("\n✅ Updated src/generated.module.ts with generated feature module imports.");
    }
    else {
        console.log("⚠️  No API definition files found. Create .api.json files in src/api-definitions/");
        console.log("\nGenerating sample API as fallback...");
        await (0, agent_1.createAgentApiFiles)(agent_1.sampleApiDescription, absoluteOutput);
        await (0, agent_1.writeGeneratedModuleFile)([agent_1.sampleApiDescription], absoluteOutput);
        console.log(`✓ Generated sample API for feature '${agent_1.sampleApiDescription.featureName}'`);
    }
}
main().catch((error) => {
    console.error("❌ Failed to generate API files:", error);
    process.exit(1);
});
