using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace BlazorStaticMinimalBlog.Services;

public sealed class OfflineManifest
{
    [JsonPropertyName("schemaVersion")]
    public int SchemaVersion { get; init; }

    [JsonPropertyName("buildId")]
    public string BuildId { get; init; } = string.Empty;

    [JsonPropertyName("routes")]
    public string[] Routes { get; init; } = [];

    [JsonPropertyName("assets")]
    public string[] Assets { get; init; } = [];
}

public static class OfflineBundleGenerator
{
    private const int SchemaVersion = 1;
    private const string MermaidAsset = "vendor/mermaid/mermaid.min.js";
    private const string BuildIdToken = "__OFFLINE_BUILD_ID__";
    private static readonly Regex BaseHref = new(
        "<base\\b[^>]*\\bhref\\s*=\\s*[\"']([^\"']+)[\"']",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex SourceAttribute = new(
        "\\bsrc\\s*=\\s*[\"']([^\"']+)[\"']",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex SourceSetAttribute = new(
        "\\bsrcset\\s*=\\s*[\"']([^\"']+)[\"']",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex LinkHrefAttribute = new(
        "<link\\b[^>]*\\bhref\\s*=\\s*[\"']([^\"']+)[\"']",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex ManifestLink = new(
        "<link\\b(?=[^>]*\\brel\\s*=\\s*[\"']manifest[\"'])(?=[^>]*\\bhref\\s*=\\s*[\"']([^\"']+)[\"'])[^>]*>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex PdfHrefAttribute = new(
        "<a\\b[^>]*\\bhref\\s*=\\s*[\"']([^\"']+\\.pdf(?:[?#][^\"']*)?)[\"']",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex CssUrl = new(
        "url\\(\\s*(?:[\"']([^\"']+)[\"']|([^)]*))\\s*\\)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
    };

    public static OfflineManifest Generate(string outputRoot, string workerTemplatePath)
    {
        outputRoot = Path.GetFullPath(outputRoot);
        workerTemplatePath = Path.GetFullPath(workerTemplatePath);

        if (!Directory.Exists(outputRoot))
            throw new DirectoryNotFoundException($"Offline output directory does not exist: {outputRoot}");
        if (!File.Exists(workerTemplatePath))
            throw new FileNotFoundException("Offline service-worker template was not found.", workerTemplatePath);

        var routeFiles = FindRouteFiles(outputRoot);
        var routes = routeFiles.Keys.Order(StringComparer.Ordinal).ToArray();
        var assets = new SortedDictionary<string, string>(StringComparer.Ordinal);

        foreach (var pair in routeFiles)
        {
            var html = File.ReadAllText(pair.Value);
            var documentUrl = new Uri($"https://offline.local/{ToUrlPath(Path.GetRelativePath(outputRoot, pair.Value))}");
            var (baseUrl, scopePath) = ResolveBaseUrl(html, documentUrl);

            AddHtmlReferences(html, baseUrl, scopePath, outputRoot, assets);
            AddWebManifestReferences(html, baseUrl, scopePath, outputRoot, assets);
        }

        AddAsset(MermaidAsset, outputRoot, assets);
        ProcessCssReferences(outputRoot, assets);

        var workerTemplate = File.ReadAllText(workerTemplatePath);
        var buildId = CreateBuildId(routes, routeFiles, assets, workerTemplatePath);
        var manifest = new OfflineManifest
        {
            SchemaVersion = SchemaVersion,
            BuildId = buildId,
            Routes = routes,
            Assets = assets.Keys.ToArray(),
        };

        if (!workerTemplate.Contains(BuildIdToken, StringComparison.Ordinal))
            throw new InvalidOperationException($"The worker template must contain {BuildIdToken}.");

        var worker = workerTemplate.Replace(BuildIdToken, buildId, StringComparison.Ordinal);
        AtomicWrite(Path.Combine(outputRoot, "offline-manifest.json"),
            JsonSerializer.Serialize(manifest, JsonOptions));
        AtomicWrite(Path.Combine(outputRoot, "service-worker.js"), worker);
        DeleteDirectoryIfExists(Path.Combine(outputRoot, "js", "__tests__"));
        DeleteIfExists(Path.Combine(outputRoot, "offline-manifest.json.gz"));
        DeleteIfExists(Path.Combine(outputRoot, "service-worker.js.gz"));

        return manifest;
    }

    private static Dictionary<string, string> FindRouteFiles(string outputRoot)
    {
        var routes = new Dictionary<string, string>(StringComparer.Ordinal);

        foreach (var file in Directory.EnumerateFiles(outputRoot, "*.html", SearchOption.AllDirectories))
        {
            var relative = ToUrlPath(Path.GetRelativePath(outputRoot, file));
            if (IsExcludedPath(relative)) continue;

            var route = RouteForHtml(relative);
            if (route is null) continue;
            routes[route] = file;
        }

        if (routes.Count == 0)
            throw new InvalidOperationException($"No generated HTML routes were found in {outputRoot}.");

        return routes;
    }

    private static string? RouteForHtml(string relativePath)
    {
        if (relativePath.Equals("index.html", StringComparison.OrdinalIgnoreCase)) return "./";
        if (!relativePath.EndsWith(".html", StringComparison.OrdinalIgnoreCase)) return null;

        if (relativePath.EndsWith("/index.html", StringComparison.OrdinalIgnoreCase))
            return relativePath[..^"/index.html".Length];

        return relativePath[..^".html".Length];
    }

    private static (Uri BaseUrl, string ScopePath) ResolveBaseUrl(string html, Uri documentUrl)
    {
        var match = BaseHref.Match(html);
        if (!match.Success) return (documentUrl, "/");

        if (!Uri.TryCreate(documentUrl, match.Groups[1].Value, out var baseUrl))
            return (documentUrl, "/");

        var scopePath = baseUrl.AbsolutePath.EndsWith('/')
            ? baseUrl.AbsolutePath
            : baseUrl.AbsolutePath + "/";
        return (baseUrl, scopePath);
    }

    private static void AddHtmlReferences(
        string html,
        Uri baseUrl,
        string scopePath,
        string outputRoot,
        SortedDictionary<string, string> assets)
    {
        foreach (Match match in SourceAttribute.Matches(html))
            AddReference(match.Groups[1].Value, baseUrl, scopePath, outputRoot, assets);

        foreach (Match match in SourceSetAttribute.Matches(html))
        {
            foreach (var candidate in match.Groups[1].Value.Split(','))
            {
                var reference = candidate.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
                if (reference is not null) AddReference(reference, baseUrl, scopePath, outputRoot, assets);
            }
        }

        foreach (Match match in LinkHrefAttribute.Matches(html))
            AddReference(match.Groups[1].Value, baseUrl, scopePath, outputRoot, assets);

        foreach (Match match in PdfHrefAttribute.Matches(html))
            AddReference(match.Groups[1].Value, baseUrl, scopePath, outputRoot, assets);
    }

    private static void AddWebManifestReferences(
        string html,
        Uri baseUrl,
        string scopePath,
        string outputRoot,
        SortedDictionary<string, string> assets)
    {
        foreach (Match match in ManifestLink.Matches(html))
        {
            var manifestUrl = ResolveLocalReference(match.Groups[1].Value, baseUrl, scopePath);
            if (manifestUrl is null) continue;

            AddAsset(manifestUrl, outputRoot, assets);
            var manifestPath = GetAssetPath(manifestUrl, outputRoot);
            using var document = JsonDocument.Parse(File.ReadAllText(manifestPath));
            AddManifestArrayReferences(document.RootElement, "icons", manifestPath, outputRoot, assets);
            AddManifestArrayReferences(document.RootElement, "screenshots", manifestPath, outputRoot, assets);

            if (document.RootElement.TryGetProperty("shortcuts", out var shortcuts)
                && shortcuts.ValueKind == JsonValueKind.Array)
            {
                foreach (var shortcut in shortcuts.EnumerateArray())
                {
                    if (shortcut.ValueKind != JsonValueKind.Object) continue;
                    AddManifestArrayReferences(shortcut, "icons", manifestPath, outputRoot, assets);
                }
            }
        }
    }

    private static void AddManifestArrayReferences(
        JsonElement manifest,
        string propertyName,
        string manifestPath,
        string outputRoot,
        SortedDictionary<string, string> assets)
    {
        if (!manifest.TryGetProperty(propertyName, out var entries)
            || entries.ValueKind != JsonValueKind.Array)
            return;

        var manifestDirectory = Path.GetDirectoryName(manifestPath)!;
        foreach (var entry in entries.EnumerateArray())
        {
            if (entry.ValueKind != JsonValueKind.Object
                || !entry.TryGetProperty("src", out var source)
                || source.ValueKind != JsonValueKind.String)
                continue;

            var rawSource = source.GetString()!;
            var relativePath = ResolveManifestPath(rawSource, manifestDirectory, outputRoot);
            if (relativePath is null) continue;
            var relativeUrl = ToUrlPath(Path.GetRelativePath(outputRoot, relativePath));
            AddAsset(relativeUrl, outputRoot, assets);
        }
    }

    private static string? ResolveManifestPath(string rawSource, string manifestDirectory, string outputRoot)
    {
        if (string.IsNullOrWhiteSpace(rawSource))
            throw new InvalidOperationException($"Invalid local manifest reference: {rawSource}");
        if (rawSource.StartsWith("//", StringComparison.Ordinal)) return null;
        if (Uri.TryCreate(rawSource, UriKind.Absolute, out var absolute))
        {
            if (absolute.Scheme is "http" or "https") return null;
            throw new InvalidOperationException($"Invalid local manifest reference: {rawSource}");
        }

        var normalizedSource = rawSource.Split('?', 2)[0].Split('#', 2)[0];
        if (Path.IsPathRooted(normalizedSource))
            throw new InvalidOperationException($"Rooted manifest reference is not allowed: {rawSource}");

        var path = Path.GetFullPath(Path.Combine(
            manifestDirectory,
            normalizedSource.Replace('/', Path.DirectorySeparatorChar)));
        var relativePath = Path.GetRelativePath(outputRoot, path);
        if (relativePath.Equals("..", StringComparison.Ordinal)
            || relativePath.StartsWith($"..{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
            || Path.IsPathRooted(relativePath))
            throw new InvalidOperationException($"Manifest reference escapes the offline output: {rawSource}");

        return path;
    }

    private static void ProcessCssReferences(
        string outputRoot,
        SortedDictionary<string, string> assets)
    {
        var processed = new HashSet<string>(StringComparer.Ordinal);
        var pending = new Queue<string>(assets.Keys.Where(IsCssPath));

        while (pending.Count > 0)
        {
            var assetUrl = pending.Dequeue();
            if (!processed.Add(assetUrl)) continue;

            var filePath = assets[assetUrl];
            var css = File.ReadAllText(filePath);
            var baseUrl = new Uri($"https://offline.local/{assetUrl.Split('?', 2)[0]}");
            var before = assets.Count;

            foreach (Match match in CssUrl.Matches(css))
            {
                var raw = (match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value).Trim();
                AddReference(raw, baseUrl, "/", outputRoot, assets);
            }

            if (assets.Count > before)
            {
                foreach (var added in assets.Keys.Where(IsCssPath).Where(key => !processed.Contains(key)))
                    pending.Enqueue(added);
            }
        }
    }

    private static void AddReference(
        string rawReference,
        Uri baseUrl,
        string scopePath,
        string outputRoot,
        SortedDictionary<string, string> assets)
    {
        if (string.IsNullOrWhiteSpace(rawReference)) return;
        if (rawReference.StartsWith('#')
            || rawReference.StartsWith("data:", StringComparison.OrdinalIgnoreCase)
            || rawReference.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)
            || rawReference.StartsWith("javascript:", StringComparison.OrdinalIgnoreCase)) return;

        if (!Uri.TryCreate(baseUrl, rawReference, out var resolved)) return;
        if (!resolved.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase)
            || !resolved.Host.Equals("offline.local", StringComparison.OrdinalIgnoreCase)) return;

        var relativeUrl = ResolveLocalReference(rawReference, baseUrl, scopePath);
        if (relativeUrl is not null) AddAsset(relativeUrl, outputRoot, assets);
    }

    private static string? ResolveLocalReference(string rawReference, Uri baseUrl, string scopePath)
    {
        if (!Uri.TryCreate(baseUrl, rawReference, out var resolved)) return null;
        if (!resolved.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase)
            || !resolved.Host.Equals("offline.local", StringComparison.OrdinalIgnoreCase)) return null;
        if (!resolved.AbsolutePath.StartsWith(scopePath, StringComparison.Ordinal)) return null;

        var relativePath = ToUrlPath(Uri.UnescapeDataString(
            resolved.AbsolutePath[scopePath.Length..])).TrimStart('/');
        return relativePath.Length == 0 ? null : relativePath + resolved.Query;
    }

    private static void AddAsset(
        string relativeUrl,
        string outputRoot,
        SortedDictionary<string, string> assets)
    {
        var path = relativeUrl.Split('?', 2)[0].Split('#', 2)[0];
        if (path.Length == 0 || IsExcludedPath(path)) return;
        if (Path.IsPathRooted(path))
            throw new InvalidOperationException($"Rooted local reference is not allowed: {relativeUrl}");

        var fullPath = Path.GetFullPath(Path.Combine(outputRoot, path.Replace('/', Path.DirectorySeparatorChar)));
        var relativePath = Path.GetRelativePath(outputRoot, fullPath);
        if (Path.IsPathRooted(relativePath)
            || relativePath.Equals("..", StringComparison.Ordinal)
            || relativePath.StartsWith($"..{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
            throw new InvalidOperationException($"Local reference escapes the offline output: {relativeUrl}");
        if (!File.Exists(fullPath))
            throw new InvalidOperationException($"Missing local offline reference: {relativeUrl}");

        assets.TryAdd(relativeUrl.Replace('\\', '/'), fullPath);
    }

    private static string GetAssetPath(string relativeUrl, string outputRoot)
    {
        var path = relativeUrl.Split('?', 2)[0].Split('#', 2)[0];
        return Path.GetFullPath(Path.Combine(outputRoot, path.Replace('/', Path.DirectorySeparatorChar)));
    }

    private static string CreateBuildId(
        IEnumerable<string> routes,
        IReadOnlyDictionary<string, string> routeFiles,
        IReadOnlyDictionary<string, string> assets,
        string workerTemplatePath)
    {
        var pairs = new List<string>();
        foreach (var route in routes)
            pairs.Add($"route\n{route}\n{HashFile(routeFiles[route])}");
        foreach (var asset in assets.Keys)
            pairs.Add($"asset\n{asset}\n{HashFile(assets[asset])}");
        pairs.Add($"worker-template\n{HashFile(workerTemplatePath)}");

        pairs.Sort(StringComparer.Ordinal);
        var input = $"schemaVersion\n{SchemaVersion}\n{string.Join("\n", pairs)}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input))).ToLowerInvariant();
    }

    private static string HashFile(string path) =>
        Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path))).ToLowerInvariant();

    private static bool IsCssPath(string url) =>
        url.Split('?', 2)[0].EndsWith(".css", StringComparison.OrdinalIgnoreCase);

    private static bool IsExcludedPath(string relativePath)
    {
        var segments = relativePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return relativePath.EndsWith(".gz", StringComparison.OrdinalIgnoreCase)
            || relativePath.Equals("build-metadata.txt", StringComparison.OrdinalIgnoreCase)
            || relativePath.Equals(".nojekyll", StringComparison.OrdinalIgnoreCase)
            || relativePath.Equals("404.html", StringComparison.OrdinalIgnoreCase)
            || segments.Any(segment => segment.Equals("__tests__", StringComparison.OrdinalIgnoreCase)
                || segment.Equals("reports", StringComparison.OrdinalIgnoreCase));
    }

    private static string ToUrlPath(string path) => path.Replace('\\', '/');

    private static void AtomicWrite(string path, string content)
    {
        var temporaryPath = $"{path}.{Guid.NewGuid():N}.tmp";
        try
        {
            File.WriteAllText(temporaryPath, content, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            File.Move(temporaryPath, path, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporaryPath)) File.Delete(temporaryPath);
        }
    }

    private static void DeleteIfExists(string path)
    {
        if (File.Exists(path)) File.Delete(path);
    }

    private static void DeleteDirectoryIfExists(string path)
    {
        if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
    }
}
