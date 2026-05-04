using Bunit;
using Microsoft.AspNetCore.Components;
using BlazorStaticMinimalBlog.Components;

namespace Ren.Courses.Tests;

/// <summary>
/// bUnit component tests for PostGrid. Tests Grid/Stack layout rendering
/// and card template execution. PostGrid has no DI dependencies -- all data
/// comes through parameters, making it ideal for isolated component testing.
/// </summary>
public class PostGridComponentTests
{
    [Fact]
    public void PostGrid_GridLayout_RendersCorrectContainer()
    {
        using var ctx = new TestContext();
        var posts = new List<object> { "item1", "item2" };

        var cut = ctx.Render<PostGrid>(parameters => parameters
            .Add(p => p.Items, posts)
            .Add(p => p.Layout, PostGrid.PostGridLayout.Grid)
            .Add(p => p.CardTemplate, (object ctx2) => builder =>
            {
                builder.OpenElement(0, "div");
                builder.AddAttribute(1, "class", "card");
                builder.AddContent(2, ctx2.ToString());
                builder.CloseElement();
            })
        );

        var gridDiv = cut.Find("div.grid");
        Assert.NotNull(gridDiv);
        Assert.True(gridDiv.ClassList.Contains("grid"));
        Assert.True(gridDiv.ClassList.Contains("gap-6"));

        var cards = cut.FindAll(".card");
        Assert.Equal(2, cards.Count);
        Assert.Equal("item1", cards[0].TextContent);
        Assert.Equal("item2", cards[1].TextContent);
    }

    [Fact]
    public void PostGrid_StackLayout_RendersFlexContainer()
    {
        using var ctx = new TestContext();
        var posts = new List<object> { "project1", "project2" };

        var cut = ctx.Render<PostGrid>(parameters => parameters
            .Add(p => p.Items, posts)
            .Add(p => p.Layout, PostGrid.PostGridLayout.Stack)
            .Add(p => p.CardTemplate, (object ctx2) => builder =>
            {
                builder.OpenElement(0, "article");
                builder.AddAttribute(1, "class", "project-card");
                builder.AddContent(2, ctx2.ToString());
                builder.CloseElement();
            })
        );

        var flexDiv = cut.Find("div.flex");
        Assert.NotNull(flexDiv);
        Assert.True(flexDiv.ClassList.Contains("flex-col"));

        var cards = cut.FindAll(".project-card");
        Assert.Equal(2, cards.Count);
    }

    [Fact]
    public void PostGrid_EmptyItems_RendersEmptyContainer()
    {
        using var ctx = new TestContext();
        var posts = new List<object>();

        var cut = ctx.Render<PostGrid>(parameters => parameters
            .Add(p => p.Items, posts)
            .Add(p => p.Layout, PostGrid.PostGridLayout.Grid)
            .Add(p => p.CardTemplate, (object ctx2) => builder =>
            {
                builder.OpenElement(0, "span");
                builder.CloseElement();
            })
        );

        var gridDiv = cut.Find("div.grid");
        Assert.NotNull(gridDiv);
        Assert.Empty(cut.FindAll(".grid > *"));
    }

    [Fact]
    public void PostGrid_CardTemplate_ReceivesCorrectItemContext()
    {
        using var ctx = new TestContext();
        var items = new List<int> { 42, 99 };

        var cut = ctx.Render<PostGrid>(parameters => parameters
            .Add(p => p.Items, items.Cast<object>())
            .Add(p => p.Layout, PostGrid.PostGridLayout.Grid)
            .Add(p => p.CardTemplate, (object ctx2) => builder =>
            {
                builder.OpenElement(0, "span");
                builder.AddAttribute(1, "data-value", ctx2.ToString());
                builder.CloseElement();
            })
        );

        var spans = cut.FindAll("span[data-value]");
        Assert.Equal(2, spans.Count);
        Assert.Equal("42", spans[0].GetAttribute("data-value"));
        Assert.Equal("99", spans[1].GetAttribute("data-value"));
    }
}
