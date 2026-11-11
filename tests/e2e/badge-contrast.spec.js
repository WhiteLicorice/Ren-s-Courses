// @ts-check
'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const {
    ARTICLE_SLUG,
    EXPIRED_ARTICLE_SLUG,
    DUE_TODAY_ARTICLE_SLUG,
    COURSE_PAGE_ROUTE
} = require('../fixtures/site/routes');

/**
 * The material card status badge is 12px text on a 10 percent tint of its own
 * colour. Measure the rendered pair, then assert WCAG AA contrast in both
 * themes. The fixture site carries one material for each status. The expired
 * and due-today fixtures declare downloadLink, so the build generates no PDF
 * for them and no PDF cache entry changes.
 */
const PAGES = ['/', COURSE_PAGE_ROUTE];
const THEMES = ['light', 'dark'];
const STATUSES = ['Expired', 'DueToday', 'Future'];
const MIN_CONTRAST = 4.5;

const STATUS_BY_SLUG = {
    [EXPIRED_ARTICLE_SLUG]: 'Expired',
    [DUE_TODAY_ARTICLE_SLUG]: 'DueToday',
    [ARTICLE_SLUG]: 'Future'
};

/**
 * Guard the fixtures inside the test that needs them. The label carries the
 * effective date. A re-dated fixture changes the label, so the guard fails
 * instead of measuring a different status under the same name.
 */
const EXPECTED_LABEL = {
    Expired: 'Exp: Sep 10',
    DueToday: 'Due: Sep 15',
    Future: /^Due: (Sep 20|Oct 02)$/
};

test.use({ serviceWorkers: 'block', hasTouch: true });

/** Reads each card badge and returns its rendered colour pair. */
function readBadges() {
    // Tailwind v4 serialises the palette as oklch() and the tint as a
    // color-mix() in oklab. Parse the computed forms, not the class names.
    const percentOrNumber = value =>
        value.endsWith('%') ? Number.parseFloat(value) / 100 : Number.parseFloat(value);
    const alphaValue = value =>
        value.endsWith('%') ? Number.parseFloat(value) / 100 : Number.parseFloat(value);

    const oklabToSrgb = (L, a, b, alpha) => {
        const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
        const l = l_ ** 3;
        const m = m_ ** 3;
        const s = s_ ** 3;
        const linear = {
            r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
        };
        const encode = value => {
            const v = value <= 0.0031308
                ? 12.92 * value
                : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
            return Math.min(255, Math.max(0, v * 255));
        };
        return { r: encode(linear.r), g: encode(linear.g), b: encode(linear.b), a: alpha };
    };

    const parseColor = value => {
        const text = String(value).trim();
        if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

        let match = /^rgba?\(([^)]+)\)$/i.exec(text);
        if (match) {
            const parts = match[1].split(/[,\s/]+/).filter(Boolean);
            if (parts.length < 3) return null;
            const channel = part => part.endsWith('%')
                ? Number.parseFloat(part) * 2.55
                : Number.parseFloat(part);
            return {
                r: channel(parts[0]),
                g: channel(parts[1]),
                b: channel(parts[2]),
                a: parts.length > 3 ? alphaValue(parts[3]) : 1
            };
        }

        match = /^oklch\(([^)]+)\)$/i.exec(text);
        if (match) {
            const [main, alphaPart] = match[1].split('/');
            const parts = main.trim().split(/\s+/);
            if (parts.length < 3) return null;
            const radians = Number.parseFloat(parts[2]) * Math.PI / 180;
            const chroma = Number.parseFloat(parts[1]);
            return oklabToSrgb(
                percentOrNumber(parts[0]),
                chroma * Math.cos(radians),
                chroma * Math.sin(radians),
                alphaPart === undefined ? 1 : alphaValue(alphaPart.trim()));
        }

        match = /^oklab\(([^)]+)\)$/i.exec(text);
        if (match) {
            const [main, alphaPart] = match[1].split('/');
            const parts = main.trim().split(/\s+/);
            if (parts.length < 3) return null;
            return oklabToSrgb(
                percentOrNumber(parts[0]),
                percentOrNumber(parts[1]),
                percentOrNumber(parts[2]),
                alphaPart === undefined ? 1 : alphaValue(alphaPart.trim()));
        }

        match = /^color\(srgb\s+([^)]+)\)$/i.exec(text);
        if (match) {
            const [main, alphaPart] = match[1].split('/');
            const parts = main.trim().split(/\s+/);
            if (parts.length < 3) return null;
            return {
                r: percentOrNumber(parts[0]) * 255,
                g: percentOrNumber(parts[1]) * 255,
                b: percentOrNumber(parts[2]) * 255,
                a: alphaPart === undefined ? 1 : alphaValue(alphaPart.trim())
            };
        }

        return null;
    };

    const requireColor = (value, owner) => {
        const color = parseColor(value);
        if (!color) throw new Error(`Cannot parse colour "${value}" from ${owner}`);
        return color;
    };

    const composite = (top, bottom) => ({
        r: top.r * top.a + bottom.r * (1 - top.a),
        g: top.g * top.a + bottom.g * (1 - top.a),
        b: top.b * top.a + bottom.b * (1 - top.a),
        a: 1
    });

    // Walk up from the element and composite each translucent layer. The card
    // surface is opaque, so the walk stops there.
    const backingColor = element => {
        const layers = [];
        for (let node = element; node; node = node.parentElement) {
            const value = getComputedStyle(node).backgroundColor;
            const color = requireColor(value, node.tagName);
            if (color.a > 0) {
                layers.push(color);
                if (color.a >= 1) break;
            }
        }
        let result = { r: 255, g: 255, b: 255, a: 1 };
        for (let i = layers.length - 1; i >= 0; i--) {
            result = composite(layers[i], result);
        }
        return result;
    };

    const channel = value => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };

    const luminance = color =>
        0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);

    const contrast = (first, second) => {
        const a = luminance(first);
        const b = luminance(second);
        const lighter = Math.max(a, b);
        const darker = Math.min(a, b);
        return (lighter + 0.05) / (darker + 0.05);
    };

    const badgeText = /^(Exp|Due): [A-Z][a-z]{2} \d{2}$/;

    return [...document.querySelectorAll('article')].map(article => {
        const link = article.querySelector('h3 a[href*="articles/"]');
        const slug = link
            ? link.getAttribute('href').split('/').filter(Boolean).pop()
            : null;
        const badge = [...article.querySelectorAll('div')]
            .find(element => badgeText.test(element.textContent.trim()));
        if (!badge) return null;

        const style = getComputedStyle(badge);
        const foreground = requireColor(style.color, 'badge text');
        const background = backingColor(badge);
        return {
            slug,
            text: badge.textContent.trim(),
            appliedTheme: document.documentElement.getAttribute('data-theme'),
            surface: getComputedStyle(document.documentElement)
                .getPropertyValue('--bg-surface').trim(),
            fontSize: Number.parseFloat(style.fontSize),
            fontWeight: style.fontWeight,
            opacity: Number(style.opacity),
            foreground: style.color,
            background: `rgb(${Math.round(background.r)}, `
                + `${Math.round(background.g)}, ${Math.round(background.b)})`,
            contrast: Math.round(contrast(foreground, background) * 1000) / 1000
        };
    }).filter(Boolean);
}

async function visit(page, viewport, theme, route) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    // Drive the theme through the system preference. The site boot script
    // resolves it on load, the same path a reader takes. A direct data-theme
    // write is not stable here, because the theme script re-resolves it.
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(route);
    await page.waitForLoadState('load');
    await page.waitForFunction(
        wanted => document.documentElement.getAttribute('data-theme') === wanted,
        theme);

    // Guard the measurement: the built stylesheet must load and parse, or the
    // computed colours would come from the user agent sheet.
    const sheets = await page.evaluate(() => [...document.styleSheets]
        .filter(sheet => /css\/app\.css/.test(sheet.href || ''))
        .map(sheet => sheet.cssRules.length));
    expect(sheets.length, `${route} must load css/app.css`).toBe(1);
    expect(sheets[0], 'css/app.css must parse').toBeGreaterThan(0);

    const applied = await page.evaluate(() => ({
        theme: document.documentElement.getAttribute('data-theme'),
        surface: getComputedStyle(document.documentElement)
            .getPropertyValue('--bg-surface').trim()
    }));
    expect(applied.theme, `${route} must apply the ${theme} theme`).toBe(theme);
    expect(applied.surface, `${route} must resolve the ${theme} surface`).not.toBe('');
}

/** The measured badge for each status, keyed by status. */
function badgesByStatus(badges) {
    const result = {};
    for (const badge of badges) {
        const status = STATUS_BY_SLUG[badge.slug];
        if (status) result[status] = badge;
    }
    return result;
}

const VIEWPORTS = [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 430, height: 932 }
];

test.describe('material card status badge contrast', () => {
    for (const viewport of VIEWPORTS) {
        test(`is at least 4.5 to 1 in both themes at ${viewport.width}px`, async ({ page }) => {
            for (const theme of THEMES) {
                for (const route of PAGES) {
                    await visit(page, viewport, theme, route);
                    const badges = badgesByStatus(await page.evaluate(readBadges));

                    for (const status of STATUSES) {
                        const badge = badges[status];
                        const label = `${status} on ${route} in ${theme} at ${viewport.width}px`;
                        expect.soft(badge, `${label}: badge not found`).toBeTruthy();
                        if (!badge) continue;

                        expect.soft(badge.text, `${label}: fixture label`).toMatch(EXPECTED_LABEL[status]);
                        expect.soft(badge.fontSize, `${label}: font size`).toBe(12);
                        expect.soft(badge.contrast, `${label}: measured ${badge.foreground} `
                            + `on ${badge.background}`).toBeGreaterThanOrEqual(MIN_CONTRAST);
                    }
                }
            }
        });
    }

    test('records every badge measurement', async ({ page }) => {
        const evidenceDir = process.env.B006_EVIDENCE_DIR;
        const lines = [];
        for (const viewport of VIEWPORTS) {
            for (const theme of THEMES) {
                for (const route of PAGES) {
                    await visit(page, viewport, theme, route);
                    const badges = badgesByStatus(await page.evaluate(readBadges));
                    for (const status of STATUSES) {
                        const badge = badges[status];
                        lines.push(badge
                            ? `${viewport.width}x${viewport.height} ${route} ${theme} ${status}`
                                + ` applied=${badge.appliedTheme} surface=${badge.surface}`
                                + ` text=${badge.text} fontSize=${badge.fontSize}`
                                + ` weight=${badge.fontWeight} opacity=${badge.opacity}`
                                + ` fg=${badge.foreground} bg=${badge.background}`
                                + ` contrast=${badge.contrast.toFixed(2)}`
                            : `${viewport.width}x${viewport.height} ${route} ${theme} ${status}`
                                + ' badge=missing');
                    }
                }
            }
        }
        if (evidenceDir) {
            fs.writeFileSync(path.join(evidenceDir, 'measurements.txt'), lines.join('\n') + '\n');
        }
    });

    test('the materials catalog lists tags, not cards', async ({ page }) => {
        // /materials is the tag cloud. Cards live on / and on a course page.
        await page.goto('/materials');
        await page.waitForLoadState('load');
        expect(await page.locator('article').count()).toBe(0);
        expect(await page.locator('a[href*="materials/"]').count()).toBeGreaterThan(0);
    });
});
