// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { DIAGRAM_FIXTURES, MULTIPLE_WIDGETS, buildPageMarkup } = require('../fixtures/diagram-fixtures');

/**
 * These tests run the real renderer against permanent in-memory fixtures, not
 * against production material. The harness document is served on the static
 * server's own origin at a synthetic route, so the real stylesheet, the real
 * interactive-diagrams.js, and the pinned Mermaid bundle all load by their
 * normal paths. site.js never runs, so no service worker or unrelated widget
 * can affect a measurement.
 *
 * The harness must share the server origin. An `about:blank` document has an
 * opaque origin, and Chrome's private-network rules then refuse every loopback
 * subresource ("the request client is not a secure context and the resource is
 * in more-private address space `loopback`"), so the renderer never loads.
 */
const HARNESS_ROUTE = '/__diagram-harness';

/** Article width in production is a 65ch column, so the harness matches it. */
function harnessPage(names) {
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
  .harness { margin-inline: auto; max-width: 65ch; padding-inline: 1rem; }
  .tail { height: 150vh; }
</style>
</head>
<body>
<main class="harness prose">${buildPageMarkup(names)}</main>
<div class="tail"></div>
<script src="js/interactive-diagrams.js"></script>
<script>window.__diagramsReady = window.initInteractiveDiagrams();</script>
</body>
</html>`;
}

async function mount(page, names, { width = 1280, height = 900 } = {}) {
    await page.setViewportSize({ width, height });
    await page.route(`**${HARNESS_ROUTE}`, route => route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: harnessPage(names)
    }));
    await page.goto(HARNESS_ROUTE);
    const count = [].concat(names).length;
    await expect(page.locator('[data-diagram-initialized="true"]')).toHaveCount(count, { timeout: 20000 });
}

/**
 * Smallest label size actually painted, in CSS pixels. Labels live in view-box
 * units, so the SVG scale converts them to what a reader sees.
 */
function measureLabels(element) {
    const sizes = [];
    for (const svg of element.querySelectorAll('[data-diagram-canvas] svg')) {
        const box = svg.viewBox?.baseVal;
        const rect = svg.getBoundingClientRect();
        if (!box || box.width <= 0 || rect.width <= 0) continue;
        const scale = rect.width / box.width;
        const labels = svg.querySelectorAll(
            'text, tspan, .nodeLabel, .edgeLabel, foreignObject span, foreignObject p, foreignObject div');
        for (const label of labels) {
            if (!label.textContent || !label.textContent.trim()) continue;
            const size = Number.parseFloat(getComputedStyle(label).fontSize);
            if (Number.isFinite(size) && size > 0) sizes.push(size * scale);
        }
    }
    return sizes;
}

async function smallestLabel(widget) {
    const sizes = await widget.evaluate(measureLabels);
    expect(sizes.length).toBeGreaterThan(0);
    return Math.min(...sizes);
}

const WIDTHS = [360, 768, 1280];

test.describe('readable diagrams at every width', () => {
    for (const width of WIDTHS) {
        test(`the opt-in token stream stays readable at ${width}px`, async ({ page }) => {
            await mount(page, 'wideTokenStream', { width });
            const widget = page.locator('[data-interactive-diagram]');

            expect(await smallestLabel(widget)).toBeGreaterThanOrEqual(13.9);
            // The author approved a vertical variant, so panning is never the answer.
            expect(await widget.getAttribute('data-diagram-layout')).not.toBe('pan');

            const pageWidth = await page.evaluate(
                () => document.documentElement.scrollWidth - window.innerWidth);
            expect(pageWidth).toBeLessThanOrEqual(1);
        });

        test(`the flowchart without a narrow variant pans readably at ${width}px`, async ({ page }) => {
            await mount(page, 'wideFlowchartWithoutReflow', { width });
            const widget = page.locator('[data-interactive-diagram]');

            expect(await smallestLabel(widget)).toBeGreaterThanOrEqual(13.9);

            const state = await widget.evaluate(element => {
                const layout = element.dataset.diagramLayout;
                const viewport = element.querySelector('[data-diagram-step]:not([hidden]) [data-diagram-viewport]');
                const scrollers = [...element.querySelectorAll('*')]
                    .filter(node => node.scrollWidth - node.clientWidth > 1)
                    .map(node => node.getAttribute('data-diagram-viewport') === '' ? 'viewport' : node.className);
                return {
                    layout,
                    overflow: viewport.scrollWidth - viewport.clientWidth,
                    hintHidden: element.querySelector('[data-diagram-step]:not([hidden]) [data-diagram-scroll-hint]').hidden,
                    tabindex: viewport.getAttribute('tabindex'),
                    scrollers
                };
            });

            if (state.layout === 'pan') {
                expect(state.overflow).toBeGreaterThan(1);
                expect(state.hintHidden).toBe(false);
                expect(state.tabindex).toBe('0');
            } else {
                expect(state.overflow).toBeLessThanOrEqual(1);
                expect(state.hintHidden).toBe(true);
            }

            // Only the diagram viewport may scroll sideways.
            expect(state.scrollers).toEqual(state.layout === 'pan' ? ['viewport'] : []);

            const pageOverflow = await page.evaluate(
                () => document.documentElement.scrollWidth - window.innerWidth);
            expect(pageOverflow).toBeLessThanOrEqual(1);
        });

        test(`a sequence diagram stays readable without reflowing at ${width}px`, async ({ page }) => {
            await mount(page, 'wideSequenceDiagram', { width });
            const widget = page.locator('[data-interactive-diagram]');

            expect(await smallestLabel(widget)).toBeGreaterThanOrEqual(13.9);
            // A sequence diagram has no direction token, so it must pan, never reflow.
            const sources = await widget.evaluate(element =>
                [...element.querySelectorAll('[data-diagram-source]')].map(node => node.textContent.trim()));
            expect(sources.every(source => source.startsWith('sequenceDiagram'))).toBe(true);
            expect(await widget.getAttribute('data-diagram-layout')).not.toBe('narrow');
        });
    }
});

test('the pan viewport scrolls with the keyboard once focused', async ({ page }) => {
    await mount(page, 'wideFlowchartWithoutReflow', { width: 360 });
    const viewport = page.locator('[data-diagram-step]:not([hidden]) [data-diagram-viewport]');
    await expect(viewport).toHaveAttribute('tabindex', '0');

    await viewport.focus();
    await expect(viewport).toBeFocused();
    const before = await viewport.evaluate(node => node.scrollLeft);
    for (let press = 0; press < 5; press++) await page.keyboard.press('ArrowRight');
    await expect.poll(() => viewport.evaluate(node => node.scrollLeft)).toBeGreaterThan(before);
});

test('the overflow cues follow the scroll position', async ({ page }) => {
    await mount(page, 'wideFlowchartWithoutReflow', { width: 360 });
    const viewport = page.locator('[data-diagram-step]:not([hidden]) [data-diagram-viewport]');

    await expect(viewport).not.toHaveAttribute('data-overflow-left', 'true');
    await expect(viewport).toHaveAttribute('data-overflow-right', 'true');

    const middle = await viewport.evaluate(node => {
        node.scrollLeft = (node.scrollWidth - node.clientWidth) / 2;
        return node.scrollLeft;
    });
    expect(middle).toBeGreaterThan(1);
    await expect(viewport).toHaveAttribute('data-overflow-left', 'true');
    await expect(viewport).toHaveAttribute('data-overflow-right', 'true');

    await viewport.evaluate(node => { node.scrollLeft = node.scrollWidth; });
    await expect(viewport).toHaveAttribute('data-overflow-left', 'true');
    await expect(viewport).not.toHaveAttribute('data-overflow-right', 'true');
});

test('sideways panning does not block vertical page scrolling', async ({ page }) => {
    await mount(page, 'wideFlowchartWithoutReflow', { width: 360 });
    const viewport = page.locator('[data-diagram-step]:not([hidden]) [data-diagram-viewport]');

    // Native touch and trackpad behaviour only survives if nothing suppresses it.
    const styles = await viewport.evaluate(node => {
        const computed = getComputedStyle(node);
        return { touchAction: computed.touchAction, overflowY: computed.overflowY };
    });
    expect(styles.touchAction).not.toBe('none');
    expect(styles.overflowY).toBe('hidden');

    await page.mouse.move(180, 400);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('every step keeps the same widget height and the controls behave', async ({ page }) => {
    await mount(page, 'mixedAspectSteps', { width: 768 });
    const widget = page.locator('[data-interactive-diagram]');
    const status = widget.locator('[data-diagram-status]');

    const first = await widget.evaluate(element => element.getBoundingClientRect().height);
    await expect(widget.locator('[data-diagram-action="previous"]')).toBeDisabled();

    await widget.locator('[data-diagram-action="next"]').click();
    await expect(status).toHaveText('Step 2 of 3');
    expect(await widget.evaluate(element => element.getBoundingClientRect().height)).toBeCloseTo(first, 0);

    await widget.locator('[data-diagram-action="next"]').click();
    await expect(status).toHaveText('Step 3 of 3');
    await expect(widget.locator('[data-diagram-action="next"]')).toBeDisabled();
    expect(await widget.evaluate(element => element.getBoundingClientRect().height)).toBeCloseTo(first, 0);

    const play = widget.locator('[data-diagram-action="play"]');
    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'true');
    await expect(status).toHaveText('Step 1 of 3');
    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'false');
    expect(await widget.evaluate(element => element.getBoundingClientRect().height)).toBeCloseTo(first, 0);
});

test('a theme change never exposes an empty or half-rendered stage', async ({ page }) => {
    await mount(page, 'wideTokenStream', { width: 768 });
    const widget = page.locator('[data-interactive-diagram]');
    const layoutBefore = await widget.getAttribute('data-diagram-layout');

    const samples = await page.evaluate(async () => {
        const widget = document.querySelector('[data-interactive-diagram]');
        let emptyFrames = 0;
        let sourceFrames = 0;
        const probe = setInterval(() => {
            const step = widget.querySelector('[data-diagram-step]:not([hidden])');
            if (!step.querySelector('[data-diagram-canvas] svg')) emptyFrames++;
            if (!step.querySelector('[data-diagram-source]').hidden) sourceFrames++;
        }, 4);

        document.documentElement.setAttribute('data-theme', 'light');
        await window.refreshInteractiveDiagrams();
        clearInterval(probe);
        return { emptyFrames, sourceFrames };
    });

    expect(samples.emptyFrames).toBe(0);
    expect(samples.sourceFrames).toBe(0);
    expect(await widget.getAttribute('data-diagram-layout')).toBe(layoutBefore);
    expect(await smallestLabel(widget)).toBeGreaterThanOrEqual(13.9);
});

test('crossing the layout threshold never flashes the raw Mermaid source', async ({ page }) => {
    await mount(page, 'wideTokenStream', { width: 1280 });

    await page.evaluate(() => {
        window.__sourceFlashes = 0;
        const observer = new MutationObserver(() => {
            document.querySelectorAll('[data-diagram-step]:not([hidden]) [data-diagram-source]')
                .forEach(node => { if (!node.hidden) window.__sourceFlashes++; });
        });
        observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
    });

    await page.setViewportSize({ width: 360, height: 900 });
    await expect.poll(() => page.evaluate(
        () => document.querySelector('[data-interactive-diagram]').dataset.diagramLayout)).toBeTruthy();
    await page.waitForTimeout(750);

    expect(await page.evaluate(() => window.__sourceFlashes)).toBe(0);
    const widget = page.locator('[data-interactive-diagram]');
    expect(await smallestLabel(widget)).toBeGreaterThanOrEqual(13.9);
});

test('two widgets keep separate layout, scroll and playback state', async ({ page }) => {
    await mount(page, MULTIPLE_WIDGETS, { width: 768 });
    const widgets = page.locator('[data-interactive-diagram]');
    const first = widgets.nth(0);
    const second = widgets.nth(1);

    const layouts = await widgets.evaluateAll(nodes => nodes.map(node => node.dataset.diagramLayout));
    expect(layouts[1]).toBe('fit');
    expect(layouts[0]).not.toBe(layouts[1]);

    await first.locator('[data-diagram-action="next"]').click();
    await expect(first.locator('[data-diagram-status]')).toHaveText('Step 2 of 4');
    await expect(second.locator('[data-diagram-status]')).toHaveText('Step 1 of 2');

    const ids = await page.evaluate(
        () => [...document.querySelectorAll('[data-diagram-viewport]')].map(node => node.id));
    expect(new Set(ids).size).toBe(ids.length);
});

test('no diagram test requests a production article route', async ({ page }) => {
    const requested = [];
    page.on('request', request => requested.push(request.url()));

    await mount(page, ['wideTokenStream', 'wideSequenceDiagram'], { width: 768 });

    expect(requested.filter(url => url.includes('/articles/'))).toEqual([]);
    // Mermaid and the renderer still come from the real static output.
    expect(requested.some(url => url.endsWith('js/interactive-diagrams.js'))).toBe(true);
    expect(requested.some(url => url.includes('vendor/mermaid/mermaid.min.js'))).toBe(true);
});
