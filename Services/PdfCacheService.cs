using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace BlazorStaticMinimalBlog.Services;

/// <summary>
/// Content-addressed cache for PDF generation.
/// State stored as JSON, keyed by normalized slug.
/// </summary>
public interface IPdfCacheService
{
    /// <summary>Check cache hit. Returns (true, filename) or (false, null).</summary>
    Task<(bool hit, string? cachedUrl)> TryHitAsync(string slug, string fingerprint, ILogger logger);

    /// <summary>Record a successful generation.</summary>
    Task RecordAsync(string slug, string fingerprint, string generatedUrl, ILogger logger);

    /// <summary>Remove stale state and its referenced output for one material.</summary>
    Task InvalidateAsync(string slug, ILogger logger, CancellationToken ct = default);

    /// <summary>Prune stale state files and orphaned PDFs.</summary>
    Task PruneAsync(HashSet<string> activeSlugs, ILogger logger, CancellationToken ct = default);
}

public class PdfCacheService : IPdfCacheService
{
    private readonly string _stateDir;
    private readonly string _outputDir;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public PdfCacheService(IToolchainProvider toolchain)
    {
        _stateDir = toolchain.CacheStateDirectory;
        _outputDir = toolchain.OutputDirectory;
    }

    public async Task<(bool hit, string? cachedUrl)> TryHitAsync(string slug, string fingerprint, ILogger logger)
    {
        var stateFile = StatePath(slug);
        if (!File.Exists(stateFile)) return (false, null);

        CacheState? state;
        try
        {
            state = JsonSerializer.Deserialize<CacheState>(
                await File.ReadAllTextAsync(stateFile), JsonOpts);
        }
        catch
        {
            await InvalidateAsync(slug, logger);
            return (false, null);
        }

        if (state is null || state.Fingerprint != fingerprint)
        {
            await InvalidateAsync(slug, logger);
            return (false, null);
        }

        if (Path.GetFileName(state.OutputName) != state.OutputName)
        {
            await InvalidateAsync(slug, logger);
            return (false, null);
        }

        var outputPath = Path.Combine(_outputDir, state.OutputName);
        if (!File.Exists(outputPath))
        {
            await InvalidateAsync(slug, logger);
            return (false, null);
        }

        // Validate %PDF- header
        var head = await ReadHeadAsync(outputPath, 5);
        if (string.IsNullOrEmpty(head) || !head.StartsWith("%PDF-"))
        {
            logger.LogWarning("Cache state exists but output corrupt for {Slug}, miss", slug);
            await InvalidateAsync(slug, logger);
            return (false, null);
        }

        logger.LogDebug("Cache HIT {Slug}: {Url}", slug, state.OutputName);
        return (true, state.OutputName);
    }

    public async Task RecordAsync(string slug, string fingerprint, string generatedUrl, ILogger logger)
    {
        // generatedUrl is the output filename like "{slug}.{12}.pdf"
        var state = new CacheState
        {
            Slug = slug,
            Fingerprint = fingerprint,
            OutputName = generatedUrl,
            CachedAt = DateTime.UtcNow
        };

        var stateFile = StatePath(slug);
        Directory.CreateDirectory(_stateDir);

        // Atomic write via temp file
        var tmp = stateFile + ".tmp";
        var json = JsonSerializer.Serialize(state, JsonOpts);
        await File.WriteAllTextAsync(tmp, json);
        File.Move(tmp, stateFile, overwrite: true);

        logger.LogDebug("Cache recorded {Slug}: {Url}", slug, generatedUrl);
    }

    public async Task InvalidateAsync(string slug, ILogger logger, CancellationToken ct = default)
    {
        var stateFile = StatePath(slug);
        string? outputName = null;

        if (File.Exists(stateFile))
        {
            try
            {
                var state = JsonSerializer.Deserialize<CacheState>(
                    await File.ReadAllTextAsync(stateFile, ct), JsonOpts);
                if (state is not null && Path.GetFileName(state.OutputName) == state.OutputName)
                    outputName = state.OutputName;
            }
            catch { /* corrupt state is still removed below */ }

            try { File.Delete(stateFile); } catch { }
        }

        if (outputName is not null)
        {
            try { File.Delete(Path.Combine(_outputDir, outputName)); } catch { }
        }

        logger.LogDebug("Invalidated PDF cache for {Slug}", slug);
    }

    public async Task PruneAsync(HashSet<string> activeSlugs, ILogger logger, CancellationToken ct = default)
    {
        // Remove stale state files
        if (Directory.Exists(_stateDir))
        {
            foreach (var f in Directory.EnumerateFiles(_stateDir, "*.json"))
            {
                ct.ThrowIfCancellationRequested();
                var slug = Path.GetFileNameWithoutExtension(f);
                if (!activeSlugs.Contains(slug))
                {
                    try { File.Delete(f); } catch { }
                    logger.LogDebug("Pruned stale state: {Slug}", slug);
                }
            }
        }

        // Collect active output names from remaining state
        var activeNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (Directory.Exists(_stateDir))
        {
            foreach (var f in Directory.EnumerateFiles(_stateDir, "*.json"))
            {
                try
                {
                    var state = JsonSerializer.Deserialize<CacheState>(
                        await File.ReadAllTextAsync(f, ct), JsonOpts);
                    if (state?.OutputName is not null)
                        activeNames.Add(state.OutputName);
                }
                catch { }
            }
        }

        // Remove orphaned PDFs
        if (Directory.Exists(_outputDir))
        {
            foreach (var pdf in Directory.EnumerateFiles(_outputDir, "*.pdf"))
            {
                ct.ThrowIfCancellationRequested();
                var name = Path.GetFileName(pdf);
                if (!activeNames.Contains(name))
                {
                    try { File.Delete(pdf); } catch { }
                    logger.LogDebug("Pruned stale PDF: {Name}", name);
                }
            }
        }
    }

    private string StatePath(string slug)
    {
        var safe = slug.Replace("/", "-").Replace("\\", "-");
        return Path.Combine(_stateDir, $"{safe}.json");
    }

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

    private class CacheState
    {
        public string Slug { get; set; } = "";
        public string Fingerprint { get; set; } = "";
        public string OutputName { get; set; } = "";
        public DateTime CachedAt { get; set; }
    }
}
