// wwwroot/theme.js

/**
 * DYNAMIC PRISM THEME SWAPPER
 */
window.switchPrismTheme = (theme) => {
    const link = document.getElementById('prism-theme-link');
    if (!link) return;

    // Use Absolute Paths (Start with /) to ensure it works on all pages
    const themes = {
        dark: "css/prism-dark.css",
        light: "css/prism-light.css"
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

    // 4. Clean Storage (Since we rely on System Settings, we keep storage clean)
    if (theme === 'default') {
        localStorage.removeItem('user-theme');
    } else {
        localStorage.setItem('user-theme', theme);
    }
};

// Listen for system changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    window.switchPrismTheme('default');
});