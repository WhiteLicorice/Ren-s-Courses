using System.Text.RegularExpressions;
using BlazorStaticMinimalBlog.Models;
using BlazorStaticMinimalBlog.Services;
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
}
