using System.Reflection;
using System.Runtime.CompilerServices;
using BlazorStatic.Services;
using BlazorStaticMinimalBlog.Components.Pages;
using Bunit;
using Microsoft.Extensions.DependencyInjection;

namespace Ren.Courses.Tests;

public class ProjectsPageTests
{
    // ----------------------------------------------------------------
    // 1. No projects renders the empty state
    // ----------------------------------------------------------------
    [Fact]
    public void Render_NoProjects_ShowsEmptyState()
    {
        using var ctx = new BunitContext();
        ctx.Services.AddSingleton(CreateServiceWithPosts([]));

        var cut = ctx.Render<Projects>();

        Assert.Contains("No projects available.", cut.Markup);
    }

    // ----------------------------------------------------------------
    // 2. With projects, no empty state and catalog renders
    // ----------------------------------------------------------------
    [Fact]
    public void Render_WithProjects_NoEmptyState()
    {
        using var ctx = new BunitContext();
        ctx.Services.AddSingleton(CreateServiceWithPosts([
            new Post<ProjectFrontMatter>
            {
                FrontMatter = new ProjectFrontMatter
                {
                    Title = "Aevum",
                    Tags = ["cmsc-124"],
                },
                Url = "aevum",
                HtmlContent = "<p>project</p>",
            },
        ]));

        var cut = ctx.Render<Projects>();

        Assert.DoesNotContain("No projects available.", cut.Markup);
        Assert.Contains("cmsc-124", cut.Markup);
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private static BlazorStaticContentService<ProjectFrontMatter> CreateServiceWithPosts(
        List<Post<ProjectFrontMatter>> posts)
    {
        var service = (BlazorStaticContentService<ProjectFrontMatter>)
            RuntimeHelpers.GetUninitializedObject(
                typeof(BlazorStaticContentService<ProjectFrontMatter>));

        var postsField = typeof(BlazorStaticContentService<ProjectFrontMatter>)
            .GetField("<Posts>k__BackingField",
                BindingFlags.Instance | BindingFlags.NonPublic);

        postsField!.SetValue(service, posts);

        return service;
    }
}
