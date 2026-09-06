// wwwroot/theme.js

/**
 * DYNAMIC PRISM THEME SWAPPER
 * Registry-driven: window.siteThemeRegistry is rendered by App.razor from
 * Models/SiteThemeRegistry. Falls back to light/dark when absent (Jest).
 */
window.switchPrismTheme = (theme) => {
    const link = document.getElementById('prism-theme-link');

    const registry = Array.isArray(window.siteThemeRegistry) && window.siteThemeRegistry.length > 0
        ? window.siteThemeRegistry.map(entry => entry.site).filter(Boolean)
        : ['light', 'dark'];

    let targetMode = null;

    // 1. Resolve Mode from the registry, not a binary if/else.
    if (registry.includes(theme)) {
        targetMode = theme;
    } else {
        // 'default' (or unknown) -> Check System between light/dark when both exist.
        const hasLight = registry.includes('light');
        const hasDark = registry.includes('dark');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (hasLight && hasDark) targetMode = systemDark ? 'dark' : 'light';
        else targetMode = registry[0];
    }

    // 2. Swap CSS when the link exists. A missing highlight link must never
    // gate the site theme, storage, or chrome colour.
    if (link) {
        const fallbackPrism = targetMode === 'light' || targetMode === 'dark'
            ? `css/prism-${targetMode}.css`
            : null;
        const newHref = link.dataset[`${targetMode}Href`]
            || fallbackPrism
            || link.dataset.darkHref
            || link.dataset.lightHref
            || link.getAttribute('href');
        if (newHref) link.href = newHref;
    }

    // 3. Update DOM. Flipping data-theme is the entire diagram operation now:
    // diagrams repaint through CSS variables with no Mermaid call.
    document.documentElement.setAttribute('data-theme', targetMode);

    // 4. Clean Storage (Since we rely on System Settings, we keep storage clean)
    if (theme === 'default') {
        localStorage.removeItem('user-theme');
    } else {
        localStorage.setItem('user-theme', theme);
    }

    // 5. Update theme-color meta tag for browser chrome
    updateThemeColorMeta(targetMode);
};

/**
 * Updates browser chrome theme-color to match the site theme.
 * Reads window.siteThemeColors (rendered from the C# registry) first so the
 * hex literals live once in Models/SiteThemeRegistry, not twice in JS.
 */
function updateThemeColorMeta(mode) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    const registryColors = window.siteThemeColors ?? {};
    meta.content = registryColors[mode]
        ?? (mode === 'light' ? '#f8f9fa' : '#111827');
}

// Listen for system changes, but never clobber an explicit stored choice.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    try {
        if (localStorage.getItem('user-theme')) return;
    } catch {
        // Storage unavailable: fall through to following the OS.
    }
    window.switchPrismTheme('default');
});
