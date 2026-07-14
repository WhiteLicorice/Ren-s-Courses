using System.IO.Compression;
using System.Security.Cryptography;
using BlazorStaticMinimalBlog.Models;
using Microsoft.Extensions.Logging;

namespace BlazorStaticMinimalBlog.Services;

/// <summary>
/// Bootstraps pinned Pandoc and Tectonic binaries.
/// Downloads, verifies SHA-256, extracts atomically.
/// Never invokes ambient PATH versions.
/// </summary>
public interface IToolchainProvider
{
    /// <summary>
    /// Ensure toolchain is bootstrapped. Returns false on unsupported platform or failure.
    /// </summary>
    Task<bool> BootstrapAsync(ILogger logger, CancellationToken ct = default);

    /// <summary>Path to Pandoc executable, or null if unavailable.</summary>
    string? PandocPath { get; }

    /// <summary>Path to Tectonic executable, or null if unavailable.</summary>
    string? TectonicPath { get; }

    /// <summary>Runtime identifier (win-x64 or linux-x64).</summary>
    string RuntimeIdentifier { get; }

    /// <summary>Physical path of the PDF template directory.</summary>
    string TemplatesPath { get; }

    /// <summary>Physical path of the committed .mmdc.json.</summary>
    string MermaidConfigPath { get; }

    /// <summary>Physical path of the Tectonic bundle, or null.</summary>
    string? TectonicBundlePath { get; }

    /// <summary>Physical path of the Puppeteer browser cache.</summary>
    string PuppeteerCachePath { get; }

    /// <summary>Physical path of the Mermaid CLI entry point.</summary>
    string MermaidCliPath { get; }

    /// <summary>Directory where generated PDFs should be placed.</summary>
    string OutputDirectory { get; }

    /// <summary>Directory for cache state.</summary>
    string CacheStateDirectory { get; }

    /// <summary>Directory for work files.</summary>
    string WorkDirectory { get; }
}

public class ToolchainProvider : IToolchainProvider
{
    private readonly string _artifactsDir;

    public ToolchainProvider(string contentRootPath)
    {
        _artifactsDir = Path.Combine(contentRootPath, "artifacts");
        TemplatesPath = Path.Combine(contentRootPath, "PdfTemplates");
        MermaidConfigPath = Path.Combine(contentRootPath, ".mmdc.json");
        OutputDirectory = Path.Combine(contentRootPath, "wwwroot", "generated-pdfs");
        CacheStateDirectory = Path.Combine(_artifactsDir, "material-pdfs", "state");
        WorkDirectory = Path.Combine(_artifactsDir, "material-pdfs", "work");
        PuppeteerCachePath = Path.Combine(_artifactsDir, "puppeteer");
        MermaidCliPath = Path.Combine(contentRootPath, "node_modules", "@mermaid-js", "mermaid-cli", "node_modules", ".bin", "mmdc");
        if (!OperatingSystem.IsWindows())
            MermaidCliPath = Path.Combine(contentRootPath, "node_modules", "@mermaid-js", "mermaid-cli", "node_modules", ".bin", "mmdc");
    }

    public string RuntimeIdentifier =>
        OperatingSystem.IsWindows() ? "win-x64" :
        OperatingSystem.IsLinux() ? "linux-x64" :
        "unsupported";

    public string? PandocPath { get; private set; }
    public string? TectonicPath { get; private set; }
    public string? TectonicBundlePath { get; private set; }
    public string TemplatesPath { get; }
    public string MermaidConfigPath { get; }
    public string OutputDirectory { get; }
    public string CacheStateDirectory { get; }
    public string WorkDirectory { get; }
    public string PuppeteerCachePath { get; }
    public string MermaidCliPath { get; }

    public async Task<bool> BootstrapAsync(ILogger logger, CancellationToken ct = default)
    {
        var rid = RuntimeIdentifier;
        if (rid == "unsupported")
        {
            logger.LogWarning("Unsupported runtime platform. PDF generation disabled.");
            return false;
        }

        try
        {
            // Bootstrap Pandoc
            var pandocInfo = ToolchainManifest.Current.Pandoc;
            if (pandocInfo.Archives.TryGetValue(rid, out var pandocArchive))
            {
                PandocPath = await DownloadAndExtractAsync("pandoc", pandocInfo.Version, rid,
                    pandocArchive, logger, ct);
            }

            // Bootstrap Tectonic
            var tectonicInfo = ToolchainManifest.Current.Tectonic;
            if (tectonicInfo.Archives.TryGetValue(rid, out var tectonicArchive))
            {
                TectonicPath = await DownloadAndExtractAsync("tectonic", tectonicInfo.Version, rid,
                    tectonicArchive, logger, ct);

                // Download Tectonic bundle
                if (tectonicInfo.BundleUrl is not null)
                {
                    TectonicBundlePath = await DownloadBundleAsync(tectonicInfo.BundleUrl, logger, ct);
                }
            }

            // Ensure output, cache, and work directories exist
            Directory.CreateDirectory(OutputDirectory);
            Directory.CreateDirectory(CacheStateDirectory);
            Directory.CreateDirectory(WorkDirectory);
            Directory.CreateDirectory(PuppeteerCachePath);

            logger.LogInformation("PDF toolchain bootstrapped: Pandoc={Pandoc}, Tectonic={Tectonic}",
                PandocPath ?? "N/A", TectonicPath ?? "N/A");

            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Toolchain bootstrap failed. PDF generation will use fallbacks.");
            return false;
        }
    }

    private async Task<string> DownloadAndExtractAsync(string tool, string version, string rid,
        ToolArchive archive, ILogger logger, CancellationToken ct)
    {
        var toolDir = Path.Combine(_artifactsDir, "pdf-toolchain", tool, version, rid);
        var executablePath = Path.GetFullPath(Path.Combine(toolDir, archive.ExecutablePath));

        if (File.Exists(executablePath))
        {
            logger.LogDebug("Found cached {Tool} at {Path}", tool, executablePath);
            return executablePath;
        }

        Directory.CreateDirectory(toolDir);

        // Download
        var archiveExt = Path.GetExtension(archive.Url) switch
        {
            ".zip" => ".zip",
            ".gz" => ".tar.gz",
            _ => ".tmp"
        };
        var downloadPath = Path.Combine(toolDir, $"download{archiveExt}");
        var finalDownloadPath = Path.Combine(toolDir, $"downloaded{archiveExt}");

        logger.LogInformation("Downloading {Tool} {Version}...", tool, version);
        using (var client = new HttpClient { Timeout = TimeSpan.FromMinutes(5) })
        {
            var response = await client.GetAsync(archive.Url, HttpCompletionOption.ResponseHeadersRead, ct);
            response.EnsureSuccessStatusCode();

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            await using var fileStream = File.Create(downloadPath);
            await stream.CopyToAsync(fileStream, ct);
        }

        // Verify SHA-256
        logger.LogInformation("Verifying checksum for {Tool}...", tool);
        var hash = await ComputeSha256Async(downloadPath, ct);
        if (!string.Equals(hash, archive.Sha256, StringComparison.OrdinalIgnoreCase))
        {
            File.Delete(downloadPath);
            throw new InvalidOperationException(
                $"SHA-256 mismatch for {tool}: expected {archive.Sha256}, got {hash}");
        }

        // Atomically rename (partial file → downloaded)
        if (File.Exists(finalDownloadPath))
            File.Delete(finalDownloadPath);
        File.Move(downloadPath, finalDownloadPath);

        // Extract
        logger.LogInformation("Extracting {Tool}...", tool);
        if (archiveExt == ".zip")
        {
            ZipFile.ExtractToDirectory(finalDownloadPath, toolDir, overwriteFiles: true);
        }
        else if (archiveExt == ".tar.gz")
        {
            await ExtractTarGzAsync(finalDownloadPath, toolDir, ct);
        }

        // Set executable permissions on Linux
        if (!OperatingSystem.IsWindows() && File.Exists(executablePath))
        {
            File.SetUnixFileMode(executablePath,
                UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute |
                UnixFileMode.GroupRead | UnixFileMode.GroupExecute |
                UnixFileMode.OtherRead | UnixFileMode.OtherExecute);
        }

        // Cleanup archive
        try { File.Delete(finalDownloadPath); } catch { /* best-effort */ }

        return executablePath;
    }

    private async Task<string> DownloadBundleAsync(string bundleUrl, ILogger logger, CancellationToken ct)
    {
        var bundleDir = Path.Combine(_artifactsDir, "tectonic-cache");
        Directory.CreateDirectory(bundleDir);

        var bundlePath = Path.Combine(bundleDir, "bundle.tar");
        if (File.Exists(bundlePath))
        {
            logger.LogDebug("Found cached Tectonic bundle at {Path}", bundlePath);
            return bundlePath;
        }

        logger.LogInformation("Downloading Tectonic bundle...");
        using (var client = new HttpClient { Timeout = TimeSpan.FromMinutes(5) })
        {
            var response = await client.GetAsync(bundleUrl, HttpCompletionOption.ResponseHeadersRead, ct);
            response.EnsureSuccessStatusCode();

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            await using var fileStream = File.Create(bundlePath);
            await stream.CopyToAsync(fileStream, ct);
        }

        return bundlePath;
    }

    private static async Task<string> ComputeSha256Async(string filePath, CancellationToken ct)
    {
        await using var stream = File.OpenRead(filePath);
        var hash = await SHA256.HashDataAsync(stream, ct);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static async Task ExtractTarGzAsync(string gzPath, string targetDir, CancellationToken ct)
    {
        // .NET 9 has TarReader in System.Formats.Tar
        await using var gzStream = File.OpenRead(gzPath);
        await using var decompressed = new System.IO.Compression.GZipStream(gzStream, CompressionMode.Decompress);
        await System.Formats.Tar.TarFile.ExtractToDirectoryAsync(decompressed, targetDir, overwriteFiles: true, ct);
    }
}
