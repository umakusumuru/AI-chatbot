import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { ApiDescription, ApiDtoProperty, ApiRoute } from '../agent';
import { VERSIONS } from './versions.config';

const V = VERSIONS.springBoot;

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
function toPascalCase(s: string) { return s.split(/[-_]/).map(capitalize).join(''); }
function toSnakeCase(s: string) { return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''); }

function mapJavaType(type: string, required = true): string {
  if (type.includes('number') || type === 'int' || type === 'integer') return required ? 'Integer' : 'Integer';
  if (type.includes('boolean')) return 'Boolean';
  if (type.includes('[]') || type === 'array') return 'List<String>';
  return 'String';
}

async function write(filePath: string, content: string) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

function buildDto(dtoName: string, properties: ApiDtoProperty[], pkg: string): string {
  function buildClass(name: string, props: ApiDtoProperty[]): string[] {
    const classes: string[] = [];
    const fields: string[] = [];

    for (const p of props) {
      if (p.properties?.length) {
        const nestedName = `${name}${capitalize(p.name)}`;
        classes.push(...buildClass(nestedName, p.properties));
        const annotation = p.required ? '    @Valid\n    @NotNull\n' : '    @Valid\n';
        fields.push(`${annotation}    private ${nestedName} ${p.name};`);
        continue;
      }
      const javaType = mapJavaType(p.type || 'string');
      const annotation = p.required
        ? javaType === 'String' ? '    @NotBlank\n' : '    @NotNull\n'
        : '';
      fields.push(`${annotation}    private ${javaType} ${p.name};`);
    }

    const gettersSetters = props.map(p => {
      const nestedName = p.properties?.length ? `${name}${capitalize(p.name)}` : null;
      const javaType = nestedName ?? mapJavaType(p.type || 'string');
      const cap = capitalize(p.name);
      return `    public ${javaType} get${cap}() { return ${p.name}; }\n    public void set${cap}(${javaType} ${p.name}) { this.${p.name} = ${p.name}; }`;
    }).join('\n\n');

    classes.push(`public class ${name} {\n\n${fields.join('\n\n')}\n\n${gettersSetters}\n}`);
    return classes;
  }

  const classes = buildClass(dtoName, properties);
  return `package ${pkg}.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

${classes.join('\n\n')}
`;
}

function buildService(description: ApiDescription, pkg: string): string {
  const serviceClass = toPascalCase(description.featureName) + 'Service';

  const methods = description.routes.map(route => {
    const hasPathParam = /:(\w+)/.test(route.path);
    const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
    const params: string[] = [];
    if (hasPathParam) params.push(`String ${paramName}`);
    if (route.requestDto) params.push(`${route.requestDto.name} body`);

    const isList = (route.responseType ?? '').includes('[]');
    const returnType = isList ? 'List<Object>' : 'Object';

    const sampleReturn = isList
      ? 'return List.of(Map.of("id", "1", "name", "Sample Item 1"), Map.of("id", "2", "name", "Sample Item 2"));'
      : `return Map.of("id", ${hasPathParam ? paramName : '"1"'}, "name", "Sample ${route.actionName}");`;

    const paramDocs = [
      hasPathParam ? `     * @param ${paramName} path identifier` : '',
      route.requestDto ? `     * @param body ${route.requestDto.name} request payload` : '',
      `     * @return ${isList ? 'list of items' : 'single item response'}`,
    ].filter(Boolean).join('\n');

    return `    /**
     * ${route.summary || route.actionName}
     *
${paramDocs}
     */
    public ${returnType} ${route.actionName}(${params.join(', ')}) {\n        // TODO: replace with actual business logic\n        ${sampleReturn}\n    }`;
  }).join('\n\n');

  const dtoImports = [...new Set(description.routes.filter(r => r.requestDto).map(r => `import ${pkg}.dto.${r.requestDto!.name};`))].join('\n');

  return `package ${pkg}.service;

import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;
${dtoImports}

/**
 * Service layer for the ${capitalize(description.featureName)} feature.
 * Contains business logic for all ${description.baseRoute} operations.
 * Replace the stub implementations with real data access logic.
 */
@Service
public class ${serviceClass} {

${methods}
}
`;
}

function buildController(description: ApiDescription, pkg: string): string {
  const controllerClass = toPascalCase(description.featureName) + 'Controller';
  const serviceClass = toPascalCase(description.featureName) + 'Service';

  const methodMap: Record<string, string> = {
    get: 'GetMapping', post: 'PostMapping', put: 'PutMapping',
    delete: 'DeleteMapping', patch: 'PatchMapping',
  };

  const methods = description.routes.map(route => {
    const hasPathParam = /:(\w+)/.test(route.path);
    const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
    const path = route.path ? `("/${route.path}")` : '';
    const params: string[] = [];
    if (hasPathParam) params.push(`@PathVariable String ${paramName}`);
    if (route.requestDto) params.push(`@Valid @RequestBody ${route.requestDto.name} body`);

    const serviceArgs = [
      hasPathParam ? paramName : '',
      route.requestDto ? 'body' : '',
    ].filter(Boolean).join(', ');

    const isList = (route.responseType ?? '').includes('[]');
    const returnType = isList ? 'List<Object>' : 'Object';

    const javadocParams = [
      hasPathParam ? `     * @param ${paramName} path identifier` : '',
      route.requestDto ? `     * @param body ${route.requestDto.name} request body (validated)` : '',
      `     * @return HTTP 200 with ${isList ? 'list of items' : 'response object'}`,
    ].filter(Boolean).join('\n');

    return `    /**
     * ${route.summary || route.actionName}
     *
${javadocParams}
     */
    @${methodMap[route.method]}${path}
    @Operation(summary = "${route.summary || route.actionName}")
    @ApiResponse(responseCode = "200", description = "Successful response")
    public ResponseEntity<${returnType}> ${route.actionName}(${params.join(', ')}) {
        return ResponseEntity.ok(service.${route.actionName}(${serviceArgs}));
    }`;
  }).join('\n\n');

  const dtoImports = [...new Set(description.routes.filter(r => r.requestDto).map(r => `import ${pkg}.dto.${r.requestDto!.name};`))].join('\n');

  return `package ${pkg}.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import ${pkg}.service.${serviceClass};
${dtoImports}

/**
 * REST controller for the ${capitalize(description.featureName)} API.
 * Base path: /api/${description.baseRoute}
 *
 * <p>All endpoints are documented via Swagger UI at /swagger-ui.html</p>
 */
@RestController
@RequestMapping("/api/${description.baseRoute}")
@Tag(name = "${description.featureName}", description = "${description.featureName} API")
public class ${controllerClass} {

    @Autowired
    private ${serviceClass} service;

${methods}
}
`;
}

function buildPomXml(description: ApiDescription): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>${V.springBootParent}</version>
  </parent>
  <groupId>com.example</groupId>
  <artifactId>${description.featureName}-api</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springdoc</groupId>
      <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
      <version>${V.springdocOpenapi}</version>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
`;
}

function buildApplicationClass(pkg: string, featureName: string): string {
  const appClass = toPascalCase(featureName) + 'Application';
  return `package ${pkg};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ${appClass} {
    public static void main(String[] args) {
        SpringApplication.run(${appClass}.class, args);
    }
}
`;
}

function buildVendorService(description: ApiDescription, pkg: string): string {
  const cap = toPascalCase(description.featureName);
  const vendorRoutes = description.routes.filter(r => r.vendor);

  const methods = vendorRoutes.length > 0
    ? vendorRoutes.map(route => {
        const v = route.vendor!;
        const httpMethod = (v.method ?? route.method).toUpperCase();
        const hasPathParam = /:(\w+)/.test(route.path);
        const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
        const params = [
          hasPathParam ? `String ${paramName}` : '',
          route.requestDto ? `Object body` : '',
        ].filter(Boolean).join(', ');
        const url = v.url.replace(/:(\w+)/g, (_: string, k: string) => `" + ${k} + "`);
        return `    public Object ${route.actionName}(${params}) {
        if ("true".equals(System.getenv("VENDOR_MOCK"))) {
            return Map.of("mocked", true, "action", "${route.actionName}");
        }
        return restClient.${httpMethod.toLowerCase()}()
            .uri("${url}")
            .body(${route.requestDto ? 'body' : 'Map.of()'})
            .retrieve()
            .body(Object.class);
    }`;
      }).join('\n\n')
    : `    public Object fetchExternal(String url, Object body) {
        if ("true".equals(System.getenv("VENDOR_MOCK"))) {
            return Map.of("mocked", true);
        }
        return restClient.post()
            .uri(url)
            .body(body)
            .retrieve()
            .body(Object.class);
    }`;

  return `package ${pkg}.vendor;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.util.Map;

@Service
public class ${cap}VendorService {

    private final RestClient restClient;

    public ${cap}VendorService(RestClient.Builder builder) {
        this.restClient = builder
            .baseUrl("https://api.example.com")
            .defaultHeader("Content-Type", "application/json")
            .build();
    }

${methods}
}
`;
}

function buildControllerTest(description: ApiDescription, pkg: string): string {
  const cap = toPascalCase(description.featureName);
  const controllerClass = cap + 'Controller';
  const serviceClass = cap + 'Service';
  const useTestNG = description.testFramework === 'testng';

  const testAnnotation = useTestNG ? '@Test' : '@Test';
  const testImport = useTestNG
    ? `import org.testng.annotations.Test;\nimport org.testng.annotations.BeforeMethod;`
    : `import org.junit.jupiter.api.Test;`;

  const tests = description.routes.map(route => {
    const path = '/api/' + description.baseRoute + '/' + route.path.replace(/^\//, '').replace(/:(\w+)/g, '1');
    const cleanPath = path.replace(/\/+$/, '');
    const method = route.method.toUpperCase();

    let requestBody = '';
    if (route.requestDto) {
      const fields = route.requestDto.properties
        .map(p => `"${p.name}": "${p.name}-test"`)
        .join(', ');
      requestBody = `
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\${${fields}}}")`;
    }

    return `    ${testAnnotation}
    void ${route.actionName}ShouldReturn2xx() throws Exception {
        mockMvc.perform(MockMvcRequestBuilders.${method.toLowerCase()}("${cleanPath}")${requestBody})
            .andExpect(MockMvcResultMatchers.status().is2xxSuccessful());
    }`;
  }).join('\n\n');

  return `package ${pkg}.controller;

${testImport}
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;

@WebMvcTest(${controllerClass}.class)
class ${controllerClass}Test {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ${serviceClass} service;

${tests}
}
`;
}

function buildServiceTest(description: ApiDescription, pkg: string): string {
  const cap = toPascalCase(description.featureName);
  const serviceClass = cap + 'Service';
  const useTestNG = description.testFramework === 'testng';

  const [testImport, beforeImport, assertClass, beforeAnnotation] = useTestNG
    ? [
        `import org.testng.annotations.Test;`,
        `import org.testng.annotations.BeforeMethod;`,
        `org.testng.Assert`,
        `@BeforeMethod`,
      ]
    : [
        `import org.junit.jupiter.api.Test;`,
        `import org.junit.jupiter.api.BeforeEach;`,
        `org.junit.jupiter.api.Assertions`,
        `@BeforeEach`,
      ];

  const tests = description.routes.map(route => {
    return `    @Test
    void ${route.actionName}ShouldNotThrow() {
        ${assertClass}.assertDoesNotThrow(() -> {
            // service.${route.actionName}(...);
        });
    }`;
  }).join('\n\n');

  return `package ${pkg}.service;

${testImport}
${beforeImport}

class ${serviceClass}Test {

    private ${serviceClass} service;

    ${beforeAnnotation}
    void setUp() {
        service = new ${serviceClass}();
    }

${tests}
}
`;
}

function buildPomXmlWithTestNG(description: ApiDescription): string {
  return buildPomXml(description).replace(
    '</dependencies>',
    `    <dependency>
      <groupId>org.testng</groupId>
      <artifactId>testng</artifactId>
      <version>${VERSIONS.testng.testng}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.mockito</groupId>
      <artifactId>mockito-core</artifactId>
      <version>${VERSIONS.testng.mockitoVersion}</version>
      <scope>test</scope>
    </dependency>
  </dependencies>`
  );
}

export async function createSpringBootFiles(description: ApiDescription, rootDir: string) {
  const base = join(rootDir, description.baseRoute);
  const pkg = `com.example.${toSnakeCase(description.featureName).replace(/_/g, '.')}`;
  const pkgPath = join(base, 'src', 'main', 'java', ...pkg.split('.'));
  const testPkgPath = join(base, 'src', 'test', 'java', ...pkg.split('.'));

  const controllerClass = toPascalCase(description.featureName) + 'Controller';
  const serviceClass = toPascalCase(description.featureName) + 'Service';
  const appClass = toPascalCase(description.featureName) + 'Application';

  await write(join(pkgPath, 'controller', `${controllerClass}.java`), buildController(description, pkg));
  await write(join(pkgPath, 'service', `${serviceClass}.java`), buildService(description, pkg));
  await write(join(pkgPath, 'vendor', `${toPascalCase(description.featureName)}VendorService.java`), buildVendorService(description, pkg));
  await write(join(pkgPath, `${appClass}.java`), buildApplicationClass(pkg, description.featureName));
  await write(join(testPkgPath, 'controller', `${controllerClass}Test.java`), buildControllerTest(description, pkg));
  await write(join(testPkgPath, 'service', `${serviceClass}Test.java`), buildServiceTest(description, pkg));
  const pomContent = description.testFramework === 'testng'
    ? buildPomXmlWithTestNG(description)
    : buildPomXml(description);
  await write(join(base, 'pom.xml'), pomContent);

  for (const route of description.routes) {
    if (route.requestDto) {
      await write(
        join(pkgPath, 'dto', `${route.requestDto.name}.java`),
        buildDto(route.requestDto.name, route.requestDto.properties, pkg)
      );
    }
  }

  console.log(`✓ [Spring Boot] Generated for '${description.featureName}' → ${base}`);
}
