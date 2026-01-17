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
        // If "default", we remove the attribute so system preference takes over
        if (themeName == "default")
        {
            await _js.InvokeVoidAsync("document.documentElement.removeAttribute", "data-theme");
            await _js.InvokeVoidAsync("localStorage.removeItem", "user-theme");
        }
        else
        {
            await _js.InvokeVoidAsync("document.documentElement.setAttribute", "data-theme", themeName);
            await _js.InvokeVoidAsync("localStorage.setItem", "user-theme", themeName);
        }

        OnThemeChanged?.Invoke();
    }

    public async Task<string> GetCurrentTheme()
    {
        return await _js.InvokeAsync<string>("localStorage.getItem", "user-theme") ?? "default";
    }
}