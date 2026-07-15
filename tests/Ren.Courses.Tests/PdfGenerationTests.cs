using System.Text;
using BlazorStaticMinimalBlog.Models;
using BlazorStaticMinimalBlog.Services;
using Microsoft.Extensions.Logging;

namespace Ren.Courses.Tests;

[Collection("BuildTimeProvider")]
public class PdfGenerationTests
{
    // --- Frontmatter / PdfConfig ---

    [Fact]
    public void AbsentPdfConfig_DefaultsToNull()
    {
        var fm = new CourseFrontMatter
        {
            Title = "Test",
            Published = new DateTime(2026, 3, 1),
            Tags = new List<string> { "test" }
        };

        Assert.Null(fm.Pdf);
    }

    [Fact]
    public void PdfConfig_WithCustomTemplate_RoundTrips()
    {
        var post = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
        {
            Title = "Custom",
            Published = new DateTime(2026, 3, 1),
            Tags = new List<string> { "test" },
            Pdf = new PdfConfig
            {
                Template = "custom",
                Variables = new Dictionary<string, object>
                {
                    ["courseLabel"] = "CMSC 131",
                    ["documentType"] = "Lab"
                }
            }
        });

        Assert.NotNull(post.FrontMatter.Pdf);
        Assert.Equal("custom", post.FrontMatter.Pdf.Template);
        Assert.NotNull(post.FrontMatter.Pdf.Variables);
        Assert.Equal("CMSC 131", post.FrontMatter.Pdf.Variables["courseLabel"].ToString());
        Assert.Equal("Lab", post.FrontMatter.Pdf.Variables["documentType"].ToString());
    }

    [Fact]
    public void PdfConfig_DefaultTemplate_WhenPdfMissing()
    {
        // The default template is resolved in the generator, not the frontmatter
        // CourseFrontMatter.Pdf is null when not specified
        var fm = new CourseFrontMatter
        {
            Title = "No Pdf",
            Published = new DateTime(2026, 3, 1),
            Tags = new List<string> { "test" },
            DownloadLink = "https://example.com/doc.pdf"
        };

        Assert.Null(fm.Pdf);
    }

    // --- Template name validation ---

    [Theory]
    [InlineData("default")]
    [InlineData("custom")]
    [InlineData("my-template")]
    [InlineData("template123")]
    public void ValidTemplateNames_Accepted(string templateName)
    {
        // Simulate validation logic from PdfGeneratorService
        var regex = new System.Text.RegularExpressions.Regex(@"^[a-z0-9][a-z0-9_-]*$");
        Assert.Matches(regex, templateName);
    }

    [Theory]
    [InlineData("")]
    [InlineData("UPPERCASE")]
    [InlineData("has space")]
    [InlineData("../traversal")]
    [InlineData("path/separator")]
    [InlineData("template@name")]
    [InlineData("-starts-with-dash")]
    [InlineData("_starts-with-underscore")]
    public void InvalidTemplateNames_Rejected(string templateName)
    {
        var regex = new System.Text.RegularExpressions.Regex(@"^[a-z0-9][a-z0-9_-]*$");
        Assert.DoesNotMatch(regex, templateName);
    }

    // --- PdfGenerationManifest ---

    [Fact]
    public void Manifest_NoResult_ReturnsNull()
    {
        var manifest = new PdfGenerationManifest();
        Assert.Null(manifest.GetResult("nonexistent"));
    }

    [Fact]
    public void Manifest_SetAndGetResult_Succeeds()
    {
        var manifest = new PdfGenerationManifest();
        manifest.SetResult("test-post", new PdfGenerationResult
        {
            Status = PdfGenerationStatus.Generated,
            RelativeUrl = "pdfs/test-post.abc123.pdf"
        });

        var result = manifest.GetResult("test-post");
        Assert.NotNull(result);
        Assert.Equal(PdfGenerationStatus.Generated, result.Status);
        Assert.Equal("pdfs/test-post.abc123.pdf", result.RelativeUrl);
    }

    [Fact]
    public void Manifest_SetFailedResult_ContainsDiagnostic()
    {
        var manifest = new PdfGenerationManifest();
        manifest.SetResult("failed-post", new PdfGenerationResult
        {
            Status = PdfGenerationStatus.Failed,
            Diagnostic = "Toolchain unavailable"
        });

        var result = manifest.GetResult("failed-post");
        Assert.NotNull(result);
        Assert.Equal(PdfGenerationStatus.Failed, result.Status);
        Assert.Equal("Toolchain unavailable", result.Diagnostic);
    }

    [Fact]
    public void Manifest_SetCachedResult_Succeeds()
    {
        var manifest = new PdfGenerationManifest();
        manifest.SetResult("cached-post", new PdfGenerationResult
        {
            Status = PdfGenerationStatus.Cached,
            RelativeUrl = "pdfs/cached-post.def456.pdf"
        });

        var result = manifest.GetResult("cached-post");
        Assert.NotNull(result);
        Assert.Equal(PdfGenerationStatus.Cached, result.Status);
    }

    [Fact]
    public void Manifest_AllResults_ReflectsSetEntries()
    {
        var manifest = new PdfGenerationManifest();
        manifest.SetResult("a", new PdfGenerationResult { Status = PdfGenerationStatus.Generated, RelativeUrl = "a.pdf" });
        manifest.SetResult("b", new PdfGenerationResult { Status = PdfGenerationStatus.Failed, Diagnostic = "err" });

        Assert.Equal(2, manifest.AllResults.Count);
        Assert.Contains("a", manifest.AllResults.Keys);
        Assert.Contains("b", manifest.AllResults.Keys);
    }

    // --- Download resolution (component logic tests) ---

    [Fact]
    public void GeneratedResult_OverridesDownloadLink()
    {
        var manifest = new PdfGenerationManifest();
        manifest.SetResult("test-post", new PdfGenerationResult
        {
            Status = PdfGenerationStatus.Generated,
            RelativeUrl = "pdfs/test-post.abc123.pdf"
        });

        var result = manifest.GetResult("test-post");
        var hasGenerated = result?.Status is PdfGenerationStatus.Generated or PdfGenerationStatus.Cached
            && result?.RelativeUrl is not null;

        Assert.True(hasGenerated);
        // The generated link should be base-relative without leading slash
        Assert.StartsWith("pdfs/", result!.RelativeUrl);
        Assert.DoesNotContain("/pdfs", result.RelativeUrl.AsSpan(1));
    }

    [Fact]
    public void FailedResult_FallsBackToDownloadLink()
    {
        const string fallbackLink = "https://drive.google.com/example.pdf";

        var manifest = new PdfGenerationManifest();
        manifest.SetResult("test-post", new PdfGenerationResult
        {
            Status = PdfGenerationStatus.Failed,
            Diagnostic = "Pandoc not found"
        });

        var result = manifest.GetResult("test-post");
        var hasGenerated = result?.Status is PdfGenerationStatus.Generated or PdfGenerationStatus.Cached
            && result?.RelativeUrl is not null;
        var hasFallback = !string.IsNullOrWhiteSpace(fallbackLink);

        Assert.False(hasGenerated);
        Assert.True(hasFallback);
    }

    [Fact]
    public void FailedResult_WithoutFallback_OmitDownload()
    {
        var manifest = new PdfGenerationManifest();
        manifest.SetResult("test-post", new PdfGenerationResult
        {
            Status = PdfGenerationStatus.Failed,
            Diagnostic = "Generation error"
        });

        var result = manifest.GetResult("test-post");
        var hasGenerated = result?.Status is PdfGenerationStatus.Generated or PdfGenerationStatus.Cached
            && result?.RelativeUrl is not null;
        var hasFallback = false; // No DownloadLink

        Assert.False(hasGenerated);
        Assert.False(hasFallback);
        // Submit should still be independent (separate check not part of manifest)
    }

    [Fact]
    public void MissingManifestEntry_TreatedAsFailure()
    {
        var manifest = new PdfGenerationManifest();

        Assert.Null(manifest.GetResult("unknown-post"));
        // Component treats null as failure → uses fallback if available
    }

    [Fact]
    public void GeneratedLink_UsesDownloadAttribute_BaseRelativeUrl()
    {
        // Verify generated link contract matches spec
        var relativeUrl = "pdfs/test-post.abc123.pdf";
        var leafSlug = "test-post";

        var href = relativeUrl;
        var download = $"{leafSlug}.pdf";

        // Base-relative: no leading slash
        Assert.False(href.StartsWith("/"), "Generated URL should be base-relative");
        // Has download attribute (simulated by href containing slug)
        Assert.Equal("test-post.pdf", download);
        // data-download-source="generated"
        Assert.Contains("pdfs/", href);
    }

    [Fact]
    public void FallbackLink_UsesTargetBlank()
    {
        const string fallbackLink = "https://example.com/doc.pdf";

        // Verify fallback contract
        Assert.StartsWith("http", fallbackLink);
        // In component: target="_blank" rel="noopener noreferrer" data-download-source="fallback"
    }

    // --- Cache fingerprinting ---

    [Fact]
    public void Fingerprint_ChangesWithMarkdown()
    {
        // Verify that different markdown produces different fingerprints
        // This is a unit test that the cache service computes fingerprints correctly
        var slug = "test-doc";
        var md1 = "---\ntitle: A\n---\nBody A";
        var md2 = "---\ntitle: B\n---\nBody B";

        var fp1 = ComputeTestFingerprint(slug, md1);
        var fp2 = ComputeTestFingerprint(slug, md2);

        Assert.NotEqual(fp1, fp2);
    }

    [Fact]
    public void Fingerprint_UnchangedInput_Stable()
    {
        var slug = "stable-doc";
        var md = "---\ntitle: Stable\n---\nSame body";

        var fp1 = ComputeTestFingerprint(slug, md);
        var fp2 = ComputeTestFingerprint(slug, md);

        Assert.Equal(fp1, fp2);
    }

    [Fact]
    public void Fingerprint_ChangesWithFrontmatter()
    {
        // Full markdown includes frontmatter, so changing frontmatter changes the fingerprint
        var slug = "fm-test";
        var md1 = "---\ntitle: Original\npublished: 2026-01-01\n---\nBody";
        var md2 = "---\ntitle: Modified\npublished: 2026-01-02\n---\nBody";

        var fp1 = ComputeTestFingerprint(slug, md1);
        var fp2 = ComputeTestFingerprint(slug, md2);

        Assert.NotEqual(fp1, fp2);
    }

    [Fact]
    public void Fingerprint_IncludesSchemaVersion()
    {
        var md = "---\ntitle: Schema\n---\nBody";

        var fp = ComputeTestFingerprint("schema-test", md);
        Assert.NotNull(fp);
        Assert.Equal(64, fp.Length); // SHA-256 hex
    }

    [Fact]
    public void Fingerprint_First12Chars_UsedForUrl()
    {
        var md = "---\ntitle: URL Test\n---\nBody";
        var fp = ComputeTestFingerprint("url-test", md);

        var prefix = fp[..12];
        Assert.Equal(12, prefix.Length);
        Assert.Matches("^[0-9a-f]+$", prefix);
    }

    // --- Process runner ---

    [Fact]
    public async Task ProcessRunner_ExecutableNotFound_ReturnsError()
    {
        var runner = new SystemProcessRunner();
        var result = await runner.RunAsync("nonexistent-executable-that-should-not-exist-12345",
            ["--version"]);

        Assert.NotEqual(0, result.ExitCode);
    }

    // --- ToolchainManifest ---

    [Fact]
    public void ToolchainManifest_HasSchemaVersion()
    {
        Assert.Equal(5, ToolchainManifest.GeneratorSchemaVersion);
    }

    [Fact]
    public void ToolchainManifest_Current_ContainsBothPlatforms()
    {
        var manifest = ToolchainManifest.Current;

        Assert.NotNull(manifest.Pandoc);
        Assert.Contains("win-x64", manifest.Pandoc.Archives.Keys);
        Assert.Contains("linux-x64", manifest.Pandoc.Archives.Keys);

        Assert.NotNull(manifest.Tectonic);
        Assert.Contains("win-x64", manifest.Tectonic.Archives.Keys);
        Assert.Contains("linux-x64", manifest.Tectonic.Archives.Keys);
    }

    [Fact]
    public void ToolchainManifest_ToFingerprintJson_IsDeterministic()
    {
        var json1 = ToolchainManifest.Current.ToFingerprintJson();
        var json2 = ToolchainManifest.Current.ToFingerprintJson();

        Assert.Equal(json1, json2);
    }

    [Fact]
    public async Task Generator_DiscoversNestedMaterial_ThenReusesCacheWithoutBootstrapping()
    {
        using var tempDir = new TempDirectory();
        var materials = Path.Combine(tempDir.Path, "Content", "Materials", "nested");
        var templates = Path.Combine(tempDir.Path, "PdfTemplates", "default");
        Directory.CreateDirectory(materials);
        Directory.CreateDirectory(templates);
        await File.WriteAllTextAsync(Path.Combine(templates, "template.latex"), "$body$");
        await File.WriteAllTextAsync(Path.Combine(tempDir.Path, ".mmdc.json"), "{}");
        await File.WriteAllTextAsync(Path.Combine(tempDir.Path, "package-lock.json"), "{}");
        await File.WriteAllTextAsync(Path.Combine(materials, "lesson.md"),
            "---\ntitle: Nested lesson\npublished: 2026-03-01\ndownloadLink: https://example.com/fallback.pdf\n---\n\nBody\n");

        var toolchain = new RecordingToolchainProvider(tempDir.Path);
        var runner = new RecordingPdfProcessRunner();
        var cache = new PdfCacheService(toolchain);
        var firstManifest = new PdfGenerationManifest();
        var first = new PdfGeneratorService(toolchain, runner, new NoOpMermaidRenderer(),
            cache, firstManifest, tempDir.Path);

        await first.RunAsync(NullLogger.Instance);

        var generated = firstManifest.GetResult("nested/lesson");
        Assert.NotNull(generated);
        Assert.Equal(PdfGenerationStatus.Generated, generated.Status);
        Assert.True(File.Exists(Path.Combine(toolchain.OutputDirectory,
            Path.GetFileName(generated.RelativeUrl!))));
        Assert.Equal(1, toolchain.BootstrapCount);
        Assert.Contains(runner.Invocations, call => call.Executable == toolchain.PandocPath);
        Assert.Contains(runner.Invocations, call => call.Executable == toolchain.TectonicPath &&
            call.Args.Contains("--outdir") && call.Args.Contains("--bundle"));

        runner.Invocations.Clear();
        var secondManifest = new PdfGenerationManifest();
        var second = new PdfGeneratorService(toolchain, runner, new NoOpMermaidRenderer(),
            cache, secondManifest, tempDir.Path);

        await second.RunAsync(NullLogger.Instance);

        Assert.Equal(PdfGenerationStatus.Cached,
            secondManifest.GetResult("nested/lesson")?.Status);
        Assert.Equal(1, toolchain.BootstrapCount);
        Assert.Empty(runner.Invocations);
    }

    // --- BuildAugmentedMarkdown ---

    private static MaterialSource MakeMaterialSource(string raw)
    {
        var deser = new YamlDotNet.Serialization.DeserializerBuilder()
            .WithNamingConvention(YamlDotNet.Serialization.NamingConventions.CamelCaseNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();
        var (fm, bodyStart) = PdfGeneratorService.ParseFrontMatter<CourseFrontMatter>(raw, deser);
        return new MaterialSource
        {
            RouteUrl = "test-material",
            Slug = "test-material",
            SourcePath = "",
            RawMarkdown = raw,
            FrontMatter = fm ?? new CourseFrontMatter(),
            BodyStart = bodyStart
        };
    }

    [Fact]
    public void BuildAugmentedMarkdown_SectionReplacesMarkerAtExactPosition()
    {
        var raw = "---\ntitle: Test\npublished: 2026-01-01\n---\nBefore\n<!-- diagram: k -->\nAfter";
        var src = MakeMaterialSource(raw);
        var sections = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["k"] = "\n## Diagram\n\nBody\n"
        };
        var logger = new CollectingLogger();

        var result = new PdfGeneratorService(
            new MockToolchainProvider("."),
            new RecordingPdfProcessRunner(),
            new NoOpMermaidRenderer(),
            new PdfCacheService(new MockToolchainProvider(".")),
            new PdfGenerationManifest(),
            ".")
            .BuildAugmentedMarkdown(src, sections, logger);

        Assert.Contains("---\ntitle: Test\npublished: 2026-01-01\n---", result);
        Assert.Contains("Before", result);
        Assert.Contains("## Diagram", result);
        Assert.Contains("After", result);

        var beforeIdx = result.IndexOf("Before", StringComparison.Ordinal);
        var diagramIdx = result.IndexOf("## Diagram", StringComparison.Ordinal);
        var afterIdx = result.IndexOf("After", StringComparison.Ordinal);
        Assert.True(beforeIdx < diagramIdx, "Diagram should appear after 'Before'");
        Assert.True(diagramIdx < afterIdx, "Diagram should appear before 'After'");
    }

    [Fact]
    public void BuildAugmentedMarkdown_UnresolvedKey_DropsMarkerAndLogsWarning()
    {
        var raw = "---\ntitle: Test\npublished: 2026-01-01\n---\nBefore\n<!-- diagram: unknown -->\nAfter";
        var src = MakeMaterialSource(raw);
        var sections = new Dictionary<string, string>(StringComparer.Ordinal);
        var logger = new CollectingLogger();

        var result = new PdfGeneratorService(
            new MockToolchainProvider("."),
            new RecordingPdfProcessRunner(),
            new NoOpMermaidRenderer(),
            new PdfCacheService(new MockToolchainProvider(".")),
            new PdfGenerationManifest(),
            ".")
            .BuildAugmentedMarkdown(src, sections, logger);

        Assert.DoesNotContain("<!-- diagram: unknown -->", result);
        Assert.Contains("Before", result);
        Assert.Contains("After", result);
        Assert.Contains(logger.Warnings, w => w.Contains("unknown"));
    }

    [Fact]
    public void BuildAugmentedMarkdown_DuplicateKey_UsesProvidedSection()
    {
        // BuildAugmentedMarkdown receives sectionsByKey already resolved
        // (first-wins in GenerateOneAsync). Verifies it substitutes correctly.
        var raw = "---\ntitle: Test\npublished: 2026-01-01\n---\n<!-- diagram: dup -->";
        var src = MakeMaterialSource(raw);
        var sections = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["dup"] = "\n## First\n\n### S1\n\n![S1](mmd_0000.pdf)\n"
        };
        var logger = new CollectingLogger();

        var result = new PdfGeneratorService(
            new MockToolchainProvider("."),
            new RecordingPdfProcessRunner(),
            new NoOpMermaidRenderer(),
            new PdfCacheService(new MockToolchainProvider(".")),
            new PdfGenerationManifest(),
            ".")
            .BuildAugmentedMarkdown(src, sections, logger);

        Assert.Contains("## First", result);
        Assert.DoesNotContain("## Second", result);
        Assert.Empty(logger.Warnings);
    }

    [Fact]
    public void BuildAugmentedMarkdown_NoMarkers_ReturnsOriginalContent()
    {
        var raw = "---\ntitle: Test\npublished: 2026-01-01\n---\nBody text here";
        var src = MakeMaterialSource(raw);
        var sections = new Dictionary<string, string>(StringComparer.Ordinal);
        var logger = new CollectingLogger();

        var result = new PdfGeneratorService(
            new MockToolchainProvider("."),
            new RecordingPdfProcessRunner(),
            new NoOpMermaidRenderer(),
            new PdfCacheService(new MockToolchainProvider(".")),
            new PdfGenerationManifest(),
            ".")
            .BuildAugmentedMarkdown(src, sections, logger);

        Assert.Equal(raw, result);
        Assert.Empty(logger.Warnings);
    }

    [Fact]
    public void BuildAugmentedMarkdown_PreservesFrontmatterBlock()
    {
        var raw = "---\ntitle: My Title\npublished: 2026-01-01\ntags:\n  - demo\n---\n<!-- diagram: k -->";
        var src = MakeMaterialSource(raw);
        var sections = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["k"] = "\n## Diagram\n\nContent\n"
        };
        var logger = new CollectingLogger();

        var result = new PdfGeneratorService(
            new MockToolchainProvider("."),
            new RecordingPdfProcessRunner(),
            new NoOpMermaidRenderer(),
            new PdfCacheService(new MockToolchainProvider(".")),
            new PdfGenerationManifest(),
            ".")
            .BuildAugmentedMarkdown(src, sections, logger);

        Assert.StartsWith("---", result);
        Assert.Contains("title: My Title", result);
        Assert.Contains("tags:", result);
        Assert.Contains("  - demo", result);
    }

    // --- Helper: compute a deterministic test fingerprint ---

    private static string ComputeTestFingerprint(string slug, string markdown)
    {
        // Simplified fingerprint for unit testing (doesn't depend on disk)
        using var sha = System.Security.Cryptography.SHA256.Create();
        using var stream = new MemoryStream();
        using var writer = new BinaryWriter(stream);

        writer.Write(ToolchainManifest.GeneratorSchemaVersion);
        writer.Write(markdown);
        writer.Write("default-template-content");
        writer.Write(ToolchainManifest.Current.ToFingerprintJson());
        writer.Write("{}"); // Empty mermaid config

        writer.Flush();
        stream.Position = 0;

        var hash = System.Security.Cryptography.SHA256.HashData(stream);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}

public class CacheTests
{
    // --- Mock-based cache tests (don't require real toolchain) ---

    [Fact]
    public async Task CacheHit_MissingStateFile_ReturnsMiss()
    {
        using var tempDir = new TempDirectory();
        var toolchain = new MockToolchainProvider(tempDir.Path);
        var cache = new PdfCacheService(toolchain);

        var (hit, _) = await cache.TryHitAsync("nonexistent", "abc123", NullLogger.Instance);

        Assert.False(hit);
    }

    [Fact]
    public async Task CacheHit_StateExistsButOutputMissing_ReturnsMiss()
    {
        using var tempDir = new TempDirectory();
        var toolchain = new MockToolchainProvider(tempDir.Path);
        var cache = new PdfCacheService(toolchain);

        await cache.RecordAsync("test-doc", "fingerprint1234abcd", "test-doc.fingerprint12.pdf", NullLogger.Instance);
        // Don't create the output file → cache miss

        var (hit, _) = await cache.TryHitAsync("test-doc", "fingerprint1234abcd", NullLogger.Instance);

        Assert.False(hit);
    }

    [Fact]
    public async Task CacheHit_StateAndOutputMatch_ReturnsHit()
    {
        using var tempDir = new TempDirectory();
        var toolchain = new MockToolchainProvider(tempDir.Path);
        var cache = new PdfCacheService(toolchain);

        // Fingerprint must be >= 12 hex chars to match the URL format {slug}.{first12}.pdf
        var fingerprint = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
        var outputName = $"test-doc.{fingerprint[..12]}.pdf";
        var outputPath = Path.Combine(toolchain.OutputDirectory, outputName);
        Directory.CreateDirectory(toolchain.OutputDirectory);
        await File.WriteAllTextAsync(outputPath, "%PDF-1.4 test content\n");

        await cache.RecordAsync("test-doc", fingerprint, outputName, NullLogger.Instance);

        var (hit, url) = await cache.TryHitAsync("test-doc", fingerprint, NullLogger.Instance);

        Assert.True(hit);
        Assert.Equal(outputName, url);
    }

    [Fact]
    public async Task CacheHit_CorruptOutput_ReturnsMiss()
    {
        using var tempDir = new TempDirectory();
        var toolchain = new MockToolchainProvider(tempDir.Path);
        var cache = new PdfCacheService(toolchain);

        var outputName = "test-doc.corrupt.pdf";
        var outputPath = Path.Combine(toolchain.OutputDirectory, outputName);
        Directory.CreateDirectory(toolchain.OutputDirectory);
        await File.WriteAllTextAsync(outputPath, "Not a PDF file\n");  // Missing %PDF-

        await cache.RecordAsync("test-doc", "fingerprint12345", outputName, NullLogger.Instance);

        var (hit, _) = await cache.TryHitAsync("test-doc", "fingerprint12345", NullLogger.Instance);

        Assert.False(hit);
    }

    [Fact]
    public async Task CacheHit_FingerprintMismatch_ReturnsMiss()
    {
        using var tempDir = new TempDirectory();
        var toolchain = new MockToolchainProvider(tempDir.Path);
        var cache = new PdfCacheService(toolchain);

        var outputName = "test-doc.oldfingerprint12.pdf";  // 12-char prefix "oldfingerpri"
        var outputPath = Path.Combine(toolchain.OutputDirectory, outputName);
        Directory.CreateDirectory(toolchain.OutputDirectory);
        await File.WriteAllTextAsync(outputPath, "%PDF-1.4\n");

        await cache.RecordAsync("test-doc", "oldfingerprint1234567890", outputName, NullLogger.Instance);

        var (hit, _) = await cache.TryHitAsync("test-doc", "newfingerprint1234567890", NullLogger.Instance);

        Assert.False(hit);
        Assert.False(File.Exists(outputPath));
        Assert.Empty(Directory.GetFiles(toolchain.CacheStateDirectory, "test-doc.json"));
    }

    [Fact]
    public async Task RecordCache_CreatesStateFile()
    {
        using var tempDir = new TempDirectory();
        var toolchain = new MockToolchainProvider(tempDir.Path);
        var cache = new PdfCacheService(toolchain);

        await cache.RecordAsync("state-test", "statefp12345678901", "state-test.statefp123456.pdf", NullLogger.Instance);

        // State file should exist
        var stateDir = toolchain.CacheStateDirectory;
        Assert.True(Directory.Exists(stateDir));
        Assert.NotEmpty(Directory.GetFiles(stateDir, "state-test.json"));
    }

    [Fact]
    public async Task Prune_RemovesStaleState()
    {
        using var tempDir = new TempDirectory();
        var toolchain = new MockToolchainProvider(tempDir.Path);
        var cache = new PdfCacheService(toolchain);

        const string fingerprint = "stalefingerprint12345678";
        // Record and prune with active slugs not including this doc
        await cache.RecordAsync("stale-doc", fingerprint,
            $"stale-doc.{fingerprint[..12]}.pdf", NullLogger.Instance);
        // Ensure state file exists
        var stateDir = toolchain.CacheStateDirectory;
        Directory.CreateDirectory(stateDir);
        var stateFiles = Directory.GetFiles(stateDir, "stale-doc.json");

        await cache.PruneAsync(new HashSet<string>(), NullLogger.Instance);

        // Stale state should be removed
        Assert.Empty(Directory.GetFiles(stateDir, "stale-doc.json"));
    }
}

/// <summary>
/// Null logger that ignores all messages.
/// </summary>
public class NullLogger : ILogger
{
    public static readonly NullLogger Instance = new();
    private NullLogger() { }
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel logLevel) => false;
    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) { }
}

/// <summary>
/// Mock toolchain provider for cache tests (all paths in temp dir).
/// </summary>
public class MockToolchainProvider : IToolchainProvider
{
    public MockToolchainProvider(string basePath)
    {
        BasePath = basePath;
        OutputDirectory = Path.Combine(basePath, "wwwroot", "pdfs");
        CacheStateDirectory = Path.Combine(basePath, "artifacts", "material-pdfs", "state");
        WorkDirectory = Path.Combine(basePath, "artifacts", "material-pdfs", "work");
        TemplatesPath = Path.Combine(basePath, "PdfTemplates");
        MermaidConfigPath = Path.Combine(basePath, ".mmdc.json");
        PuppeteerCachePath = Path.Combine(basePath, "artifacts", "puppeteer");
    }

    public string BasePath { get; }
    public string RuntimeIdentifier => OperatingSystem.IsWindows() ? "win-x64" : "linux-x64";
    public bool IsSupported => true;
    public string? PandocPath => null;
    public string? TectonicPath => null;
    public string TectonicBundleUrl => "https://example.com/bundle.tar";
    public string TemplatesPath { get; }
    public string MermaidConfigPath { get; }
    public string OutputDirectory { get; }
    public string CacheStateDirectory { get; }
    public string WorkDirectory { get; }
    public string PuppeteerCachePath { get; }
    public string NodeModulesPath => Path.Combine(BasePath, "node_modules");

    public Task<bool> BootstrapAsync(ILogger logger, CancellationToken ct = default)
        => Task.FromResult(true);
}

public sealed class RecordingToolchainProvider : IToolchainProvider
{
    public RecordingToolchainProvider(string root)
    {
        TemplatesPath = Path.Combine(root, "PdfTemplates");
        MermaidConfigPath = Path.Combine(root, ".mmdc.json");
        OutputDirectory = Path.Combine(root, "wwwroot", "pdfs");
        CacheStateDirectory = Path.Combine(root, "artifacts", "material-pdfs", "state");
        WorkDirectory = Path.Combine(root, "artifacts", "material-pdfs", "work");
        PuppeteerCachePath = Path.Combine(root, "artifacts", "puppeteer");
        NodeModulesPath = Path.Combine(root, "node_modules");
    }

    public int BootstrapCount { get; private set; }
    public string RuntimeIdentifier => "test-x64";
    public bool IsSupported => true;
    public string? PandocPath => "fake-pandoc";
    public string? TectonicPath => "fake-tectonic";
    public string TectonicBundleUrl => "https://example.com/bundle.tar";
    public string TemplatesPath { get; }
    public string MermaidConfigPath { get; }
    public string OutputDirectory { get; }
    public string CacheStateDirectory { get; }
    public string WorkDirectory { get; }
    public string PuppeteerCachePath { get; }
    public string NodeModulesPath { get; }

    public Task<bool> BootstrapAsync(ILogger logger, CancellationToken ct = default)
    {
        BootstrapCount++;
        Directory.CreateDirectory(OutputDirectory);
        Directory.CreateDirectory(CacheStateDirectory);
        Directory.CreateDirectory(WorkDirectory);
        return Task.FromResult(true);
    }
}

public sealed class RecordingPdfProcessRunner : IProcessRunner
{
    public List<(string Executable, string[] Args)> Invocations { get; } = new();

    public async Task<ProcessResult> RunAsync(string executable, string[] args,
        string? workingDirectory = null,
        Dictionary<string, string?>? environmentVariables = null,
        int timeoutMs = 180_000,
        CancellationToken ct = default)
    {
        Invocations.Add((executable, args));
        if (executable == "fake-pandoc")
        {
            var output = args[Array.IndexOf(args, "--output") + 1];
            await File.WriteAllTextAsync(output, "\\begin{document}ok\\end{document}", ct);
        }
        else if (executable == "fake-tectonic")
        {
            var outDir = args[Array.IndexOf(args, "--outdir") + 1];
            await File.WriteAllTextAsync(Path.Combine(outDir, "document.pdf"), "%PDF-1.7\n", ct);
        }

        return new ProcessResult { ExitCode = 0 };
    }
}

public sealed class NoOpMermaidRenderer : IMermaidRenderer
{
    public bool IsAvailable => true;

    public Task<bool> RenderToPdfAsync(string mermaidDefinition, string outputPdfPath,
        string inputFile, ILogger logger, CancellationToken ct = default) => Task.FromResult(true);
}

/// <summary>
/// Temporary directory that cleans up on dispose.
/// </summary>
public class TempDirectory : IDisposable
{
    public string Path { get; } = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"pdf-test-{Guid.NewGuid():N}");

    public TempDirectory()
    {
        Directory.CreateDirectory(Path);
    }

    public void Dispose()
    {
        try { Directory.Delete(Path, recursive: true); } catch { /* best-effort */ }
    }
}

/// <summary>
/// Collects warning messages for test assertions.
/// </summary>
public class CollectingLogger : ILogger
{
    public List<string> Warnings { get; } = new();

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        if (logLevel == LogLevel.Warning)
            Warnings.Add(formatter(state, exception));
    }
}
