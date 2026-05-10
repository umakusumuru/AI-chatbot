import * as path from "path";
import { spawnSync, spawn } from "child_process";
import {
  createAgentApiFiles,
  generateApisFromDirectory,
  writeGeneratedModuleFile,
  ApiDescription,
  ApiRoute,
  sampleApiDescription,
} from "../src/agent";
import * as http from "http";
import { URL } from "url";
import { GeminiiClient } from "../src/geminii";
import { readdir, readFile } from "fs/promises";

const TEST_PORT = 4000;
const SERVER_URL = `http://localhost:${TEST_PORT}/api`;
const START_TIMEOUT_MS = 15000;
const TEST_ROUTE_TIMEOUT_MS = 10000;

function formatRoutePath(baseRoute: string, routePath: string): string {
  const cleanedPath = routePath.replace(/(^\/)|(\/$)/g, "");
  const normalized = cleanedPath.replace(/:[^/]+/g, "1");
  return normalized ? `${baseRoute}/${normalized}` : baseRoute;
}

interface RequestDtoDefinition {
  name: string;
  properties: { name: string; type: string; required?: boolean }[];
}

function sampleBodyForDto(dto: RequestDtoDefinition) {
  const body: Record<string, unknown> = {};

  for (const property of dto.properties) {
    if (property.type.includes("string")) {
      body[property.name] = `${property.name}-sample`;
    } else if (property.type.includes("number")) {
      body[property.name] = 1;
    } else if (property.type.includes("boolean")) {
      body[property.name] = true;
    } else if (property.type.includes("[]")) {
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
        headers: body ? { "Content-Type": "application/json" } : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            data: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    request.on("error", reject);

    if (body) {
      request.write(JSON.stringify(body));
    }

    request.end();
  });
}

async function generateApisFromDirectoryGeminii(
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

    const generatedFiles = await client.generateFiles(description);
    for (const generatedFile of generatedFiles) {
      const filePath = path.join(outputDir, generatedFile.path);
      await ensureDirectory(path.dirname(filePath));
      await writeFile(filePath, generatedFile.content, "utf8");
    }
    console.log(
      `✓ Generated feature '${description.featureName}' via geminii from ${file}`
    );
  }

  return descriptions;
}

async function ensureDirectory(dirPath: string) {
  const { mkdir } = await import("fs/promises");
  await mkdir(dirPath, { recursive: true });
}

async function writeFile(
  filePath: string,
  content: string,
  encoding: BufferEncoding
) {
  const { writeFile } = await import("fs/promises");
  await writeFile(filePath, content, encoding);
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await httpRequest("GET", url);
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
      const body =
        route.requestDto ? sampleBodyForDto(route.requestDto) : undefined;

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
    throw new Error(`API tests failed:\n${failures.join("\n")}`);
  }
}

async function main() {
  const outputDirArg = process.argv[2] ?? "src";
  const outputDir = path.resolve(process.cwd(), outputDirArg);
  const definitionsDir = path.resolve(
    process.cwd(),
    outputDirArg,
    "api-definitions"
  );

  console.log("🚀 Generating APIs from definitions...");
  let descriptions: ApiDescription[];

  if (process.env.USE_GEMINII === "true") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required when USE_GEMINII=true");
    }
    console.log("🤖 Using Gemini/OpenAI for generation...");
    descriptions = await generateApisFromDirectoryGeminii(
      definitionsDir,
      outputDir,
      apiKey
    );
  } else {
    console.log("📜 Using script-based generation...");
    descriptions = await generateApisFromDirectory(definitionsDir, outputDir);
  }

  if (descriptions.length === 0) {
    console.log("⚠️ No API definitions found. Generating sample API instead.");
    await createAgentApiFiles(sampleApiDescription, outputDir);
    descriptions = [sampleApiDescription];
  }

  console.log(
    `📝 Writing generated module with ${descriptions.length} descriptions...`
  );
  await writeGeneratedModuleFile(descriptions, outputDir);
  console.log("✅ Generated module written successfully.");

  console.log("🔧 Building project...");
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const buildCommand = `${npmCommand} run build`;
  const buildResult = spawnSync(buildCommand, {
    stdio: "inherit",
    shell: true,
  });

  if (buildResult.status !== 0) {
    throw new Error("Build failed. See output above.");
  }

  console.log("▶️ Starting built application...");
  const server = spawn("node", ["dist/src/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
    },
    stdio: ["ignore", "inherit", "inherit"],
  });

  try {
    await waitForServer(SERVER_URL, START_TIMEOUT_MS);
    console.log(`✅ Server started at ${SERVER_URL}`);

    console.log("🧪 Running test requests against generated APIs...");
    const apiDescriptions =
      descriptions.length ? descriptions : [sampleApiDescription];
    await testGeneratedApis(apiDescriptions);
    console.log("✅ All generated API routes returned successful responses.");
  } finally {
    if (!server.killed) {
      server.kill();
    }
  }
}

main().catch((error) => {
  console.error("❌ generate-build-test failed:", error);
  process.exit(1);
});

main().catch((error) => {
  console.error("❌ generate-build-test failed:", error);
  process.exit(1);
});
