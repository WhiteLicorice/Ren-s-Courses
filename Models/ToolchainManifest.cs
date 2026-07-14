using System.Text.Json.Serialization;

namespace BlazorStaticMinimalBlog.Models;

/// <summary>
/// Committed toolchain manifest for reproducible PDF generation.
/// Contains pinned binary locations, SHA-256 checksums, and schema version.
/// </summary>
public class ToolchainManifest
{
    /// <summary>Generator schema version — bump when generation behavior changes.</summary>
    public const int GeneratorSchemaVersion = 3;

    /// <summary>Current manifest instance with pinned values.</summary>
    public static ToolchainManifest Current { get; } = new()
    {
        SchemaVersion = GeneratorSchemaVersion,
        Pandoc = new ToolInfo
        {
            Version = "3.10",
            Archives = new Dictionary<string, ToolArchive>
            {
                ["win-x64"] = new()
                {
                    Url = "https://github.com/jgm/pandoc/releases/download/3.10/pandoc-3.10-windows-x86_64.zip",
                    Sha256 = "bb808d00fd58762299d64582a9b4c3e4b106cd929e62c5f19bcdcb496f1e54ae",
                    ExecutablePath = "pandoc-3.10/pandoc.exe"
                },
                ["linux-x64"] = new()
                {
                    Url = "https://github.com/jgm/pandoc/releases/download/3.10/pandoc-3.10-linux-amd64.tar.gz",
                    Sha256 = "e0f8af62d0f267d22baa5bcefe6d5dda3a097ccc60de794b759fe03159923244",
                    ExecutablePath = "pandoc-3.10/bin/pandoc"
                }
            }
        },
        Tectonic = new ToolInfo
        {
            Version = "0.16.9",
            BundleUrl = "https://data1.fullyjustified.net/tlextras-2022.0r0.tar",
            Archives = new Dictionary<string, ToolArchive>
            {
                ["win-x64"] = new()
                {
                    Url = "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.16.9/tectonic-0.16.9-x86_64-pc-windows-msvc.zip",
                    Sha256 = "131a24604785a9600989a3d91225f597df52ac06f00aeffe86fd529f99ee5cdd",
                    ExecutablePath = "tectonic.exe"
                },
                ["linux-x64"] = new()
                {
                    Url = "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.16.9/tectonic-0.16.9-x86_64-unknown-linux-musl.tar.gz",
                    Sha256 = "60b13a0826ae7ad9ce34b4a2df06bff2cfcfa6dda8a915477c0cbb84e1a4a902",
                    ExecutablePath = "tectonic"
                }
            }
        },
        MermaidConfig = new MermaidToolInfo
        {
            CliVersion = "11.16.0",
            PuppeteerVersion = "25.3.0"
        }
    };

    public int SchemaVersion { get; set; }
    public ToolInfo Pandoc { get; set; } = new();
    public ToolInfo Tectonic { get; set; } = new();
    public MermaidToolInfo MermaidConfig { get; set; } = new();

    /// <summary>
    /// Serialize to deterministic JSON for cache fingerprinting.
    /// </summary>
    public string ToFingerprintJson()
    {
        return System.Text.Json.JsonSerializer.Serialize(this, new System.Text.Json.JsonSerializerOptions
        {
            WriteIndented = false,
            PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
        });
    }
}

public class ToolInfo
{
    public string Version { get; set; } = "";
    public string? BundleUrl { get; set; }
    public Dictionary<string, ToolArchive> Archives { get; set; } = new();
}

public class ToolArchive
{
    public string Url { get; set; } = "";
    public string Sha256 { get; set; } = "";
    public string ExecutablePath { get; set; } = "";
}

public class MermaidToolInfo
{
    public string CliVersion { get; set; } = "";
    public string PuppeteerVersion { get; set; } = "";
}
