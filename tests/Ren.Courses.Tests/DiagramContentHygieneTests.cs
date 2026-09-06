using System.Text.RegularExpressions;
using BlazorStaticMinimalBlog.Models;
using RensMarkdownTemplates.Services;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace Ren.Courses.Tests;

/// <summary>
/// Content hygiene tests that scan real Content/Materials/*.md files.
/// These fail loudly on authoring errors while runtime stays graceful.
/// </summary>
public class DiagramContentHygieneTests
{
    private static string RepoRoot
    {
        get
        {
            for (var dir = new DirectoryInfo(AppContext.BaseDirectory);
                 dir is not null;
                 dir = dir.Parent)
            {
                var candidate = Path.Combine(dir.FullName, "Content", "Materials");
                if (Directory.Exists(candidate))
                    return dir.FullName;
            }
            throw new DirectoryNotFoundException("Cannot locate Content/Materials from repo root");
        }
    }

    [Fact]
    public void AllDiagrams_HaveValidUniqueKeys()
    {
        var violations = new List<string>();
        var files = Directory.GetFiles(
            Path.Combine(RepoRoot, "Content", "Materials"), "*.md", SearchOption.AllDirectories);

        var deser = new DeserializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();

        foreach (var file in files)
        {
            var raw = File.ReadAllText(file);
            var (fm, _) = PdfGeneratorService.ParseFrontMatter<CourseFrontMatter>(raw, deser);
            if (fm is null) continue;
            if (fm.Diagrams.Count == 0) continue;

            var keysSeen = new Dictionary<string, int>(StringComparer.Ordinal);
            for (int i = 0; i < fm.Diagrams.Count; i++)
            {
                var d = fm.Diagrams[i];
                if (d.Steps.Count == 0) continue; // No steps = no-op

                var key = d.Key;
                if (string.IsNullOrWhiteSpace(key))
                {
                    violations.Add($"{Path.GetFileName(file)}: diagram[{i}] '{d.Title}' has no key");
                }
                else if (!DiagramMarkers.KeyFormat.IsMatch(key))
                {
                    violations.Add($"{Path.GetFileName(file)}: diagram[{i}] key '{key}' is not valid kebab-case");
                }
                else if (keysSeen.TryGetValue(key, out var prevIdx))
                {
                    violations.Add($"{Path.GetFileName(file)}: duplicate key '{key}' at diagram[{i}] (first seen at diagram[{prevIdx}])");
                }
                else
                {
                    keysSeen[key] = i;
                }
            }
        }

        Assert.Empty(violations);
    }

    [Fact]
    public void AllBodyMarkers_ReferenceValidFrontmatterKey()
    {
        var violations = new List<string>();
        var files = Directory.GetFiles(
            Path.Combine(RepoRoot, "Content", "Materials"), "*.md", SearchOption.AllDirectories);

        var deser = new DeserializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();

        foreach (var file in files)
        {
            var raw = File.ReadAllText(file);
            var (fm, bodyStart) = PdfGeneratorService.ParseFrontMatter<CourseFrontMatter>(raw, deser);
            if (fm is null) continue;

            var body = bodyStart > 0 ? raw[bodyStart..] : "";
            var referencedKeys = DiagramMarkers.FindReferencedKeys(body);
            if (referencedKeys.Count == 0) continue;

            var declaredKeys = new HashSet<string>(
                fm.Diagrams.Where(d => !string.IsNullOrWhiteSpace(d.Key)).Select(d => d.Key),
                StringComparer.Ordinal);

            foreach (var key in referencedKeys)
            {
                if (!declaredKeys.Contains(key))
                    violations.Add($"{Path.GetFileName(file)}: marker references key '{key}' not declared in frontmatter");
            }
        }

        Assert.Empty(violations);
    }

    [Fact]
    public void AllDiagramsWithSteps_AreReferencedAtLeastOnce()
    {
        var violations = new List<string>();
        var files = Directory.GetFiles(
            Path.Combine(RepoRoot, "Content", "Materials"), "*.md", SearchOption.AllDirectories);

        var deser = new DeserializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();

        foreach (var file in files)
        {
            var raw = File.ReadAllText(file);
            var (fm, bodyStart) = PdfGeneratorService.ParseFrontMatter<CourseFrontMatter>(raw, deser);
            if (fm is null) continue;
            if (fm.Diagrams.Count == 0) continue;

            var body = bodyStart > 0 ? raw[bodyStart..] : "";
            var referencedKeys = DiagramMarkers.FindReferencedKeys(body);

            foreach (var d in fm.Diagrams)
            {
                if (d.Steps.Count == 0) continue;
                var key = d.Key;
                if (string.IsNullOrWhiteSpace(key)) continue; // Already flagged by AllDiagrams_HaveValidUniqueKeys

                if (!referencedKeys.Contains(key))
                    violations.Add($"{Path.GetFileName(file)}: diagram '{d.Title}' (key '{key}') has steps but is never referenced");
            }
        }

        Assert.Empty(violations);
    }

    [Fact]
    public void AllDiagrams_DeclareUsableNarrowDirections()
    {
        var violations = new List<string>();
        var files = Directory.GetFiles(
            Path.Combine(RepoRoot, "Content", "Materials"), "*.md", SearchOption.AllDirectories);

        var deser = new DeserializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();

        foreach (var file in files)
        {
            var raw = File.ReadAllText(file);
            var (fm, _) = PdfGeneratorService.ParseFrontMatter<CourseFrontMatter>(raw, deser);
            if (fm is null) continue;

            foreach (var d in fm.Diagrams)
            {
                foreach (var violation in DiagramNarrowDirection.Validate(d))
                    violations.Add($"{Path.GetFileName(file)}: diagram '{d.Title}': {violation}");
            }
        }

        Assert.Empty(violations);
    }

    // The cases below feed the same validation in-memory, so an invalid
    // direction is proved to fail without adding broken Markdown to Content.

    [Theory]
    [InlineData("LR")]
    [InlineData("RL")]
    [InlineData("TD")]
    [InlineData("tb")]
    [InlineData("diagonal")]
    public void UnsupportedNarrowDirection_IsAViolation(string direction)
    {
        var diagram = DiagramFixtures.WideTokenStream();
        diagram.NarrowDirection = direction;

        var violations = DiagramNarrowDirection.Validate(RoundTrip(diagram)).ToList();

        var violation = Assert.Single(violations);
        Assert.Contains($"narrowDirection '{direction}' is not supported", violation, StringComparison.Ordinal);
    }

    [Fact]
    public void NarrowDirectionOnNonFlowchartSteps_IsAViolationPerStep()
    {
        var diagram = DiagramFixtures.WideSequenceDiagram();

        var violations = DiagramNarrowDirection.Validate(RoundTrip(diagram)).ToList();

        Assert.Equal(diagram.Steps.Count, violations.Count);
        Assert.All(violations, violation =>
            Assert.Contains("no flowchart or graph declaration", violation, StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("TB")]
    [InlineData("BT")]
    public void SupportedNarrowDirectionOnFlowcharts_PassesValidation(string direction)
    {
        var diagram = DiagramFixtures.WideTokenStream();
        diagram.NarrowDirection = direction;

        Assert.Empty(DiagramNarrowDirection.Validate(RoundTrip(diagram)));
    }

    [Fact]
    public void DiagramWithoutNarrowDirection_PassesValidation()
    {
        Assert.Empty(DiagramNarrowDirection.Validate(
            RoundTrip(DiagramFixtures.WideFlowchartWithoutReflow())));
    }

    [Fact]
    public void EphemeralPost_RoundTripsNarrowDirection()
    {
        var diagram = DiagramFixtures.WideTokenStream();
        var post = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
        {
            Title = "Round trip",
            Published = new DateTime(2026, 3, 1),
            Diagrams = [diagram]
        });

        Assert.Contains("narrowDirection: TB", post.RawMarkdown, StringComparison.Ordinal);
        var parsed = Assert.Single(post.FrontMatter.Diagrams);
        Assert.Equal("TB", parsed.NarrowDirection);
        // The canonical source survives untouched; PDF generation reads this.
        Assert.Equal(diagram.Steps[0].Mermaid, parsed.Steps[0].Mermaid);
        Assert.StartsWith("flowchart LR", parsed.Steps[0].Mermaid, StringComparison.Ordinal);
    }

    /// <summary>Validate what YAML deserialization actually produces, not the in-code object.</summary>
    private static RensMarkdownTemplates.Models.LearningDiagram RoundTrip(
        RensMarkdownTemplates.Models.LearningDiagram diagram)
    {
        var post = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
        {
            Title = "Hygiene fixture",
            Published = new DateTime(2026, 3, 1),
            Diagrams = [diagram]
        });

        return post.FrontMatter.Diagrams.Single();
    }

    [Fact]
    public void NoDiagramSource_UsesReservedSentinelRange()
    {
        // The browser renderer reserves #100000-#10FFFF as sentinel colours that
        // become var(--dg-*) references. An author hex inside that range would be
        // rewritten into a CSS variable. See README "Custom themes".
        var violations = new List<string>();
        var files = Directory.GetFiles(
            Path.Combine(RepoRoot, "Content", "Materials"), "*.md", SearchOption.AllDirectories);

        var deser = new DeserializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();

        foreach (var file in files)
        {
            var raw = File.ReadAllText(file);
            var (fm, _) = PdfGeneratorService.ParseFrontMatter<CourseFrontMatter>(raw, deser);
            if (fm is null) continue;

            foreach (var d in fm.Diagrams)
            {
                foreach (var step in d.Steps)
                {
                    foreach (System.Text.RegularExpressions.Match m in Regex.Matches(step.Mermaid ?? "", @"#[0-9a-fA-F]{6}\b"))
                    {
                        var hex = m.Value;
                        if (hex[1] == '1' && hex[2] == '0' && IsHexInReservedRange(hex))
                            violations.Add($"{Path.GetFileName(file)}: diagram '{d.Title}' step '{step.Title}' uses reserved sentinel colour {hex}");
                    }
                }
            }
        }

        Assert.Empty(violations);
    }

    private static bool IsHexInReservedRange(string hex)
    {
        // Reserved: #100000-#10FFFF inclusive.
        if (!int.TryParse(hex.Substring(1), System.Globalization.NumberStyles.HexNumber, null, out var value))
            return false;
        return value >= 0x100000 && value <= 0x10FFFF;
    }
}
