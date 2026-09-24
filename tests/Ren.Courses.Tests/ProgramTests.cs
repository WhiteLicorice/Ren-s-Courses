namespace Ren.Courses.Tests;

public class ProgramTests
{
    [Fact]
    public void ResolveProductionOutputPath_returns_only_the_output_child()
    {
        using var fixture = new OutputFixture();

        var outputPath = ResolveProductionOutputPath(fixture.Root);

        Assert.Equal(Path.Combine(fixture.Root, "output"), outputPath);
    }

    [Fact]
    public void ResolveProductionOutputPath_rejects_drive_and_output_roots()
    {
        var driveRoot = Path.GetPathRoot(Environment.CurrentDirectory)!;
        Assert.Throws<InvalidOperationException>(() => ResolveProductionOutputPath(driveRoot));

        using var fixture = new OutputFixture(Path.Combine(
            Path.GetTempPath(), $"ren-courses-output-root-{Guid.NewGuid():N}", "output"));
        Assert.Throws<InvalidOperationException>(() => ResolveProductionOutputPath(fixture.Root));
    }

    [Fact]
    public void ResetProductionOutput_removes_stale_files_and_preserves_siblings()
    {
        using var fixture = new OutputFixture();
        var outputPath = Path.Combine(fixture.Root, "output");
        Directory.CreateDirectory(outputPath);
        File.WriteAllText(Path.Combine(outputPath, "stale.html"), "stale");
        var siblingPath = Path.Combine(fixture.Root, "keep.txt");
        File.WriteAllText(siblingPath, "keep");

        ResetProductionOutput(fixture.Root);

        Assert.True(Directory.Exists(outputPath));
        Assert.False(File.Exists(Path.Combine(outputPath, "stale.html")));
        Assert.True(File.Exists(siblingPath));
    }

    [Fact]
    public void ResolveOutputPath_accepts_the_fixture_site_folder()
    {
        using var fixture = new OutputFixture();

        var outputPath = ProductionOutput.Resolve(fixture.Root, SiteLayout.EndToEndFixture.OutputFolderName);

        Assert.Equal(Path.Combine(fixture.Root, "output-e2e"), outputPath);
    }

    [Theory]
    [InlineData("wwwroot")]
    [InlineData("Content")]
    [InlineData("../output")]
    [InlineData("output/nested")]
    [InlineData("")]
    public void ResolveOutputPath_rejects_any_folder_outside_the_known_outputs(string folderName)
    {
        using var fixture = new OutputFixture();
        Assert.Throws<InvalidOperationException>(() => ProductionOutput.Resolve(fixture.Root, folderName));
    }

    [Fact]
    public void ResetFixtureOutput_leaves_the_production_output_alone()
    {
        using var fixture = new OutputFixture();
        var productionOutput = Path.Combine(fixture.Root, "output");
        Directory.CreateDirectory(productionOutput);
        File.WriteAllText(Path.Combine(productionOutput, "index.html"), "real site");

        ProductionOutput.Reset(fixture.Root, SiteLayout.EndToEndFixture.OutputFolderName);

        Assert.True(Directory.Exists(Path.Combine(fixture.Root, "output-e2e")));
        Assert.True(File.Exists(Path.Combine(productionOutput, "index.html")));
    }

    [Fact]
    public void SiteLayout_without_a_profile_is_the_production_layout()
    {
        Assert.Same(SiteLayout.Production, SiteLayout.FromProfile(null));
        Assert.Same(SiteLayout.Production, SiteLayout.FromProfile(""));
        Assert.Equal("Content", SiteLayout.Production.ContentRoot);
        Assert.Equal("output", SiteLayout.Production.OutputFolderName);
    }

    [Fact]
    public void SiteLayout_production_keeps_the_pdf_generator_defaults()
    {
        // Production must behave exactly as it did before the layout existed.
        var defaults = new RensMarkdownTemplates.PdfGeneratorOptions { ContentRoot = ".", PipelineRoot = "." };

        Assert.Equal(defaults.MaterialsDirectory, SiteLayout.Production.MaterialsDirectory);
        Assert.Equal(defaults.ArtifactsDirectory, SiteLayout.Production.PdfArtifactsDirectory);
        Assert.Equal(defaults.OutputDirectory, SiteLayout.Production.PdfOutputDirectory);
    }

    [Fact]
    public void SiteLayout_e2e_profile_isolates_every_generated_path()
    {
        // The PDF cache prunes every slug it does not see. A fixture build that
        // shared the production cache or PDF folder would delete the real PDFs.
        var e2e = SiteLayout.FromProfile("e2e");
        var production = SiteLayout.Production;

        Assert.Same(SiteLayout.EndToEndFixture, e2e);
        Assert.NotEqual(production.ContentRoot, e2e.ContentRoot);
        Assert.NotEqual(production.OutputFolderName, e2e.OutputFolderName);
        Assert.NotEqual(production.PdfArtifactsDirectory, e2e.PdfArtifactsDirectory);
        Assert.NotEqual(production.PdfOutputDirectory, e2e.PdfOutputDirectory);
        Assert.False(e2e.PdfOutputDirectory.StartsWith("wwwroot", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void SiteLayout_content_path_stays_relative_for_production_and_absolute_for_e2e()
    {
        // BlazorStatic resolves a relative ContentPath against the bin folder, and
        // the csproj copies only Content/** there. The fixture tree is not copied.
        var root = Path.Combine(Path.GetTempPath(), "repo");

        Assert.Equal("Content", SiteLayout.Production.ContentPathFor(root));
        Assert.Equal(
            Path.GetFullPath(Path.Combine(root, "tests", "fixtures", "site", "Content")),
            SiteLayout.EndToEndFixture.ContentPathFor(root));
    }

    [Fact]
    public void SiteLayout_e2e_removes_every_pdf_it_did_not_generate()
    {
        // wwwroot/pdfs reaches every output with the rest of wwwroot. A fixture
        // page must not be able to link a live material's PDF.
        using var fixture = new OutputFixture();
        var generated = Path.Combine(fixture.Root, SiteLayout.EndToEndFixture.PdfOutputDirectory);
        var published = Path.Combine(fixture.Root, "output-e2e", "pdfs");
        Directory.CreateDirectory(generated);
        Directory.CreateDirectory(published);
        File.WriteAllText(Path.Combine(generated, "fixture.abc.pdf"), "fixture");
        File.WriteAllText(Path.Combine(published, "fixture.abc.pdf"), "fixture");
        File.WriteAllText(Path.Combine(published, "live-material.def.pdf"), "live");

        SiteLayout.EndToEndFixture.RemoveForeignPdfs(fixture.Root, Path.Combine(fixture.Root, "output-e2e"));

        Assert.Equal(["fixture.abc.pdf"], Directory.GetFiles(published).Select(Path.GetFileName));
    }

    [Fact]
    public void SiteLayout_production_keeps_every_published_pdf()
    {
        using var fixture = new OutputFixture();
        var published = Path.Combine(fixture.Root, "output", "pdfs");
        Directory.CreateDirectory(published);
        File.WriteAllText(Path.Combine(published, "material.abc.pdf"), "real");

        SiteLayout.Production.RemoveForeignPdfs(fixture.Root, Path.Combine(fixture.Root, "output"));

        Assert.True(File.Exists(Path.Combine(published, "material.abc.pdf")));
    }

    [Fact]
    public void SiteLayout_rejects_an_unknown_profile()
    {
        Assert.Throws<InvalidOperationException>(() => SiteLayout.FromProfile("staging"));
    }

    [Fact]
    public void SiteLayout_e2e_content_root_holds_every_content_type()
    {
        var root = Path.Combine(RepoPaths.Root, SiteLayout.EndToEndFixture.ContentRoot);
        foreach (var folder in new[] { "Materials", "Projects", "Events", "FAQs", "Bookings" })
        {
            var path = Path.Combine(root, folder);
            Assert.True(Directory.Exists(path), $"Missing fixture folder {path}");
            Assert.NotEmpty(Directory.GetFiles(path, "*.md", SearchOption.AllDirectories));
        }
    }

    private static string ResolveProductionOutputPath(string contentRootPath) =>
        ProductionOutput.Resolve(contentRootPath);

    private static void ResetProductionOutput(string contentRootPath) =>
        ProductionOutput.Reset(contentRootPath);

    private sealed class OutputFixture : IDisposable
    {
        public OutputFixture(string? root = null)
        {
            Root = root ?? Path.Combine(Path.GetTempPath(), $"ren-courses-output-{Guid.NewGuid():N}");
            Directory.CreateDirectory(Root);
        }

        public string Root { get; }

        public void Dispose()
        {
            if (Directory.Exists(Root)) Directory.Delete(Root, recursive: true);
        }
    }
}
