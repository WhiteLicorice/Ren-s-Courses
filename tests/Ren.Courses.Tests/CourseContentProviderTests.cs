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
                Tags = new List<string> { "fixture-course-a" },
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
                    Tags = new List<string> { "fixture-course-a" },
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
                    Tags = new List<string> { "fixture-course-b" },
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
                    Tags = new List<string> { "fixture-course-a", "fixture-course-c" },
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
            t => Assert.Equal("fixture-course-a", t),
            t => Assert.Equal("fixture-course-b", t),
            t => Assert.Equal("fixture-course-c", t));
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
    // ================================================================
    // Showcase Mode Tests
    // ================================================================

    [Fact]
    public void GetVisiblePosts_ShowcaseMode_IncludesPostBeforeTermStart()
    {
        BuildTimeProvider.IsShowcaseMode = true;
        var provider = CreateEmptyProvider();

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Pre-Term Post",
                Published = new DateTime(2025, 8, 1), // before termStart
                Tags = new List<string>(),
            },
            Url = "pre-term",
            HtmlContent = "<p>Pre-Term</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        BuildTimeProvider.IsShowcaseMode = false;
        Assert.Contains(post, result);
    }

    [Fact]
    public void GetVisiblePosts_ShowcaseMode_IncludesPostAfterTermEnd()
    {
        BuildTimeProvider.IsShowcaseMode = true;
        var provider = CreateEmptyProvider();

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Post-Term Post",
                Published = new DateTime(2026, 8, 1), // after termEnd
                Tags = new List<string>(),
            },
            Url = "post-term",
            HtmlContent = "<p>Post-Term</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        BuildTimeProvider.IsShowcaseMode = false;
        Assert.Contains(post, result);
    }

    [Fact]
    public void GetVisiblePosts_ShowcaseMode_IncludesFuturePublishedPost()
    {
        BuildTimeProvider.IsShowcaseMode = true;
        var provider = CreateEmptyProvider();

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Future Post",
                Published = new DateTime(2026, 9, 1), // > LocalNow
                Tags = new List<string>(),
            },
            Url = "future",
            HtmlContent = "<p>Future</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        BuildTimeProvider.IsShowcaseMode = false;
        Assert.Contains(post, result);
    }

    [Fact]
    public void GetVisiblePosts_ShowcaseMode_StillExcludesDraft()
    {
        BuildTimeProvider.IsShowcaseMode = true;
        var provider = CreateEmptyProvider();

        var draft = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Draft",
                Published = new DateTime(2025, 1, 1),
                IsDraft = true,
                Tags = new List<string>(),
            },
            Url = "draft",
            HtmlContent = "<p>Draft</p>",
        };

        var result = provider.GetVisiblePosts(new[] { draft });

        BuildTimeProvider.IsShowcaseMode = false;
        Assert.DoesNotContain(draft, result);
    }

    [Fact]
    public void GetVisiblePosts_ShowcaseMode_StillExcludesHiddenTag()
    {
        BuildTimeProvider.IsShowcaseMode = true;
        var provider = CreateEmptyProvider();
        provider.GlobalHiddenTags = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "private" };

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Hidden",
                Published = new DateTime(2025, 1, 1),
                Tags = new List<string> { "private" },
            },
            Url = "hidden",
            HtmlContent = "<p>Hidden</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        BuildTimeProvider.IsShowcaseMode = false;
        Assert.DoesNotContain(post, result);
    }

    [Fact]
    public void GetVisiblePosts_ShowcaseMode_NoArgOverloadReturnsAllNonDraft()
    {
        BuildTimeProvider.IsShowcaseMode = true;

        var posts = new List<Post<CourseFrontMatter>>
        {
            new()
            {
                FrontMatter = new CourseFrontMatter
                {
                    Title = "Pre-Term",
                    Published = new DateTime(2025, 1, 1),
                    Tags = new List<string>(),
                },
                Url = "pre",
                HtmlContent = "<p>Pre</p>",
            },
            new()
            {
                FrontMatter = new CourseFrontMatter
                {
                    Title = "Future",
                    Published = new DateTime(2026, 9, 1),
                    Tags = new List<string>(),
                },
                Url = "fut",
                HtmlContent = "<p>Fut</p>",
            },
            new()
            {
                FrontMatter = new CourseFrontMatter
                {
                    Title = "Draft",
                    Published = new DateTime(2026, 3, 1),
                    IsDraft = true,
                    Tags = new List<string>(),
                },
                Url = "draft",
                HtmlContent = "<p>Draft</p>",
            },
        };

        var service = CreateServiceWithPosts(posts);
        var provider = new CourseContentProvider(service);
        var result = provider.GetVisiblePosts().ToList();

        BuildTimeProvider.IsShowcaseMode = false;

        Assert.Equal(2, result.Count);
        Assert.Contains(result, p => p.FrontMatter.Title == "Pre-Term");
        Assert.Contains(result, p => p.FrontMatter.Title == "Future");
        Assert.DoesNotContain(result, p => p.FrontMatter.Title == "Draft");
    }

    // ================================================================
    // Active Course Tests
    // ================================================================

    // ----------------------------------------------------------------
    // 1. Tagged post whose course is not active is excluded (even in window)
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_InactiveCourseTag_Excluded()
    {
        var provider = CreateEmptyProvider();

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Inactive Course Post",
                Published = new DateTime(2026, 3, 1), // inside term window
                Tags = new List<string> { "fixture-course-c" }, // not in ACTIVE_COURSES
            },
            Url = "inactive-course",
            HtmlContent = "<p>Inactive</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        Assert.DoesNotContain(post, result);
    }

    // ----------------------------------------------------------------
    // 2. Tagged post of an active course is excluded outside the term window
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_ActiveCourseTag_OutsideTermWindow_Excluded()
    {
        var provider = CreateEmptyProvider();

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Active Course Post",
                Published = new DateTime(2025, 8, 24), // before termStart
                Tags = new List<string> { "fixture-course-a" }, // active course
            },
            Url = "active-course",
            HtmlContent = "<p>Active</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        Assert.DoesNotContain(post, result);
    }

    // ----------------------------------------------------------------
    // 3. Tagged post of an active course inside the window is visible
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_ActiveCourseTag_InsideTermWindow_Visible()
    {
        var provider = CreateEmptyProvider();

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Active Course Post",
                Published = new DateTime(2026, 3, 1), // inside term window
                Tags = new List<string> { "fixture-course-a" },
            },
            Url = "active-course",
            HtmlContent = "<p>Active</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        Assert.Contains(post, result);
    }

    // ----------------------------------------------------------------
    // 4. Multi-tag post visible if any tag matches an active course
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_MultiTagPostWithActiveTag_Visible()
    {
        var provider = CreateEmptyProvider();

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Multi-Tag Post",
                Published = new DateTime(2026, 3, 1),
                Tags = new List<string> { "fixture-course-c", "fixture-course-b" }, // b active
            },
            Url = "multi-tag",
            HtmlContent = "<p>Multi</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        Assert.Contains(post, result);
    }

    // ----------------------------------------------------------------
    // 5. Active-course post still hidden if published in the future
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_ActiveCourseTag_FuturePublished_Excluded()
    {
        var provider = CreateEmptyProvider();

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Future Active Post",
                Published = new DateTime(2026, 4, 1), // inside window but > LocalNow
                Tags = new List<string> { "fixture-course-a" },
            },
            Url = "future-active",
            HtmlContent = "<p>Future</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        Assert.DoesNotContain(post, result);
    }

    // ----------------------------------------------------------------
    // 6. Showcase mode bypasses the active-course check
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_InactiveCourseTag_ShowcaseMode_Visible()
    {
        BuildTimeProvider.IsShowcaseMode = true;
        var provider = CreateEmptyProvider();

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Inactive Showcase Post",
                Published = new DateTime(2026, 3, 1),
                Tags = new List<string> { "fixture-course-c" },
            },
            Url = "inactive-showcase",
            HtmlContent = "<p>Showcase</p>",
        };

        var result = provider.GetVisiblePosts(new[] { post });

        BuildTimeProvider.IsShowcaseMode = false;
        Assert.Contains(post, result);
    }

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
