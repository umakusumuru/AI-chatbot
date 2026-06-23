import OpenAI from 'openai';
import { ApiDescription } from './agent';

export interface GeneratedFile {
  path: string;
  content: string;
}

export class GeminiiClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  private async createChatCompletionWithRetry(
    request: any,
    retries = 3
  ): Promise<any> {
    const retryableStatus = [429, 502, 503, 504];
    let attempt = 0;

    while (attempt <= retries) {
      try {
        return await this.client.chat.completions.create(request);
      } catch (error: any) {
        attempt += 1;
        const status = error?.status || error?.response?.status;
        const isRetryable = retryableStatus.includes(status);

        if (!isRetryable || attempt > retries) {
          throw error;
        }

        const delayMs = 500 * 2 ** (attempt - 1);
        console.warn(
          `OpenAI request failed with status ${status}. Retrying attempt ${attempt}/${retries} in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async generateFiles(description: ApiDescription): Promise<GeneratedFile[]> {
    const prompt = `You are a NestJS code generator. Generate a complete feature folder for the following API description:

${JSON.stringify(description, null, 2)}

IMPORTANT: Include comprehensive Swagger/OpenAPI decorators for automatic API documentation:

1. Controller decorators:
   - @ApiTags('${description.baseRoute}') on the controller class
   - @ApiOperation({ summary: 'endpoint description' }) on each method
   - @ApiResponse({ status: 200, description: 'Successful response.' }) on success methods
   - @ApiBadRequestResponse({ description: 'Invalid request.' }) on all methods
   - @ApiNotFoundResponse({ description: 'Resource not found.' }) on methods with path parameters
   - @ApiBody({ type: DtoClass }) on POST/PUT methods with request bodies

2. DTO decorators:
   - @ApiProperty({ required: true/false, type: String/Number }) for each property
   - Use @ApiProperty for required fields, @ApiPropertyOptional for optional fields

3. Service validation:
   - Include validation logic for required fields in request bodies
   - Include path parameter validation (return 404 for invalid IDs like '0')
   - Use BadRequestException for validation errors, NotFoundException for missing resources

The generated code must use Observables from rxjs.
Generate these files:
- ${description.baseRoute}/${description.baseRoute}.module.ts
- ${description.baseRoute}/${description.baseRoute}.controller.ts
- ${description.baseRoute}/${description.baseRoute}.service.ts
- one or more dto files under ${description.baseRoute}/dto/ for request DTOs

Import necessary decorators from '@nestjs/swagger' and exceptions from '@nestjs/common'.

If the API route object contains a vendor block, include service code that proxies requests to the external vendor URL using fetch, templating url, headers, and request body from the vendor fields. Support optional mapRequest and mapResponse templating using {{...}} placeholders.

Return only valid JSON in this exact format:
{
  "files": [
    {"path": "<relative-path>", "content": "<file content>"}
  ]
}

Do not include markdown fences, explanations, or any extra text.`;

    const response = await this.createChatCompletionWithRetry({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    const rawContent = response.choices?.[0]?.message?.content;
    let rawText = '';

    if (typeof rawContent === 'string') {
      rawText = rawContent;
    } else if (Array.isArray(rawContent)) {
      const contentParts = rawContent as any[];
      rawText = contentParts.map((item) => item?.text ?? '').join('');
    }

    if (!rawText) {
      throw new Error(
        'Geminii response did not contain a parsable code payload.'
      );
    }

    const parsed = JSON.parse(rawText);
    if (!parsed.files || !Array.isArray(parsed.files)) {
      throw new Error('Geminii output did not return a valid files array.');
    }

    return parsed.files.map((item: any) => ({
      path: item.path,
      content: item.content,
    }));
  }
}
