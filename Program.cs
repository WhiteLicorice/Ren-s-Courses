using BlazorStatic;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using BlazorStaticMinimalBlog.Components;
using BlazorStaticMinimalBlog.Models;
using BlazorStaticMinimalBlog.Services;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseStaticWebAssets();

builder.Services.AddBlazorStaticService(opt =>
{
    //opt. //check to change the defaults
})
.AddBlazorStaticContentService<CourseFrontMatter>(opt =>
{
    opt.ContentPath = "Content/Materials";
    opt.Tags.TagsPageUrl = "materials";
    opt.PageUrl = "articles";
})
.AddBlazorStaticContentService<ProjectFrontMatter>(opt =>
{
    opt.ContentPath = "Content/Projects";
    opt.Tags.TagsPageUrl = "projects";
    opt.PageUrl = "null";
})
.AddBlazorStaticContentService<BookingFrontmatter>(opt =>
{
    opt.ContentPath = "Content/Bookings";
    opt.Tags.TagsPageUrl = "null";
    opt.PageUrl = "null";
});

builder.Services.AddRazorComponents();
builder.Services.AddSingleton<HolidaysProvider>();
builder.Services.AddSingleton<CourseContentProvider>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();
app.UseAntiforgery();

app.MapRazorComponents<App>();

app.UseBlazorStaticGenerator(shutdownApp: !app.Environment.IsDevelopment());

app.Run();

public static class WebsiteKeys
{
    public const string GitHubRepo = "https://github.com/WhiteLicorice/Ren-s-Courses";
    public const string AuthorGitHub = "https://github.com/WhiteLicorice";
    public const string Title = "Ren's Courses";
    public const string BlogPostStorageAddress = $"{GitHubRepo}/tree/main/Content/Blog";
    public const string BlogLead = "Ren's Courses is a headless Learning Management System designed for CS units I handle under the University of the Philippines Visayas, Division of Physical Sciences and Mathematics. All rights reserved.";
}
