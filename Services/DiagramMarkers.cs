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

    // --- Fence-aware scanning ---

    /// <summary>
    /// Returns (contentStart, contentEnd) ranges for fenced code blocks (``` and ~~~).
    /// Markers inside these ranges are ignored by FindReferencedKeys and Substitute.
    /// </summary>
    internal static List<(int start, int end)> GetFencedRanges(string text)
    {
        var ranges = new List<(int, int)>();
        // Match opening/closing fences: ```+ or ~~~+ at start of line, optional info string on opener
        var fenceLine = new Regex(@"^(?<fence>```+|~~~+)\s*$", RegexOptions.Multiline);

        var fences = new List<(int index, int length, char type)>();
        foreach (Match m in fenceLine.Matches(text))
        {
            var fenceStr = m.Groups["fence"].Value;
            fences.Add((m.Index, fenceStr.Length, fenceStr[0]));
        }

        // Greedy pair matching
        for (int i = 0; i < fences.Count; i++)
        {
            var opener = fences[i];
            for (int j = i + 1; j < fences.Count; j++)
            {
                var closer = fences[j];
                if (closer.type == opener.type && closer.length >= opener.length)
                {
                    var openerLineEnd = text.IndexOf('\n', opener.index);
                    if (openerLineEnd < 0) openerLineEnd = text.Length - 1;
                    var contentStart = openerLineEnd + 1;
                    ranges.Add((contentStart, closer.index));
                    i = j; // skip past this pair
                    break;
                }
            }
        }

        return ranges;
    }

    private static bool IsInFencedRange(int index, List<(int start, int end)> ranges)
    {
        foreach (var (start, end) in ranges)
        {
            if (index >= start && index < end)
                return true;
        }
        return false;
    }

    // PDF path: distinct keys referenced in a body (outside fenced code blocks).
    public static HashSet<string> FindReferencedKeys(string markdown)
    {
        var keys = new HashSet<string>(StringComparer.Ordinal);
        var fencedRanges = GetFencedRanges(markdown);
        foreach (Match m in MarkerLine.Matches(markdown))
        {
            if (IsInFencedRange(m.Index, fencedRanges)) continue;
            keys.Add(m.Groups["key"].Value);
        }
        return keys;
    }

    // PDF path: replace each marker line with resolve(key); null result drops the marker line.
    // Markers inside fenced code blocks are left untouched.
    public static string Substitute(string markdown, Func<string, string?> resolve)
    {
        var fencedRanges = GetFencedRanges(markdown);
        return MarkerLine.Replace(markdown, m =>
        {
            if (IsInFencedRange(m.Index, fencedRanges)) return m.Value;
            var key = m.Groups["key"].Value;
            var replacement = resolve(key);
            return replacement ?? "";
        });
    }

    // Web path: resolve rendered HTML into alternating html / diagram segments.
    // Unknown keys silently omitted. Same key twice => two instances with distinct
    // sequential DiagramIndex (global counter). Duplicate frontmatter keys: first wins.
    public sealed record BodySegment(string? Html, LearningDiagram? Diagram, int DiagramIndex);

    public static List<BodySegment> ResolveSegments(string html, IReadOnlyList<LearningDiagram> diagrams)
    {
        var segments = new List<BodySegment>();
        var usedKeys = new Dictionary<string, LearningDiagram>(StringComparer.Ordinal);
        var globalIndex = 0;

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
                segments.Add(new BodySegment(null, diagram, globalIndex));
                globalIndex++;
            }
            // Unknown keys: silently omitted (no segment emitted)

            lastIndex = m.Index + m.Length;
        }

        // Emit remaining html after last marker
        if (lastIndex < html.Length)
            segments.Add(new BodySegment(html[lastIndex..], null, 0));

        return segments;
    }

    /// <summary>
    /// Returns keys that appear more than once across diagrams with non-blank keys.
    /// Used by callers to emit one warning per duplicate; CI backstop is hygiene test.
    /// </summary>
    public static HashSet<string> FindDuplicateKeys(IReadOnlyList<LearningDiagram> diagrams)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var duplicates = new HashSet<string>(StringComparer.Ordinal);
        foreach (var d in diagrams)
        {
            if (!string.IsNullOrWhiteSpace(d.Key) && !seen.Add(d.Key))
                duplicates.Add(d.Key);
        }
        return duplicates;
    }
}
