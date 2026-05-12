using System.Reflection;
using System.Runtime.CompilerServices;
using BlazorStatic.Services;

namespace Ren.Courses.Tests;

[Collection("BuildTimeProvider")]
public class FAQContentProviderTests
{
    // ----------------------------------------------------------------
    // 1. Valid post within term is included
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_ValidPost_ReturnsPost()
    {
        var provider = CreateEmptyProvider();
        var post = MakeFaqPost("cmsc-125", new DateTime(2026, 3, 1));

        var result = provider.GetVisiblePosts(new[] { post });

        Assert.Contains(post, result);
    }

    // ----------------------------------------------------------------
    // 2. Post published before term start is excluded
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_BeforeTermStart_Excluded()
    {
        // termStart (UTC) = 2026-01-14 16:00 (from PH local "2026-01-15")
        var provider = CreateEmptyProvider();
        var post = MakeFaqPost("cmsc-125", new DateTime(2026, 1, 1));

        var result = provider.GetVisiblePosts(new[] { post });

        Assert.DoesNotContain(post, result);
    }

    // ----------------------------------------------------------------
    // 3. Post published after term end is excluded
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_AfterTermEnd_Excluded()
    {
        // termEnd (UTC) = 2026-05-30 16:00 (from PH local "2026-05-31")
        var provider = CreateEmptyProvider();
        var post = MakeFaqPost("cmsc-125", new DateTime(2026, 6, 15));

        var result = provider.GetVisiblePosts(new[] { post });

        Assert.DoesNotContain(post, result);
    }

    // ----------------------------------------------------------------
    // 4. Future post (Published > LocalNow) is excluded
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_FuturePublished_Excluded()
    {
        // LocalNow = 2026-03-15 18:00 PHT
        var provider = CreateEmptyProvider();
        var post = MakeFaqPost("cmsc-125", new DateTime(2026, 3, 20));

        var result = provider.GetVisiblePosts(new[] { post });

        Assert.DoesNotContain(post, result);
    }

    // ----------------------------------------------------------------
    // 5. Empty source returns empty
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_EmptySource_ReturnsEmpty()
    {
        var provider = CreateEmptyProvider();

        var result = provider.GetVisiblePosts(Array.Empty<Post<FAQFrontmatter>>());

        Assert.Empty(result);
    }

    // ----------------------------------------------------------------
    // 6. Results ordered by Published ascending
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_OrderedByPublishedAscending()
    {
        var provider = CreateEmptyProvider();
        var older = MakeFaqPost("cmsc-124", new DateTime(2026, 1, 20));
        var newer = MakeFaqPost("cmsc-124", new DateTime(2026, 3, 1));

        var result = provider.GetVisiblePosts(new[] { newer, older }).ToList();

        Assert.Equal(2, result.Count);
        Assert.Equal(older.FrontMatter.Published, result[0].FrontMatter.Published);
        Assert.Equal(newer.FrontMatter.Published, result[1].FrontMatter.Published);
    }

    // ----------------------------------------------------------------
    // 7. GetAllTags returns distinct sorted tags
    // ----------------------------------------------------------------
    [Fact]
    public void GetAllTags_ReturnsDistinctSortedTags()
    {
        var posts = new List<Post<FAQFrontmatter>>
        {
            MakeFaqPost("cmsc-125", new DateTime(2026, 2, 1)),
            MakeFaqPost("cmsc-124", new DateTime(2026, 2, 15)),
            MakeFaqPost("cmsc-125", new DateTime(2026, 3, 1)),
        };

        var service = CreateServiceWithPosts(posts);
        var provider = new FAQContentProvider(service);

        var tags = provider.GetAllTags();

        Assert.Equal(2, tags.Count);
        Assert.Equal("cmsc-124", tags[0]);
        Assert.Equal("cmsc-125", tags[1]);
    }

    // ----------------------------------------------------------------
    // 8. GetAllTags with multiple tags per post — all tags included
    // ----------------------------------------------------------------
    [Fact]
    public void GetAllTags_MultiTagPost_AllTagsIncluded()
    {
        var post = new Post<FAQFrontmatter>
        {
            FrontMatter = new FAQFrontmatter
            {
                Question = "Multi-tag question",
                Tags = new List<string> { "cmsc-124", "cmsc-125" },
                Published = new DateTime(2026, 2, 1),
            },
            Url = "multi-tag",
            HtmlContent = "<p>Answer</p>",
        };

        var service = CreateServiceWithPosts(new List<Post<FAQFrontmatter>> { post });
        var provider = new FAQContentProvider(service);

        var tags = provider.GetAllTags();

        Assert.Equal(2, tags.Count);
        Assert.Contains("cmsc-124", tags);
        Assert.Contains("cmsc-125", tags);
    }

    // ----------------------------------------------------------------
    // 9. Showcase mode — includes post before term start
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_ShowcaseMode_IncludesPostBeforeTerm()
    {
        BuildTimeProvider.IsShowcaseMode = true;
        var provider = CreateEmptyProvider();
        var post = MakeFaqPost("cmsc-125", new DateTime(2025, 6, 1));

        var result = provider.GetVisiblePosts(new[] { post });

        BuildTimeProvider.IsShowcaseMode = false;
        Assert.Contains(post, result);
    }

    // ----------------------------------------------------------------
    // 10. Showcase mode — includes future post
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_ShowcaseMode_IncludesFuturePost()
    {
        BuildTimeProvider.IsShowcaseMode = true;
        var provider = CreateEmptyProvider();
        var post = MakeFaqPost("cmsc-125", new DateTime(2026, 9, 1));

        var result = provider.GetVisiblePosts(new[] { post });

        BuildTimeProvider.IsShowcaseMode = false;
        Assert.Contains(post, result);
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private static Post<FAQFrontmatter> MakeFaqPost(string tag, DateTime published) =>
        new()
        {
            FrontMatter = new FAQFrontmatter
            {
                Question = $"Question for {tag}",
                Tags = new List<string> { tag },
                Published = published,
            },
            Url = $"faq-{tag}-{published:yyyyMMdd}",
            HtmlContent = "<p>Answer</p>",
        };

    private static FAQContentProvider CreateEmptyProvider()
        => new(CreateServiceWithPosts([]));

    private static BlazorStaticContentService<FAQFrontmatter> CreateServiceWithPosts(
        List<Post<FAQFrontmatter>> posts)
    {
        var service = (BlazorStaticContentService<FAQFrontmatter>)
            RuntimeHelpers.GetUninitializedObject(
                typeof(BlazorStaticContentService<FAQFrontmatter>));

        var postsField = typeof(BlazorStaticContentService<FAQFrontmatter>)
            .GetField("<Posts>k__BackingField",
                BindingFlags.Instance | BindingFlags.NonPublic);

        postsField!.SetValue(service, posts);

        return service;
    }
}
