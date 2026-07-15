using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using BlazorStaticMinimalBlog.Models;
using Microsoft.Extensions.Logging;

namespace BlazorStaticMinimalBlog.Services;

public interface IToolchainProvider
{
    Task<bool> BootstrapAsync(ILogger logger, CancellationToken ct = default);
    string RuntimeIdentifier { get; }
    bool IsSupported { get; }
    string? PandocPath { get; }
    string? TectonicPath { get; }
    string TectonicBundleUrl { get; }
    string TemplatesPath { get; }
    string MermaidConfigPath { get; }
    string OutputDirectory { get; }
    string CacheStateDirectory { get; }
    string WorkDirectory { get; }
    string PuppeteerCachePath { get; }
    string NodeModulesPath { get; }
    string PuppeteerConfigPath { get; }
}

public class ToolchainProvider : IToolchainProvider
{
    private readonly string _artifactsDir;
    private readonly string _contentRoot;

    public ToolchainProvider(string contentRootPath)
    {
        _contentRoot = contentRootPath;
        _artifactsDir = Path.Combine(contentRootPath, "artifacts");
    }

    public string RuntimeIdentifier =>
        OperatingSystem.IsWindows() ? "win-x64" :
        OperatingSystem.IsLinux() ? "linux-x64" :
        "unsupported";

    public bool IsSupported =>
        RuntimeIdentifier != "unsupported" &&
        RuntimeInformation.ProcessArchitecture == Architecture.X64;

    public string? PandocPath { get; private set; }
    public string? TectonicPath { get; private set; }

    public string TectonicBundleUrl => ToolchainManifest.Current.Tectonic.BundleUrl
        ?? throw new InvalidOperationException("The Tectonic bundle URL is not configured.");

    public string TemplatesPath => Path.Combine(_contentRoot, "PdfTemplates");
    public string MermaidConfigPath => Path.Combine(_contentRoot, ".mmdc.json");
    public string NodeModulesPath => Path.Combine(_contentRoot, "node_modules");
    public string PuppeteerConfigPath => Path.Combine(_contentRoot, "puppeteer-config.json");
    public string OutputDirectory => Path.Combine(_contentRoot, "wwwroot", "pdfs");
    public string CacheStateDirectory => Path.Combine(_artifactsDir, "material-pdfs", "state");
    public string WorkDirectory => Path.Combine(_artifactsDir, "material-pdfs", "work");
    public string PuppeteerCachePath => Path.Combine(_artifactsDir, "puppeteer");

    public async Task<bool> BootstrapAsync(ILogger logger, CancellationToken ct = default)
    {
        if (!IsSupported)
        {
            logger.LogWarning("Unsupported platform: {Rid} / {Arch}",
                RuntimeIdentifier, RuntimeInformation.ProcessArchitecture);
            return false;
        }

        var rid = RuntimeIdentifier;

        try
        {
            var pandocOk = await BootstrapToolAsync("pandoc",
                ToolchainManifest.Current.Pandoc, rid, logger, ct);

            var tectonicOk = await BootstrapToolAsync("tectonic",
                ToolchainManifest.Current.Tectonic, rid, logger, ct);

            Directory.CreateDirectory(OutputDirectory);
            Directory.CreateDirectory(CacheStateDirectory);
            Directory.CreateDirectory(WorkDirectory);
            Directory.CreateDirectory(PuppeteerCachePath);

            if (pandocOk && tectonicOk)
                logger.LogInformation("Toolchain ready: Pandoc={P}, Tectonic={T}",
                    PandocPath, TectonicPath);
            else
                logger.LogWarning("Toolchain incomplete: Pandoc={P} Tectonic={T}",
                    pandocOk, tectonicOk);

            return pandocOk && tectonicOk;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Toolchain bootstrap failed");
            return false;
        }
    }

    private async Task<bool> BootstrapToolAsync(string name, ToolInfo info, string rid,
        ILogger logger, CancellationToken ct)
    {
        if (!info.Archives.TryGetValue(rid, out var archive))
        {
            logger.LogWarning("No archive for {Tool}/{Rid}", name, rid);
            return false;
        }

        var versionDir = Path.Combine(_artifactsDir, "pdf-toolchain", name, info.Version, rid);
        var exePath = Path.GetFullPath(Path.Combine(versionDir, archive.ExecutablePath));

        // Check cache
        if (File.Exists(exePath) && new FileInfo(exePath).Length > 0)
        {
            if (OperatingSystem.IsLinux())
            {
                File.SetUnixFileMode(exePath,
                    UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute |
                    UnixFileMode.GroupRead | UnixFileMode.GroupExecute |
                    UnixFileMode.OtherRead | UnixFileMode.OtherExecute);
            }
            logger.LogDebug("Found cached {Tool} at {Path}", name, exePath);
            if (name == "pandoc") PandocPath = exePath;
            else TectonicPath = exePath;
            return true;
        }

        // Download with retry
        var downloadDir = Path.Combine(_artifactsDir, "pdf-toolchain", name, info.Version, rid);
        Directory.CreateDirectory(downloadDir);

        var ext = archive.Url.EndsWith(".zip") ? ".zip" : ".tar.gz";
        var partialPath = Path.Combine(downloadDir, $"download{ext}.partial");
        var archivePath = Path.Combine(downloadDir, $"archive{ext}");

        logger.LogInformation("Downloading {Tool} {Version}...", name, info.Version);

        bool downloaded = false;
        for (int attempt = 0; attempt < 2; attempt++)
        {
            try
            {
                using var client = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
                var response = await client.GetAsync(archive.Url,
                    HttpCompletionOption.ResponseHeadersRead, ct);
                response.EnsureSuccessStatusCode();

                await using var src = await response.Content.ReadAsStreamAsync(ct);
                await using var dst = File.Create(partialPath);
                await src.CopyToAsync(dst, ct);
                downloaded = true;
                break;
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning("Download attempt {A} timed out for {Tool}", attempt + 1, name);
                if (attempt == 0) continue;
            }
            catch (Exception ex) when (attempt == 0)
            {
                logger.LogWarning(ex, "Download attempt 1 failed for {Tool}, retrying", name);
            }
        }

        if (!downloaded)
        {
            logger.LogWarning("Failed to download {Tool} after retries", name);
            return false;
        }

        // Verify SHA-256
        var hash = await ComputeSha256Async(partialPath, ct);
        if (!string.Equals(hash, archive.Sha256, StringComparison.OrdinalIgnoreCase))
        {
            try { File.Delete(partialPath); } catch { }
            logger.LogWarning("SHA-256 mismatch for {Tool}: expected {Expected} got {Actual}",
                name, archive.Sha256, hash);
            return false;
        }

        // Rename partial → archive
        try { File.Delete(archivePath); } catch { }
        File.Move(partialPath, archivePath);

        // Extract to temp sibling dir
        var tempDir = downloadDir + ".tmp." + Guid.NewGuid().ToString("N")[..8];
        try
        {
            Directory.CreateDirectory(tempDir);
            logger.LogInformation("Extracting {Tool}...", name);

            if (ext == ".zip")
                ZipFile.ExtractToDirectory(archivePath, tempDir, overwriteFiles: true);
            else
                await ExtractTarGzAsync(archivePath, tempDir, ct);

            // Validate expected executable exists
            var extractedExe = Path.GetFullPath(Path.Combine(tempDir, archive.ExecutablePath));
            if (!File.Exists(extractedExe) || new FileInfo(extractedExe).Length == 0)
            {
                logger.LogWarning("Extracted {Tool} missing expected executable {Exe}",
                    name, archive.ExecutablePath);
                return false;
            }

            // Set executable bit on Linux
            if (OperatingSystem.IsLinux())
            {
                File.SetUnixFileMode(extractedExe,
                    UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute |
                    UnixFileMode.GroupRead | UnixFileMode.GroupExecute |
                    UnixFileMode.OtherRead | UnixFileMode.OtherExecute);
            }

            // Atomically rename temp into final position
            if (Directory.Exists(versionDir))
                Directory.Delete(versionDir, recursive: true);
            Directory.Move(tempDir, versionDir);

            if (name == "pandoc")
            {
                PandocPath = exePath;
                // For Pandoc, the exe may be at a different relative location
                // within the extracted tree. Re-resolve from versionDir.
                var resolvedExe = Path.GetFullPath(Path.Combine(versionDir, archive.ExecutablePath));
                if (File.Exists(resolvedExe))
                    PandocPath = resolvedExe;
            }
            else
            {
                TectonicPath = Path.GetFullPath(Path.Combine(versionDir, archive.ExecutablePath));
            }

            // Clean up archive
            try { File.Delete(archivePath); } catch { }

            return true;
        }
        catch
        {
            if (Directory.Exists(tempDir))
                try { Directory.Delete(tempDir, recursive: true); } catch { }
            throw;
        }
    }

    private static async Task<string> ComputeSha256Async(string path, CancellationToken ct)
    {
        await using var s = File.OpenRead(path);
        var hash = await SHA256.HashDataAsync(s, ct);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static async Task ExtractTarGzAsync(string gzPath, string targetDir, CancellationToken ct)
    {
        await using var gz = File.OpenRead(gzPath);
        await using var decompressed = new GZipStream(gz, CompressionMode.Decompress);
        await System.Formats.Tar.TarFile.ExtractToDirectoryAsync(decompressed, targetDir, overwriteFiles: true, ct);
    }

}
