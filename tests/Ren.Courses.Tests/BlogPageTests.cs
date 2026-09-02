using System.Reflection;
using System.Runtime.CompilerServices;
using BlazorStatic;
using BlazorStatic.Services;
using BlazorStaticMinimalBlog.Components.Pages;
using Bunit;
using Microsoft.Extensions.DependencyInjection;

namespace Ren.Courses.Tests;

[Collection("BuildTimeProvider")]
public class BlogPageTests
{
    [Fact]
    public void Home_UsesParsedPostsEvenWhenProviderCapturedAnEmptyService()
    {
        using var ctx = new BunitContext();
        var post = new Post<CourseFrontMatter>
        {
            Url = "interactive-demo",
            HtmlContent = "<p>Demo</p>",
            FrontMatter = new CourseFrontMatter
            {
                Title = "Interactive demo",
                Published = new DateTime(2026, 3, 1),
                Tags = ["demo"]
            }
        };
        var parsedPosts = CreateServiceWithPosts([post]);
        var providerWithEmptySnapshot = new CourseContentProvider(CreateServiceWithPosts([]));

        ctx.Services.AddSingleton(parsedPosts);
        ctx.Services.AddSingleton(providerWithEmptySnapshot);
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var previousShowcaseMode = BuildTimeProvider.IsShowcaseMode;
        try
        {
            BuildTimeProvider.IsShowcaseMode = true;
            var cut = ctx.Render<Blog>();

            Assert.Contains("Interactive demo", cut.Markup);
            Assert.Single(cut.FindAll("article[data-course-tags]"));
        }
        finally
        {
            BuildTimeProvider.IsShowcaseMode = previousShowcaseMode;
        }
    }

    [Fact]
    public void Home_NoVisiblePosts_ShowsNoMaterialsText()
    {
        using var ctx = new BunitContext();
        ctx.Services.AddSingleton(CreateServiceWithPosts([]));
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>();

        Assert.Contains("No Materials available.", cut.Markup);
    }

    [Fact]
    public void Home_CourseFilterChips_ExcludeInactiveCourses()
    {
        using var ctx = new BunitContext();
        var posts = CreateServiceWithPosts([
            new Post<CourseFrontMatter>
            {
                Url = "active-post",
                HtmlContent = "<p>Active</p>",
                FrontMatter = new CourseFrontMatter
                {
                    Title = "Active post",
                    Published = new DateTime(2026, 3, 1),
                    Tags = ["fixture-course-a"],
                },
            },
            new Post<CourseFrontMatter>
            {
                Url = "inactive-post",
                HtmlContent = "<p>Inactive</p>",
                FrontMatter = new CourseFrontMatter
                {
                    Title = "Inactive post",
                    Published = new DateTime(2026, 3, 1),
                    Tags = ["fixture-course-c"],
                },
            },
        ]);
        ctx.Services.AddSingleton(posts);
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>();

        var chips = cut.FindAll("button[data-tag]")
            .Select(b => b.GetAttribute("data-tag"))
            .ToList();
        Assert.Contains("fixture-course-a", chips);
        Assert.DoesNotContain("fixture-course-c", chips);
    }

    [Fact]
    public void Article_WithSubmissions_RendersCompactSubmissionMenuBesideDownload()
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
                DownloadLink = "https://example.com/material.pdf",
                Submissions =
                [
                    new() { Name = "Source code", Link = "https://forms.gle/source" },
                    new() { Name = "Individual reflection", Link = "https://forms.gle/reflection" }
                ]
            }
        };

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "test-material"));

        var actions = cut.Find("[data-material-actions]");
        var download = actions.QuerySelector("a[data-download-action]");
        Assert.NotNull(download);
        Assert.Equal("https://example.com/material.pdf", download.GetAttribute("href"));

        var menu = actions.QuerySelector("[data-submission-menu]");
        Assert.NotNull(menu);
        var trigger = menu.QuerySelector("button[data-submission-trigger]");
        Assert.NotNull(trigger);
        Assert.Equal("Submit", trigger.TextContent.Trim());
        Assert.Equal("false", trigger.GetAttribute("aria-expanded"));
        Assert.Equal("submission-menu-panel", trigger.GetAttribute("aria-controls"));
        Assert.NotNull(trigger.QuerySelector("svg[data-submit-icon]"));
        Assert.NotNull(menu.QuerySelector("#submission-menu-panel"));

        var links = menu.QuerySelectorAll("a");
        Assert.Equal(2, links.Length);
        Assert.Equal("Source code", links[0].TextContent.Trim());
        Assert.Equal("https://forms.gle/source", links[0].GetAttribute("href"));
        Assert.Equal("_blank", links[0].GetAttribute("target"));
        Assert.Equal("noopener noreferrer", links[0].GetAttribute("rel"));
        Assert.Equal("Individual reflection", links[1].TextContent.Trim());
    }

    [Fact]
    public void Article_WithoutSubmissions_DoesNotRenderSubmissionMenu()
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
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "reading"));

        Assert.Empty(cut.FindAll("[data-submission-menu]"));
    }

    [Fact]
    public void Article_WithDiagram_RendersStepWidgetAndSourceFallback()
    {
        using var ctx = new BunitContext();
        var diagram = DiagramFixtures.MixedAspectSteps("k");
        var post = DiagramFixtures.BuildPost(
            "sorting",
            "<p>Before</p>\n<!-- diagram: k -->\n<p>After</p>",
            diagram);

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "sorting"));

        var widget = cut.Find("section[data-interactive-diagram]");
        Assert.Equal(diagram.Title, widget.QuerySelector("h2")!.TextContent.Trim());
        Assert.Contains(diagram.Description, widget.TextContent);
        Assert.Equal(diagram.Steps.Count, widget.QuerySelectorAll("[data-diagram-step]").Length);
        Assert.Contains("flowchart LR", widget.QuerySelector("[data-diagram-source]")!.TextContent);
        Assert.Equal(3, widget.QuerySelectorAll("button").Length);

        // Placement assertion: widget sits between "Before" and "After" in markup
        var markup = cut.Markup;
        var beforeIdx = markup.IndexOf("Before", StringComparison.Ordinal);
        var widgetIdx = markup.IndexOf("data-interactive-diagram", StringComparison.Ordinal);
        var afterIdx = markup.IndexOf("After", StringComparison.Ordinal);
        Assert.True(beforeIdx < widgetIdx, "Widget should appear after 'Before' text");
        Assert.True(widgetIdx < afterIdx, "Widget should appear before 'After' text");
    }

    [Fact]
    public void Article_DiagramWithNarrowDirection_EmitsDirectionMetadata()
    {
        using var ctx = new BunitContext();
        var diagram = DiagramFixtures.WideTokenStream("tokens");
        var post = DiagramFixtures.BuildPost(
            "tokens",
            DiagramFixtures.MarkersFor(diagram),
            diagram);

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "tokens"));

        var widget = cut.Find("section[data-interactive-diagram]");
        Assert.Equal("TB", widget.GetAttribute("data-diagram-narrow-direction"));
    }

    [Fact]
    public void Article_DiagramWithoutNarrowDirection_OmitsDirectionMetadata()
    {
        using var ctx = new BunitContext();
        var diagram = DiagramFixtures.WideFlowchartWithoutReflow("phases");
        var post = DiagramFixtures.BuildPost(
            "phases",
            DiagramFixtures.MarkersFor(diagram),
            diagram);

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "phases"));

        var widget = cut.Find("section[data-interactive-diagram]");
        Assert.False(widget.HasAttribute("data-diagram-narrow-direction"));
    }

    [Theory]
    [InlineData("LR")]
    [InlineData("tb")]
    [InlineData("diagonal")]
    public void Article_DiagramWithUnsupportedNarrowDirection_OmitsDirectionMetadata(string direction)
    {
        using var ctx = new BunitContext();
        var diagram = DiagramFixtures.WideTokenStream("tokens");
        diagram.NarrowDirection = direction;
        var post = DiagramFixtures.BuildPost(
            "tokens",
            DiagramFixtures.MarkersFor(diagram),
            diagram);

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "tokens"));

        var widget = cut.Find("section[data-interactive-diagram]");
        Assert.False(widget.HasAttribute("data-diagram-narrow-direction"));
    }

    [Fact]
    public void Article_DiagramSteps_EmitUniqueViewportAndInstructionIds()
    {
        using var ctx = new BunitContext();
        var first = DiagramFixtures.WideTokenStream("tokens");
        var second = DiagramFixtures.AlreadyVerticalFlowchart("commit");
        var post = DiagramFixtures.BuildPost(
            "two-widgets",
            DiagramFixtures.MarkersFor(first, second),
            first,
            second);

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "two-widgets"));

        var viewports = cut.FindAll("[data-diagram-viewport]");
        var hints = cut.FindAll("[data-diagram-scroll-hint]");
        Assert.Equal(first.Steps.Count + second.Steps.Count, viewports.Count);
        Assert.Equal(viewports.Count, hints.Count);

        var viewportIds = viewports.Select(viewport => viewport.Id).ToList();
        var hintIds = hints.Select(hint => hint.Id).ToList();
        Assert.All(viewportIds, id => Assert.False(string.IsNullOrWhiteSpace(id)));
        Assert.All(hintIds, id => Assert.False(string.IsNullOrWhiteSpace(id)));
        Assert.Equal(viewportIds.Count, viewportIds.Distinct(StringComparer.Ordinal).Count());
        Assert.Equal(hintIds.Count, hintIds.Distinct(StringComparer.Ordinal).Count());

        // Every viewport points at its own instruction, and every instruction starts hidden.
        for (var index = 0; index < viewports.Count; index++)
        {
            Assert.Equal(hintIds[index], viewports[index].GetAttribute("aria-describedby"));
            Assert.True(hints[index].HasAttribute("hidden"));
        }

        // The stage that receives the SVG lives inside the scrollable viewport.
        Assert.All(viewports, viewport => Assert.NotNull(viewport.QuerySelector("[data-diagram-canvas]")));
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
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "reading"));

        Assert.Empty(cut.FindAll("section[data-interactive-diagram]"));
    }

    [Fact]
    public void Article_DiagramDeclaredNoMarker_DoesNotRenderWidget()
    {
        using var ctx = new BunitContext();
        var post = DiagramFixtures.BuildPost(
            "strict-mode",
            "<p>Body with no marker</p>",
            DiagramFixtures.SingleStepDiagram("unreferenced"));

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "strict-mode"));

        Assert.Empty(cut.FindAll("section[data-interactive-diagram]"));
    }

    [Fact]
    public void Article_MarkerWithUnknownKey_NoExceptionNoWidget()
    {
        using var ctx = new BunitContext();
        var post = new Post<CourseFrontMatter>
        {
            Url = "unknown-key",
            HtmlContent = "<p>Body</p>\n<!-- diagram: nonexistent -->\n<p>More</p>",
            FrontMatter = new CourseFrontMatter
            {
                Title = "Unknown Key",
                Published = new DateTime(2026, 3, 1)
            }
        };

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "unknown-key"));

        Assert.Empty(cut.FindAll("section[data-interactive-diagram]"));
    }

    [Fact]
    public void Article_SameKeyTwice_RendersTwoWidgetsWithDistinctIds()
    {
        using var ctx = new BunitContext();
        var post = DiagramFixtures.BuildPost(
            "twice",
            "<!-- diagram: k -->\nmid\n<!-- diagram: k -->",
            DiagramFixtures.SingleStepDiagram("k"));

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "twice"));

        var widgets = cut.FindAll("section[data-interactive-diagram]");
        Assert.Equal(2, widgets.Count);
        Assert.Contains("learning-diagram-0-title", widgets[0].InnerHtml);
        Assert.Contains("learning-diagram-1-title", widgets[1].InnerHtml);
    }

    [Fact]
    public void Article_TwoDistinctDiagrams_RendersSequentialDistinctIds()
    {
        using var ctx = new BunitContext();
        var post = DiagramFixtures.BuildPost(
            "two-diagrams",
            "<!-- diagram: a -->\n<!-- diagram: b -->",
            DiagramFixtures.SingleStepDiagram("a"),
            DiagramFixtures.AlreadyVerticalFlowchart("b"));

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ConfigureArticleScripts(ctx);

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "two-diagrams"));

        var widgets = cut.FindAll("section[data-interactive-diagram]");
        Assert.Equal(2, widgets.Count);
        Assert.Contains("learning-diagram-0-title", widgets[0].InnerHtml);
        Assert.Contains("learning-diagram-1-title", widgets[1].InnerHtml);
    }

    [Fact]
    public void Article_RendersWithoutIssuingAnyJavaScriptInterop()
    {
        // The static output ships no Blazor runtime (App.razor loads plain <script src>
        // tags only, and no @rendermode is applied), so JS init belongs to site.js on
        // DOMContentLoaded. Any interop call from a page component is dead code; bUnit's
        // strict JSInterop mode is what proves none is issued.
        using var ctx = new BunitContext();
        var post = new Post<CourseFrontMatter>
        {
            Url = "no-interop",
            HtmlContent = "<h2 id=\"one\">One</h2>",
            FrontMatter = new CourseFrontMatter
            {
                Title = "No Interop",
                Published = new DateTime(2026, 3, 1)
            }
        };

        ctx.Services.AddSingleton(CreateServiceWithPosts([post]));
        ctx.Services.AddSingleton(new CourseContentProvider(CreateServiceWithPosts([])));
        ctx.Services.AddSingleton<FrontmatterStatusService>();
        ctx.Services.AddSingleton(new PdfGenerationManifest());

        var cut = ctx.Render<Blog>(parameters => parameters
            .Add(p => p.FileName, "no-interop"));

        Assert.Contains("No Interop", cut.Markup);
    }

    private static void ConfigureArticleScripts(BunitContext ctx)
    {
        ctx.Services.AddSingleton(new PdfGenerationManifest());
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

        var optionsType = typeof(BlazorStaticContentService<CourseFrontMatter>).Assembly
            .GetTypes()
            .First(type => type.Name == "BlazorStaticContentOptions`1")
            .MakeGenericType(typeof(CourseFrontMatter));
        var options = RuntimeHelpers.GetUninitializedObject(optionsType);
        optionsType.GetProperty("PageUrl")!.SetValue(options, "articles");
        var optionsField = typeof(BlazorStaticContentService<CourseFrontMatter>)
            .GetFields(BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public)
            .First(field => field.FieldType == optionsType);
        optionsField.SetValue(service, options);

        return service;
    }
}
