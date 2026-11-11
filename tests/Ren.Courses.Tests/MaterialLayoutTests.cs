using BlazorStatic;
using BlazorStatic.Services;
using BlazorStaticMinimalBlog.Models;
using BlazorStaticMinimalBlog.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace Ren.Courses.Tests;

public class MaterialLayoutTests
{
    [Theory]
    [InlineData("cmsc-124-lab0", "cmsc-124-lab0")]
    [InlineData("cmsc-124/lab0/cmsc-124-lab0", "cmsc-124-lab0")]
    [InlineData("cmsc-124/lab0", "lab0")]
    public void ParsedUrlSlug_ReturnsTheLastSegment(string url, string expected)
    {
        Assert.Equal(expected, MaterialLayout.ParsedUrlSlug(url));
    }

    [Fact]
    public void Normalize_RewritesANestedPostUrlAndItsPage()
    {
        var (service, contentService) = CreateServices();
        contentService.Posts.Add(MakePost("cmsc-124/lab0/cmsc-124-lab0"));
        service.Options.PagesToGenerate.Add(Page("articles/cmsc-124/lab0/cmsc-124-lab0"));
        service.Options.PagesToGenerate.Add(Page("materials"));
        using var temp = new TempDir();

        MaterialLayout.Normalize(service, contentService, temp.Path);

        Assert.Equal("cmsc-124-lab0", Assert.Single(contentService.Posts).Url);
        var article = Assert.Single(service.Options.PagesToGenerate,
            page => page.Url.StartsWith("articles/", StringComparison.Ordinal));
        Assert.Equal("articles/cmsc-124-lab0", article.Url);
        Assert.Equal(Path.Combine("articles", "cmsc-124-lab0.html"), article.OutputFile);
        Assert.Contains(service.Options.PagesToGenerate, page => page.Url == "materials");
    }

    [Fact]
    public void Normalize_PublishesMediaBesideANestedMaterial()
    {
        using var temp = new TempDir();
        var materials = Path.Combine(temp.Path, "Materials");
        var media = Path.Combine(materials, "cmsc-124", "lab0", "media");
        Directory.CreateDirectory(media);
        var image = Path.Combine(media, "figure-1.png");
        File.WriteAllBytes(image, [0x89, 0x50, 0x4E, 0x47]);

        var (service, contentService) = CreateServices();
        var post = MakePost("cmsc-124/lab0/cmsc-124-lab0");
        post.HtmlContent = $"<p><img src=\"{image.Replace('\\', '/')}\" alt=\"figure\"></p>";
        contentService.Posts.Add(post);
        service.Options.PagesToGenerate.Add(Page("articles/cmsc-124/lab0/cmsc-124-lab0"));
        service.Options.ContentToCopyToOutput.Add(new ContentToCopy(media, media));

        MaterialLayout.Normalize(service, contentService, materials);

        var copy = Assert.Single(service.Options.ContentToCopyToOutput);
        Assert.Equal("Content/Materials/cmsc-124/lab0/media", copy.TargetPath);
        Assert.Contains(
            "src=\"Content/Materials/cmsc-124/lab0/media/figure-1.png\"",
            post.HtmlContent);
    }

    [Fact]
    public void Normalize_LeavesAFlatMaterialAndItsPageAlone()
    {
        var (service, contentService) = CreateServices();
        var post = MakePost("cmsc-124-lab0");
        contentService.Posts.Add(post);
        var page = Page("articles/cmsc-124-lab0");
        service.Options.PagesToGenerate.Add(page);
        using var temp = new TempDir();

        MaterialLayout.Normalize(service, contentService, temp.Path);

        Assert.Equal("cmsc-124-lab0", post.Url);
        Assert.Same(page, Assert.Single(service.Options.PagesToGenerate));
        Assert.Empty(service.Options.ContentToCopyToOutput);
    }

    [Fact]
    public void ValidateUniqueSlugs_NamesBothPaths()
    {
        using var temp = new TempDir();
        var first = Path.Combine(temp.Path, "cmsc-124", "lab0", "lesson.md");
        var second = Path.Combine(temp.Path, "cmsc-124", "lab1", "lesson.md");
        Directory.CreateDirectory(Path.GetDirectoryName(first)!);
        Directory.CreateDirectory(Path.GetDirectoryName(second)!);
        File.WriteAllText(first, "---\ntitle: First\n---\n");
        File.WriteAllText(second, "---\ntitle: Second\n---\n");

        var exception = Assert.Throws<InvalidOperationException>(
            () => MaterialLayout.ValidateUniqueSlugs(temp.Path));

        Assert.Contains(first, exception.Message);
        Assert.Contains(second, exception.Message);
    }

    [Fact]
    public void ValidateUniqueSlugs_AllowsDifferentFileNames()
    {
        using var temp = new TempDir();
        var first = Path.Combine(temp.Path, "one", "lesson.md");
        var second = Path.Combine(temp.Path, "two", "reading.md");
        Directory.CreateDirectory(Path.GetDirectoryName(first)!);
        Directory.CreateDirectory(Path.GetDirectoryName(second)!);
        File.WriteAllText(first, "---\ntitle: First\n---\n");
        File.WriteAllText(second, "---\ntitle: Second\n---\n");

        var exception = Record.Exception(() => MaterialLayout.ValidateUniqueSlugs(temp.Path));

        Assert.Null(exception);
    }

    [Fact]
    public void ValidateUniqueSlugs_RejectsCaseOnlyCollision()
    {
        using var temp = new TempDir();
        var first = Path.Combine(temp.Path, "one", "Lesson.md");
        var second = Path.Combine(temp.Path, "two", "lesson.md");
        WriteMaterial(first);
        WriteMaterial(second);

        var exception = Assert.Throws<InvalidOperationException>(
            () => MaterialLayout.ValidateUniqueSlugs(temp.Path));

        Assert.Contains(first, exception.Message);
        Assert.Contains(second, exception.Message);
    }

    [Fact]
    public void ValidateUniqueSlugs_RejectsFlatAgainstNested()
    {
        using var temp = new TempDir();
        var first = Path.Combine(temp.Path, "lesson.md");
        var second = Path.Combine(temp.Path, "one", "lesson.md");
        WriteMaterial(first);
        WriteMaterial(second);

        var exception = Assert.Throws<InvalidOperationException>(
            () => MaterialLayout.ValidateUniqueSlugs(temp.Path));

        Assert.Contains(first, exception.Message);
        Assert.Contains(second, exception.Message);
    }

    [Fact]
    public void ValidateUniqueSlugs_RejectsNormalizedPdfNameCollision()
    {
        using var temp = new TempDir();
        var first = Path.Combine(temp.Path, "lesson.md");
        var second = Path.Combine(temp.Path, "-lesson.md");
        WriteMaterial(first);
        WriteMaterial(second);

        var exception = Assert.Throws<InvalidOperationException>(
            () => MaterialLayout.ValidateUniqueSlugs(temp.Path));

        Assert.Contains(first, exception.Message);
        Assert.Contains(second, exception.Message);
    }

    [Fact]
    public void ValidateUniqueSlugs_RejectsTheReviewerPair()
    {
        using var temp = new TempDir();
        var safe = Path.Combine(temp.Path, "one", "lesson.md");
        var unsafePath = Path.Combine(temp.Path, "two", "lesson .md");
        WriteMaterial(safe);
        WriteMaterial(unsafePath);

        var exception = Assert.Throws<InvalidOperationException>(
            () => MaterialLayout.ValidateUniqueSlugs(temp.Path));

        Assert.Contains(unsafePath, exception.Message);
        Assert.Contains("allowed", exception.Message);
    }

    [Fact]
    public void ValidateUniqueSlugs_RejectsTheHtmlAliasPair()
    {
        using var temp = new TempDir();
        var safe = Path.Combine(temp.Path, "one", "lesson.md");
        var unsafePath = Path.Combine(temp.Path, "two", "lesson.html.md");
        WriteMaterial(safe);
        WriteMaterial(unsafePath);

        var exception = Assert.Throws<InvalidOperationException>(
            () => MaterialLayout.ValidateUniqueSlugs(temp.Path));

        Assert.Contains(unsafePath, exception.Message);
        Assert.Contains("lesson.html", exception.Message);
        Assert.Contains("allowed", exception.Message);
    }

    [Fact]
    public void ValidateUniqueSlugs_RejectsALoneHtmlAlias()
    {
        using var temp = new TempDir();
        var file = Path.Combine(temp.Path, "lesson.html.md");
        WriteMaterial(file);

        var exception = Assert.Throws<InvalidOperationException>(
            () => MaterialLayout.ValidateUniqueSlugs(temp.Path));

        Assert.Contains(file, exception.Message);
        Assert.Contains("lesson.html", exception.Message);
        Assert.Contains("allowed", exception.Message);
    }

    [Fact]
    public void ValidateUniqueSlugs_RejectsALoneTrailingSpace()
    {
        using var temp = new TempDir();
        var file = Path.Combine(temp.Path, "lesson .md");
        WriteMaterial(file);

        var exception = Assert.Throws<InvalidOperationException>(
            () => MaterialLayout.ValidateUniqueSlugs(temp.Path));

        Assert.Contains(file, exception.Message);
        Assert.Contains("allowed", exception.Message);
    }

    [Fact]
    public void ValidateUniqueSlugs_RejectsAHashInTheName()
    {
        using var temp = new TempDir();
        var file = Path.Combine(temp.Path, "a#b.md");
        WriteMaterial(file);

        var exception = Assert.Throws<InvalidOperationException>(
            () => MaterialLayout.ValidateUniqueSlugs(temp.Path));

        Assert.Contains(file, exception.Message);
        Assert.Contains("allowed", exception.Message);
    }

    [Theory]
    [InlineData("", "allowed")]
    [InlineData("lesson ", "allowed")]
    [InlineData(" lesson", "allowed")]
    [InlineData("a\tb", "allowed")]
    [InlineData("a#b", "allowed")]
    [InlineData("a?b", "allowed")]
    [InlineData(@"a\b", "allowed")]
    [InlineData("a/b", "allowed")]
    [InlineData("a%2Fb", "allowed")]
    [InlineData("lesson.html", "allowed")]
    [InlineData("lesson\n", "allowed")]
    [InlineData("lesson\r\n", "allowed")]
    [InlineData("a%b", "allowed")]
    [InlineData("a.b", "allowed")]
    [InlineData("a b", "allowed")]
    [InlineData("café", "allowed")]
    public void UrlSlugProblem_RejectsUnsafeSlugs(string slug, string reason)
    {
        var problem = MaterialLayout.UrlSlugProblem(slug);

        Assert.NotNull(problem);
        Assert.Contains(reason, problem);
        Assert.Contains("letters, digits", problem);
    }

    [Theory]
    [InlineData("lesson")]
    [InlineData("Lesson")]
    [InlineData("lesson_plan")]
    [InlineData("lesson-plan")]
    [InlineData("a1")]
    public void UrlSlugProblem_AcceptsSafeSlugs(string slug)
    {
        Assert.Null(MaterialLayout.UrlSlugProblem(slug));
    }

    [Theory]
    [InlineData("lesson.md")]
    [InlineData("lesson_plan.md")]
    [InlineData("course/index/index.md")]
    [InlineData("course/index.md")]
    [InlineData("Lesson.md")]
    [InlineData("-lesson-.md")]
    [InlineData("course/lab/lesson.md")]
    public void ValidateUniqueSlugs_AcceptsSafePaths(string relativePath)
    {
        using var temp = new TempDir();
        WriteMaterial(Path.Combine(temp.Path,
            relativePath.Replace('/', Path.DirectorySeparatorChar)));

        var exception = Record.Exception(
            () => MaterialLayout.ValidateUniqueSlugs(temp.Path));

        Assert.Null(exception);
    }

    [MaterialDepotFact]
    public void ValidateUniqueSlugs_AcceptsEveryRealMaterial()
    {
        var materials = Path.Combine(RepoPaths.Root, "Content", "Materials");
        var files = Directory
            .EnumerateFiles(materials, "*.md", SearchOption.AllDirectories)
            .ToList();

        Assert.NotEmpty(files);
        var exception = Record.Exception(
            () => MaterialLayout.ValidateUniqueSlugs(materials));

        Assert.Null(exception);
    }

    [Fact]
    public void ValidateUniqueSlugs_AcceptsACorpusOfAnotherSize()
    {
        using var temp = new TempDir();
        WriteMaterial(Path.Combine(temp.Path, "one.md"));
        WriteMaterial(Path.Combine(temp.Path, "two.md"));
        WriteMaterial(Path.Combine(temp.Path, "three.md"));

        var exception = Record.Exception(
            () => MaterialLayout.ValidateUniqueSlugs(temp.Path));

        Assert.Null(exception);
    }

    [Fact]
    public void Normalize_PublishesMediaForACourseIndexFile()
    {
        using var temp = new TempDir();
        var materials = Path.Combine(temp.Path, "Materials");
        var media = Path.Combine(materials, "course", "media");
        Directory.CreateDirectory(media);
        var image = Path.Combine(media, "figure-1.png");
        File.WriteAllBytes(image, [0x89, 0x50, 0x4E, 0x47]);

        var (service, contentService) = CreateServices();
        var post = MakePost("course");
        post.HtmlContent = $"<p><img src=\"{image.Replace('\\', '/')}\" alt=\"figure\"></p>";
        contentService.Posts.Add(post);
        service.Options.PagesToGenerate.Add(Page("articles/course"));
        service.Options.ContentToCopyToOutput.Add(new ContentToCopy(media, media));

        MaterialLayout.Normalize(service, contentService, materials);

        Assert.Contains(
            "src=\"Content/Materials/course/media/figure-1.png\"",
            post.HtmlContent);
        var copy = Assert.Single(service.Options.ContentToCopyToOutput);
        Assert.Equal("Content/Materials/course/media", copy.TargetPath);
    }

    private static void WriteMaterial(string path)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, "---\ntitle: Test\n---\n");
    }

    private static (BlazorStaticService Service, BlazorStaticContentService<CourseFrontMatter> Content)
        CreateServices()
    {
        var options = new BlazorStaticOptions();
        var helpers = new BlazorStaticHelpers(options, NullLogger<BlazorStaticHelpers>.Instance);
        var service = new BlazorStaticService(options, helpers, NullLogger<BlazorStaticService>.Instance);
        var contentOptions = new BlazorStaticContentOptions<CourseFrontMatter>
        {
            PageUrl = "articles",
            ContentPath = "Content/Materials"
        };
        var content = new BlazorStaticContentService<CourseFrontMatter>(
            contentOptions, helpers, service,
            NullLogger<BlazorStaticContentService<CourseFrontMatter>>.Instance);
        return (service, content);
    }

    private static Post<CourseFrontMatter> MakePost(string url) => new()
    {
        FrontMatter = new CourseFrontMatter
        {
            Title = url,
            Published = new DateTime(2026, 3, 1),
            Tags = new List<string> { "fixture-course-a" }
        },
        Url = url,
        HtmlContent = "<p>body</p>"
    };

    private static PageToGenerate Page(string url) =>
        new(url, Path.Combine(url, "index.html"));

    private sealed class TempDir : IDisposable
    {
        internal TempDir()
        {
            Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(),
                $"ren-courses-material-layout-{Guid.NewGuid():N}");
            Directory.CreateDirectory(Path);
        }

        internal string Path { get; }

        public void Dispose()
        {
            if (Directory.Exists(Path)) Directory.Delete(Path, recursive: true);
        }
    }
}
