using System.Collections.Concurrent;

namespace BlazorStaticMinimalBlog.Models;

/// <summary>
/// Singleton manifest populated before static generation.
/// Keyed by the exact Post.Url used by BlazorStatic.
/// Injected into article components to resolve generated PDF links.
/// </summary>
public class PdfGenerationManifest
{
    private readonly ConcurrentDictionary<string, PdfGenerationResult> _results = new(StringComparer.Ordinal);

    public PdfGenerationResult? GetResult(string postUrl)
    {
        _results.TryGetValue(postUrl, out var result);
        return result;
    }

    public void SetResult(string postUrl, PdfGenerationResult result)
    {
        _results[postUrl] = result;
    }

    public bool HasResult(string postUrl) => _results.ContainsKey(postUrl);

    public IReadOnlyDictionary<string, PdfGenerationResult> AllResults =>
        new Dictionary<string, PdfGenerationResult>(_results);
}
