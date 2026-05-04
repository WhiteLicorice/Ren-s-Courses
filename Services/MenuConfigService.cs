using System.Text.Json;
using BlazorStaticMinimalBlog.Components;

namespace BlazorStaticMinimalBlog.Services;

public class MenuConfigService
{
    public List<MenuItem> Items { get; }

    public MenuConfigService(string menuFilePath)
    {
        var json = File.ReadAllText(menuFilePath);
        var items = JsonSerializer.Deserialize<List<MenuItemJson>>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? [];

        Items = items.Select(i => new MenuItem(i.Name, i.Link, null, i.Target)).ToList();
    }
}

public record MenuItem(string Name, string Link, Svg.Icons? Icon, string Target);

public class MenuItemJson
{
    public string Name { get; set; } = "";
    public string Link { get; set; } = "";
    public string? Icon { get; set; }
    public string Target { get; set; } = "_self";
}
