import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { ApiDescription, ApiDtoProperty, ApiRoute } from '../agent';
import { VERSIONS } from './versions.config';

const V = VERSIONS.aspNet;
const VT = VERSIONS.aspNetTest;

function toPascalCase(s: string) {
  return s.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function mapCSharpType(type: string, required = true): string {
  if (type.includes('number') || type === 'int') return required ? 'int' : 'int?';
  if (type.includes('boolean')) return required ? 'bool' : 'bool?';
  if (type.includes('[]') || type === 'array') return 'List<string>';
  return 'string';
}

async function write(filePath: string, content: string) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

function buildDto(dtoName: string, properties: ApiDtoProperty[]): string {
  function buildRecord(name: string, props: ApiDtoProperty[]): string[] {
    const results: string[] = [];
    const fields = props.map(p => {
      if (p.properties?.length) {
        const nested = `${name}${capitalize(p.name)}`;
        results.push(...buildRecord(nested, p.properties));
        const required = p.required ? '\n    [Required]' : '';
        return `${required}\n    public ${nested} ${capitalize(p.name)} { get; set; } = new();`;
      }
      const csType = mapCSharpType(p.type || 'string', p.required !== false);
      const nullable = !p.required && csType === 'string' ? '?' : '';
      const annotation = p.required ? '\n    [Required]' : '';
      return `${annotation}\n    public ${csType}${nullable} ${capitalize(p.name)} { get; set; }`;
    });

    results.push(`public class ${name}\n{\n${fields.join('\n')}\n}`);
    return results;
  }

  const classes = buildRecord(dtoName, properties);
  return `using System.ComponentModel.DataAnnotations;

namespace Api.DTOs;

${classes.join('\n\n')}
`;
}

function buildInterface(description: ApiDescription): string {
  const serviceClass = toPascalCase(description.featureName) + 'Service';
  const interfaceName = `I${serviceClass}`;

  const methods = description.routes.map(route => {
    const hasPathParam = /:(\w+)/.test(route.path);
    const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
    const isList = (route.responseType ?? '').includes('[]');
    const returnType = isList ? 'Task<List<object>>' : 'Task<object>';
    const params: string[] = [];
    if (hasPathParam) params.push(`string ${paramName}`);
    if (route.requestDto) params.push(`${route.requestDto.name} body`);
    return `    ${returnType} ${toPascalCase(route.actionName)}Async(${params.join(', ')});`;
  }).join('\n');

  const dtoUsings = description.routes.some(r => r.requestDto) ? 'using Api.DTOs;\n' : '';

  return `${dtoUsings}
namespace Api.Services;

public interface ${interfaceName}
{
${methods}
}
`;
}

function buildService(description: ApiDescription): string {
  const serviceClass = toPascalCase(description.featureName) + 'Service';
  const interfaceName = `I${serviceClass}`;

  const methods = description.routes.map(route => {
    const hasPathParam = /:(\w+)/.test(route.path);
    const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
    const isList = (route.responseType ?? '').includes('[]');
    const returnType = isList ? 'Task<List<object>>' : 'Task<object>';
    const params: string[] = [];
    if (hasPathParam) params.push(`string ${paramName}`);
    if (route.requestDto) params.push(`${route.requestDto.name} body`);

    const sampleReturn = isList
      ? 'return Task.FromResult<List<object>>(new List<object> { new { Id = "1", Name = "Sample Item 1" }, new { Id = "2", Name = "Sample Item 2" } });'
      : `return Task.FromResult<object>(new { Id = ${hasPathParam ? paramName : '"1"'}, Name = "Sample ${route.actionName}" });`;

    const xmlParams = [
      hasPathParam ? `    /// <param name="${paramName}">Path identifier</param>` : '',
      route.requestDto ? `    /// <param name="body">${route.requestDto.name} payload</param>` : '',
      `    /// <returns>${isList ? 'List of items' : 'Single item'}</returns>`,
    ].filter(Boolean).join('\n');

    return `    /// <summary>${route.summary || route.actionName}</summary>
${xmlParams}
    public ${returnType} ${toPascalCase(route.actionName)}Async(${params.join(', ')})\n    {\n        // TODO: replace with actual business logic\n        ${sampleReturn}\n    }`;
  }).join('\n\n');

  const dtoUsings = description.routes.some(r => r.requestDto) ? 'using Api.DTOs;\n' : '';

  return `${dtoUsings}using Api.Services;

namespace Api.Services;

public class ${serviceClass} : ${interfaceName}
{
${methods}
}
`;
}

function buildController(description: ApiDescription): string {
  const controllerClass = toPascalCase(description.featureName) + 'Controller';
  const serviceClass = toPascalCase(description.featureName) + 'Service';
  const interfaceName = `I${serviceClass}`;

  const methodMap: Record<string, string> = {
    get: 'HttpGet', post: 'HttpPost', put: 'HttpPut', delete: 'HttpDelete', patch: 'HttpPatch',
  };

  const methods = description.routes.map(route => {
    const hasPathParam = /:(\w+)/.test(route.path);
    const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
    const path = route.path ? `"${route.path}"` : '';
    const isList = (route.responseType ?? '').includes('[]');
    const returnType = isList ? 'List<object>' : 'object';
    const params: string[] = [];
    if (hasPathParam) params.push(`string ${paramName}`);
    if (route.requestDto) params.push(`[FromBody] ${route.requestDto.name} body`);

    const serviceArgs = [
      hasPathParam ? paramName : '',
      route.requestDto ? 'body' : '',
    ].filter(Boolean).join(', ');

    const pathAttr = path ? `(${path})` : '';
    const notFoundAttr = hasPathParam ? '\n    [ProducesResponseType(StatusCodes.Status404NotFound)]' : '';
    const badReqAttr = route.requestDto ? '\n    [ProducesResponseType(StatusCodes.Status400BadRequest)]' : '';

    const xmlParams = [
      hasPathParam ? `    /// <param name="${paramName}">Path identifier</param>` : '',
      route.requestDto ? `    /// <param name="body">${route.requestDto.name} request payload</param>` : '',
      `    /// <returns>HTTP 200 with ${isList ? 'list of items' : 'response object'}</returns>`,
    ].filter(Boolean).join('\n');

    return `    /// <summary>${route.summary || route.actionName}</summary>
${xmlParams}
    [${methodMap[route.method]}${pathAttr}]
    [SwaggerOperation(Summary = "${route.summary || route.actionName}")]
    [ProducesResponseType(typeof(${returnType}), StatusCodes.Status200OK)]${badReqAttr}${notFoundAttr}
    public async Task<IActionResult> ${toPascalCase(route.actionName)}(${params.join(', ')})
    {
        var result = await _service.${toPascalCase(route.actionName)}Async(${serviceArgs});
        return Ok(result);
    }`;
  }).join('\n\n');

  const dtoUsings = description.routes.some(r => r.requestDto) ? 'using Api.DTOs;\n' : '';

  return `using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
${dtoUsings}using Api.Services;

namespace Api.Controllers;

/// <summary>
/// API controller for the ${capitalize(description.featureName)} feature.
/// Base path: /api/${description.baseRoute}
/// All endpoints are documented via Swagger UI at /swagger
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ${controllerClass} : ControllerBase
{
    private readonly ${interfaceName} _service;

    /// <summary>Initialises the controller with the injected service.</summary>
    /// <param name="service">The ${interfaceName} implementation.</param>
    public ${controllerClass}(${interfaceName} service)
    {
        _service = service;
    }

${methods}
}
`;
}

function buildProgramCs(description: ApiDescription): string {
  const serviceClass = toPascalCase(description.featureName) + 'Service';
  const interfaceName = `I${serviceClass}`;
  return `using Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c => c.EnableAnnotations());
builder.Services.AddScoped<${interfaceName}, ${serviceClass}>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.MapControllers();
app.Run();
`;
}

function buildCsproj(featureName: string): string {
  return `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>${V.dotnetSdkVersion}</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Swashbuckle.AspNetCore" Version="${V.swashbuckle}" />
    <PackageReference Include="Swashbuckle.AspNetCore.Annotations" Version="${V.swashbuckleAnnotations}" />
  </ItemGroup>
</Project>
`;
}

function buildVendorInterface(description: ApiDescription): string {
  const cap = toPascalCase(description.featureName);
  const vendorRoutes = description.routes.filter(r => r.vendor);

  const methods = vendorRoutes.length > 0
    ? vendorRoutes.map(route => {
        const hasPathParam = /:(\w+)/.test(route.path);
        const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
        const params = [
          hasPathParam ? `string ${paramName}` : '',
          route.requestDto ? `object body` : '',
        ].filter(Boolean).join(', ');
        return `    Task<object> ${toPascalCase(route.actionName)}Async(${params});`;
      }).join('\n')
    : `    Task<object> FetchExternalAsync(string url, object? body = null);`;

  return `namespace ${cap}Api.Services;

public interface I${cap}VendorService
{
${methods}
}
`;
}

function buildVendorService(description: ApiDescription): string {
  const cap = toPascalCase(description.featureName);
  const vendorRoutes = description.routes.filter(r => r.vendor);

  const methods = vendorRoutes.length > 0
    ? vendorRoutes.map(route => {
        const v = route.vendor!;
        const httpMethod = (v.method ?? route.method).toUpperCase();
        const hasPathParam = /:(\w+)/.test(route.path);
        const paramName = route.path.match(/:(\w+)/)?.[1] ?? 'id';
        const params = [
          hasPathParam ? `string ${paramName}` : '',
          route.requestDto ? `object body` : '',
        ].filter(Boolean).join(', ');
        const urlExpr = v.url.replace(/:(\w+)/g, (_: string, k: string) => `{${k}}`);
        const sendContent = route.requestDto
          ? `\n        var content = JsonContent.Create(body);`
          : '';
        const reqLine = route.requestDto
          ? `_http.${toPascalCase(httpMethod.toLowerCase())}Async($"${urlExpr}", content)`
          : `_http.${toPascalCase(httpMethod.toLowerCase())}Async($"${urlExpr}")`;
        return `    public async Task<object> ${toPascalCase(route.actionName)}Async(${params})
    {
        if (Environment.GetEnvironmentVariable("VENDOR_MOCK") == "true")
            return new { mocked = true, action = "${route.actionName}" };
${sendContent}
        var response = await ${reqLine};
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<object>() ?? new { };
    }`;
      }).join('\n\n')
    : `    public async Task<object> FetchExternalAsync(string url, object? body = null)
    {
        if (Environment.GetEnvironmentVariable("VENDOR_MOCK") == "true")
            return new { mocked = true };
        var content = body is null ? null : JsonContent.Create(body);
        var response = await _http.PostAsync(url, content);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<object>() ?? new { };
    }`;

  return `using System.Net.Http.Json;
namespace ${cap}Api.Services;

public class ${cap}VendorService : I${cap}VendorService
{
    private readonly HttpClient _http;

    public ${cap}VendorService(IHttpClientFactory factory)
    {
        _http = factory.CreateClient("VendorClient");
    }

${methods}
}
`;
}

function buildTestCsproj(description: ApiDescription): string {
  const featureName = description.featureName;
  const tf = description.testFramework ?? 'xunit';
  const VN = VERSIONS.nunit;
  const VM = VERSIONS.mstest;

  let packages: string;
  if (tf === 'nunit') {
    packages = `    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="${VN.testSdk}" />
    <PackageReference Include="NUnit" Version="${VN.nunit}" />
    <PackageReference Include="NUnit3TestAdapter" Version="${VN.nunitAdapter}" />
    <PackageReference Include="Moq" Version="${VN.moq}" />`;
  } else if (tf === 'mstest') {
    packages = `    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="${VM.testSdk}" />
    <PackageReference Include="MSTest.TestFramework" Version="${VM.mstest}" />
    <PackageReference Include="MSTest.TestAdapter" Version="${VM.mstest}" />
    <PackageReference Include="Moq" Version="${VM.moq}" />`;
  } else {
    packages = `    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="${VT.testSdk}" />
    <PackageReference Include="xunit" Version="${VT.xunit}" />
    <PackageReference Include="xunit.runner.visualstudio" Version="${VT.xunitRunner}" />
    <PackageReference Include="Moq" Version="${VT.moq}" />`;
  }

  return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>${V.dotnetSdkVersion}</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
  </PropertyGroup>
  <ItemGroup>
${packages}
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="../${featureName}-api.csproj" />
  </ItemGroup>
</Project>
`;
}

function buildControllerTests(description: ApiDescription): string {
  const cap = toPascalCase(description.featureName);
  const controllerClass = cap + 'Controller';
  const serviceInterface = `I${cap}Service`;
  const tf = description.testFramework ?? 'xunit';

  const dtoUsings = [...new Set(description.routes
    .filter(r => r.requestDto)
    .map(() => `using ${cap}Api.DTOs;`)
  )].join('\n');

  const tests = description.routes.map(route => {
    const hasPathParam = /:(\w+)/.test(route.path);
    const actionMethod = toPascalCase(route.actionName);
    const args = [
      hasPathParam ? `"test-id"` : '',
      route.requestDto ? `new ${route.requestDto.name}()` : '',
    ].filter(Boolean).join(', ');

    if (tf === 'nunit') {
      return `    [Test]
    public async Task ${actionMethod}_ReturnsResult()
    {
        var result = await _controller.${actionMethod}(${args});
        Assert.IsNotNull(result);
    }`;
    }
    if (tf === 'mstest') {
      return `    [TestMethod]
    public async Task ${actionMethod}_ReturnsResult()
    {
        var result = await _controller.${actionMethod}(${args});
        Assert.IsNotNull(result);
    }`;
    }
    return `    [Fact]
    public async Task ${actionMethod}_ReturnsResult()
    {
        var result = await _controller.${actionMethod}(${args});
        Assert.NotNull(result);
    }`;
  }).join('\n\n');

  if (tf === 'nunit') {
    return `using Moq;
using NUnit.Framework;
using ${cap}Api.Controllers;
using ${cap}Api.Services;
${dtoUsings}

namespace ${cap}Api.Tests;

[TestFixture]
public class ${controllerClass}Tests
{
    private Mock<${serviceInterface}> _mockService;
    private ${controllerClass} _controller;

    [SetUp]
    public void SetUp()
    {
        _mockService = new Mock<${serviceInterface}>();
        _controller = new ${controllerClass}(_mockService.Object);
    }

${tests}
}
`;
  }

  if (tf === 'mstest') {
    return `using Moq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using ${cap}Api.Controllers;
using ${cap}Api.Services;
${dtoUsings}

namespace ${cap}Api.Tests;

[TestClass]
public class ${controllerClass}Tests
{
    private Mock<${serviceInterface}> _mockService;
    private ${controllerClass} _controller;

    [TestInitialize]
    public void Initialize()
    {
        _mockService = new Mock<${serviceInterface}>();
        _controller = new ${controllerClass}(_mockService.Object);
    }

${tests}
}
`;
  }

  // xUnit (default)
  return `using Moq;
using Xunit;
using ${cap}Api.Controllers;
using ${cap}Api.Services;
${dtoUsings}

namespace ${cap}Api.Tests;

public class ${controllerClass}Tests
{
    private readonly Mock<${serviceInterface}> _mockService;
    private readonly ${controllerClass} _controller;

    public ${controllerClass}Tests()
    {
        _mockService = new Mock<${serviceInterface}>();
        _controller = new ${controllerClass}(_mockService.Object);
    }

${tests}
}
`;
}

export async function createAspNetFiles(description: ApiDescription, rootDir: string) {
  const base = join(rootDir, description.baseRoute);
  const cap = toPascalCase(description.featureName);
  const controllerClass = cap + 'Controller';
  const serviceClass = cap + 'Service';

  await write(join(base, 'Controllers', `${controllerClass}.cs`), buildController(description));
  await write(join(base, 'Services', `I${serviceClass}.cs`), buildInterface(description));
  await write(join(base, 'Services', `${serviceClass}.cs`), buildService(description));
  await write(join(base, 'Services', `I${cap}VendorService.cs`), buildVendorInterface(description));
  await write(join(base, 'Services', `${cap}VendorService.cs`), buildVendorService(description));
  await write(join(base, 'Program.cs'), buildProgramCs(description));
  await write(join(base, `${description.featureName}-api.csproj`), buildCsproj(description.featureName));
  await write(join(base, 'Tests', `${controllerClass}Tests.cs`), buildControllerTests(description));
  await write(join(base, 'Tests', `${description.featureName}-api.Tests.csproj`), buildTestCsproj(description));

  for (const route of description.routes) {
    if (route.requestDto) {
      await write(
        join(base, 'DTOs', `${route.requestDto.name}.cs`),
        buildDto(route.requestDto.name, route.requestDto.properties)
      );
    }
  }

  console.log(`✓ [ASP.NET Core] Generated for '${description.featureName}' → ${base}`);
}
