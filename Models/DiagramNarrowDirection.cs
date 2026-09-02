using System.Text.RegularExpressions;
using RensMarkdownTemplates.Models;

namespace BlazorStaticMinimalBlog.Models;

/// <summary>
/// Single owner of the <c>narrowDirection</c> contract on the .NET side.
///
/// A diagram can name an author-approved vertical flow direction. The web
/// renderer applies it only when the canonical drawing cannot stay readable at
/// the available width. Generated PDFs always keep the canonical Mermaid
/// source, so this type never rewrites a definition. It only decides whether a
/// declared direction is usable.
///
/// The equivalent browser-side rules live in
/// <c>wwwroot/js/interactive-diagrams.js</c> (<c>rewriteFlowchartDirection</c>).
/// Keep <see cref="FlowchartDeclaration"/> and that regex in step.
/// </summary>
public static class DiagramNarrowDirection
{
    /// <summary>The only directions an author can request.</summary>
    public static readonly IReadOnlyList<string> Supported = ["TB", "BT"];

    /// <summary>
    /// A complete Mermaid flowchart or graph declaration on its own line, with
    /// an optional direction token and an optional trailing semicolon. Only
    /// such a line can carry a rewritten direction without disturbing the rest
    /// of the source.
    /// </summary>
    public static readonly Regex FlowchartDeclaration = new(
        @"^[ \t]*(?:flowchart|graph)(?:[ \t]+(?:TB|TD|BT|RL|LR))?[ \t]*;?[ \t]*$",
        RegexOptions.Multiline | RegexOptions.Compiled);

    /// <summary>True when the author asked for a direction the renderer supports.</summary>
    public static bool IsSupported(string? direction) =>
        direction is not null && Supported.Contains(direction, StringComparer.Ordinal);

    /// <summary>True when a Mermaid definition carries a rewritable flowchart declaration.</summary>
    public static bool CanReflow(string? mermaid) =>
        !string.IsNullOrWhiteSpace(mermaid) && FlowchartDeclaration.IsMatch(mermaid);

    /// <summary>
    /// Report every reason a declared narrow direction is unusable. An empty
    /// result means the diagram either declares no direction or declares one
    /// that every step can honour.
    /// </summary>
    public static IEnumerable<string> Validate(LearningDiagram diagram)
    {
        var direction = diagram.NarrowDirection;
        if (string.IsNullOrWhiteSpace(direction)) yield break;

        if (!IsSupported(direction))
        {
            yield return $"narrowDirection '{direction}' is not supported "
                + $"(use one of: {string.Join(", ", Supported)})";
            yield break;
        }

        for (var index = 0; index < diagram.Steps.Count; index++)
        {
            if (CanReflow(diagram.Steps[index].Mermaid)) continue;
            yield return $"step[{index}] '{diagram.Steps[index].Title}' declares narrowDirection "
                + $"'{direction}' but its Mermaid source has no flowchart or graph declaration";
        }
    }
}
