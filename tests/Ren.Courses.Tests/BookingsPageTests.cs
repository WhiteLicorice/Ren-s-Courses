using System.Reflection;
using System.Runtime.CompilerServices;
using BlazorStatic.Services;
using BlazorStaticMinimalBlog.Components.Pages;
using BlazorStaticMinimalBlog.Services;
using Bunit;
using Microsoft.Extensions.DependencyInjection;

namespace Ren.Courses.Tests;

[Collection("BuildTimeProvider")]
public class BookingsPageTests
{
    // ----------------------------------------------------------------
    // 1. Empty service renders the empty state
    // ----------------------------------------------------------------
    [Fact]
    public void Render_NoBookings_ShowsEmptyState()
    {
        using var ctx = CreateContext([]);

        var cut = ctx.Render<Bookings>();

        Assert.Contains("No booking calendars available yet.", cut.Markup);
    }

    // ----------------------------------------------------------------
    // 2. Booking of inactive course is hidden
    // ----------------------------------------------------------------
    [Fact]
    public void Render_InactiveCourseBooking_Hidden()
    {
        using var ctx = CreateContext([
            MakeBooking("CMSC 125 Lab", "fixture-course-c"),
            MakeBooking("CMSC 124 Lab", "fixture-course-a"),
        ]);

        var cut = ctx.Render<Bookings>();

        Assert.Contains("CMSC 124 Lab", cut.Markup);
        Assert.DoesNotContain("CMSC 125 Lab", cut.Markup);
    }

    // ----------------------------------------------------------------
    // 3. Untagged booking is always visible
    // ----------------------------------------------------------------
    [Fact]
    public void Render_UntaggedBooking_Shown()
    {
        using var ctx = CreateContext([
            MakeBooking("General Consultation", null),
        ]);

        var cut = ctx.Render<Bookings>();

        Assert.Contains("General Consultation", cut.Markup);
    }

    // ----------------------------------------------------------------
    // 4. Showcase mode bypasses the active-course check
    // ----------------------------------------------------------------
    [Fact]
    public void Render_InactiveCourseBooking_ShowcaseMode_Shown()
    {
        using var ctx = CreateContext([
            MakeBooking("CMSC 125 Lab", "fixture-course-c"),
        ]);

        BuildTimeProvider.IsShowcaseMode = true;
        try
        {
            var cut = ctx.Render<Bookings>();
            Assert.Contains("CMSC 125 Lab", cut.Markup);
        }
        finally
        {
            BuildTimeProvider.IsShowcaseMode = false;
        }
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private static BunitContext CreateContext(List<Post<BookingFrontmatter>> bookings)
    {
        var ctx = new BunitContext();
        var service = CreateServiceWithPosts(bookings);
        ctx.Services.AddSingleton(service);
        ctx.Services.AddSingleton(new BookingContentProvider(service));
        return ctx;
    }

    private static Post<BookingFrontmatter> MakeBooking(string name, string? tag) =>
        new()
        {
            FrontMatter = new BookingFrontmatter
            {
                Name = name,
                Calendar = "https://cal.com/renscourses/test",
                Desc = "Book an appointment.",
                Tags = tag is null ? [] : [tag],
            },
            Url = name.ToLowerInvariant().Replace(" ", "-"),
            HtmlContent = "<p>booking</p>",
        };

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
