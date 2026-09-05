// wwwroot/theme.js

/**
 * DYNAMIC PRISM THEME SWAPPER
 */
window.switchPrismTheme = (theme) => {
    const link = document.getElementById('prism-theme-link');
    if (!link) return;

    const themes = {
        dark: link.dataset.darkHref || "css/prism-dark.css",
        light: link.dataset.lightHref || "css/prism-light.css"
    };

    let targetMode = 'dark';

    // 1. Resolve Mode
    if (theme === 'light') targetMode = 'light';
    else if (theme === 'dark') targetMode = 'dark';
    else {
        // 'default' -> Check System
        targetMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // 2. Swap CSS (Force update)
    const newHref = themes[targetMode];
    link.href = newHref;

    // 3. Update DOM
    document.documentElement.setAttribute('data-theme', targetMode);
    if (window.refreshInteractiveDiagrams) window.refreshInteractiveDiagrams();

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
 * Updates browser chrome theme-color to match accent.
 * Uses dark/light adaptive colors instead of hardcoded red.
 */
function updateThemeColorMeta(mode) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    // Use color that adapts to theme: dark bg in dark mode, light bg in light mode
    meta.content = mode === 'light' ? '#f8f9fa' : '#111827';
}

// Listen for system changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    window.switchPrismTheme('default');
});
