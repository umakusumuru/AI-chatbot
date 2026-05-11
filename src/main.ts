import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");

  const swaggerConfig = new DocumentBuilder()
    .setTitle("AI Chatbot API")
    .setDescription("Generated NestJS API documentation with Swagger")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api-docs", app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`NestJS API running at http://localhost:${port}/api`);
  console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
}

bootstrap();
