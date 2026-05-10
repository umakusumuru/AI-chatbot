"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiiClient = void 0;
const openai_1 = require("openai");
class GeminiiClient {
    constructor(apiKey) {
        this.client = new openai_1.default({ apiKey });
    }
    async generateFiles(description) {
        const prompt = `You are a NestJS code generator. Generate a complete feature folder for the following API description:

${JSON.stringify(description, null, 2)}

The generated code must use Observables from rxjs.
Generate these files:
- ${description.baseRoute}/${description.baseRoute}.module.ts
- ${description.baseRoute}/${description.baseRoute}.controller.ts
- ${description.baseRoute}/${description.baseRoute}.service.ts
- one or more dto files under ${description.baseRoute}/dto/ for request DTOs

Return only valid JSON in this exact format:
{
  "files": [
    {"path": "<relative-path>", "content": "<file content>"}
  ]
}

Do not include markdown fences, explanations, or any extra text.`;
        const response = await this.client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        });
        const rawContent = response.choices?.[0]?.message?.content;
        let rawText = "";
        if (typeof rawContent === "string") {
            rawText = rawContent;
        }
        else if (Array.isArray(rawContent)) {
            const contentParts = rawContent;
            rawText = contentParts.map((item) => item?.text ?? "").join("");
        }
        if (!rawText) {
            throw new Error("Geminii response did not contain a parsable code payload.");
        }
        const parsed = JSON.parse(rawText);
        if (!parsed.files || !Array.isArray(parsed.files)) {
            throw new Error("Geminii output did not return a valid files array.");
        }
        return parsed.files.map((item) => ({
            path: item.path,
            content: item.content,
        }));
    }
}
exports.GeminiiClient = GeminiiClient;
