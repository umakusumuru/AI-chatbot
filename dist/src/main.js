"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("@nestjs/swagger");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix("api");
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle("AI Chatbot API")
        .setDescription("Generated NestJS API documentation with Swagger")
        .setVersion("1.0")
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup("api-docs", app, document);
    const port = Number(process.env.PORT ?? 3000);
    await app.listen(port);
    console.log(`NestJS API running at http://localhost:${port}/api`);
    console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
}
bootstrap();
