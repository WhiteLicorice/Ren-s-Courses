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
    /// Uses CommonMark line-based state machine: labeled fences (```csharp), indented
    /// fences (≤3 spaces), tilde fences, and unclosed fences are all handled correctly.
    /// Markers inside these ranges are ignored by FindReferencedKeys and Substitute.
    /// </summary>
    internal static List<(int start, int end)> GetFencedRanges(string text)
    {
        var ranges = new List<(int, int)>();
        int pos = 0;
        bool inFence = false;
        char fenceChar = '\0';
        int fenceLen = 0;
        int contentStart = 0;

        while (pos < text.Length)
        {
            int lineEnd = text.IndexOf('\n', pos);
            int lineLen = (lineEnd >= 0 ? lineEnd : text.Length) - pos;

            // Exclude \r from line content for CRLF
            int contentLen = lineLen;
            if (contentLen > 0 && text[pos + contentLen - 1] == '\r')
                contentLen--;

            var line = text.AsSpan(pos, contentLen);

            int indent = 0;
            while (indent < line.Length && (line[indent] == ' ' || line[indent] == '\t'))
                indent++;

            if (!inFence)
            {
                if (indent <= 3 && line.Length - indent >= 3)
                {
                    char c = line[indent];
                    if (c == '`' || c == '~')
                    {
                        int runLen = 0;
                        while (indent + runLen < line.Length && line[indent + runLen] == c)
                            runLen++;

                        if (runLen >= 3 && IsValidFenceOpener(line, indent, runLen, c))
                        {
                            inFence = true;
                            fenceChar = c;
                            fenceLen = runLen;
                            contentStart = (lineEnd >= 0) ? lineEnd + 1 : text.Length;
                        }
                    }
                }
            }
            else
            {
                if (indent <= 3 && line.Length - indent >= fenceLen && line[indent] == fenceChar)
                {
                    if (IsFenceCloser(line, indent, fenceChar, fenceLen))
                    {
                        ranges.Add((contentStart, pos));
                        inFence = false;
                    }
                }
            }

            pos = (lineEnd >= 0) ? lineEnd + 1 : text.Length;
        }

        if (inFence)
            ranges.Add((contentStart, text.Length));

        return ranges;
    }

    private static bool IsValidFenceOpener(ReadOnlySpan<char> line, int indent, int runLen, char c)
    {
        if (c == '~')
        {
            // Tilde fences: rest of line must be whitespace only (no info string in CommonMark)
            for (int i = indent + runLen; i < line.Length; i++)
            {
                if (line[i] != ' ' && line[i] != '\t') return false;
            }
            return true;
        }
        // Backtick fences: info string allowed, but must not contain backticks
        for (int i = indent + runLen; i < line.Length; i++)
        {
            if (line[i] == '`') return false;
        }
        return true;
    }

    private static bool IsFenceCloser(ReadOnlySpan<char> line, int indent, char fenceChar, int minLen)
    {
        int runLen = 0;
        while (indent + runLen < line.Length && line[indent + runLen] == fenceChar)
            runLen++;
        if (runLen < minLen) return false;
        // Rest of line must be whitespace only
        for (int i = indent + runLen; i < line.Length; i++)
        {
            if (line[i] != ' ' && line[i] != '\t') return false;
        }
        return true;
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
