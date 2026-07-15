using BlazorStaticMinimalBlog.Models;

namespace Ren.Courses.Tests;

public class DiagramMarkerTests
{
    [Theory]
    [InlineData("<!-- diagram: key -->")]
    [InlineData("<!-- diagram: bfs-traversal -->")]
    [InlineData("  <!-- diagram: my-key -->")]
    [InlineData("\t<!-- diagram: key -->\t")]
    [InlineData("<!-- diagram: a -->")]
    public void MarkerLine_OwnLine_Matches(string line)
    {
        var keys = DiagramMarkers.FindReferencedKeys(line);
        Assert.NotEmpty(keys);
    }

    [Theory]
    [InlineData("some text <!-- diagram: key --> more text")]
    [InlineData("prefix<!-- diagram: key -->")]
    [InlineData("<!-- diagram: key -->suffix")]
    [InlineData("<!-- diagram: key --> trailing text")]
    public void MarkerLine_InlineInParagraph_Ignored(string line)
    {
        var keys = DiagramMarkers.FindReferencedKeys(line);
        Assert.Empty(keys);
    }

    [Theory]
    [InlineData("<!-- diagram: key -->\n", 1)]
    [InlineData("<!-- diagram: a -->\n<!-- diagram: b -->\n", 2)]
    [InlineData("<!-- diagram: same -->\n<!-- diagram: same -->\n", 1)] // deduped
    public void FindReferencedKeys_CountsCorrectly(string markdown, int expectedCount)
    {
        var keys = DiagramMarkers.FindReferencedKeys(markdown);
        Assert.Equal(expectedCount, keys.Count);
    }

    [Fact]
    public void FindReferencedKeys_WithCRLF_ToleratesCarriageReturn()
    {
        var keys = DiagramMarkers.FindReferencedKeys("<!-- diagram: k -->\r\n<!-- diagram: k -->\r\n");
        Assert.Single(keys);
        Assert.Contains("k", keys);
    }

    [Fact]
    public void FindReferencedKeys_NonMarkerComment_Ignored()
    {
        var markdown = "<!-- other comment -->\n<!-- diagram: key -->\n<!-- also not a marker -->";
        var keys = DiagramMarkers.FindReferencedKeys(markdown);
        Assert.Single(keys);
        Assert.Contains("key", keys);
    }

    [Theory]
    [InlineData("key")]
    [InlineData("bfs-traversal")]
    [InlineData("a")]
    [InlineData("a-b-c")]
    [InlineData("my-long-kebab-key-123")]
    public void KeyFormat_ValidKeys_Accepted(string key)
    {
        Assert.Matches(DiagramMarkers.KeyFormat, key);
    }

    [Theory]
    [InlineData("")]
    [InlineData("Uppercase")]
    [InlineData("has_underscore")]
    [InlineData("has space")]
    [InlineData("-starts-with-dash")]
    [InlineData("ends-with-dash-")]
    [InlineData("CamelCase")]
    [InlineData("UPPER")]
    public void KeyFormat_InvalidKeys_Rejected(string key)
    {
        Assert.DoesNotMatch(DiagramMarkers.KeyFormat, key);
    }

    [Fact]
    public void Substitute_ReplacesResolvedKeyInPlace()
    {
        var markdown = "Before\n<!-- diagram: k -->\nAfter";
        var result = DiagramMarkers.Substitute(markdown, key =>
            key == "k" ? "[DIAGRAM_SECTION]" : null);

        Assert.Equal("Before\n[DIAGRAM_SECTION]\nAfter", result);
    }

    [Fact]
    public void Substitute_DropsUnresolvedKey()
    {
        var markdown = "Before\n<!-- diagram: unknown -->\nAfter";
        var result = DiagramMarkers.Substitute(markdown, _ => null);

        Assert.Equal("Before\n\nAfter", result);
    }

    [Fact]
    public void Substitute_LeavesNonMarkerCommentsUntouched()
    {
        var markdown = "<!-- other -->\n<!-- diagram: k -->\n<!-- also other -->";
        var result = DiagramMarkers.Substitute(markdown, key =>
            key == "k" ? "[DIAGRAM]" : null);

        Assert.Equal("<!-- other -->\n[DIAGRAM]\n<!-- also other -->", result);
    }

    [Fact]
    public void Substitute_MultipleMarkers_EachResolvedIndependently()
    {
        var markdown = "<!-- diagram: a -->\nmid\n<!-- diagram: b -->";
        var result = DiagramMarkers.Substitute(markdown, key => key switch
        {
            "a" => "[A]",
            "b" => "[B]",
            _ => null
        });

        Assert.Equal("[A]\nmid\n[B]", result);
    }

    [Fact]
    public void ResolveSegments_NoMarkers_ReturnsSingleHtmlSegment()
    {
        var html = "<p>Hello World</p>";
        var segments = DiagramMarkers.ResolveSegments(html, []);
        Assert.Single(segments);
        Assert.Equal("<p>Hello World</p>", segments[0].Html);
        Assert.Null(segments[0].Diagram);
    }

    [Fact]
    public void ResolveSegments_EmptyHtml_ReturnsEmpty()
    {
        var segments = DiagramMarkers.ResolveSegments("", []);
        Assert.Empty(segments);
    }

    [Fact]
    public void ResolveSegments_UnknownKey_Omitted()
    {
        var html = "<p>Before</p>\n<!-- diagram: unknown -->\n<p>After</p>";
        var diagrams = new List<LearningDiagram>();
        var segments = DiagramMarkers.ResolveSegments(html, diagrams);

        Assert.Equal(2, segments.Count);
        Assert.Contains("Before", segments[0].Html);
        Assert.Null(segments[0].Diagram);
        Assert.Contains("After", segments[1].Html);
    }

    [Fact]
    public void ResolveSegments_SameKeyTwice_TwoInstancesWithDistinctIndices()
    {
        var html = "<!-- diagram: k -->\nmid\n<!-- diagram: k -->";
        var diagrams = new List<LearningDiagram>
        {
            new() { Key = "k", Title = "Diagram K", Steps = { new() { Title = "S1", Mermaid = "flowchart LR\n A-->B" } } }
        };

        var segments = DiagramMarkers.ResolveSegments(html, diagrams);

        var diagramsOnly = segments.Where(s => s.Diagram is not null).ToList();
        Assert.Equal(2, diagramsOnly.Count);
        Assert.Equal(0, diagramsOnly[0].DiagramIndex);
        Assert.Equal(1, diagramsOnly[1].DiagramIndex);
    }

    [Fact]
    public void ResolveSegments_DuplicateFrontmatterKey_FirstDiagramWins()
    {
        var html = "<!-- diagram: k -->";
        var diagrams = new List<LearningDiagram>
        {
            new() { Key = "k", Title = "First", Steps = { new() { Title = "S1", Mermaid = "flowchart LR\n A-->B" } } },
            new() { Key = "k", Title = "Second", Steps = { new() { Title = "S2", Mermaid = "flowchart LR\n C-->D" } } }
        };

        var segments = DiagramMarkers.ResolveSegments(html, diagrams);
        var d = Assert.Single(segments, s => s.Diagram is not null);
        Assert.Equal("First", d.Diagram!.Title);
    }

    [Fact]
    public void ResolveSegments_BlankKey_IgnoredInFirstWins()
    {
        var html = "<!-- diagram: k -->";
        var diagrams = new List<LearningDiagram>
        {
            new() { Key = "", Title = "No Key", Steps = { new() { Title = "S1", Mermaid = "flowchart LR\n A-->B" } } },
            new() { Key = "k", Title = "Has Key", Steps = { new() { Title = "S2", Mermaid = "flowchart LR\n C-->D" } } }
        };

        var segments = DiagramMarkers.ResolveSegments(html, diagrams);
        var d = Assert.Single(segments, s => s.Diagram is not null);
        Assert.Equal("Has Key", d.Diagram!.Title);
    }

    [Fact]
    public void ResolveSegments_HtmlOnlyBeforeMarker_CorrectOrdering()
    {
        var html = "<p>First</p>\n<!-- diagram: k -->\n<p>Second</p>";
        var diagrams = new List<LearningDiagram>
        {
            new() { Key = "k", Title = "D", Steps = { new() { Title = "S", Mermaid = "flowchart LR\n A-->B" } } }
        };

        var segments = DiagramMarkers.ResolveSegments(html, diagrams);
        Assert.Equal(3, segments.Count);
        Assert.Contains("First", segments[0].Html);
        Assert.Equal("D", segments[1].Diagram!.Title);
        Assert.Contains("Second", segments[2].Html);
    }

    [Fact]
    public void ResolveSegments_MarkerOnlyWithKey_NoHtmlSegmentsForEmptyGaps()
    {
        var html = "<!-- diagram: k -->";
        var diagrams = new List<LearningDiagram>
        {
            new() { Key = "k", Title = "Standalone", Steps = { new() { Title = "S", Mermaid = "flowchart LR\n A-->B" } } }
        };

        var segments = DiagramMarkers.ResolveSegments(html, diagrams);
        var d = Assert.Single(segments);
        Assert.Equal("Standalone", d.Diagram!.Title);
    }

    [Fact]
    public void ResolveSegments_NoReferencedDiagrams_StrictMode()
    {
        var html = "<p>Body</p>";
        var diagrams = new List<LearningDiagram>
        {
            new() { Key = "unreferenced", Title = "Unreferenced", Steps = { new() { Title = "S", Mermaid = "flowchart LR\n A-->B" } } }
        };

        var segments = DiagramMarkers.ResolveSegments(html, diagrams);
        // Only html segment — unreferenced diagram not rendered
        Assert.Single(segments);
        Assert.Equal("<p>Body</p>", segments[0].Html);
        Assert.Null(segments[0].Diagram);
    }
}
