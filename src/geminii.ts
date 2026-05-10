import OpenAI from "openai";
import { ApiDescription } from "./agent";

export interface GeneratedFile {
  path: string;
  content: string;
}

export class GeminiiClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateFiles(description: ApiDescription): Promise<GeneratedFile[]> {
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
    } else if (Array.isArray(rawContent)) {
      const contentParts = rawContent as any[];
      rawText = contentParts.map((item) => item?.text ?? "").join("");
    }

    if (!rawText) {
      throw new Error(
        "Geminii response did not contain a parsable code payload."
      );
    }

    const parsed = JSON.parse(rawText);
    if (!parsed.files || !Array.isArray(parsed.files)) {
      throw new Error("Geminii output did not return a valid files array.");
    }

    return parsed.files.map((item: any) => ({
      path: item.path,
      content: item.content,
    }));
  }
}
