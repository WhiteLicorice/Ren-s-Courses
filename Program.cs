using BlazorStatic;
using BlazorStatic.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Security.Cryptography;
using BlazorStaticMinimalBlog.Components;
using BlazorStaticMinimalBlog.Models;
using BlazorStaticMinimalBlog.Services;
// YES, THESE ARE NECESSARY.

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseStaticWebAssets();
var contentRootPath = builder.Environment.ContentRootPath;
var productionOutputPath = Path.Combine(contentRootPath, "output");
var isDevelopment = builder.Environment.IsDevelopment();

if (args.Contains("--finalize-offline", StringComparer.Ordinal))
{
    OfflineBundleGenerator.Generate(
        Path.Combine(builder.Environment.ContentRootPath, "output"),
        Path.Combine(builder.Environment.ContentRootPath, "Offline", "service-worker.template.js"));
    return;
}

builder.Services.AddBlazorStaticService(opt =>
{
    opt.OutputFolderPath = productionOutputPath;
    opt.SuppressFileGeneration = isDevelopment;
    // BlazorStatic combines relative ignore paths with the output path twice.
    opt.IgnoredPathsOnContentCopy.Add(Path.Combine(productionOutputPath, "offline-manifest.json"));
    opt.IgnoredPathsOnContentCopy.Add(Path.Combine(productionOutputPath, "offline-manifest.json.gz"));
    opt.IgnoredPathsOnContentCopy.Add(Path.Combine(productionOutputPath, "service-worker.js"));
    opt.IgnoredPathsOnContentCopy.Add(Path.Combine(productionOutputPath, "service-worker.js.gz"));
    opt.IgnoredPathsOnContentCopy.Add(Path.Combine(productionOutputPath, "js", "__tests__"));
})
.AddBlazorStaticContentService<CourseFrontMatter>(opt =>
{
    opt.ContentPath = WebsiteKeys.Materials.SourcePath;
    opt.Tags.TagsPageUrl = WebsiteKeys.Materials.TagPageUrl;
    opt.PageUrl = WebsiteKeys.Materials.UrlPrefix;
    opt.AfterContentParsedAndAddedAction = WebsiteKeys.RemoveHiddenArticlePages;
})
.AddBlazorStaticContentService<ProjectFrontMatter>(opt =>
{
    opt.ContentPath = WebsiteKeys.Projects.SourcePath;
    opt.Tags.TagsPageUrl = WebsiteKeys.Projects.TagPageUrl;
    opt.PageUrl = WebsiteKeys.DisabledPage;
    opt.AfterContentParsedAndAddedAction = WebsiteKeys.RemovePostPages;
})
.AddBlazorStaticContentService<BookingFrontmatter>(opt =>
{
    opt.ContentPath = WebsiteKeys.Bookings.SourcePath;
    opt.Tags.TagsPageUrl = WebsiteKeys.DisabledPage;
    opt.PageUrl = WebsiteKeys.DisabledPage;
    opt.Tags.AddTagPagesFromPosts = false;
    opt.AfterContentParsedAndAddedAction = WebsiteKeys.RemovePostPages;
})
.AddBlazorStaticContentService<CalendarEventFrontmatter>(opt =>
{
    opt.ContentPath = WebsiteKeys.CalendarEvents.SourcePath;
    opt.Tags.TagsPageUrl = WebsiteKeys.DisabledPage;
    opt.PageUrl = WebsiteKeys.DisabledPage;
    opt.Tags.AddTagPagesFromPosts = false;
    opt.AfterContentParsedAndAddedAction = WebsiteKeys.RemovePostPages;
})
.AddBlazorStaticContentService<FAQFrontmatter>(opt =>
{
    opt.ContentPath = WebsiteKeys.FAQs.SourcePath;
    opt.Tags.TagsPageUrl = WebsiteKeys.FAQs.PageUrl;
    opt.PageUrl = WebsiteKeys.DisabledPage;
    opt.Tags.AddTagPagesFromPosts = false;
    opt.AfterContentParsedAndAddedAction = WebsiteKeys.RemovePostPages;
});

builder.Services.AddRazorComponents();

// Load configurable values from appsettings.json
WebsiteKeys.BlogLead = builder.Configuration.GetValue<string>("BlogLead") ?? WebsiteKeys.BlogLead;

var holidaysProvider = new HolidaysProvider();
await holidaysProvider.InitializeAsync();
builder.Services.AddSingleton(holidaysProvider);

builder.Services.AddSingleton<CourseContentProvider>();
builder.Services.AddSingleton<FAQContentProvider>();
builder.Services.AddSingleton<BookingContentProvider>();
builder.Services.AddSingleton<FrontmatterStatusService>();
builder.Services.AddSingleton<CalendarEventProvider>();
builder.Services.AddScoped<ThemeService>();

// PDF generation services
var markdownPipelineRoot = Path.Combine(
    builder.Environment.ContentRootPath, "Dependencies", "RensMarkdownTemplates");
var pdfOptions = new PdfGeneratorOptions
{
    ContentRoot = builder.Environment.ContentRootPath,
    PipelineRoot = markdownPipelineRoot
};
var pdfManifest = new PdfGenerationManifest();
builder.Services.AddSingleton(pdfManifest);
builder.Services.AddSingleton(pdfOptions);
builder.Services.AddSingleton<IProcessRunner>(sp => new SystemProcessRunner());
builder.Services.AddSingleton<IToolchainProvider>(
    sp => new ToolchainProvider(pdfOptions));
builder.Services.AddSingleton<IPdfCacheService, PdfCacheService>();
builder.Services.AddSingleton<IMermaidRenderer, MermaidRenderer>();
builder.Services.AddSingleton<PdfGeneratorService>(sp =>
{
    var toolchain = sp.GetRequiredService<IToolchainProvider>();
    var runner = sp.GetRequiredService<IProcessRunner>();
    var mermaid = sp.GetRequiredService<IMermaidRenderer>();
    var cache = sp.GetRequiredService<IPdfCacheService>();
    var manifest = sp.GetRequiredService<PdfGenerationManifest>();
    return new PdfGeneratorService(toolchain, runner, mermaid, cache, manifest, pdfOptions);
});

var menuFilePath = Path.Combine(builder.Environment.ContentRootPath, "menu.json");
builder.Services.AddSingleton(new MenuConfigService(menuFilePath));

var app = builder.Build();

// Run PDF generation before middleware and BlazorStatic.
// Must not fail the build — catch all exceptions and log warnings.
try
{
    var pdfGenerator = app.Services.GetRequiredService<PdfGeneratorService>();
    var pdfLogger = app.Services.GetRequiredService<ILogger<PdfGeneratorService>>();
    await pdfGenerator.RunAsync(pdfLogger);
}
catch (Exception ex)
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    logger.LogWarning(ex, "PDF generation failed. Site will use fallback download links.");
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();
app.UseAntiforgery();

app.MapRazorComponents<App>();

if (!isDevelopment)
    ProductionOutput.Reset(contentRootPath);

app.UseBlazorStaticGenerator(shutdownApp: !app.Environment.IsDevelopment());

app.Run();

if (!isDevelopment)
{
    OfflineBundleGenerator.Generate(
        Path.Combine(contentRootPath, "output"),
        Path.Combine(contentRootPath, "Offline", "service-worker.template.js"));
}

internal static class ProductionOutput
{
    internal static void Reset(string contentRootPath)
    {
        var outputPath = Resolve(contentRootPath);
        if (Directory.Exists(outputPath)) Directory.Delete(outputPath, recursive: true);
        Directory.CreateDirectory(outputPath);
    }

    internal static string Resolve(string contentRootPath)
    {
        var fullContentRoot = Path.GetFullPath(contentRootPath);
        var outputPath = Path.GetFullPath(Path.Combine(fullContentRoot, "output"));
        var pathRoot = Path.GetPathRoot(outputPath);
        var parentPath = Directory.GetParent(outputPath)?.FullName;

        if (string.Equals(fullContentRoot, Path.GetPathRoot(fullContentRoot), StringComparison.OrdinalIgnoreCase)
            || string.Equals(Path.GetFileName(fullContentRoot), "output", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(parentPath)
            || string.Equals(outputPath, pathRoot, StringComparison.OrdinalIgnoreCase)
            || !string.Equals(parentPath, fullContentRoot, StringComparison.OrdinalIgnoreCase)
            || !string.Equals(Path.GetFileName(outputPath), "output", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Refusing unsafe production output path: {outputPath}");

        return outputPath;
    }
}

public static class WebsiteKeys
{
    // --- GLOBAL SETTINGS ---
    public const string GitHubRepo = "https://github.com/WhiteLicorice/Ren-s-Courses";
    public const string AuthorGitHub = "https://github.com/WhiteLicorice";
    public const string Title = "Ren's Courses";
    public const string BlogPostStorageAddress = $"{GitHubRepo}/tree/main/Content/Blog";
    public static string BlogLead { get; set; } = "Ren's Courses is a headless Learning Management System designed for CS units I handle under the University of the Philippines Visayas, Division of Physical Sciences and Mathematics. All rights reserved.";

    public static string VersionedAsset(string path)
    {
        var assetPath = FindAsset(path);
        if (assetPath is null) return path;

        using var stream = File.OpenRead(assetPath);
        var hash = Convert.ToHexString(SHA256.HashData(stream))[..12].ToLowerInvariant();
        return $"{path}?v={hash}";
    }

    private static string? FindAsset(string path)
    {
        var relativePath = Path.Combine("wwwroot", path.Replace('/', Path.DirectorySeparatorChar));
        var workingDirectoryPath = Path.GetFullPath(relativePath);
        if (File.Exists(workingDirectoryPath)) return workingDirectoryPath;

        for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
             directory is not null;
             directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
        }

        return null;
    }

    // Non-empty placeholder for content types where individual pages are not needed.
    // Generation of individual post pages is suppressed via AfterContentParsedAndAddedAction.
    public const string DisabledPage = "_disabled";

    // --- DOMAIN SPECIFIC KEYS ---
    public static class Materials
    {
        public const string SourcePath = "Content/Materials";
        public const string TagPageUrl = "materials";
        public const string UrlPrefix = "articles";
    }

    public static class Projects
    {
        public const string SourcePath = "Content/Projects";
        public const string TagPageUrl = "projects";
    }

    public static class Bookings
    {
        public const string SourcePath = "Content/Bookings";
    }

    public static class CalendarEvents
    {
        public const string SourcePath = "Content/Events";
    }

    public static class FAQs
    {
        public const string SourcePath = "Content/FAQs";
        public const string PageUrl = "faqs";
    }

    // AfterContentParsedAndAddedAction callback: removes individual post pages
    // for content types that only need the listing page, not detail pages.
    // BlazorStatic v1.0.0-beta.17 has no built-in option to skip individual page
    // generation, so we remove them post-parse via this hook.
    internal static void RemovePostPages<T>(BlazorStaticService svc, BlazorStaticContentService<T> contentService) where T : class, IFrontMatter, new()
    {
        // Uses contentService.Options.PageUrl for prefix matching instead of
        // the DisabledPage constant. This is more robust because it directly
        // references the service's own PageUrl, which is the actual prefix used
        // when auto-generating individual post pages.
        // Note: BlazorStatic v1.0.0-beta.17 has no built-in option to skip
        // individual page generation, so we remove them post-parse via this hook.
        var prefix = contentService.Options.PageUrl + "/";
        var pagesToRemove = svc.Options.PagesToGenerate
            .Where(p => p.Url.StartsWith(prefix, StringComparison.Ordinal))
            .ToList();
        foreach (var page in pagesToRemove)
            svc.Options.PagesToGenerate.Remove(page);
    }

    // AfterContentParsedAndAddedAction callback: drops individual article
    // pages for posts that are not currently visible (inactive course, future
    // release, or out-of-window untagged post). Listing and tag pages are
    // untouched. Mirrors CourseContentProvider.GetVisiblePosts.
    internal static void RemoveHiddenArticlePages(
        BlazorStaticService svc, BlazorStaticContentService<CourseFrontMatter> contentService)
    {
        var prefix = contentService.Options.PageUrl + "/";
        var visibleUrls = new CourseContentProvider(contentService)
            .GetVisiblePosts()
            .Select(p => p.Url)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var pagesToRemove = svc.Options.PagesToGenerate
            .Where(p => p.Url.StartsWith(prefix, StringComparison.Ordinal)
                && !visibleUrls.Contains(p.Url[prefix.Length..]))
            .ToList();
        foreach (var page in pagesToRemove)
            svc.Options.PagesToGenerate.Remove(page);
    }
}
