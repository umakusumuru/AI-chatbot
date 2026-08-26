/**
 * Centralized dependency versions for all code generators.
 * Update here when a new framework version ships — no need to touch individual generators.
 *
 * Versioning conventions:
 *  - npm   : caret ranges (^) so patch/minor updates are allowed
 *  - Maven : exact version — Spring Boot BOM manages transitive versions
 *  - NuGet : exact version — .csproj SDK handles minor compatibility
 *  - pip   : minimum floor (>=) — consistent with PyPI best practice
 */

export const VERSIONS = {
  // ─── Express stack ───────────────────────────────────────────────────────────
  express: {
    express: '^4.18.3',
    expressValidator: '^7.0.1',
    swaggerUiExpress: '^5.0.0',
    typesExpress: '^4.17.21',
    typesNode: '^20.14.4',
    typesSwaggerUiExpress: '^4.1.6',
    typescript: '^5.4.0',
    tsNodeDev: '^2.0.0',
  },

  // ─── Spring Boot stack ───────────────────────────────────────────────────────
  springBoot: {
    springBootParent: '3.2.0',
    springdocOpenapi: '2.3.0',
    javaSource: '17',
    javaTarget: '17',
  },

  // ─── ASP.NET Core stack ──────────────────────────────────────────────────────
  aspNet: {
    swashbuckle: '6.5.0',
    swashbuckleAnnotations: '6.5.0',
    dotnetSdkVersion: 'net8.0',
  },

  // ─── FastAPI stack ───────────────────────────────────────────────────────────
  fastApi: {
    fastapi: '>=0.110.0',
    uvicorn: '>=0.27.0',
    pydantic: '>=2.0.0',
    pythonVersion: '3.11',
  },

  // ─── NestJS stack (used by GraphQL + gRPC generators too) ───────────────────
  nestJs: {
    nestCommon: '^10.0.0',
    nestCore: '^10.0.0',
    nestGraphql: '^12.0.0',
    nestApollo: '^12.0.0',
    nestMicroservices: '^10.0.0',
    graphql: '^16.0.0',
    apolloServer: '^4.0.0',
    nestSwagger: '^7.3.0',
    swaggerUiExpress: '^5.0.0',
    typescript: '^5.4.0',
  },

  // ─── Express vendor + test deps ──────────────────────────────────────────────
  expressTest: {
    axios: '^1.7.2',
    jest: '^29.7.0',
    tsJest: '^29.2.0',
    supertest: '^7.0.0',
    typesJest: '^29.5.0',
    typesSupertest: '^6.0.0',
  },

  // ─── Spring Boot test deps (already in BOM via spring-boot-starter-test) ────
  springBootTest: {
    junitVersion: '5.10.2',
    mockitoVersion: '5.11.0',
  },

  // ─── ASP.NET Core test deps ──────────────────────────────────────────────────
  aspNetTest: {
    testSdk: '17.9.0',
    xunit: '2.7.0',
    xunitRunner: '2.5.7',
    moq: '4.20.70',
    aspNetCoreMvcTesting: '8.0.0',
  },

  // ─── FastAPI vendor + test deps ──────────────────────────────────────────────
  fastApiTest: {
    httpx: '>=0.27.0',
    pytest: '>=8.0.0',
    pytestAsyncio: '>=0.23.0',
  },

  // ─── Alternative test frameworks ─────────────────────────────────────────────

  // TypeScript: Vitest (alternative to Jest)
  vitest: {
    vitest: '^1.6.0',
    vitestCoverage: '^1.6.0',
    supertest: '^7.0.0',
    typesSupertest: '^6.0.0',
  },

  // Java: TestNG (alternative to JUnit 5)
  testng: {
    testng: '7.10.2',
    mockitoVersion: '5.11.0',
  },

  // C#: NUnit (alternative to xUnit)
  nunit: {
    nunit: '4.1.0',
    nunitAdapter: '4.5.0',
    testSdk: '17.9.0',
    moq: '4.20.70',
  },

  // C#: MSTest (alternative to xUnit)
  mstest: {
    mstest: '3.3.1',
    testSdk: '17.9.0',
    moq: '4.20.70',
  },
} as const;
