using System.Reflection;
using System.Runtime.CompilerServices;
using BlazorStatic.Services;
using BlazorStaticMinimalBlog.Services;

namespace Ren.Courses.Tests;

[Collection("BuildTimeProvider")]
public class BookingContentProviderTests
{
    // ----------------------------------------------------------------
    // 1. Booking of inactive course is excluded
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_InactiveCourseTag_Excluded()
    {
        var provider = CreateEmptyProvider();
        var booking = MakeBooking("fixture-course-c", "CMSC 141 Lab");

        var result = provider.GetVisiblePosts(new[] { booking });

        Assert.DoesNotContain(booking, result);
    }

    // ----------------------------------------------------------------
    // 2. Booking of active course is included
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_ActiveCourseTag_Included()
    {
        var provider = CreateEmptyProvider();
        var booking = MakeBooking("fixture-course-a", "CMSC 124 Lab");

        var result = provider.GetVisiblePosts(new[] { booking });

        Assert.Contains(booking, result);
    }

    // ----------------------------------------------------------------
    // 3. Untagged booking is not course-scoped — always visible
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_Untagged_Included()
    {
        var provider = CreateEmptyProvider();
        var booking = MakeBooking(null, "General Consultation");

        var result = provider.GetVisiblePosts(new[] { booking });

        Assert.Contains(booking, result);
    }

    // ----------------------------------------------------------------
    // 4. Showcase mode bypasses the active-course check
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_InactiveCourseTag_ShowcaseMode_Included()
    {
        BuildTimeProvider.IsShowcaseMode = true;
        var provider = CreateEmptyProvider();
        var booking = MakeBooking("fixture-course-c", "CMSC 141 Lab");

        var result = provider.GetVisiblePosts(new[] { booking });

        BuildTimeProvider.IsShowcaseMode = false;
        Assert.Contains(booking, result);
    }

    // ----------------------------------------------------------------
    // 5. Results ordered by Name
    // ----------------------------------------------------------------
    [Fact]
    public void GetVisiblePosts_OrderedByName()
    {
        var provider = CreateEmptyProvider();
        var bookings = new[]
        {
            MakeBooking("fixture-course-a", "Zulu Lab"),
            MakeBooking("fixture-course-b", "Alpha Lab"),
        };

        var result = provider.GetVisiblePosts(bookings).ToList();

        Assert.Equal(2, result.Count);
        Assert.Equal("Alpha Lab", result[0].FrontMatter.Name);
        Assert.Equal("Zulu Lab", result[1].FrontMatter.Name);
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private static Post<BookingFrontmatter> MakeBooking(string? tag, string name) =>
        new()
        {
            FrontMatter = new BookingFrontmatter
            {
                Name = name,
                Calendar = $"https://cal.com/renscourses/{name.ToLowerInvariant()}",
                Desc = "Book an appointment.",
                Tags = tag is null ? [] : [tag],
            },
            Url = name.ToLowerInvariant().Replace(" ", "-"),
            HtmlContent = "<p>booking</p>",
        };

    private static BookingContentProvider CreateEmptyProvider()
        => new(CreateServiceWithPosts([]));

    private static BlazorStaticContentService<BookingFrontmatter> CreateServiceWithPosts(
        List<Post<BookingFrontmatter>> posts)
    {
        var service = (BlazorStaticContentService<BookingFrontmatter>)
            RuntimeHelpers.GetUninitializedObject(
                typeof(BlazorStaticContentService<BookingFrontmatter>));

        var postsField = typeof(BlazorStaticContentService<BookingFrontmatter>)
            .GetField("<Posts>k__BackingField",
                BindingFlags.Instance | BindingFlags.NonPublic);

        postsField!.SetValue(service, posts);

        return service;
    }
}
