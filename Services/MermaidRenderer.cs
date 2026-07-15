using Microsoft.Extensions.Logging;

namespace BlazorStaticMinimalBlog.Services;

/// <summary>
/// Renders Mermaid definitions as PDF vector assets using pinned mermaid-cli.
/// </summary>
public interface IMermaidRenderer
{
    Task<bool> RenderToPdfAsync(string mermaidDefinition, string outputPdfPath,
        string inputFile, ILogger logger, CancellationToken ct = default);
    bool IsAvailable { get; }
}

public class MermaidRenderer : IMermaidRenderer
{
    private readonly IProcessRunner _processRunner;
    private readonly string _mmdcPath;
    private readonly string _configPath;
    private readonly string _puppeteerConfigPath;
    private readonly string _nodePath;
    private readonly string _puppeteerCache;

    public MermaidRenderer(IToolchainProvider toolchain, IProcessRunner processRunner)
    {
        _processRunner = processRunner;

        // Platform-independent entry point
        _mmdcPath = Path.Combine(toolchain.NodeModulesPath, "@mermaid-js", "mermaid-cli", "src", "cli.js");
        _configPath = toolchain.MermaidConfigPath;
        _puppeteerConfigPath = toolchain.PuppeteerConfigPath;
        _puppeteerCache = toolchain.PuppeteerCachePath;

        _nodePath = FindNode();
    }

    public bool IsAvailable => File.Exists(_nodePath) && File.Exists(_mmdcPath);

    public async Task<bool> RenderToPdfAsync(string mermaidDefinition, string outputPdfPath,
        string inputFile, ILogger logger, CancellationToken ct = default)
    {
        if (!IsAvailable)
        {
            logger.LogWarning("Mermaid CLI unavailable. Node={Node} Mmdc={Mmdc}", _nodePath, _mmdcPath);
            return false;
        }

        if (string.IsNullOrWhiteSpace(mermaidDefinition))
        {
            logger.LogWarning("Empty Mermaid definition treated as failure");
            return false;
        }

        try
        {
            await File.WriteAllTextAsync(inputFile, mermaidDefinition, ct);

            var args = new List<string>
            {
                _mmdcPath,
                "-i", inputFile,
                "-o", outputPdfPath,
                "-e", "pdf",
                "-c", _configPath,
                "--pdfFit"
            };

            if (File.Exists(_puppeteerConfigPath))
            {
                args.Add("-p");
                args.Add(_puppeteerConfigPath);
            }

            var env = new Dictionary<string, string?>
            {
                ["PUPPETEER_CACHE_DIR"] = _puppeteerCache
            };

            var result = await _processRunner.RunAsync(_nodePath, args.ToArray(),
                workingDirectory: Path.GetDirectoryName(inputFile),
                environmentVariables: env,
                timeoutMs: 60_000,
                ct: ct);

            if (result.TimedOut)
            {
                logger.LogWarning("Mermaid render timed out (60s)");
                return false;
            }

            if (result.ExitCode != 0)
            {
                logger.LogWarning("Mermaid CLI exit {Code}: {Err}",
                    result.ExitCode, Truncate(result.StdErr, 200));
                return false;
            }

            if (!File.Exists(outputPdfPath))
            {
                logger.LogWarning("Mermaid CLI produced no output");
                return false;
            }

            return true;
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning("Mermaid render cancelled");
            return false;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Mermaid render failed");
            return false;
        }
    }

    private static string FindNode()
    {
        foreach (var dir in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
        {
            try
            {
                var name = OperatingSystem.IsWindows() ? "node.exe" : "node";
                var full = Path.Combine(dir, name);
                if (File.Exists(full)) return full;
            }
            catch { }
        }
        return "node";
    }

    private static string Truncate(string s, int n) =>
        s.Length <= n ? s : s[..n] + "...";
}
