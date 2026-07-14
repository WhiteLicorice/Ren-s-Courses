using System.Reflection;
using System.Runtime.CompilerServices;
using BlazorStatic;
using BlazorStatic.Services;

namespace Ren.Courses.Tests;

[Collection("BuildTimeProvider")]
public class WebsiteKeysTests
{
    [Fact]
    public void VersionedAsset_AppendsBuildVersion()
    {
        var result = WebsiteKeys.VersionedAsset("css/site.css");

        Assert.Matches("^css/site\\.css\\?v=[0-9a-f]+$", result);
    }

    // ----------------------------------------------------------------
    // 1. RemovePostPages removes pages matching service PageUrl prefix
    // ----------------------------------------------------------------
    [Fact]
    public void RemovePostPages_RemovesPagesMatchingPageUrlPrefix()
    {
        var (svc, contentService) = CreateServicePair<BookingFrontmatter>(
            pageUrl: "_disabled",
            pages: [
                ("_disabled/post-1", "<p>body</p>"),
                ("_disabled/post-2", "<p>body</p>"),
                ("projects", "<p>listing</p>"),
                ("projects/tag-cmsc-131", "<p>tag</p>"),
            ]);

        WebsiteKeys.RemovePostPages(svc, contentService);

        var remaining = svc.Options.PagesToGenerate.Select(p => GetUrl(p)).ToList();
        Assert.DoesNotContain("_disabled/post-1", remaining);
        Assert.DoesNotContain("_disabled/post-2", remaining);
        Assert.Contains("projects", remaining);
        Assert.Contains("projects/tag-cmsc-131", remaining);
    }

    // ----------------------------------------------------------------
    // 2. RemovePostPages does not remove pages with different prefixes
    // ----------------------------------------------------------------
    [Fact]
    public void RemovePostPages_DoesNotRemoveUnrelatedPages()
    {
        var (svc, contentService) = CreateServicePair<ProjectFrontMatter>(
            pageUrl: "_disabled",
            pages: [
                ("articles/post-1", "<p>body</p>"),
                ("materials", "<p>listing</p>"),
            ]);

        WebsiteKeys.RemovePostPages(svc, contentService);

        Assert.Equal(2, svc.Options.PagesToGenerate.Count);
    }

    // ----------------------------------------------------------------
    // 3. RemovePostPages with empty PagesToGenerate does not throw
    // ----------------------------------------------------------------
    [Fact]
    public void RemovePostPages_EmptyPages_DoesNotThrow()
    {
        var (svc, contentService) = CreateServicePair<ProjectFrontMatter>(
            pageUrl: "_disabled",
            pages: []);

        var exception = Record.Exception(() => WebsiteKeys.RemovePostPages(svc, contentService));
        Assert.Null(exception);
    }

    // ----------------------------------------------------------------
    // 4. Uses contentService.Options.PageUrl, not hardcoded "_disabled"
    // ----------------------------------------------------------------
    [Fact]
    public void RemovePostPages_UsesServicePageUrlPrefix()
    {
        var (svc, contentService) = CreateServicePair<BookingFrontmatter>(
            pageUrl: "my-prefix",
            pages: [
                ("my-prefix/post-1", "<p>body</p>"),
                ("other/post-2", "<p>body</p>"),
                ("listing", "<p>listing</p>"),
            ]);

        WebsiteKeys.RemovePostPages(svc, contentService);

        var remaining = svc.Options.PagesToGenerate.Select(p => GetUrl(p)).ToList();
        Assert.DoesNotContain("my-prefix/post-1", remaining);
        Assert.Contains("other/post-2", remaining);
        Assert.Contains("listing", remaining);
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private static string GetUrl(object page) =>
        (string)page.GetType().GetProperty("Url")!.GetValue(page)!;

    /// <summary>
    /// Creates BlazorStaticService + BlazorStaticContentService{T} with controlled state.
    /// </summary>
    private static (BlazorStaticService, BlazorStaticContentService<T>) CreateServicePair<T>(
        string pageUrl, List<(string Url, string Content)> pages)
        where T : class, IFrontMatter, new()
    {
        var svcAsm = typeof(BlazorStaticService).Assembly;
        var contentSvcAsm = typeof(BlazorStaticContentService<>).Assembly;
        var optionsAsm = typeof(BlazorStaticOptions).Assembly;

        // --- Create BlazorStaticService ---
        var svcType = typeof(BlazorStaticService);
        var svc = RuntimeHelpers.GetUninitializedObject(svcType);

        // --- Create BlazorStaticOptions for svc.Options ---
        var optionsType = typeof(BlazorStaticOptions);
        var options = RuntimeHelpers.GetUninitializedObject(optionsType);

        // Set PagesToGenerate via backing field
        var pageType = optionsAsm.GetTypes()
            .First(t => t.Name == "PageToGenerate" && t.IsClass);

        var listType = typeof(List<>).MakeGenericType(pageType);
        var list = (System.Collections.IList)Activator.CreateInstance(listType)!;

        foreach (var (url, content) in pages)
        {
            var pg = RuntimeHelpers.GetUninitializedObject(pageType);
            pageType.GetProperty("Url")!.SetValue(pg, url);
            var cp = pageType.GetProperty("Content");
            if (cp?.CanWrite == true) cp.SetValue(pg, content);
            list.Add(pg);
        }

        var pagesField = optionsType.GetField("<PagesToGenerate>k__BackingField",
            BindingFlags.Instance | BindingFlags.NonPublic)!;
        pagesField.SetValue(options, list);

        // Link Options to svc — try find the backing field or property
        var svcOptionsField = svcType.GetFields(BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public)
            .FirstOrDefault(f => f.Name.Contains("Options") && f.FieldType == optionsType)
            ?? (FieldInfo?)svcType.GetFields(BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public)
                .FirstOrDefault(f => f.FieldType == optionsType);

        // Try setting via field; if not found, use the Options property directly
        // (BlazorStaticService might auto-create Options when accessed)
        if (svcOptionsField != null)
        {
            svcOptionsField.SetValue(svc, options);
        }

        // --- Create BlazorStaticContentService<T> ---
        var contentSvcType = typeof(BlazorStaticContentService<T>);
        var contentSvc = RuntimeHelpers.GetUninitializedObject(contentSvcType);

        // Create BlazorStaticContentOptions<T>
        var genericOptType = contentSvcAsm.GetTypes()
            .First(t => t.Name == "BlazorStaticContentOptions`1")
            .MakeGenericType(typeof(T));

        var contentOptions = RuntimeHelpers.GetUninitializedObject(genericOptType);

        genericOptType.GetProperty("PageUrl")?.SetValue(contentOptions, pageUrl);
        genericOptType.GetProperty("ContentPath")?.SetValue(contentOptions, "Content/Test");

        var contentOptionsField = contentSvcType.GetFields(BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public)
            .FirstOrDefault(f => f.FieldType.IsGenericType &&
                f.FieldType.GetGenericTypeDefinition().Name == "BlazorStaticContentOptions`1")
            ?? contentSvcType.GetFields(BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public)
                .FirstOrDefault(f =>
                    f.FieldType.Name.Contains("BlazorStaticContentOptions"));

        if (contentOptionsField != null)
        {
            contentOptionsField.SetValue(contentSvc, contentOptions);
        }

        return ((BlazorStaticService)svc, (BlazorStaticContentService<T>)contentSvc);
    }
}
