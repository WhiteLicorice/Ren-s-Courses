using System.Reflection;
using System.Runtime.CompilerServices;
using BlazorStatic.Services;

namespace Ren.Courses.Tests;

[Collection("BuildTimeProvider")]
public class CourseContentProviderTests
{
    // ----------------------------------------------------------------
    // 1. Valid post (published within term, not draft, no hidden tags)
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_ValidPost_ReturnsPost()
    {
        var provider = CreateEmptyProvider();

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Valid Post",
                Published = new DateTime(2026, 3, 1),
                IsDraft = false,
                Tags = new List<string> { "cmsc-131" },
            },
            Url = "valid-post",
            HtmlContent = "<p>Valid Post</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        Assert.Contains(post, result);
    }

    // ----------------------------------------------------------------
    // 2. Draft post excluded
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_DraftPost_Excluded()
    {
        var provider = CreateEmptyProvider();

        var draftPost = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Draft Post",
                Published = new DateTime(2026, 3, 1),
                IsDraft = true,
                Tags = new List<string>(),
            },
            Url = "draft-post",
            HtmlContent = "<p>Draft Post</p>",
        };

        var result = provider.GetVisiblePosts(new[] { draftPost });

        Assert.DoesNotContain(draftPost, result);
    }

    // ----------------------------------------------------------------
    // 3. Post with hidden tag excluded
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_PostWithHiddenTag_Excluded()
    {
        var provider = CreateEmptyProvider();
        provider.GlobalHiddenTags = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "hidden-tag" };

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Hidden Tag Post",
                Published = new DateTime(2026, 3, 1),
                Tags = new List<string> { "hidden-tag" },
            },
            Url = "hidden-tag-post",
            HtmlContent = "<p>Hidden Tag Post</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        Assert.DoesNotContain(post, result);
    }

    // ----------------------------------------------------------------
    // 4. Post published before term start excluded
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_PublishedBeforeTermStart_Excluded()
    {
        // termStart (UTC) = 2026-01-14 16:00 (from PH local "2026-01-15")
        var provider = CreateEmptyProvider();

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Before Term",
                Published = new DateTime(2026, 1, 1),
                Tags = new List<string>(),
            },
            Url = "before-term",
            HtmlContent = "<p>Before Term</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        Assert.DoesNotContain(post, result);
    }

    // ----------------------------------------------------------------
    // 5. Post published after term end excluded
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_PublishedAfterTermEnd_Excluded()
    {
        // termEnd (UTC) = 2026-05-30 16:00 (from PH local "2026-05-31")
        var provider = CreateEmptyProvider();

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "After Term",
                Published = new DateTime(2026, 6, 15),
                Tags = new List<string>(),
            },
            Url = "after-term",
            HtmlContent = "<p>After Term</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        Assert.DoesNotContain(post, result);
    }

    // ----------------------------------------------------------------
    // 6. Future unpublished post (Published > LocalNow) excluded
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_FuturePublishedPost_Excluded()
    {
        // LocalNow = 2026-03-15 18:00 PHT
        var provider = CreateEmptyProvider();

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Future Post",
                Published = new DateTime(2026, 3, 20),
                Tags = new List<string>(),
            },
            Url = "future-post",
            HtmlContent = "<p>Future Post</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        Assert.DoesNotContain(post, result);
    }

    // ----------------------------------------------------------------
    // 7. All posts outside term window returns empty
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_AllPostsOutsideTermWindow_ReturnsEmpty()
    {
        var provider = CreateEmptyProvider();

        var posts = new[]
        {
            new Post<CourseFrontMatter>
            {
                FrontMatter = new CourseFrontMatter
                {
                    Title = "Before Term",
                    Published = new DateTime(2026, 1, 1),
                    Tags = new List<string>(),
                },
                Url = "before-term",
                HtmlContent = "<p>Before Term</p>",
            },
            new Post<CourseFrontMatter>
            {
                FrontMatter = new CourseFrontMatter
                {
                    Title = "After Term",
                    Published = new DateTime(2026, 6, 15),
                    Tags = new List<string>(),
                },
                Url = "after-term",
                HtmlContent = "<p>After Term</p>",
            },
        };

        var result = provider.GetVisiblePosts(posts);

        Assert.Empty(result);
    }

    // ----------------------------------------------------------------
    // 8. Ordering is by Published descending
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_Ordering_ByPublishedDescending()
    {
        var provider = CreateEmptyProvider();

        var posts = new[]
        {
            new Post<CourseFrontMatter>
            {
                FrontMatter = new CourseFrontMatter
                {
                    Title = "Oldest",
                    Published = new DateTime(2026, 1, 20),
                    Tags = new List<string>(),
                },
                Url = "oldest",
                HtmlContent = "<p>Oldest</p>",
            },
            new Post<CourseFrontMatter>
            {
                FrontMatter = new CourseFrontMatter
                {
                    Title = "Middle",
                    Published = new DateTime(2026, 2, 15),
                    Tags = new List<string>(),
                },
                Url = "middle",
                HtmlContent = "<p>Middle</p>",
            },
            new Post<CourseFrontMatter>
            {
                FrontMatter = new CourseFrontMatter
                {
                    Title = "Newest",
                    Published = new DateTime(2026, 3, 1),
                    Tags = new List<string>(),
                },
                Url = "newest",
                HtmlContent = "<p>Newest</p>",
            },
        };

        var result = provider.GetVisiblePosts(posts).ToList();

        Assert.Equal(3, result.Count);
        Assert.Equal("Newest", result[0].FrontMatter.Title);
        Assert.Equal("Middle", result[1].FrontMatter.Title);
        Assert.Equal("Oldest", result[2].FrontMatter.Title);
    }

    // ----------------------------------------------------------------
    // 9. GetAllTags returns distinct sorted tags
    // ----------------------------------------------------------------
    [Fact]
    public void GetAllTags_ReturnsDistinctSortedTags()
    {
        var posts = new List<Post<CourseFrontMatter>>
        {
            new Post<CourseFrontMatter>
            {
                FrontMatter = new CourseFrontMatter
                {
                    Title = "Post 1",
                    Published = new DateTime(2026, 3, 1),
                    Tags = new List<string> { "cmsc-131" },
                },
                Url = "post-1",
                HtmlContent = "<p>Post 1</p>",
            },
            new Post<CourseFrontMatter>
            {
                FrontMatter = new CourseFrontMatter
                {
                    Title = "Post 2",
                    Published = new DateTime(2026, 2, 15),
                    Tags = new List<string> { "cmsc-124" },
                },
                Url = "post-2",
                HtmlContent = "<p>Post 2</p>",
            },
            new Post<CourseFrontMatter>
            {
                FrontMatter = new CourseFrontMatter
                {
                    Title = "Post 3",
                    Published = new DateTime(2026, 1, 20),
                    Tags = new List<string> { "cmsc-131", "cmsc-141" },
                },
                Url = "post-3",
                HtmlContent = "<p>Post 3</p>",
            },
        };

        var service = CreateServiceWithPosts(posts);
        var provider = new CourseContentProvider(service);

        var tags = provider.GetAllTags();

        Assert.Equal(3, tags.Count);
        Assert.Collection(tags,
            t => Assert.Equal("cmsc-124", t),
            t => Assert.Equal("cmsc-131", t),
            t => Assert.Equal("cmsc-141", t));
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    /// <summary>
    /// Creates a <see cref="CourseContentProvider"/> backed by a service
    /// whose <c>Posts</c> list is empty. Only the pure filtering overload
    /// <see cref="CourseContentProvider.GetVisiblePosts(IEnumerable{Post{CourseFrontMatter}})"/>
    /// is exercised by the callers; the no-arg overload works but returns nothing.
    /// </summary>
    private static CourseContentProvider CreateEmptyProvider()
        => new(CreateServiceWithPosts([]));

    /// <summary>
    /// Creates a <see cref="BlazorStaticContentService{CourseFrontMatter}"/>
    /// without running its constructor (via
    /// <see cref="RuntimeHelpers.GetUninitializedObject"/>), then sets the
    /// <c>Posts</c> backing field via reflection.  This avoids the
    /// DI-heavy constructor that requires <c>BlazorStaticContentOptions</c>,
    /// <c>BlazorStaticHelpers</c>, <c>BlazorStaticService</c>, and a logger.
    /// </summary>
    private static BlazorStaticContentService<CourseFrontMatter> CreateServiceWithPosts(
        List<Post<CourseFrontMatter>> posts)
    {
        var service = (BlazorStaticContentService<CourseFrontMatter>)
            RuntimeHelpers.GetUninitializedObject(
                typeof(BlazorStaticContentService<CourseFrontMatter>));

        var postsField = typeof(BlazorStaticContentService<CourseFrontMatter>)
            .GetField("<Posts>k__BackingField",
                BindingFlags.Instance | BindingFlags.NonPublic);

        postsField!.SetValue(service, posts);

        return service;
    }
}
