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
