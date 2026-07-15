using System.Text.RegularExpressions;
using BlazorStaticMinimalBlog.Models;

namespace BlazorStaticMinimalBlog.Services;

public static class DiagramMarkers
{
    // Own-line only; tolerant of horizontal whitespace and CRLF. Keys: kebab-case.
    private static readonly Regex MarkerLine = new(
        @"^[ \t]*<!--\s*diagram:\s*(?<key>[a-z0-9]+(?:-[a-z0-9]+)*)\s*-->[ \t]*\r?$",
        RegexOptions.Multiline | RegexOptions.Compiled);

    public static readonly Regex KeyFormat =
        new(@"^[a-z0-9]+(?:-[a-z0-9]+)*$", RegexOptions.Compiled);

    // PDF path: distinct keys referenced in a body.
    public static HashSet<string> FindReferencedKeys(string markdown)
    {
        var keys = new HashSet<string>(StringComparer.Ordinal);
        foreach (Match m in MarkerLine.Matches(markdown))
            keys.Add(m.Groups["key"].Value);
        return keys;
    }

    // PDF path: replace each marker line with resolve(key); null result drops the marker line.
    public static string Substitute(string markdown, Func<string, string?> resolve)
    {
        return MarkerLine.Replace(markdown, m =>
        {
            var key = m.Groups["key"].Value;
            var replacement = resolve(key);
            return replacement ?? "";
        });
    }

    // Web path: resolve rendered HTML into alternating html / diagram segments.
    // Unknown keys silently omitted. Same key twice => two instances with distinct
    // sequential DiagramIndex. Duplicate frontmatter keys: first diagram wins.
    public sealed record BodySegment(string? Html, LearningDiagram? Diagram, int DiagramIndex);

    public static List<BodySegment> ResolveSegments(string html, IReadOnlyList<LearningDiagram> diagrams)
    {
        var segments = new List<BodySegment>();
        var usedKeys = new Dictionary<string, LearningDiagram>(StringComparer.Ordinal);
        var keyCounts = new Dictionary<string, int>(StringComparer.Ordinal);

        // Build first-wins lookup
        foreach (var d in diagrams)
        {
            if (!string.IsNullOrWhiteSpace(d.Key) && !usedKeys.ContainsKey(d.Key))
                usedKeys[d.Key] = d;
        }

        var lastIndex = 0;
        foreach (Match m in MarkerLine.Matches(html))
        {
            var key = m.Groups["key"].Value;

            // Emit html segment for text before this marker
            var before = html[lastIndex..m.Index];
            if (before.Length > 0)
                segments.Add(new BodySegment(before, null, 0));

            // Emit diagram segment if key is known
            if (usedKeys.TryGetValue(key, out var diagram))
            {
                keyCounts.TryGetValue(key, out var count);
                segments.Add(new BodySegment(null, diagram, count));
                keyCounts[key] = count + 1;
            }
            // Unknown keys: silently omitted (no segment emitted)

            lastIndex = m.Index + m.Length;
        }

        // Emit remaining html after last marker
        if (lastIndex < html.Length)
            segments.Add(new BodySegment(html[lastIndex..], null, 0));

        return segments;
    }
}
