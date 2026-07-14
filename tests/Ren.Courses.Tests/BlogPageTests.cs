using System.Reflection;
using System.Runtime.CompilerServices;
using BlazorStatic;
using BlazorStatic.Services;
using BlazorStaticMinimalBlog.Components.Pages;
using Bunit;
using Microsoft.Extensions.DependencyInjection;

namespace Ren.Courses.Tests;

public class BlogPageTests
{
    [Fact]
    public void Article_WithSubmissions_RendersNamedSubmissionLinks()
    {
        using var ctx = new BunitContext();
        var post = new Post<CourseFrontMatter>
        {
            Url = "test-material",
            HtmlContent = "<p>Body</p>",
            FrontMatter = new CourseFrontMatter
            {
                Title = "Test Material",
                Published = new DateTime(2026, 3, 1),
                Submissions =
                [
                    new() { Name = "Source code", Link = "https://forms.gle/source" },
                    new() { Name = "Individual reflection", Link = "https://forms.gle/reflection" }
                ]
            }
        };

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "test-material"));

        var section = cut.Find("section[aria-labelledby='submission-heading']");
        Assert.Contains("Submit your work", section.QuerySelector("h2")!.TextContent);

        var links = section.QuerySelectorAll("a");
        Assert.Equal(2, links.Length);
        Assert.Equal("Source code", links[0].TextContent.Trim());
        Assert.Equal("https://forms.gle/source", links[0].GetAttribute("href"));
        Assert.Equal("_blank", links[0].GetAttribute("target"));
        Assert.Equal("noopener noreferrer", links[0].GetAttribute("rel"));
        Assert.Equal("Individual reflection", links[1].TextContent.Trim());
    }

    [Fact]
    public void Article_WithoutSubmissions_DoesNotRenderSubmissionSection()
    {
        using var ctx = new BunitContext();
        var post = new Post<CourseFrontMatter>
        {
            Url = "reading",
            HtmlContent = "<p>Body</p>",
            FrontMatter = new CourseFrontMatter
            {
                Title = "Reading",
                Published = new DateTime(2026, 3, 1)
            }
        };

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "reading"));

        Assert.Empty(cut.FindAll("section[aria-labelledby='submission-heading']"));
    }

    [Fact]
    public void Article_WithDiagram_RendersStepWidgetAndSourceFallback()
    {
        using var ctx = new BunitContext();
        var post = new Post<CourseFrontMatter>
        {
            Url = "sorting",
            HtmlContent = "<p>Body</p>",
            FrontMatter = new CourseFrontMatter
            {
                Title = "Sorting",
                Published = new DateTime(2026, 3, 1),
                Diagrams =
                [
                    new()
                    {
                        Title = "Bubble sort",
                        Description = "A single pass.",
                        Steps =
                        [
                            new()
                            {
                                Title = "Compare",
                                Description = "Compare the first pair.",
                                Mermaid = "flowchart LR\n    A[5] --> B[2]"
                            },
                            new()
                            {
                                Title = "Swap",
                                Description = "Swap the pair.",
                                Mermaid = "flowchart LR\n    B[2] --> A[5]"
                            }
                        ]
                    }
                ]
            }
        };

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "sorting"));

        var widget = cut.Find("section[data-interactive-diagram]");
        Assert.Equal("Bubble sort", widget.QuerySelector("h2")!.TextContent.Trim());
        Assert.Contains("A single pass.", widget.TextContent);
        Assert.Equal(2, widget.QuerySelectorAll("[data-diagram-step]").Length);
        Assert.Contains("flowchart LR", widget.QuerySelector("[data-diagram-source]")!.TextContent);
        Assert.Equal(3, widget.QuerySelectorAll("button").Length);
    }

    [Fact]
    public void Article_WithoutDiagrams_DoesNotRenderDiagramWidget()
    {
        using var ctx = new BunitContext();
        var post = new Post<CourseFrontMatter>
        {
            Url = "reading",
            HtmlContent = "<p>Body</p>",
            FrontMatter = new CourseFrontMatter
            {
                Title = "Reading",
                Published = new DateTime(2026, 3, 1)
            }
        };

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "reading"));

        Assert.Empty(cut.FindAll("section[data-interactive-diagram]"));
    }

    private static void ConfigureArticleScripts(BunitContext ctx)
    {
        ctx.JSInterop.SetupVoid("addCodeFeatures");
        ctx.JSInterop.SetupVoid("generateTOC");
        ctx.JSInterop.SetupVoid("initScrollButton");
        ctx.JSInterop.SetupVoid("initInteractiveDiagrams");
    }

    private static BlazorStaticContentService<CourseFrontMatter> CreateServiceWithPosts(
        List<Post<CourseFrontMatter>> posts)
    {
        var service = (BlazorStaticContentService<CourseFrontMatter>)
            RuntimeHelpers.GetUninitializedObject(
                typeof(BlazorStaticContentService<CourseFrontMatter>));

        var postsField = typeof(BlazorStaticContentService<CourseFrontMatter>)
            .GetField("<Posts>k__BackingField", BindingFlags.Instance | BindingFlags.NonPublic);

        postsField!.SetValue(service, posts);
        return service;
    }
}
