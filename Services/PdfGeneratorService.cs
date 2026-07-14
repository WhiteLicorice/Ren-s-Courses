using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using BlazorStatic;
using BlazorStatic.Services;
using BlazorStaticMinimalBlog.Models;
using Microsoft.Extensions.Logging;

namespace BlazorStaticMinimalBlog.Services;

/// <summary>
/// Orchestrates the PDF generation pipeline for all non-draft material posts.
/// Runs during startup, before BlazorStatic static generation.
/// </summary>
public class PdfGeneratorService
{
    private readonly BlazorStaticContentService<CourseFrontMatter> _contentService;
    private readonly IToolchainProvider _toolchain;
    private readonly IProcessRunner _processRunner;
    private readonly IMermaidRenderer _mermaidRenderer;
    private readonly IPdfCacheService _cacheService;
    private readonly PdfGenerationManifest _manifest;

    // Template name validation
    private static readonly Regex ValidTemplateName = new(@"^[a-z0-9][a-z0-9_-]*$", RegexOptions.Compiled);

    public PdfGeneratorService(
        BlazorStaticContentService<CourseFrontMatter> contentService,
        IToolchainProvider toolchain,
        IProcessRunner processRunner,
        IMermaidRenderer mermaidRenderer,
        IPdfCacheService cacheService,
        PdfGenerationManifest manifest)
    {
        _contentService = contentService;
        _toolchain = toolchain;
        _processRunner = processRunner;
        _mermaidRenderer = mermaidRenderer;
        _cacheService = cacheService;
        _manifest = manifest;
    }

    /// <summary>
    /// Run the full PDF generation pipeline.
    /// Catches all exceptions — never fails the build.
    /// </summary>
    public async Task RunAsync(ILogger logger, CancellationToken ct = default)
    {
        var stopwatch = Stopwatch.StartNew();
        var posts = _contentService.Posts;

        if (posts.Count == 0)
        {
            logger.LogInformation("No material posts found. Skipping PDF generation.");
            return;
        }

        // Bootstrap toolchain
        var toolchainOk = await _toolchain.BootstrapAsync(logger, ct);

        // Collect active slugs for pruning
        var activeSlugs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var sourcePaths = ResolveSourcePaths(posts);

        if (!toolchainOk)
        {
            logger.LogWarning("Toolchain unavailable. All materials will use fallback download links.");
            foreach (var post in posts)
            {
                if (!post.FrontMatter.IsDraft)
                {
                    var slug = NormalizeSlug(post.Url);
                    activeSlugs.Add(slug);
                    _manifest.SetResult(post.Url, new PdfGenerationResult
                    {
                        Status = PdfGenerationStatus.Failed,
                        Diagnostic = "Toolchain bootstrap failed"
                    });
                }
            }
            return;
        }

        // Ensure output dir exists
        Directory.CreateDirectory(_toolchain.OutputDirectory);

        // Process each non-draft post sequentially
        foreach (var post in posts)
        {
            if (ct.IsCancellationRequested) break;

            if (post.FrontMatter.IsDraft)
            {
                logger.LogDebug("Skipping draft: {Url}", post.Url);
                continue;
            }

            var result = await ProcessPostAsync(post, sourcePaths, logger, ct);
            _manifest.SetResult(post.Url, result);
        }

        // Prune stale cache entries
        await _cacheService.PruneAsync(activeSlugs, logger, ct);

        stopwatch.Stop();
        LogSummary(logger, posts.Count(p => !p.FrontMatter.IsDraft));
    }

    private async Task<PdfGenerationResult> ProcessPostAsync(
        Post<CourseFrontMatter> post,
        Dictionary<string, string> sourcePaths,
        ILogger logger,
        CancellationToken ct)
    {
        var slug = NormalizeSlug(post.Url);

        // Find source markdown path
        var sourceMdPath = ResolveSourcePath(post.Url, sourcePaths);
        if (sourceMdPath is null)
        {
            logger.LogWarning("No source markdown found for {Url}", post.Url);
            return Failure("Source markdown file not found");
        }

        // Read raw markdown content
        string rawMarkdown;
        try
        {
            rawMarkdown = await File.ReadAllTextAsync(sourceMdPath, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to read source markdown for {Url}", post.Url);
            return Failure($"Cannot read source: {ex.Message}");
        }

        // Validate template
        var templateName = post.FrontMatter.Pdf?.Template ?? "default";
        var validationError = ValidateTemplate(templateName);
        if (validationError is not null)
        {
            logger.LogWarning("Invalid template '{Template}' for {Url}: {Error}",
                templateName, post.Url, validationError);
            return Failure($"Invalid template '{templateName}': {validationError}");
        }

        var templateDir = Path.Combine(_toolchain.TemplatesPath, templateName);
        if (!Directory.Exists(templateDir))
        {
            logger.LogWarning("Template directory not found: {Dir}", templateDir);
            return Failure($"Template '{templateName}' directory not found");
        }

        // Compute fingerprint
        string fingerprint;
        try
        {
            var referencedMedia = ResolveReferencedMedia(post);
            var sharedAssets = GetSharedAssets();
            fingerprint = await _cacheService.ComputeFingerprintAsync(
                slug, rawMarkdown, templateDir, _toolchain.MermaidConfigPath,
                referencedMedia, sharedAssets, logger, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Fingerprint computation failed for {Url}", post.Url);
            return Failure($"Fingerprint failed: {ex.Message}");
        }

        // Check cache
        var (hit, cachedUrl) = await _cacheService.TryHitAsync(slug, fingerprint, logger);
        if (hit && cachedUrl is not null)
        {
            var generatedUrl = $"generated-pdfs/{cachedUrl}";
            var outputPath = Path.Combine(_toolchain.OutputDirectory, cachedUrl);
            if (File.Exists(outputPath))
            {
                return new PdfGenerationResult
                {
                    Status = PdfGenerationStatus.Cached,
                    RelativeUrl = generatedUrl
                };
            }
        }

        // Full generation
        logger.LogInformation("Generating PDF for {Url} ({Slug})...", post.Url, slug);

        try
        {
            return await GeneratePdfAsync(post, sourceMdPath, rawMarkdown, slug, fingerprint,
                templateName, templateDir, logger, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "PDF generation failed for {Url}", post.Url);
            return Failure($"Generation error: {ex.Message}");
        }
    }

    private async Task<PdfGenerationResult> GeneratePdfAsync(
        Post<CourseFrontMatter> post,
        string sourceMdPath,
        string rawMarkdown,
        string slug,
        string fingerprint,
        string templateName,
        string templateDir,
        ILogger logger,
        CancellationToken ct)
    {
        // 1. Render Mermaid diagrams if any
        var diagramPdfs = new List<string>();
        if (post.FrontMatter.Diagrams.Count > 0)
        {
            diagramPdfs = await RenderDiagramsAsync(post, logger, ct);
            if (diagramPdfs.Count == 0 && post.FrontMatter.Diagrams.Count > 0)
            {
                // All diagrams failed
                return Failure("Mermaid diagram rendering failed");
            }
        }

        // 2. Create augmented markdown with diagram sections
        var workDir = _toolchain.WorkDirectory;
        Directory.CreateDirectory(workDir);

        var augmentedMd = BuildAugmentedMarkdown(post, rawMarkdown, diagramPdfs, logger);
        var mdPath = Path.Combine(workDir, $"{slug}.md");
        await File.WriteAllTextAsync(mdPath, augmentedMd, ct);

        // 3. Run Pandoc (Markdown → LaTeX)
        var texPath = Path.Combine(workDir, $"{slug}.tex");
        var pandocResult = await RunPandocAsync(mdPath, texPath, templateName, templateDir, post, logger, ct);
        if (!pandocResult)
        {
            return Failure("Pandoc conversion failed");
        }

        // 4. Run Tectonic (LaTeX → PDF)
        var outputPdfName = $"{slug}.{fingerprint[..12]}.pdf";
        var outputPdfPath = Path.Combine(_toolchain.OutputDirectory, outputPdfName);

        var tectonicResult = await RunTectonicAsync(texPath, outputPdfPath, logger, ct);
        if (!tectonicResult)
        {
            return Failure("Tectonic compilation failed");
        }

        // 5. Validate output
        if (!await ValidatePdfAsync(outputPdfPath))
        {
            try { File.Delete(outputPdfPath); } catch { /* best-effort */ }
            return Failure("Generated PDF invalid or empty");
        }

        // 6. Record cache
        var generatedUrl = $"generated-pdfs/{outputPdfName}";
        await _cacheService.RecordAsync(slug, fingerprint, outputPdfName, logger);

        return new PdfGenerationResult
        {
            Status = PdfGenerationStatus.Generated,
            RelativeUrl = generatedUrl
        };
    }

    private async Task<List<string>> RenderDiagramsAsync(
        Post<CourseFrontMatter> post, ILogger logger, CancellationToken ct)
    {
        var pdfs = new List<string>();
        var mmdcDir = Path.Combine(_toolchain.WorkDirectory, "mmdc");
        Directory.CreateDirectory(mmdcDir);

        foreach (var diagram in post.FrontMatter.Diagrams)
        {
            foreach (var step in diagram.Steps)
            {
                if (string.IsNullOrWhiteSpace(step.Mermaid))
                    continue;

                var outputPdf = Path.Combine(mmdcDir, $"diag_{Path.GetRandomFileName()}.pdf");

                var success = await _mermaidRenderer.RenderToPdfAsync(step.Mermaid, outputPdf, logger, ct);
                if (!success)
                {
                    logger.LogWarning("Failed to render diagram step: {Title}", step.Title);
                    return []; // Fail the whole document if any step fails
                }

                pdfs.Add(outputPdf);
            }
        }

        return pdfs;
    }

    private string BuildAugmentedMarkdown(
        Post<CourseFrontMatter> post,
        string rawMarkdown,
        List<string> diagramPdfs,
        ILogger logger)
    {
        // Split frontmatter from body
        var bodyStart = FindBodyStart(rawMarkdown);
        var frontmatter = bodyStart > 0 ? rawMarkdown[..bodyStart] : "";
        var body = bodyStart > 0 ? rawMarkdown[bodyStart..] : rawMarkdown;

        var sb = new StringBuilder();
        sb.Append(frontmatter);

        // Insert diagram sections after frontmatter
        if (diagramPdfs.Count > 0)
        {
            int stepIdx = 0;
            foreach (var diagram in post.FrontMatter.Diagrams)
            {
                sb.AppendLine();
                sb.AppendLine($"## {EscapeLatexText(diagram.Title)}");
                if (!string.IsNullOrWhiteSpace(diagram.Description))
                    sb.AppendLine();
                    sb.AppendLine(EscapeLatexText(diagram.Description));
                sb.AppendLine();

                foreach (var step in diagram.Steps)
                {
                    sb.AppendLine($"### {EscapeLatexText(step.Title)}");
                    if (!string.IsNullOrWhiteSpace(step.Description))
                    {
                        sb.AppendLine();
                        sb.AppendLine(EscapeLatexText(step.Description));
                        sb.AppendLine();
                    }

                    // Insert the rendered diagram PDF
                    if (stepIdx < diagramPdfs.Count)
                    {
                        var relPdfPath = diagramPdfs[stepIdx];
                        sb.AppendLine($"![{EscapeLatexText(step.Title)}]({relPdfPath})");
                        sb.AppendLine();
                    }
                    stepIdx++;
                }
            }
        }

        // Then the original body
        sb.Append(body);

        return sb.ToString();
    }

    private async Task<bool> RunPandocAsync(string mdPath, string texPath, string templateName,
        string templateDir, Post<CourseFrontMatter> post, ILogger logger, CancellationToken ct)
    {
        var pandoc = _toolchain.PandocPath;
        if (pandoc is null)
        {
            logger.LogWarning("Pandoc not available");
            return false;
        }

        // Find the main template file
        var templateFile = Path.Combine(templateDir, "template.latex");
        if (!File.Exists(templateFile))
        {
            logger.LogWarning("Template not found: {File}", templateFile);
            return false;
        }

        // Build metadata arguments from frontmatter
        var metadataArgs = new List<string>
        {
            "--from", "markdown",
            "--to", "latex",
            "--template", templateFile,
            "--output", texPath,
            "--standalone",
            "--pdf-engine-opt=-shell-escape" // for potential future use
        };

        // Add metadata from frontmatter
        AddMetadata(metadataArgs, "title", post.FrontMatter.Title);
        AddMetadata(metadataArgs, "subtitle", post.FrontMatter.Subtitle);
        AddMetadata(metadataArgs, "lead", post.FrontMatter.Lead);
        AddMetadata(metadataArgs, "published", post.FrontMatter.Published.ToString("yyyy-MM-dd"));
        AddMetadata(metadataArgs, "deadline", post.FrontMatter.Deadline?.ToString("yyyy-MM-dd"));
        if (post.FrontMatter.NoDeadline)
            AddMetadata(metadataArgs, "no-deadline", "true");

        foreach (var tag in post.FrontMatter.Tags)
            AddMetadata(metadataArgs, "tags", tag);

        foreach (var author in post.FrontMatter.Authors)
        {
            var name = author.Nickname ?? author.Name ?? "";
            AddMetadata(metadataArgs, "author", name);
        }

        // Add PDF variables
        if (post.FrontMatter.Pdf?.Variables is not null)
        {
            foreach (var kvp in post.FrontMatter.Pdf.Variables)
            {
                AddMetadata(metadataArgs, $"pdf-variables-{kvp.Key}", kvp.Value?.ToString() ?? "");
            }
        }

        // Set resource path to include the working directory for diagrams
        metadataArgs.Add("--resource-path");
        metadataArgs.Add(Path.GetDirectoryName(mdPath) ?? ".");

        metadataArgs.Add(mdPath);

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(180));

        var result = await _processRunner.RunAsync(pandoc, metadataArgs.ToArray(),
            workingDirectory: _toolchain.WorkDirectory,
            ct: timeoutCts.Token);

        if (result.TimedOut)
        {
            logger.LogWarning("Pandoc timed out (180s) for {Md}", mdPath);
            return false;
        }

        if (result.ExitCode != 0)
        {
            logger.LogWarning("Pandoc exited code {Code}: {Err}",
                result.ExitCode, Truncate(result.StdErr, 300));
            return false;
        }

        if (!File.Exists(texPath))
        {
            logger.LogWarning("Pandoc produced no .tex output");
            return false;
        }

        return true;
    }

    private async Task<bool> RunTectonicAsync(string texPath, string outputPdfPath,
        ILogger logger, CancellationToken ct)
    {
        var tectonic = _toolchain.TectonicPath;
        if (tectonic is null)
        {
            logger.LogWarning("Tectonic not available");
            return false;
        }

        var cacheDir = Path.Combine(_toolchain.PuppeteerCachePath, "..", "tectonic-cache");
        var env = new Dictionary<string, string?>
        {
            ["TECTONIC_CACHE_DIR"] = Path.GetFullPath(cacheDir)
        };

        var args = new List<string>
        {
            "-X", "compile",
            "--untrusted",
            "-o", outputPdfPath
        };

        if (_toolchain.TectonicBundlePath is not null)
        {
            args.Add("--bundle");
            args.Add(_toolchain.TectonicBundlePath);
        }

        args.Add(texPath);

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(180));

        var result = await _processRunner.RunAsync(tectonic, args.ToArray(),
            workingDirectory: Path.GetDirectoryName(texPath),
            environmentVariables: env,
            ct: timeoutCts.Token);

        if (result.TimedOut)
        {
            logger.LogWarning("Tectonic timed out (180s) for {Tex}", texPath);
            return false;
        }

        if (result.ExitCode != 0)
        {
            logger.LogWarning("Tectonic exited code {Code}: {Err}",
                result.ExitCode, Truncate(result.StdErr, 300));
            return false;
        }

        return true;
    }

    private static async Task<bool> ValidatePdfAsync(string path)
    {
        if (!File.Exists(path))
            return false;

        var fileInfo = new FileInfo(path);
        if (fileInfo.Length == 0)
            return false;

        try
        {
            await using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            var header = new byte[5];
            var read = await fs.ReadAsync(header);
            return read >= 5 && header[0] == '%' && header[1] == 'P' && header[2] == 'D' && header[3] == 'F' && header[4] == '-';
        }
        catch
        {
            return false;
        }
    }

    private static void AddMetadata(List<string> args, string key, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return;
        // Use -M/--metadata for Pandoc
        args.Add("-M");
        args.Add($"{key}={value}");
    }

    private static string? ValidateTemplate(string templateName)
    {
        if (string.IsNullOrWhiteSpace(templateName))
            return "Template name is empty";

        if (!ValidTemplateName.IsMatch(templateName))
            return "Template name must match [a-z0-9][a-z0-9_-]*";

        // Prevent directory traversal
        if (templateName.Contains("..") || templateName.Contains('/') || templateName.Contains('\\'))
            return "Directory traversal detected";

        return null;
    }

    private static int FindBodyStart(string rawMarkdown)
    {
        const string delimiter = "---";
        using var reader = new StringReader(rawMarkdown);

        var firstLine = reader.ReadLine()?.Trim();
        if (firstLine != delimiter)
            return 0;

        string? line;
        while ((line = reader.ReadLine()) is not null)
        {
            if (line.Trim() == delimiter)
            {
                // Return position after the closing delimiter
                // We need the character position, not the line
                // Recalculate by searching the string
                break;
            }
        }

        // Find second --- in the raw string
        var firstDelim = rawMarkdown.IndexOf(delimiter, StringComparison.Ordinal);
        if (firstDelim < 0) return 0;

        var secondDelim = rawMarkdown.IndexOf(delimiter, firstDelim + 3, StringComparison.Ordinal);
        if (secondDelim < 0) return 0;

        return secondDelim + 3;
    }

    private Dictionary<string, string> ResolveSourcePaths(List<Post<CourseFrontMatter>> posts)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var sourceDir = Path.GetFullPath("Content/Materials");

        if (!Directory.Exists(sourceDir))
            return result;

        foreach (var mdFile in Directory.EnumerateFiles(sourceDir, "*.md"))
        {
            var fileName = Path.GetFileNameWithoutExtension(mdFile);
            result[fileName] = mdFile;
        }

        return result;
    }

    private static string? ResolveSourcePath(string postUrl, Dictionary<string, string> sourcePaths)
    {
        // Post.Url might be just the slug (e.g. "cmsc-131-lab0")
        var slug = NormalizeSlug(postUrl);

        if (sourcePaths.TryGetValue(slug, out var path))
            return path;

        // Try matching by key
        foreach (var kvp in sourcePaths)
        {
            if (string.Equals(kvp.Key, slug, StringComparison.OrdinalIgnoreCase))
                return kvp.Value;
        }

        return null;
    }

    private static IEnumerable<string> ResolveReferencedMedia(Post<CourseFrontMatter> post)
    {
        // Extract image references from HTML content
        var media = new List<string>();
        var html = post.HtmlContent;
        if (string.IsNullOrEmpty(html))
            return media;

        // Find <img src="..."> references
        var imgRegex = new Regex(@"<img[^>]+src=""([^""]+)""", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        foreach (Match match in imgRegex.Matches(html))
        {
            var src = match.Groups[1].Value;
            if (!src.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            {
                var localPath = Path.GetFullPath(Path.Combine("wwwroot", src.TrimStart('/')));
                media.Add(localPath);
            }
        }

        return media;
    }

    private List<string> GetSharedAssets()
    {
        var assets = new List<string>();
        var assetsDir = Path.Combine(_toolchain.TemplatesPath, "_shared");
        if (Directory.Exists(assetsDir))
        {
            assets.AddRange(Directory.EnumerateFiles(assetsDir, "*", SearchOption.AllDirectories));
        }
        return assets;
    }

    private static string NormalizeSlug(string url)
    {
        return url.Replace("/", "-").Replace("\\", "-").Trim('-');
    }

    private static PdfGenerationResult Failure(string diagnostic)
    {
        return new PdfGenerationResult
        {
            Status = PdfGenerationStatus.Failed,
            Diagnostic = diagnostic
        };
    }

    private static string EscapeLatexText(string text)
    {
        // Minimal LaTeX escaping for Markdown insertion
        return text
            .Replace("\\", "\\\\")
            .Replace("{", "\\{")
            .Replace("}", "\\}")
            .Replace("_", "\\_")
            .Replace("&", "\\&")
            .Replace("#", "\\#");
    }

    private static string Truncate(string value, int maxLen) =>
        value.Length <= maxLen ? value : value[..maxLen] + "...";

    private void LogSummary(ILogger logger, int totalPosts)
    {
        var generated = _manifest.AllResults.Values.Count(r => r.Status is PdfGenerationStatus.Generated);
        var cached = _manifest.AllResults.Values.Count(r => r.Status is PdfGenerationStatus.Cached);
        var failed = _manifest.AllResults.Values.Count(r => r.Status is PdfGenerationStatus.Failed);

        logger.LogInformation(
            "PDF generation complete: {Total} posts, {Generated} generated, {Cached} cached, {Failed} failed",
            totalPosts, generated, cached, failed);

        if (failed > 0)
        {
            foreach (var (url, result) in _manifest.AllResults)
            {
                if (result.Status == PdfGenerationStatus.Failed)
                    logger.LogWarning("  {Url}: {Diagnostic}", url, result.Diagnostic);
            }
        }

        // GitHub Actions step summary
        var stepSummary = Environment.GetEnvironmentVariable("GITHUB_STEP_SUMMARY");
        if (stepSummary is not null)
        {
            try
            {
                var summary = new StringBuilder();
                summary.AppendLine("## PDF Generation Results");
                summary.AppendLine();
                summary.AppendLine($"| Status | Count |");
                summary.AppendLine($"|--------|-------|");
                summary.AppendLine($"| ✅ Generated | {generated} |");
                summary.AppendLine($"| 💾 Cached | {cached} |");
                summary.AppendLine($"| ❌ Failed | {failed} |");
                summary.AppendLine();

                if (failed > 0)
                {
                    summary.AppendLine("### Failures");
                    summary.AppendLine();
                    summary.AppendLine("| Post | Diagnostic |");
                    summary.AppendLine("|------|------------|");
                    foreach (var (url, result) in _manifest.AllResults)
                    {
                        if (result.Status == PdfGenerationStatus.Failed)
                            summary.AppendLine($"| {url} | {result.Diagnostic} |");
                    }
                }

                File.AppendAllText(stepSummary, summary.ToString());
            }
            catch { /* best-effort */ }
        }
    }
}
