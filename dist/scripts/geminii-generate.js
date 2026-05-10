"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const promises_1 = require("fs/promises");
const geminii_1 = require("../src/geminii");
const agent_1 = require("../src/agent");
async function ensureDirectory(dirPath) {
    await (0, promises_1.mkdir)(dirPath, { recursive: true });
}
async function writeFileContent(filePath, content) {
    await ensureDirectory(path.dirname(filePath));
    await (0, promises_1.writeFile)(filePath, content, "utf8");
}
async function generateFromDefinitions(definitionsDir, outputDir, apiKey) {
    const files = await (0, promises_1.readdir)(definitionsDir);
    const apiFiles = files.filter((file) => file.endsWith(".api.json"));
    if (apiFiles.length === 0) {
        return [];
    }
    const client = new geminii_1.GeminiiClient(apiKey);
    const descriptions = [];
    for (const file of apiFiles) {
        const raw = await (0, promises_1.readFile)(path.join(definitionsDir, file), "utf-8");
        const description = JSON.parse(raw);
        descriptions.push(description);
        const generatedFiles = await client.generateFiles(description);
        for (const generatedFile of generatedFiles) {
            const filePath = path.join(outputDir, generatedFile.path);
            await writeFileContent(filePath, generatedFile.content);
        }
        console.log(`✓ Generated feature '${description.featureName}' via geminii from ${file}`);
    }
    return descriptions;
}
async function main() {
    const outputDir = process.argv[2] ?? "src";
    const absoluteOutput = path.resolve(process.cwd(), outputDir);
    const definitionsDir = path.resolve(process.cwd(), outputDir, "api-definitions");
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY is required to use geminii generation.");
    }
    let descriptions = await generateFromDefinitions(definitionsDir, absoluteOutput, apiKey);
    if (descriptions.length === 0) {
        console.log("⚠️ No .api.json definitions found. Using sample API description.");
        descriptions = [agent_1.sampleApiDescription];
        const generatedFiles = await new geminii_1.GeminiiClient(apiKey).generateFiles(agent_1.sampleApiDescription);
        for (const generatedFile of generatedFiles) {
            const filePath = path.join(absoluteOutput, generatedFile.path);
            await writeFileContent(filePath, generatedFile.content);
        }
    }
    await (0, agent_1.writeGeneratedModuleFile)(descriptions, absoluteOutput);
    console.log(`\n✅ Geminii generation complete. Wrote ${descriptions.length} feature module(s) into ${absoluteOutput}`);
}
main().catch((error) => {
    console.error("❌ Geminii generation failed:", error);
    process.exit(1);
});
