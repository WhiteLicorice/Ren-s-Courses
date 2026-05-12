'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../theme.js'), 'utf8');

// Stub matchMedia before loading the script (script registers a change listener at load time).
function stubMatchMedia(prefersDark) {
    const listeners = [];
    window.matchMedia = jest.fn().mockReturnValue({
        matches: prefersDark,
        addEventListener: (_, cb) => listeners.push(cb),
        removeEventListener: () => {},
        _listeners: listeners,
        _fire: (matches) => listeners.forEach(cb => cb({ matches })),
    });
}

function loadScript() {
    // eslint-disable-next-line no-new-func
    new Function(source)();
}

function buildDOM() {
    document.head.innerHTML = `<link id="prism-theme-link" rel="stylesheet" href="css/prism-dark.css">`;
    document.documentElement.setAttribute('data-theme', 'dark');
}

afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.head.innerHTML = '';
});

describe('switchPrismTheme', () => {
    beforeEach(() => {
        stubMatchMedia(true);
        buildDOM();
        loadScript();
    });

    test('sets link href to prism-light.css for "light"', () => {
        window.switchPrismTheme('light');
        expect(document.getElementById('prism-theme-link').href).toContain('prism-light.css');
    });

    test('sets link href to prism-dark.css for "dark"', () => {
        window.switchPrismTheme('dark');
        expect(document.getElementById('prism-theme-link').href).toContain('prism-dark.css');
    });

    test('sets data-theme attribute to "light"', () => {
        window.switchPrismTheme('light');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    test('sets data-theme attribute to "dark"', () => {
        window.switchPrismTheme('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    test('saves theme to localStorage', () => {
        window.switchPrismTheme('light');
        expect(localStorage.getItem('user-theme')).toBe('light');
    });

    test('"default" removes user-theme from localStorage', () => {
        localStorage.setItem('user-theme', 'light');
        window.switchPrismTheme('default');
        expect(localStorage.getItem('user-theme')).toBeNull();
    });

    test('"default" follows system preference (dark)', () => {
        // matchMedia already stubbed to dark=true.
        window.switchPrismTheme('default');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    test('"default" follows system preference (light)', () => {
        window.matchMedia = jest.fn().mockReturnValue({ matches: false, addEventListener: () => {} });
        window.switchPrismTheme('default');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    test('creates theme-color meta tag when absent', () => {
        document.querySelector('meta[name="theme-color"]')?.remove();
        window.switchPrismTheme('dark');
        const meta = document.querySelector('meta[name="theme-color"]');
        expect(meta).not.toBeNull();
        expect(meta.content).toBe('#111827');
    });

    test('updates existing theme-color meta tag', () => {
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = '#000000';
        document.head.appendChild(meta);
        window.switchPrismTheme('light');
        expect(document.querySelector('meta[name="theme-color"]').content).toBe('#f8f9fa');
    });

    test('no-op when prism-theme-link element is absent', () => {
        document.getElementById('prism-theme-link').remove();
        expect(() => window.switchPrismTheme('light')).not.toThrow();
    });
});
