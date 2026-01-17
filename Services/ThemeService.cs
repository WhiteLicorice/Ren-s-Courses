using Microsoft.JSInterop;

namespace BlazorStaticMinimalBlog.Services;

public class ThemeService
{
    private readonly IJSRuntime _js;
    public event Action? OnThemeChanged;

    public ThemeService(IJSRuntime js)
    {
        _js = js;
    }

    public async Task SetTheme(string themeName)
    {
        // Hand off ALL logic to JavaScript to ensure CSS and Attributes stay in sync.
        // We do not manipulate the DOM or localStorage here anymore to prevent race conditions.
        await _js.InvokeVoidAsync("switchPrismTheme", themeName);

        OnThemeChanged?.Invoke();
    }

    public async Task<string> GetCurrentTheme()
    {
        return await _js.InvokeAsync<string>("localStorage.getItem", "user-theme") ?? "default";
    }
}