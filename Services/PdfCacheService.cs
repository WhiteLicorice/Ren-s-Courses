using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BlazorStaticMinimalBlog.Models;
using Microsoft.Extensions.Logging;

namespace BlazorStaticMinimalBlog.Services;

/// <summary>
/// Content-addressed cache for PDF generation.
/// Fingerprints every dependency so only changed documents recompile.
/// </summary>
public interface IPdfCacheService
{
    /// <summary>
    /// Compute SHA-256 fingerprint for a document given all its dependencies.
    /// </summary>
    Task<string> ComputeFingerprintAsync(string slug, string rawMarkdown, string templatePath,
        string mmdcConfigPath, IEnumerable<string> referencedMedia, IEnumerable<string> sharedAssets,
        ILogger logger, CancellationToken ct = default);

    /// <summary>
    /// Try to load a cache hit. Returns (true, cachedUrl) on hit, (false, null) on miss.
    /// </summary>
    Task<(bool hit, string? cachedUrl)> TryHitAsync(string slug, string fingerprint, ILogger logger);

    /// <summary>
    /// Record a successful generation in the cache.
    /// </summary>
    Task RecordAsync(string slug, string fingerprint, string generatedUrl, ILogger logger);

    /// <summary>
    /// Prune stale cache entries (deleted sources, outdated fingerprints).
    /// </summary>
    Task PruneAsync(HashSet<string> activeSlugs, ILogger logger, CancellationToken ct = default);
}

public class PdfCacheService : IPdfCacheService
{
    private readonly IToolchainProvider _toolchain;
    private readonly string _stateDir;
    private readonly string _outputDir;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public PdfCacheService(IToolchainProvider toolchain)
    {
        _toolchain = toolchain;
        _stateDir = toolchain.CacheStateDirectory;
        _outputDir = toolchain.OutputDirectory;
        Directory.CreateDirectory(_stateDir);
        Directory.CreateDirectory(_outputDir);
    }

    public async Task<string> ComputeFingerprintAsync(string slug, string rawMarkdown, string templatePath,
        string mmdcConfigPath, IEnumerable<string> referencedMedia, IEnumerable<string> sharedAssets,
        ILogger logger, CancellationToken ct = default)
    {
        using var stream = new MemoryStream();
        await using var writer = new BinaryWriter(stream);

        // 1. Generator schema version
        writer.Write(ToolchainManifest.GeneratorSchemaVersion);

        // 2. Complete raw markdown (frontmatter + body)
        writer.Write(rawMarkdown ?? "");

        // 3. Template + partials
        await HashFileOrDirectoryToStreamAsync(stream, templatePath, ct);

        // 4. Toolchain manifest JSON
        writer.Write(ToolchainManifest.Current.ToFingerprintJson());

        // 5. Mermaid/Puppeteer versions + config
        var mmdcConfig = File.Exists(mmdcConfigPath) ? await File.ReadAllTextAsync(mmdcConfigPath, ct) : "";
        writer.Write(mmdcConfig);

        // Store the SHA-256 of the config for the manifest
        if (!string.IsNullOrEmpty(mmdcConfig))
        {
            var configHash = BitConverter.ToString(SHA256.HashData(Encoding.UTF8.GetBytes(mmdcConfig)))
                .Replace("-", "").ToLowerInvariant();
            ToolchainManifest.Current.MermaidConfig.ConfigSha256 = configHash;
        }

        // 6. Referenced media (local files)
        foreach (var mediaPath in referencedMedia)
        {
            if (File.Exists(mediaPath))
            {
                var bytes = await File.ReadAllBytesAsync(mediaPath, ct);
                writer.Write(bytes);
            }
        }

        // 7. Shared PDF assets
        foreach (var assetPath in sharedAssets)
        {
            if (File.Exists(assetPath))
            {
                var bytes = await File.ReadAllBytesAsync(assetPath, ct);
                writer.Write(bytes);
            }
        }

        writer.Flush();
        stream.Position = 0;

        var hash = await SHA256.HashDataAsync(stream, ct);
        return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
    }

    public async Task<(bool hit, string? cachedUrl)> TryHitAsync(string slug, string fingerprint, ILogger logger)
    {
        var stateFile = GetStateFilePath(slug);
        if (!File.Exists(stateFile))
            return (false, null);

        CacheState? state;
        try
        {
            var json = await File.ReadAllTextAsync(stateFile);
            state = JsonSerializer.Deserialize<CacheState>(json, JsonOpts);
        }
        catch
        {
            return (false, null);
        }

        if (state is null || state.Fingerprint != fingerprint)
            return (false, null);

        // Verify output exists, non-empty, starts with %PDF-
        var fpPrefix = fingerprint.Length >= 12 ? fingerprint[..12] : fingerprint;
        var expectedUrl = $"{slug}.{fpPrefix}.pdf";
        var outputPath = Path.Combine(_outputDir, expectedUrl);
        if (!File.Exists(outputPath))
            return (false, null);

        var content = await ReadHeadAsync(outputPath, 5);
        if (string.IsNullOrEmpty(content) || !content.StartsWith("%PDF-"))
            return (false, null);

        logger.LogDebug("Cache HIT for {Slug}: {Url}", slug, expectedUrl);
        return (true, expectedUrl);
    }

    public async Task RecordAsync(string slug, string fingerprint, string generatedUrl, ILogger logger)
    {
        var state = new CacheState
        {
            Slug = slug,
            Fingerprint = fingerprint,
            GeneratedUrl = generatedUrl,
            CachedAt = DateTime.UtcNow
        };

        var stateFile = GetStateFilePath(slug);
        var json = JsonSerializer.Serialize(state, JsonOpts);
        await File.WriteAllTextAsync(stateFile, json);

        logger.LogDebug("Cache recorded for {Slug}: {Url} ({Fingerprint})",
            slug, generatedUrl, fingerprint.Length >= 12 ? fingerprint[..12] : fingerprint);
    }

    public async Task PruneAsync(HashSet<string> activeSlugs, ILogger logger, CancellationToken ct = default)
    {
        // Remove stale state files
        if (Directory.Exists(_stateDir))
        {
            foreach (var stateFile in Directory.EnumerateFiles(_stateDir, "*.json"))
            {
                ct.ThrowIfCancellationRequested();
                var slug = Path.GetFileNameWithoutExtension(stateFile);
                if (!activeSlugs.Contains(slug))
                {
                    try { File.Delete(stateFile); } catch { /* best-effort */ }
                    logger.LogDebug("Pruned stale state for {Slug}", slug);
                }
            }
        }

        // Remove generated PDFs not referenced by any active state
        if (Directory.Exists(_outputDir))
        {
            var activeUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var slug in activeSlugs)
            {
                var stateFile = GetStateFilePath(slug);
                if (File.Exists(stateFile))
                {
                    try
                    {
                        var json = await File.ReadAllTextAsync(stateFile, ct);
                        var state = JsonSerializer.Deserialize<CacheState>(json, JsonOpts);
                        if (state?.GeneratedUrl is not null)
                            activeUrls.Add(state.GeneratedUrl);
                    }
                    catch { /* skip corrupt state */ }
                }
            }

            foreach (var pdfFile in Directory.EnumerateFiles(_outputDir, "*.pdf"))
            {
                ct.ThrowIfCancellationRequested();
                var fileName = Path.GetFileName(pdfFile);
                if (!activeUrls.Contains(fileName))
                {
                    try { File.Delete(pdfFile); } catch { /* best-effort */ }
                    logger.LogDebug("Pruned stale PDF: {File}", fileName);
                }
            }
        }
    }

    private string GetStateFilePath(string slug)
    {
        // Normalize slug for filesystem safety
        var safeSlug = slug.Replace("/", "-").Replace("\\", "-");
        return Path.Combine(_stateDir, $"{safeSlug}.json");
    }

    private static async Task HashFileOrDirectoryToStreamAsync(Stream stream, string path, CancellationToken ct)
    {
        if (Directory.Exists(path))
        {
            foreach (var file in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories)
                         .OrderBy(f => f, StringComparer.Ordinal))
            {
                var bytes = await File.ReadAllBytesAsync(file, ct);
                await stream.WriteAsync(bytes, ct);
            }
        }
        else if (File.Exists(path))
        {
            var bytes = await File.ReadAllBytesAsync(path, ct);
            await stream.WriteAsync(bytes, ct);
        }
    }

    private static async Task<string?> ReadHeadAsync(string path, int maxBytes)
    {
        try
        {
            await using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            var buffer = new byte[maxBytes];
            var read = await fs.ReadAsync(buffer);
            return Encoding.UTF8.GetString(buffer, 0, read);
        }
        catch
        {
            return null;
        }
    }

    private class CacheState
    {
        public string Slug { get; set; } = "";
        public string Fingerprint { get; set; } = "";
        public string GeneratedUrl { get; set; } = "";
        public DateTime CachedAt { get; set; }
    }
}
