import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { writeFile } from 'fs/promises';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Chatbot API')
    .setDescription('Generated NestJS API documentation with Swagger')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const outputPath = 'swagger.json';
  await writeFile(outputPath, JSON.stringify(document, null, 2), 'utf8');
  console.log(`Swagger document saved to ${outputPath}`);
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
