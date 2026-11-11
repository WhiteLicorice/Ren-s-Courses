using System.Text.Json;
using BlazorStatic;
using BlazorStatic.Services;
using BlazorStaticMinimalBlog.Models;
using BlazorStaticMinimalBlog.Services;
using Microsoft.Extensions.Logging.Abstractions;
using RensMarkdownTemplates.Services;

namespace Ren.Courses.Tests;

[Collection("BuildTimeProvider")]
public class MaterialLayoutIntegrationTests
{
    [Fact]
    public async Task ParsedUrlsAgreeWithRawPathRules()
    {
        var expected = LoadExpectedSlugs();

        foreach (var (raw, slug) in expected)
        {
            using var temp = new TempDir();
            var materials = Path.Combine(temp.Path, "Materials");
            WriteMaterial(materials, raw);

            var (service, content) = await ParseAsync(materials);

            var post = Assert.Single(content.Posts, p => p.FrontMatter.Title == raw);
            Assert.Equal(slug, post.Url);
            Assert.Contains(service.Options.PagesToGenerate,
                page => page.Url == $"articles/{slug}");
            Assert.Equal(slug, MaterialLayout.RawPathSlug(raw));
            Assert.Equal(slug, PdfGeneratorService.MaterialRouteUrlFor(raw));
            Assert.Equal(slug, PdfGeneratorService.MaterialSlugFor(raw));
            // The feed reads the same table in test_generate_feed.py.
            Assert.Equal(slug, expected[raw]);
        }
    }

    [Fact]
    public async Task RepeatedIndexAndCourseRootDoNotCollide()
    {
        using var temp = new TempDir();
        var materials = Path.Combine(temp.Path, "Materials");
        WriteMaterial(materials, "course/index/index");
        WriteMaterial(materials, "course");

        var (service, content) = await ParseAsync(materials);

        var nested = Assert.Single(content.Posts,
            p => p.FrontMatter.Title == "course/index/index");
        var flat = Assert.Single(content.Posts, p => p.FrontMatter.Title == "course");

        Assert.Equal("index", nested.Url);
        Assert.Equal("course", flat.Url);
        Assert.Contains(service.Options.PagesToGenerate,
            page => page.Url == "articles/index");
        Assert.Contains(service.Options.PagesToGenerate,
            page => page.Url == "articles/course");
        Assert.Equal("index", PdfGeneratorService.MaterialRouteUrlFor("course/index/index"));
        Assert.Equal("index", PdfGeneratorService.MaterialSlugFor("course/index/index"));
        Assert.Equal("course", PdfGeneratorService.MaterialRouteUrlFor("course"));
        Assert.Equal("course", PdfGeneratorService.MaterialSlugFor("course"));
    }

    private static Dictionary<string, string> LoadExpectedSlugs() =>
        JsonSerializer.Deserialize<Dictionary<string, string>>(
            File.ReadAllText(Path.Combine(
                RepoPaths.Root, "tests", "fixtures", "material-slugs.json")))!;

    private static void WriteMaterial(string materials, string raw)
    {
        var file = Path.Combine(materials,
            raw.Replace('/', Path.DirectorySeparatorChar) + ".md");
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        File.WriteAllText(file,
            $"---\ntitle: {raw}\npublished: 2026-03-01\ntags: [fixture-course-a]\n---\n\nBody\n");
    }

    private static async Task<(BlazorStaticService Service,
        BlazorStaticContentService<CourseFrontMatter> Content)> ParseAsync(string materials)
    {
        var options = new BlazorStaticOptions();
        var helpers = new BlazorStaticHelpers(options, NullLogger<BlazorStaticHelpers>.Instance);
        var service = new BlazorStaticService(options, helpers, NullLogger<BlazorStaticService>.Instance);
        var contentOptions = new BlazorStaticContentOptions<CourseFrontMatter>
        {
            PageUrl = "articles",
            ContentPath = materials,
            AfterContentParsedAndAddedAction = (svc, content) =>
                WebsiteKeys.PrepareArticlePages(svc, content, materials)
        };
        var content = new BlazorStaticContentService<CourseFrontMatter>(
            contentOptions, helpers, service,
            NullLogger<BlazorStaticContentService<CourseFrontMatter>>.Instance);

        await content.ParseAndAddPosts();
        return (service, content);
    }

    private sealed class TempDir : IDisposable
    {
        internal TempDir()
        {
            Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(),
                $"ren-courses-material-integration-{Guid.NewGuid():N}");
            Directory.CreateDirectory(Path);
        }

        internal string Path { get; }

        public void Dispose()
        {
            if (Directory.Exists(Path)) Directory.Delete(Path, recursive: true);
        }
    }
}
