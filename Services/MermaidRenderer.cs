using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace BlazorStaticMinimalBlog.Services;

/// <summary>
/// Renders Mermaid diagram definitions as PDF vector assets using pinned mermaid-cli.
/// </summary>
public interface IMermaidRenderer
{
    /// <summary>
    /// Render a single Mermaid definition to a PDF file.
    /// Returns true on success, false on failure.
    /// </summary>
    Task<bool> RenderToPdfAsync(string mermaidDefinition, string outputPdfPath,
        ILogger logger, CancellationToken ct = default);

    /// <summary>
    /// Check whether Mermaid CLI is available.
    /// </summary>
    bool IsAvailable { get; }
}

public class MermaidRenderer : IMermaidRenderer
{
    private readonly IToolchainProvider _toolchain;
    private readonly IProcessRunner _processRunner;

    public MermaidRenderer(IToolchainProvider toolchain, IProcessRunner processRunner)
    {
        _toolchain = toolchain;
        _processRunner = processRunner;
    }

    public bool IsAvailable => File.Exists(_toolchain.MermaidCliPath);

    public async Task<bool> RenderToPdfAsync(string mermaidDefinition, string outputPdfPath,
        ILogger logger, CancellationToken ct = default)
    {
        if (!IsAvailable)
        {
            logger.LogWarning("Mermaid CLI not available. Skipping diagram render.");
            return false;
        }

        // Write mermaid definition to a temporary file
        var mmdcDir = Path.Combine(_toolchain.WorkDirectory, "mmdc");
        Directory.CreateDirectory(mmdcDir);

        var inputFile = Path.Combine(mmdcDir, $"input_{Path.GetRandomFileName()}.mmd");
        var configFile = _toolchain.MermaidConfigPath;

        try
        {
            await File.WriteAllTextAsync(inputFile, mermaidDefinition, ct);

            var args = new[]
            {
                "-i", inputFile,
                "-o", outputPdfPath,
                "-p", configFile,
                "-b", "pdf"
            };

            // Set puppeteer cache directory
            var env = new Dictionary<string, string?>
            {
                ["PUPPETEER_CACHE_DIR"] = _toolchain.PuppeteerCachePath
            };

            var nodeBin = FindNodeExecutable();
            var mmdcScript = _toolchain.MermaidCliPath;

            string executable;
            string[] processArgs;

            if (nodeBin is not null)
            {
                executable = nodeBin;
                processArgs = new[] { mmdcScript }.Concat(args).ToArray();
            }
            else
            {
                // Fallback: try mmdc directly
                executable = mmdcScript;
                processArgs = args;
            }

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(60));

            var result = await _processRunner.RunAsync(executable, processArgs,
                workingDirectory: mmdcDir,
                environmentVariables: env,
                ct: timeoutCts.Token);

            if (result.TimedOut)
            {
                logger.LogWarning("Mermaid render timed out after 60s");
                return false;
            }

            if (result.ExitCode != 0)
            {
                logger.LogWarning("Mermaid CLI exited code {Code}: {Err}",
                    result.ExitCode, Truncate(result.StdErr, 200));
                return false;
            }

            if (!File.Exists(outputPdfPath))
            {
                logger.LogWarning("Mermaid CLI produced no output file");
                return false;
            }

            return true;
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning("Mermaid render cancelled (timeout)");
            return false;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Mermaid render failed");
            return false;
        }
        finally
        {
            try { if (File.Exists(inputFile)) File.Delete(inputFile); } catch { /* best-effort */ }
        }
    }

    private static string? FindNodeExecutable()
    {
        // Check common locations
        var candidates = OperatingSystem.IsWindows()
            ? new[] { "node.exe", "node.cmd" }
            : new[] { "node" };

        // Check PATH
        foreach (var candidate in candidates)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = candidate,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true
                };
                // Just check if it exists
                var process = new Process { StartInfo = psi };
                // Try finding via PATH resolution
                var found = Which(candidate);
                if (found is not null) return found;
            }
            catch { /* not found */ }
        }

        return null;
    }

    private static string? Which(string name)
    {
        var pathEnv = Environment.GetEnvironmentVariable("PATH");
        if (pathEnv is null) return null;

        foreach (var dir in pathEnv.Split(Path.PathSeparator))
        {
            try
            {
                var fullPath = Path.Combine(dir, name);
                if (File.Exists(fullPath))
                    return fullPath;
            }
            catch { /* invalid path segment */ }
        }
        return null;
    }

    private static string Truncate(string value, int maxLen) =>
        value.Length <= maxLen ? value : value[..maxLen] + "...";
}
