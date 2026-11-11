// @ts-check
'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { CELL_CODE, buildTableCodeMarkup } = require('../fixtures/table-code-fixtures');

/**
 * These tests measure the real stylesheet against a permanent in-memory article,
 * not against production or fixture material. The harness is served on the
 * static server's own origin at a synthetic route, so the built `css/app.css`
 * and the checked-in `css/site.css` load by their normal paths. site.js never
 * runs, so no service worker or unrelated widget can affect a measurement.
 *
 * The fixture also avoids a fixture Markdown edit. A fixture material change
 * forces a PDF regeneration, and the Tectonic bundle host refused requests on
 * 2026-11-11.
 */
const HARNESS_ROUTE = '/__table-code-harness';

/** Matches the article body wrapper in Components/Pages/Blog.razor. */
function harnessPage() {
    return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<base href="/">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="css/app.css">
<link rel="stylesheet" href="css/site.css">
<style>
  body { margin: 0; }
  .harness { padding-inline: 1rem; }
</style>
</head>
<body>
<main class="harness"><article class="prose max-w-none">${buildTableCodeMarkup()}</article></main>
</body>
</html>`;
}

test.use({ serviceWorkers: 'block', hasTouch: true });

async function mount(page, { width, height }) {
    await page.setViewportSize({ width, height });
    await page.route(`**${HARNESS_ROUTE}`, route => route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: harnessPage()
    }));
    await page.goto(HARNESS_ROUTE);
    await page.waitForSelector('td code', { timeout: 5000 });

    // Guard the harness: both real stylesheets must load, or a 404 would make
    // every size assertion measure Chrome's default UA sheet. Same-origin, so
    // cssRules is readable and proves the file parsed.
    const loaded = await page.evaluate(() => [...document.styleSheets]
        .map(sheet => ({ href: sheet.href || '', rules: sheet.cssRules.length }))
        .filter(sheet => /css\/(app|site)\.css/.test(sheet.href)));
    expect(loaded.map(sheet => new URL(sheet.href).pathname).sort())
        .toEqual(['/css/app.css', '/css/site.css']);
    expect(loaded.every(sheet => sheet.rules > 0)).toBe(true);
}

/** Computed font size in CSS pixels, plus the table scroll box. */
function readMetrics() {
    const size = selector => Number.parseFloat(
        window.getComputedStyle(document.querySelector(selector)).fontSize);
    const table = document.querySelector('table');
    return {
        cellCode: size('td code'),
        paragraphCode: size('article p code'),
        tableClientWidth: table.clientWidth,
        tableScrollWidth: table.scrollWidth
    };
}

const VIEWPORTS = [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 430, height: 932 }
];

test.describe('inline code in a table cell', () => {
    for (const viewport of VIEWPORTS) {
        test(`is at least 13px while paragraph code stays 14px at ${viewport.width}px`, async ({ page }) => {
            await mount(page, viewport);
            const metrics = await page.evaluate(readMetrics);

            expect(metrics.paragraphCode).toBe(14);
            expect(metrics.cellCode).toBeGreaterThanOrEqual(13);
        });
    }

    test('does not widen the page beyond the table scroll box', async ({ page }) => {
        const viewport = VIEWPORTS[0];
        await mount(page, viewport);
        const metrics = await page.evaluate(readMetrics);

        // The table is its own horizontal scroll box, so it must never push the
        // document sideways. A wider cell may only grow the box's scrollWidth.
        const pageOverflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth);
        expect(pageOverflow).toBeLessThanOrEqual(1);
        expect(metrics.tableScrollWidth).toBeGreaterThanOrEqual(metrics.tableClientWidth);
    });

    test('records the measurement at every width', async ({ page }) => {
        // The evidence file is written only when the caller names its folder, so
        // a normal suite run leaves no artifact behind.
        const evidenceDir = process.env.B012_EVIDENCE_DIR;
        const lines = [];
        for (const viewport of VIEWPORTS) {
            await mount(page, viewport);
            const metrics = await page.evaluate(readMetrics);
            lines.push(
                `${viewport.width}x${viewport.height}`
                + ` cell-code=${metrics.cellCode}px`
                + ` paragraph-code=${metrics.paragraphCode}px`
                + ` table-clientWidth=${metrics.tableClientWidth}`
                + ` table-scrollWidth=${metrics.tableScrollWidth}`);
        }
        if (evidenceDir) {
            fs.writeFileSync(path.join(evidenceDir, 'measurements.txt'), lines.join('\n') + '\n');
        }
    });
});
