"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const child_process_1 = require("child_process");
const agent_1 = require("../src/agent");
const fs = require("fs/promises");
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function runCommand(command, args, label) {
    return new Promise((resolve) => {
        console.log(`\n📋 ${label}...`);
        const child = (0, child_process_1.spawnSync)(command, args, {
            cwd: process.cwd(),
            stdio: "inherit",
            shell: true,
        });
        if (child.error) {
            console.error(`❌ ${label} failed:`, child.error);
            resolve(false);
        }
        else {
            console.log(`✅ ${label} completed`);
            resolve(true);
        }
    });
}
async function generateApis() {
    const outputDir = "src";
    const absoluteOutput = path.resolve(process.cwd(), outputDir);
    const definitionsDir = path.resolve(process.cwd(), outputDir, "api-definitions");
    console.log("🚀 Starting API generation...\n");
    const descriptions = await (0, agent_1.generateApisFromDirectory)(definitionsDir, absoluteOutput);
    if (descriptions.length > 0) {
        console.log(`\n✅ Generated ${descriptions.length} API(s)\n`);
        console.log("Generated modules:");
        descriptions.forEach((desc) => {
            console.log(`  - ${desc.moduleClassName} (route: /${desc.baseRoute})`);
        });
    }
    return descriptions;
}
async function updateGeneratedModule(descriptions) {
    const generatedModulePath = path.resolve(process.cwd(), "src", "generated.module.ts");
    const imports = descriptions
        .map((desc) => `import { ${desc.moduleClassName} } from './${desc.baseRoute}/${desc.baseRoute}.module';`)
        .join("\n");
    const refs = descriptions.map((desc) => desc.moduleClassName).join(", ");
    const moduleContent = `import { Module } from "@nestjs/common";
${imports}

/**
 * Dynamically imports all generated feature modules
 * Each feature module corresponds to an API definition file in src/api-definitions/
 * Auto-generated - Do not edit manually
 */
@Module({
  imports: [${refs}],
  controllers: [],
  providers: [],
})
export class GeneratedModule {}
`;
    await fs.writeFile(generatedModulePath, moduleContent, "utf-8");
    console.log(`✅ Updated GeneratedModule with ${descriptions.length} modules`);
}
async function buildProject() {
    return new Promise((resolve) => {
        console.log("\n🔨 Building project...");
        const build = (0, child_process_1.spawnSync)("npm", ["run", "build"], {
            cwd: process.cwd(),
            stdio: "inherit",
            shell: true,
        });
        if (build.status === 0) {
            console.log("✅ Build completed successfully");
            resolve(true);
        }
        else {
            console.error("❌ Build failed");
            resolve(false);
        }
    });
}
async function startServer() {
    return new Promise((resolve) => {
        console.log("\n🚀 Starting server...");
        const port = 3000;
        const server = (0, child_process_1.spawn)("npm", ["run", "start:dev"], {
            cwd: process.cwd(),
            stdio: ["pipe", "pipe", "pipe"],
            shell: true,
            detached: false,
        });
        let isReady = false;
        server.stdout.on("data", (data) => {
            const output = data.toString();
            console.log(output);
            if (output.includes("Nest application successfully started") &&
                !isReady) {
                isReady = true;
                console.log(`✅ Server started on http://localhost:${port}/api`);
                resolve({ process: server, port });
            }
        });
        server.stderr.on("data", (data) => {
            console.error("Server error:", data.toString());
        });
        server.on("error", (err) => {
            console.error("Failed to start server:", err);
            resolve({ process: null, port });
        });
        setTimeout(() => {
            if (!isReady) {
                console.log("⚠️ Server startup timeout - continuing with tests anyway");
                resolve({ process: server, port });
            }
        }, 30000);
    });
}
async function testApi(port, descriptions) {
    console.log("\n🧪 Testing APIs with sample data...\n");
    await sleep(2000);
    const baseUrl = `http://localhost:${port}/api`;
    for (const desc of descriptions) {
        console.log(`📍 Testing ${desc.featureName} module:`);
        for (const route of desc.routes) {
            const url = `${baseUrl}/${desc.baseRoute}${route.path === "" ? "" : "/" + route.path}`;
            try {
                let response;
                if (route.method === "post" || route.method === "put") {
                    const sampleBody = route.requestDto ?
                        Object.fromEntries(route.requestDto.properties.map((prop) => {
                            let value = "sample";
                            if (prop.type.includes("number"))
                                value = 123;
                            if (prop.type.includes("boolean"))
                                value = true;
                            if (prop.type.includes("[]"))
                                value = ["item1", "item2"];
                            return [prop.name, value];
                        }))
                        : {};
                    response = await fetch(url, {
                        method: route.method.toUpperCase(),
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(sampleBody),
                    });
                }
                else {
                    response = await fetch(url, { method: route.method.toUpperCase() });
                }
                const data = await response.text();
                const status = response.status;
                const statusEmoji = status >= 200 && status < 300 ? "✅" : "❌";
                console.log(`  ${statusEmoji} ${route.method.toUpperCase()} ${route.path || "/"} → ${status}`);
                if (data && data !== "{}") {
                    console.log(`     Response: ${data.substring(0, 100)}${data.length > 100 ? "..." : ""}`);
                }
            }
            catch (error) {
                console.log(`  ❌ ${route.method.toUpperCase()} ${route.path || "/"} → Error: ${error}`);
            }
        }
        console.log();
    }
}
async function main() {
    try {
        console.log("═══════════════════════════════════════════════");
        console.log("   🎯 API Generation → Build → Run → Test");
        console.log("═══════════════════════════════════════════════");
        const descriptions = await generateApis();
        if (descriptions.length === 0) {
            console.log("\n⚠️ No APIs generated. Make sure .api.json files exist in src/api-definitions/");
            process.exit(1);
        }
        console.log("\n📝 Updating GeneratedModule...");
        await updateGeneratedModule(descriptions);
        const buildSuccess = await buildProject();
        if (!buildSuccess) {
            console.error("\n❌ Build failed. Fix errors and try again.");
            process.exit(1);
        }
        const { process: serverProcess, port } = await startServer();
        if (!serverProcess) {
            console.error("❌ Failed to start server");
            process.exit(1);
        }
        await testApi(port, descriptions);
        console.log("═══════════════════════════════════════════════");
        console.log("✅ API Generation and Testing Complete!");
        console.log("═══════════════════════════════════════════════");
        console.log("\n📊 Summary:");
        console.log(`  • Generated: ${descriptions.length} API modules`);
        console.log(`  • Server: http://localhost:${port}/api`);
        console.log(`  • Status: All endpoints tested with sample data\n`);
        console.log("💡 To add more APIs:");
        console.log("  1. Create new .api.json in src/api-definitions/");
        console.log("  2. Run: npm run generate:build:run\n");
        console.log("Press Ctrl+C to stop the server");
    }
    catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
