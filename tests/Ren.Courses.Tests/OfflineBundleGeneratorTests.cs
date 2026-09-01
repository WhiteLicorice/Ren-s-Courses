using System.Text.Json;
using BlazorStaticMinimalBlog.Services;

namespace Ren.Courses.Tests;

public class OfflineBundleGeneratorTests
{
    [Fact]
    public void Generate_discovers_routes_assets_and_writes_embedded_worker()
    {
        using var fixture = new OfflineFixture();
        fixture.Write("index.html", "<base href=\"/\"><link rel=\"stylesheet\" href=\"css/app.css?v=css\"><link rel=\"stylesheet\" href=\"css/app.css?v=css\"><script src=\"js/app.js\"></script><img srcset=\"images/a.png 1x, images/b.png 2x\"><a href=\"pdfs/example.pdf\">PDF</a>");
        fixture.Write("docs/index.html", "<base href=\"/\"><link rel=\"manifest\" href=\"site.webmanifest\">");
        fixture.Write("articles/example.html", "<link rel=\"stylesheet\" href=\"../css/app.css\">");
        fixture.Write("css/app.css", "@font-face { src: url('../fonts/inter.woff2'); }");
        fixture.Write("js/app.js", "console.log('app');");
        fixture.Write("fonts/inter.woff2", "font");
        fixture.Write("images/a.png", "a");
        fixture.Write("images/b.png", "b");
        fixture.Write("pdfs/example.pdf", "pdf");
        fixture.Write("site.webmanifest", "{\"icons\":[{\"src\":\"android-chrome-192x192.png\"},{\"src\":\"android-chrome-512x512.png\"}]}");
        fixture.Write("android-chrome-192x192.png", "192");
        fixture.Write("android-chrome-512x512.png", "512");
        fixture.Write("vendor/mermaid/mermaid.min.js", "mermaid");
        fixture.WriteTemplate();
        fixture.Write("offline-manifest.json.gz", "stale manifest");
        fixture.Write("service-worker.js.gz", "stale worker");
        fixture.Write("js/__tests__/stale.test.js", "stale test");

        var result = OfflineBundleGenerator.Generate(fixture.OutputRoot, fixture.TemplatePath);
        var manifest = JsonSerializer.Deserialize<OfflineManifest>(
            File.ReadAllText(Path.Combine(fixture.OutputRoot, "offline-manifest.json")))!;

        Assert.Equal(["./", "articles/example", "docs"], manifest.Routes);
        Assert.Contains("css/app.css?v=css", manifest.Assets);
        Assert.Contains("fonts/inter.woff2", manifest.Assets);
        Assert.Contains("pdfs/example.pdf", manifest.Assets);
        Assert.Contains("android-chrome-192x192.png", manifest.Assets);
        Assert.Contains("android-chrome-512x512.png", manifest.Assets);
        Assert.Equal(manifest.Assets.OrderBy(asset => asset, StringComparer.Ordinal), manifest.Assets);
        Assert.Equal(manifest.Assets.Distinct(StringComparer.Ordinal), manifest.Assets);
        Assert.Matches("^[a-f0-9]{64}$", manifest.BuildId);
        Assert.Equal(manifest.BuildId, result.BuildId);
        Assert.Contains(manifest.BuildId, File.ReadAllText(Path.Combine(fixture.OutputRoot, "service-worker.js")));
        Assert.False(File.Exists(Path.Combine(fixture.OutputRoot, "offline-manifest.json.gz")));
        Assert.False(File.Exists(Path.Combine(fixture.OutputRoot, "service-worker.js.gz")));
        Assert.False(Directory.Exists(Path.Combine(fixture.OutputRoot, "js", "__tests__")));
    }

    [Fact]
    public void Generate_changes_build_identifier_for_each_referenced_content_type()
    {
        using var fixture = new OfflineFixture();
        fixture.Write("index.html", "<link rel=\"stylesheet\" href=\"css/app.css\"><script src=\"js/app.js\"></script><img src=\"images/example.png\"><a href=\"pdfs/example.pdf\">PDF</a>");
        fixture.Write("css/app.css", "@font-face { src: url('../fonts/inter.woff2'); }");
        fixture.Write("js/app.js", "one");
        fixture.Write("fonts/inter.woff2", "font-one");
        fixture.Write("images/example.png", "image-one");
        fixture.Write("pdfs/example.pdf", "pdf-one");
        fixture.WriteTemplate();

        var previous = OfflineBundleGenerator.Generate(fixture.OutputRoot, fixture.TemplatePath).BuildId;
        var changes = new[]
        {
            ("index.html", "<link rel=\"stylesheet\" href=\"css/app.css\"><script src=\"js/app.js\"></script><img src=\"images/example.png\"><a href=\"pdfs/example.pdf\">Changed PDF</a>"),
            ("css/app.css", "@font-face { src: url('../fonts/inter.woff2'); } body { color: red; }"),
            ("js/app.js", "two"),
            ("fonts/inter.woff2", "font-two"),
            ("images/example.png", "image-two"),
            ("pdfs/example.pdf", "pdf-two"),
        };

        foreach (var (path, content) in changes)
        {
            fixture.Write(path, content);
            var current = OfflineBundleGenerator.Generate(fixture.OutputRoot, fixture.TemplatePath).BuildId;
            Assert.NotEqual(previous, current);
            previous = current;
        }
    }

    [Fact]
    public void Generate_uses_content_hashes_for_a_stable_build_identifier()
    {
        using var fixture = new OfflineFixture();
        fixture.Write("index.html", "<script src=\"app.js\"></script>");
        fixture.Write("app.js", "one");
        fixture.WriteTemplate();

        var first = OfflineBundleGenerator.Generate(fixture.OutputRoot, fixture.TemplatePath);
        var second = OfflineBundleGenerator.Generate(fixture.OutputRoot, fixture.TemplatePath);

        Assert.Equal(first.BuildId, second.BuildId);

        fixture.Write("app.js", "two");
        var changed = OfflineBundleGenerator.Generate(fixture.OutputRoot, fixture.TemplatePath);

        Assert.NotEqual(first.BuildId, changed.BuildId);
    }

    [Fact]
    public void Generate_rejects_missing_local_references()
    {
        using var fixture = new OfflineFixture();
        fixture.Write("index.html", "<link rel=\"stylesheet\" href=\"missing.css\">");
        fixture.WriteTemplate();

        var exception = Assert.Throws<InvalidOperationException>(() =>
            OfflineBundleGenerator.Generate(fixture.OutputRoot, fixture.TemplatePath));

        Assert.Contains("missing.css", exception.Message);
    }

    [Fact]
    public void Generate_discovers_manifest_screenshots_and_shortcut_icons()
    {
        using var fixture = new OfflineFixture();
        fixture.Write("index.html", "<link rel=\"manifest\" href=\"site.webmanifest\">");
        fixture.Write("site.webmanifest", "{\"icons\":[{\"src\":\"icon.png\"}],\"screenshots\":[{\"src\":\"screenshots/shot.png\"}],\"shortcuts\":[{\"icons\":[{\"src\":\"icons/shortcut.png\"}]}]}");
        fixture.Write("icon.png", "icon");
        fixture.Write("screenshots/shot.png", "shot");
        fixture.Write("icons/shortcut.png", "shortcut");
        fixture.WriteTemplate();

        var manifest = OfflineBundleGenerator.Generate(fixture.OutputRoot, fixture.TemplatePath);

        Assert.Contains("icon.png", manifest.Assets);
        Assert.Contains("screenshots/shot.png", manifest.Assets);
        Assert.Contains("icons/shortcut.png", manifest.Assets);
    }

    [Fact]
    public void Generate_rejects_manifest_parent_directory_escape()
    {
        using var fixture = new OfflineFixture();
        fixture.Write("index.html", "<link rel=\"manifest\" href=\"site.webmanifest\">");
        fixture.Write("site.webmanifest", "{\"icons\":[{\"src\":\"../outside.png\"}]}");
        fixture.WriteTemplate();

        var exception = Assert.Throws<InvalidOperationException>(() =>
            OfflineBundleGenerator.Generate(fixture.OutputRoot, fixture.TemplatePath));

        Assert.Contains("escapes", exception.Message);
    }

    private sealed class OfflineFixture : IDisposable
    {
        private readonly string _root = Path.Combine(Path.GetTempPath(), $"ren-courses-offline-{Guid.NewGuid():N}");

        public OfflineFixture()
        {
            OutputRoot = Path.Combine(_root, "output");
            Directory.CreateDirectory(OutputRoot);
            Write("vendor/mermaid/mermaid.min.js", "mermaid");
        }

        public string OutputRoot { get; }

        public string TemplatePath => Path.Combine(_root, "service-worker.template.js");

        public void Write(string relativePath, string content)
        {
            var path = Path.Combine(OutputRoot, relativePath.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, content);
        }

        public void WriteTemplate() => File.WriteAllText(TemplatePath, "const BUILD_ID = '__OFFLINE_BUILD_ID__';");

        public void Dispose()
        {
            if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
        }
    }
}
