import * as path from "path";
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { GeminiiClient, GeneratedFile } from "../src/geminii";
import {
  writeGeneratedModuleFile,
  sampleApiDescription,
  ApiDescription,
} from "../src/agent";

async function ensureDirectory(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

async function writeFileContent(filePath: string, content: string) {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, content, "utf8");
}

async function generateFromDefinitions(
  definitionsDir: string,
  outputDir: string,
  apiKey: string
): Promise<ApiDescription[]> {
  const files = await readdir(definitionsDir);
  const apiFiles = files.filter((file) => file.endsWith(".api.json"));

  if (apiFiles.length === 0) {
    return [];
  }

  const client = new GeminiiClient(apiKey);
  const descriptions: ApiDescription[] = [];

  for (const file of apiFiles) {
    const raw = await readFile(path.join(definitionsDir, file), "utf-8");
    const description: ApiDescription = JSON.parse(raw);
    descriptions.push(description);

    const generatedFiles: GeneratedFile[] =
      await client.generateFiles(description);
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
  const outputDir = process.argv[2] ?? "src";
  const absoluteOutput = path.resolve(process.cwd(), outputDir);
  const definitionsDir = path.resolve(
    process.cwd(),
    outputDir,
    "api-definitions"
  );

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to use geminii generation.");
  }

  let descriptions = await generateFromDefinitions(
    definitionsDir,
    absoluteOutput,
    apiKey
  );

  if (descriptions.length === 0) {
    console.log(
      "⚠️ No .api.json definitions found. Using sample API description."
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
  console.error("❌ Geminii generation failed:", error);
  process.exit(1);
});
