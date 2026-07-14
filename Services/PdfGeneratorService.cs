using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using BlazorStaticMinimalBlog.Models;
using Microsoft.Extensions.Logging;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace BlazorStaticMinimalBlog.Services;

/// <summary>
/// Internal source record: derived directly from Content/Materials/*.md.
/// Does NOT depend on BlazorStaticContentService.Posts.
/// </summary>
internal class MaterialSource
{
    public string RouteUrl { get; init; } = "";       // "cmsc-131-lab0"
    public string Slug { get; init; } = "";            // "cmsc-131-lab0"
    public string SourcePath { get; init; } = "";      // full path
    public string RawMarkdown { get; init; } = "";
    public CourseFrontMatter FrontMatter { get; init; } = new();
    public int BodyStart { get; init; }
    public string BodyMarkdown => BodyStart > 0 ? RawMarkdown[BodyStart..] : RawMarkdown;
    public List<string> MediaPaths { get; init; } = new();
}

public class PdfGeneratorService
{
    private readonly IToolchainProvider _toolchain;
    private readonly IProcessRunner _processRunner;
    private readonly IMermaidRenderer _mermaid;
    private readonly IPdfCacheService _cache;
    private readonly PdfGenerationManifest _manifest;
    private readonly string _contentRoot;

    private static readonly Regex ValidTemplate = new(@"^[a-z0-9][a-z0-9_-]*$", RegexOptions.Compiled);
    private static readonly Regex ImgSrc = new(@"<img[^>]+src=""([^""]+)""", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex MarkdownImage = new(@"!\[[^\]]*\]\((?:<)?([^\s)>]+)", RegexOptions.Compiled);
    private static readonly Regex FrontMatterBlock = new(
        @"\A(?:\uFEFF)?---\r?\n(?<yaml>.*?)\r?\n---\r?\n",
        RegexOptions.Singleline | RegexOptions.Compiled);

    public PdfGeneratorService(
        IToolchainProvider toolchain,
        IProcessRunner processRunner,
        IMermaidRenderer mermaid,
        IPdfCacheService cache,
        PdfGenerationManifest manifest,
        string contentRoot)
    {
        _toolchain = toolchain;
        _processRunner = processRunner;
        _mermaid = mermaid;
        _cache = cache;
        _manifest = manifest;
        _contentRoot = contentRoot;
    }

    public async Task RunAsync(ILogger logger, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        var sources = DiscoverSources(logger);
        var activeSlugs = new HashSet<string>(sources.Select(s => s.Slug), StringComparer.OrdinalIgnoreCase);

        if (sources.Count == 0)
        {
            logger.LogInformation("No material files found. Skipping PDF generation.");
            await _cache.PruneAsync(activeSlugs, logger, ct);
            return;
        }

        logger.LogInformation("Discovered {Count} material files", sources.Count);

        // Pre-populate manifest with fallback defaults before any generation
        foreach (var src in sources)
            _manifest.SetResult(src.RouteUrl, new PdfGenerationResult
            {
                Status = PdfGenerationStatus.Failed,
                Diagnostic = "Pending generation"
            });

        try
        {
            // Compute fingerprints independently so one malformed template or asset
            // cannot prevent other materials from generating.
            var fpBySlug = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var src in sources)
            {
                try
                {
                    fpBySlug[src.Slug] = await ComputeFingerprintAsync(src, ct);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Cannot fingerprint {Url}", src.RouteUrl);
                    await _cache.InvalidateAsync(src.Slug, logger, ct);
                    UpdateFallbackResult(src);
                }
            }

            // Check cache hits (no toolchain needed)
            var needsGeneration = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var src in sources)
            {
                if (!fpBySlug.TryGetValue(src.Slug, out var fp))
                    continue;

                try
                {
                    var (hit, cachedUrl) = await _cache.TryHitAsync(src.Slug, fp, logger);
                    if (hit && cachedUrl is not null)
                    {
                        var url = $"generated-pdfs/{cachedUrl}";
                        _manifest.SetResult(src.RouteUrl, new PdfGenerationResult
                        {
                            Status = PdfGenerationStatus.Cached,
                            RelativeUrl = url
                        });
                        logger.LogDebug("Cache HIT {Url}", src.RouteUrl);
                    }
                    else
                    {
                        needsGeneration.Add(src.Slug);
                    }
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Cannot read PDF cache for {Url}", src.RouteUrl);
                    await _cache.InvalidateAsync(src.Slug, logger, ct);
                    needsGeneration.Add(src.Slug);
                }
            }

            // Bootstrap toolchain only if needed
            bool toolchainOk = false;
            if (needsGeneration.Count > 0)
                toolchainOk = await _toolchain.BootstrapAsync(logger, ct);
            else
                logger.LogInformation("All documents cached, skipping toolchain bootstrap");

            // Generate misses
            foreach (var src in sources)
            {
                if (ct.IsCancellationRequested) break;
                if (!needsGeneration.Contains(src.Slug)) continue;

                if (!toolchainOk)
                {
                    UpdateFallbackResult(src);
                    continue;
                }

                await GenerateOneAsync(src, fpBySlug[src.Slug], logger, ct);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Unexpected PDF generation error");
        }
        finally
        {
            foreach (var src in sources)
            {
                var result = _manifest.GetResult(src.RouteUrl);
                if (result?.Diagnostic == "Pending generation")
                    UpdateFallbackResult(src);
            }

            await _cache.PruneAsync(activeSlugs, logger, ct);
            sw.Stop();
            LogSummary(logger, sources.Count, sw.Elapsed);
        }
    }

    private async Task GenerateOneAsync(MaterialSource src, string fingerprint,
        ILogger logger, CancellationToken ct)
    {
        var slug = src.Slug;
        var fm = src.FrontMatter;

        // Validate template
        var tmplName = fm.Pdf?.Template ?? "default";
        var tmplDir = Path.Combine(_toolchain.TemplatesPath, tmplName);

        if (!ValidTemplate.IsMatch(tmplName) || tmplName.Contains(".."))
        {
            logger.LogWarning("Invalid template '{T}' for {Url}", tmplName, src.RouteUrl);
            UpdateFallbackResult(src);
            return;
        }

        var tmplFile = Path.Combine(tmplDir, "template.latex");
        if (!Directory.Exists(tmplDir) || !File.Exists(tmplFile))
        {
            logger.LogWarning("Template not found: {Dir}", tmplDir);
            UpdateFallbackResult(src);
            return;
        }

        // Isolated work directory
        var workDir = Path.Combine(_toolchain.WorkDirectory, slug, fingerprint[..12]);
        try { Directory.CreateDirectory(workDir); } catch { }

        try
        {
            var diagramPdfs = new List<(int stepIdx, string pdfPath)>();

            // Render Mermaid diagrams
            if (fm.Diagrams.Count > 0)
            {
                int stepIdx = 0;
                foreach (var diagram in fm.Diagrams)
                {
                    foreach (var step in diagram.Steps)
                    {
                        if (string.IsNullOrWhiteSpace(step.Mermaid))
                        {
                            logger.LogWarning("Empty Mermaid step '{T}' in {Url} — failing doc",
                                step.Title, src.RouteUrl);
                            goto diagramFailed;
                        }

                        var inputFile = Path.Combine(workDir, $"mmd_{stepIdx:D4}.mmd");
                        var outputPdf = Path.Combine(workDir, $"mmd_{stepIdx:D4}.pdf");

                        var ok = await _mermaid.RenderToPdfAsync(step.Mermaid, outputPdf,
                            inputFile, logger, ct);
                        if (!ok)
                        {
                            logger.LogWarning("Mermaid step {I} '{T}' failed in {Url}",
                                stepIdx, step.Title, src.RouteUrl);
                            goto diagramFailed;
                        }

                        diagramPdfs.Add((stepIdx, outputPdf));
                        stepIdx++;
                    }
                }
            }

            // Build augmented Markdown
            var augmentedMd = BuildAugmentedMarkdown(src, diagramPdfs);
            var mdPath = Path.Combine(workDir, "document.md");
            await File.WriteAllTextAsync(mdPath, augmentedMd, ct);

            // Pandoc: Markdown → LaTeX
            var texPath = Path.Combine(workDir, "document.tex");
            var pandocOk = await RunPandocAsync(mdPath, texPath, src, tmplDir, tmplName, logger, ct);
            if (!pandocOk)
            {
                UpdateFallbackResult(src);
                return;
            }

            // Tectonic: LaTeX → PDF
            var tectonicOk = await RunTectonicAsync(texPath, workDir, logger, ct);
            if (!tectonicOk)
            {
                UpdateFallbackResult(src);
                return;
            }

            // Tectonic produces {workDir}/{same-basename}.pdf = workDir/document.pdf
            var tectonicOutput = Path.Combine(workDir, "document.pdf");
            if (!File.Exists(tectonicOutput))
            {
                logger.LogWarning("Tectonic produced no PDF for {Url}", src.RouteUrl);
                UpdateFallbackResult(src);
                return;
            }

            // Validate %PDF-
            var head = await ReadHeadAsync(tectonicOutput, 5);
            if (string.IsNullOrEmpty(head) || !head.StartsWith("%PDF-"))
            {
                logger.LogWarning("Output not valid PDF for {Url}", src.RouteUrl);
                UpdateFallbackResult(src);
                return;
            }

            // Atomic rename to content-addressed final path
            var pdfName = $"{slug}.{fingerprint[..12]}.pdf";
            var finalPath = Path.Combine(_toolchain.OutputDirectory, pdfName);
            Directory.CreateDirectory(_toolchain.OutputDirectory);

            var tmpFinal = finalPath + $".{Guid.NewGuid():N}.tmp";
            if (File.Exists(tmpFinal)) File.Delete(tmpFinal);
            File.Move(tectonicOutput, tmpFinal);
            File.Move(tmpFinal, finalPath, overwrite: true);

            // Record cache
            var genUrl = $"generated-pdfs/{pdfName}";
            await _cache.RecordAsync(slug, fingerprint, pdfName, logger);

            _manifest.SetResult(src.RouteUrl, new PdfGenerationResult
            {
                Status = PdfGenerationStatus.Generated,
                RelativeUrl = genUrl
            });

            logger.LogInformation("Generated PDF for {Url}: {Name}", src.RouteUrl, pdfName);

            // Clean up work dir
            try { Directory.Delete(workDir, recursive: true); } catch { }

            return;

        diagramFailed:
            UpdateFallbackResult(src);
            return;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Generation failed for {Url}", src.RouteUrl);
            UpdateFallbackResult(src);
        }
        finally
        {
            // Keep work dir for failure diagnostics
        }
    }

    private async Task<bool> RunPandocAsync(string mdPath, string texPath, MaterialSource src,
        string tmplDir, string tmplName, ILogger logger, CancellationToken ct)
    {
        var pandoc = _toolchain.PandocPath;
        if (pandoc is null) return false;

        var tmplFile = Path.Combine(tmplDir, "template.latex");

        var luaFilter = Path.Combine(tmplDir, "code-block.lua");

        var args = new List<string>
        {
            "--from", "markdown",
            "--to", "latex",
            "--template", tmplFile,
            "--lua-filter", luaFilter,
            "--output", texPath,
            "--standalone"
        };

        void AddMeta(string key, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
                args.Add($"-M{key}={value}");
        }

        AddMeta("title", src.FrontMatter.Title);
        AddMeta("subtitle", src.FrontMatter.Subtitle);
        AddMeta("published", src.FrontMatter.Published != default ? src.FrontMatter.Published.ToString("yyyy-MM-dd") : null);
        AddMeta("publishedFormatted", src.FrontMatter.Published != default
            ? src.FrontMatter.Published.ToString("MMMM dd, yyyy", System.Globalization.CultureInfo.InvariantCulture)
            : null);
        AddMeta("deadline", src.FrontMatter.Deadline?.ToString("yyyy-MM-dd"));
        AddMeta("deadlineFormatted", src.FrontMatter.Deadline?.ToString("MMMM dd, yyyy", System.Globalization.CultureInfo.InvariantCulture));
        if (src.FrontMatter.NoDeadline)
            args.Add("-Mno-deadline=true");

        // First tag, normalized (uppercase, hyphens → spaces) for footer
        if (src.FrontMatter.Tags.Count > 0)
            AddMeta("firstTag", string.Join(" ", src.FrontMatter.Tags[0]
                .Split('-').Select(s => s.ToUpperInvariant())));

        foreach (var a in src.FrontMatter.Authors)
        {
            var name = a.Name ?? a.Nickname ?? "";
            if (!string.IsNullOrEmpty(name))
                args.Add($"-Mauthor={name}");
        }
        foreach (var t in src.FrontMatter.Tags)
            args.Add($"-Mtags={t}");

        // Pass PdfConfig variables as nested metadata (pdf.variables.*)
        if (src.FrontMatter.Pdf?.Variables is { } pdfVars)
        {
            foreach (var (key, value) in pdfVars)
            {
                if (value is null) continue;
                var v = value is string s ? s : value.ToString();
                if (!string.IsNullOrWhiteSpace(v))
                    args.Add($"-Mpdf.variables.{key}={v}");
            }
        }

        // Resource path: source directory, media directories, work dir
        var srcDir = Path.GetDirectoryName(src.SourcePath) ?? ".";
        args.Add("--resource-path");
        args.Add(string.Join(Path.PathSeparator.ToString(),
            new[] { Path.GetDirectoryName(mdPath), srcDir }
                .Concat(src.MediaPaths.Select(Path.GetDirectoryName))
                .OfType<string>()
                .Distinct(StringComparer.OrdinalIgnoreCase)));

        args.Add(mdPath);

        var argsArray = args.ToArray();
        logger.LogDebug("Pandoc args ({Count}): {Args}",
            argsArray.Length, string.Join(" | ", argsArray.Take(20)));

        var result = await _processRunner.RunAsync(pandoc, argsArray,
            workingDirectory: _toolchain.WorkDirectory, timeoutMs: 180_000, ct: ct);

        if (result.TimedOut)
        {
            logger.LogWarning("Pandoc timed out for {Url}", src.RouteUrl);
            return false;
        }
        if (result.ExitCode != 0)
        {
            logger.LogWarning("Pandoc exit {Code} for {Url}: out='{StdOut}' err='{StdErr}'",
                result.ExitCode, src.RouteUrl,
                Truncate(result.StdOut, 500),
                Truncate(result.StdErr, 500));
            return false;
        }
        if (!File.Exists(texPath))
        {
            logger.LogWarning("Pandoc produced no .tex for {Url}", src.RouteUrl);
            return false;
        }
        return true;
    }

    private async Task<bool> RunTectonicAsync(string texPath, string workDir,
        ILogger logger, CancellationToken ct)
    {
        var tectonic = _toolchain.TectonicPath;
        if (tectonic is null) return false;

        var cacheDir = Path.Combine(
            Path.GetDirectoryName(_toolchain.PuppeteerCachePath) ?? "artifacts",
            "tectonic-cache");
        Directory.CreateDirectory(cacheDir);

        var env = new Dictionary<string, string?>
        {
            ["TECTONIC_CACHE_DIR"] = Path.GetFullPath(cacheDir)
        };

        var args = new List<string>
        {
            "-X", "compile",
            "--untrusted",
            "--bundle", _toolchain.TectonicBundleUrl,
            "--outdir", workDir,
            texPath
        };

        var result = await _processRunner.RunAsync(tectonic, args.ToArray(),
            workingDirectory: workDir, environmentVariables: env,
            timeoutMs: 180_000, ct: ct);

        if (result.TimedOut)
        {
            logger.LogWarning("Tectonic timed out for {Tex}", texPath);
            return false;
        }
        if (result.ExitCode != 0)
        {
            logger.LogWarning("Tectonic exit {Code}: {Err}",
                result.ExitCode, Truncate(result.StdErr, 300));
            return false;
        }
        return true;
    }

    private string BuildAugmentedMarkdown(MaterialSource src, List<(int idx, string path)> diagramPdfs)
    {
        var body = src.BodyMarkdown;
        if (diagramPdfs.Count == 0) return src.RawMarkdown;

        var sb = new StringBuilder();
        // Keep frontmatter intact
        sb.Append(src.RawMarkdown[..src.BodyStart]);

        // Insert diagram sections
        int stepIdx = 0;
        foreach (var diagram in src.FrontMatter.Diagrams)
        {
            sb.AppendLine();
            sb.AppendLine($"## {diagram.Title}");
            if (!string.IsNullOrWhiteSpace(diagram.Description))
            {
                sb.AppendLine();
                sb.AppendLine(diagram.Description);
            }
            sb.AppendLine();

            foreach (var step in diagram.Steps)
            {
                sb.AppendLine($"### {step.Title}");
                if (!string.IsNullOrWhiteSpace(step.Description))
                {
                    sb.AppendLine();
                    sb.AppendLine(step.Description);
                    sb.AppendLine();
                }

                // Insert relative path for diagram PDF
                if (stepIdx < diagramPdfs.Count)
                {
                    // Use forward-slash relative path
                    var rel = Path.GetFileName(diagramPdfs[stepIdx].path).Replace('\\', '/');
                    sb.AppendLine($"![{step.Title}]({rel})");
                    sb.AppendLine();
                }
                stepIdx++;
            }
        }

        sb.Append(body);
        return sb.ToString();
    }

    private void UpdateFallbackResult(MaterialSource src)
    {
        var hasFallback = !string.IsNullOrWhiteSpace(src.FrontMatter.DownloadLink);
        _manifest.SetResult(src.RouteUrl, new PdfGenerationResult
        {
            Status = PdfGenerationStatus.Failed,
            RelativeUrl = null,
            Diagnostic = hasFallback ? "Fallback available after generation failure" : "No download available after generation failure"
        });
    }

    private List<string> ResolveMediaPaths(string sourceFile, string body)
    {
        var references = ImgSrc.Matches(body).Select(match => match.Groups[1].Value)
            .Concat(MarkdownImage.Matches(body).Select(match => match.Groups[1].Value));
        var media = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var sourceDirectory = Path.GetDirectoryName(sourceFile)!;

        foreach (var reference in references)
        {
            var decoded = Uri.UnescapeDataString(reference.Split('#', '?')[0]);
            if (string.IsNullOrWhiteSpace(decoded) ||
                Uri.TryCreate(decoded, UriKind.Absolute, out _))
                continue;

            var candidates = decoded.StartsWith('/')
                ? new[] { Path.Combine(_contentRoot, "wwwroot", decoded.TrimStart('/')) }
                : new[]
                {
                    Path.Combine(sourceDirectory, decoded),
                    Path.Combine(_contentRoot, "wwwroot", decoded)
                };

            foreach (var candidate in candidates)
            {
                var fullPath = Path.GetFullPath(candidate);
                if (File.Exists(fullPath))
                {
                    media.Add(fullPath);
                    break;
                }
            }
        }

        return media.OrderBy(path => path, StringComparer.Ordinal).ToList();
    }

    private List<MaterialSource> DiscoverSources(ILogger logger)
    {
        var sources = new List<MaterialSource>();
        var dir = Path.Combine(_contentRoot, "Content", "Materials");
        if (!Directory.Exists(dir))
        {
            logger.LogWarning("Materials directory not found: {Dir}", dir);
            return sources;
        }

        var deser = new DeserializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();

        foreach (var file in Directory.EnumerateFiles(dir, "*.md", SearchOption.AllDirectories)
                     .OrderBy(path => path, StringComparer.Ordinal))
        {
            try
            {
                var raw = File.ReadAllText(file);

                // Parse frontmatter
                var (fm, bodyStart) = ParseFrontMatter<CourseFrontMatter>(raw, deser);
                if (fm is null)
                {
                    logger.LogWarning("Cannot parse frontmatter from {File}", file);
                    continue;
                }

                if (fm.IsDraft)
                {
                    logger.LogDebug("Skipping draft: {File}", file);
                    continue;
                }

                var relativePath = Path.GetRelativePath(dir, file);
                var routeUrl = Path.ChangeExtension(relativePath, null)!
                    .Replace('\\', '/');
                var slug = Normalize(routeUrl);

                var body = bodyStart > 0 ? raw[bodyStart..] : raw;
                var media = ResolveMediaPaths(file, body);

                sources.Add(new MaterialSource
                {
                    RouteUrl = routeUrl,
                    Slug = slug,
                    SourcePath = file,
                    RawMarkdown = raw,
                    FrontMatter = fm,
                    BodyStart = bodyStart,
                    MediaPaths = media
                });
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to parse {File}", file);
            }
        }

        logger.LogInformation("Discovered {Count} non-draft materials", sources.Count);
        return sources;
    }

    private async Task<string> ComputeFingerprintAsync(MaterialSource src, CancellationToken ct)
    {
        using var sha = System.Security.Cryptography.SHA256.Create();

        // Hash inputs as sorted, length-framed tuples
        void HashBytes(byte[] data)
        {
            var len = BitConverter.GetBytes(data.Length);
            sha.TransformBlock(len, 0, 4, len, 0);
            sha.TransformBlock(data, 0, data.Length, data, 0);
        }

        void HashString(string s) => HashBytes(Encoding.UTF8.GetBytes(s));

        void HashEntry(string logicalPath, byte[] data)
        {
            HashString(logicalPath.Replace('\\', '/'));
            HashBytes(data);
        }

        HashEntry("generator-schema", Encoding.UTF8.GetBytes(
            ToolchainManifest.GeneratorSchemaVersion.ToString()));
        HashEntry($"source/{src.RouteUrl}.md", Encoding.UTF8.GetBytes(src.RawMarkdown));

        // Template + partials
        var tmplName = src.FrontMatter.Pdf?.Template ?? "default";
        if (!ValidTemplate.IsMatch(tmplName))
            throw new InvalidOperationException($"Invalid PDF template name '{tmplName}'.");

        var baseDir = Path.Combine(_toolchain.TemplatesPath, tmplName);
        if (!Directory.Exists(baseDir) ||
            !File.Exists(Path.Combine(baseDir, "template.latex")))
            throw new DirectoryNotFoundException($"PDF template '{tmplName}' was not found.");

        foreach (var f in Directory.EnumerateFiles(baseDir, "*", SearchOption.AllDirectories)
                     .OrderBy(f => f, StringComparer.Ordinal))
        {
            var rel = Path.GetRelativePath(baseDir, f);
            HashEntry($"template/{tmplName}/{rel}", await File.ReadAllBytesAsync(f, ct));
        }

        // Toolchain manifest
        HashEntry("toolchain-manifest", Encoding.UTF8.GetBytes(
            ToolchainManifest.Current.ToFingerprintJson()));

        // package-lock.json
        var lockPath = Path.Combine(_contentRoot, "package-lock.json");
        if (File.Exists(lockPath))
            HashEntry("package-lock.json", await File.ReadAllBytesAsync(lockPath, ct));

        // Mermaid config
        var mmdcPath = _toolchain.MermaidConfigPath;
        if (File.Exists(mmdcPath))
            HashEntry(".mmdc.json", await File.ReadAllBytesAsync(mmdcPath, ct));

        // Media paths (sorted)
        foreach (var m in src.MediaPaths.OrderBy(x => x))
            HashEntry($"media/{Path.GetRelativePath(_contentRoot, m)}",
                await File.ReadAllBytesAsync(m, ct));

        // Shared assets
        var sharedDir = Path.Combine(_toolchain.TemplatesPath, "_shared");
        if (Directory.Exists(sharedDir))
        {
            foreach (var f in Directory.EnumerateFiles(sharedDir, "*", SearchOption.AllDirectories)
                         .OrderBy(f => f, StringComparer.Ordinal))
            {
                var rel = Path.GetRelativePath(sharedDir, f);
                HashEntry($"shared/{rel}", await File.ReadAllBytesAsync(f, ct));
            }
        }

        sha.TransformFinalBlock([], 0, 0);
        return Convert.ToHexString(sha.Hash!).ToLowerInvariant();
    }

    private static (T? fm, int bodyStart) ParseFrontMatter<T>(string raw, IDeserializer deser) where T : class
    {
        var match = FrontMatterBlock.Match(raw);
        if (!match.Success)
            return (null, 0);

        try
        {
            var fm = deser.Deserialize<T>(match.Groups["yaml"].Value);
            return (fm, match.Length);
        }
        catch
        {
            return (null, 0);
        }
    }

    private static string Normalize(string s) =>
        s.Replace("/", "-").Replace("\\", "-").Trim('-');

    private static async Task<string?> ReadHeadAsync(string path, int n)
    {
        try
        {
            await using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            var buf = new byte[n];
            var r = await fs.ReadAsync(buf);
            return Encoding.UTF8.GetString(buf, 0, r);
        }
        catch { return null; }
    }

    private static string Truncate(string s, int n) =>
        s.Length <= n ? s : s[..n] + "...";

    private void LogSummary(ILogger logger, int total, TimeSpan elapsed)
    {
        var results = _manifest.AllResults;

        int gen = 0, cached = 0, fallback = 0, unavailable = 0;
        foreach (var r in results.Values)
        {
            if (r.Status == PdfGenerationStatus.Generated) gen++;
            else if (r.Status == PdfGenerationStatus.Cached) cached++;
            else if (r.Status == PdfGenerationStatus.Failed)
            {
                if (r.Diagnostic?.StartsWith("Fallback available", StringComparison.Ordinal) == true) fallback++;
                else unavailable++;
            }
        }

        logger.LogInformation(
            "PDF gen: {T} docs, {G} gen, {C} cached, {F} fallback, {U} unavailable [{E}]",
            total, gen, cached, fallback, unavailable, elapsed);

        if (fallback > 0 || unavailable > 0)
        {
            foreach (var (url, r) in results)
                if (r.Status == PdfGenerationStatus.Failed)
                    logger.LogWarning("  {Url}: {Diag}", url, r.Diagnostic);
        }

        // GitHub step summary
        var stepSum = Environment.GetEnvironmentVariable("GITHUB_STEP_SUMMARY");
        if (stepSum is not null)
        {
            try
            {
                var sb = new StringBuilder();
                sb.AppendLine("## PDF Generation Results");
                sb.AppendLine();
                sb.AppendLine("| Status | Count |");
                sb.AppendLine("|--------|-------|");
                sb.AppendLine($"| ✅ Generated | {gen} |");
                sb.AppendLine($"| 💾 Cached | {cached} |");
                sb.AppendLine($"| ⚠️ Fallback | {fallback} |");
                sb.AppendLine($"| ❌ Unavailable | {unavailable} |");
                sb.AppendLine();
                if (fallback > 0 || unavailable > 0)
                {
                    sb.AppendLine("### Details");
                    sb.AppendLine("| Post | Status |");
                    sb.AppendLine("|------|--------|");
                    foreach (var (url, r) in results)
                    {
                        if (r.Status == PdfGenerationStatus.Failed)
                        {
                            var diag = (r.Diagnostic ?? "unknown").Replace("|", "\\|");
                            sb.AppendLine($"| {url} | {diag} |");
                        }
                    }
                }
                File.AppendAllText(stepSum, sb.ToString());
            }
            catch { }
        }
    }
}
