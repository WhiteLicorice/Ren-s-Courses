// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');
const { DIAGRAM_FIXTURES, MULTIPLE_WIDGETS, buildPageMarkup, buildWidgetMarkup } = require('../fixtures/diagram-fixtures');

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

/** Playback pacing, mirrored from wwwroot/js/interactive-diagrams.js. */
const PLAY_INITIAL_HOLD_MS = 10000;
const PLAY_VIEWPORT_TRAVERSAL_MS = 8000;
const PLAY_END_HOLD_MS = 5000;
const PLAY_REDUCED_MOTION_PAGE_FRACTION = 0.9;

/**
 * Press Play and watch one whole step from inside the page. Sampling every
 * animation frame is the only way to tell a pan from a jump, and recording the
 * timings in the page avoids adding round-trip latency to every measurement.
 *
 * Returns the moment movement started, the moment the right edge was reached,
 * the moment the step changed, and every sampled position.
 */
function watchOneStep(widget, limitMs) {
    const status = () => widget.querySelector('[data-diagram-status]').textContent.trim();
    const visible = () =>
        widget.querySelector('[data-diagram-step]:not([hidden]) [data-diagram-viewport]');

    const first = visible();
    const overflow = first.scrollWidth - first.clientWidth;
    const viewportWidth = first.clientWidth;
    const startStatus = status();
    const events = {};
    const positions = [];
    const start = performance.now();

    widget.querySelector('[data-diagram-action="play"]').click();

    return new Promise(resolve => {
        const tick = () => {
            const node = visible();
            const at = performance.now() - start;
            const left = node.scrollLeft;
            positions.push(left);

            if (events.moved === undefined && left > 1) events.moved = at;
            if (events.edge === undefined && left >= overflow - 1) events.edge = at;

            if (status() !== startStatus) {
                events.changed = at;
                // The new step is already on screen, so this is its own position.
                events.leftOnChange = left;
                resolve({ overflow, viewportWidth, events, positions, status: status() });
                return;
            }
            if (at >= limitMs) {
                resolve({ overflow, viewportWidth, events, positions, status: status() });
                return;
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}

/** Distinct sampled positions, rounded, in the order they first appeared. */
function distinctPositions(positions) {
    const seen = [];
    for (const value of positions) {
        const rounded = Math.round(value);
        if (seen[seen.length - 1] !== rounded) seen.push(rounded);
    }
    return seen;
}

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

// --- Overflow-aware playback ------------------------------------------------
//
// `modestOverflowWalkthrough` is the pacing fixture: measured at 1280px it hides
// 207px behind a 574px viewport, so one pan lasts about 2.9 seconds. With a
// 10-second opening hold and a 5-second edge hold, one whole step runs for
// roughly 18 seconds, which sets every budget below.

test('an overflowing step holds, pans continuously, holds the edge, then resets left', async ({ page }) => {
    test.setTimeout(90000);
    await mount(page, 'modestOverflowWalkthrough', { width: 1280 });
    const widget = page.locator('[data-interactive-diagram]');

    const run = await widget.evaluate(watchOneStep, 40000);
    expect(run.overflow).toBeGreaterThan(20);

    // The opening view is held before anything moves.
    expect(run.events.moved).toBeGreaterThan(PLAY_INITIAL_HOLD_MS * 0.9);

    // Movement is a pan, not a jump: many separate positions, always forward.
    const distinct = distinctPositions(run.positions);
    const panned = distinct.filter(value => value > 0 && value < run.overflow);
    expect(panned.length).toBeGreaterThan(10);
    for (let index = 1; index < distinct.length; index++) {
        if (distinct[index] === 0) continue;
        expect(distinct[index]).toBeGreaterThanOrEqual(distinct[index - 1]);
    }

    // One viewport width per 8 seconds, within real-browser frame jitter.
    const expectedMs = run.overflow / (run.viewportWidth / PLAY_VIEWPORT_TRAVERSAL_MS);
    expect(run.events.edge - run.events.moved).toBeGreaterThan(expectedMs * 0.6);
    expect(run.events.edge - run.events.moved).toBeLessThan(expectedMs * 1.6);

    // The step never changes before the right edge, and the edge is held.
    expect(run.events.edge).toBeLessThan(run.events.changed);
    expect(run.events.changed - run.events.edge).toBeGreaterThan(PLAY_END_HOLD_MS * 0.8);

    // The step that follows opens at its own left edge.
    expect(run.status).toBe('Step 2 of 3');
    expect(run.events.leftOnChange).toBeLessThanOrEqual(1);
});

test('pause stops the movement and resume carries it forward', async ({ page }) => {
    test.setTimeout(90000);
    await mount(page, 'wideFlowchartWithoutReflow', { width: 1280 });
    const widget = page.locator('[data-interactive-diagram]');
    const play = widget.locator('[data-diagram-action="play"]');
    const viewport = widget.locator('[data-diagram-step]:not([hidden]) [data-diagram-viewport]');
    const read = () => viewport.evaluate(node => node.scrollLeft);

    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(read, { timeout: 30000 }).toBeGreaterThan(5);

    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'false');
    await expect(play).toHaveText('Play');

    const frozen = await read();
    await page.waitForTimeout(1200);
    // Nothing may move while playback is paused.
    expect(Math.abs(await read() - frozen)).toBeLessThanOrEqual(1);
    await expect(widget.locator('[data-diagram-status]')).toHaveText('Step 1 of 2');

    await play.click();
    await expect(play).toHaveText('Pause');
    // Resume continues from the paused position rather than starting again.
    expect(await read()).toBeGreaterThanOrEqual(frozen - 1);
    await expect.poll(read, { timeout: 30000 }).toBeGreaterThan(frozen + 20);
});

test('a fresh play returns a manually positioned step to its left edge', async ({ page }) => {
    await mount(page, 'wideFlowchartWithoutReflow', { width: 1280 });
    const widget = page.locator('[data-interactive-diagram]');
    const viewport = widget.locator('[data-diagram-step]:not([hidden]) [data-diagram-viewport]');

    const placed = await viewport.evaluate(node => {
        node.scrollLeft = (node.scrollWidth - node.clientWidth) / 2;
        return node.scrollLeft;
    });
    expect(placed).toBeGreaterThan(10);

    await widget.locator('[data-diagram-action="play"]').click();
    await expect.poll(() => viewport.evaluate(node => node.scrollLeft)).toBeLessThanOrEqual(1);
});

test('a manual scroll during playback stops it and leaves the step alone', async ({ page }) => {
    test.setTimeout(90000);
    await mount(page, 'wideFlowchartWithoutReflow', { width: 1280 });
    const widget = page.locator('[data-interactive-diagram]');
    const play = widget.locator('[data-diagram-action="play"]');
    const viewport = widget.locator('[data-diagram-step]:not([hidden]) [data-diagram-viewport]');

    await play.click();
    await expect.poll(() => viewport.evaluate(node => node.scrollLeft), { timeout: 30000 })
        .toBeGreaterThan(5);

    await viewport.evaluate(node => { node.scrollLeft = node.scrollLeft + 120; });
    await expect(play).toHaveAttribute('aria-pressed', 'false');

    const stopped = await viewport.evaluate(node => node.scrollLeft);
    await page.waitForTimeout(1500);
    expect(Math.abs(await viewport.evaluate(node => node.scrollLeft) - stopped)).toBeLessThanOrEqual(1);
    await expect(widget.locator('[data-diagram-status]')).toHaveText('Step 1 of 2');
});

test('reduced motion pages the diagram instead of animating it', async ({ page }) => {
    // Each page is held for 10 seconds. One jump is enough to measure the step
    // size and prove the overlap, so this window stays short: the sampler runs
    // every animation frame and competes with the rest of the suite.
    test.setTimeout(60000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mount(page, 'wideFlowchartWithoutReflow', { width: 1280 });
    const widget = page.locator('[data-interactive-diagram]');

    const run = await widget.evaluate(watchOneStep, 14000);
    const jump = run.viewportWidth * PLAY_REDUCED_MOTION_PAGE_FRACTION;
    // The fixture must hide more than one page, or paging proves nothing.
    expect(run.overflow).toBeGreaterThan(jump);

    // Every sampled position is a settled page. No frame lands between two.
    const distinct = distinctPositions(run.positions);
    expect(distinct.length).toBeGreaterThan(1);
    expect(distinct[0]).toBe(0);
    for (let index = 1; index < distinct.length; index++) {
        const step = distinct[index] - distinct[index - 1];
        const expected = Math.min(jump, run.overflow - distinct[index - 1]);
        expect(Math.abs(step - expected)).toBeLessThanOrEqual(2);
    }

    // Consecutive pages overlap, so nothing falls between two views.
    expect(jump).toBeLessThan(run.viewportWidth);
});

test('the last step pans in full before playback stops', async ({ page }) => {
    // The sequence fixture hides about 170px behind a 574px viewport, so its
    // pan takes about 2.4 seconds and a whole step runs for roughly 17 seconds.
    // Two steps have to finish here, so the budget is generous.
    test.setTimeout(150000);
    await mount(page, 'wideSequenceDiagram', { width: 1280 });
    const widget = page.locator('[data-interactive-diagram]');
    const play = widget.locator('[data-diagram-action="play"]');
    const status = widget.locator('[data-diagram-status]');
    const viewport = () => widget.locator('[data-diagram-step]:not([hidden]) [data-diagram-viewport]');

    await play.click();
    await expect(status).toHaveText('Step 2 of 2', { timeout: 45000 });

    // The last step is not skipped. It pans like any other before Play releases.
    await expect(play).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => viewport().evaluate(node => node.scrollLeft), { timeout: 30000 })
        .toBeGreaterThan(5);

    await expect(play).toHaveAttribute('aria-pressed', 'false', { timeout: 45000 });
    await expect(play).toHaveText('Play');
    await expect(status).toHaveText('Step 2 of 2');

    // Playback released the last step at its right edge, not part way across.
    const end = await viewport().evaluate(node => ({
        left: node.scrollLeft,
        max: node.scrollWidth - node.clientWidth
    }));
    expect(end.left).toBeGreaterThan(end.max - 2);
});

test('a theme change resolves every palette variable and never blanks the stage', async ({ page }) => {
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
        await new Promise(resolve => setTimeout(resolve, 500));
        clearInterval(probe);
        return { emptyFrames, sourceFrames };
    });

    expect(samples.emptyFrames).toBe(0);
    expect(samples.sourceFrames).toBe(0);
    expect(await widget.getAttribute('data-diagram-layout')).toBe(layoutBefore);
    expect(await smallestLabel(widget)).toBeGreaterThanOrEqual(13.9);

    // The probe above cannot fail on its own any more, because a theme flip does
    // no work. This is the assertion that can: every var(--dg-*) the committed
    // SVG references must resolve in every registry theme. A palette block that
    // is missing, or a variable the rewrite invented, shows up here.
    const palette = await page.evaluate(() => {
        const names = new Set();
        document.querySelectorAll('[data-diagram-canvas] svg').forEach(svg => {
            for (const match of svg.outerHTML.match(/var\(--dg-[A-Za-z0-9_-]+\)/g) || []) {
                names.add(match.slice(4, -1));
            }
        });
        const registry = (window.siteThemeRegistry || [{ site: 'light' }, { site: 'dark' }])
            .map(entry => entry.site);
        const missing = [];
        const before = document.documentElement.getAttribute('data-theme');
        for (const theme of registry) {
            document.documentElement.setAttribute('data-theme', theme);
            const computed = getComputedStyle(document.documentElement);
            for (const name of names) {
                if (!computed.getPropertyValue(name).trim()) missing.push(`${theme}:${name}`);
            }
        }
        if (before) document.documentElement.setAttribute('data-theme', before);
        return { missing, referenced: names.size };
    });

    expect(palette.referenced).toBeGreaterThan(0);
    expect(palette.missing).toEqual([]);
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

test('flipping data-theme performs zero Mermaid renders and repaints node fills', async ({ page }) => {
    await mount(page, 'wideFlowchartWithoutReflow', { width: 1280 });
    const widget = page.locator('[data-interactive-diagram]');

    // Author classDef colours (#ef4444) must survive untouched, so pick a
    // theme-dependent node fill, not the highlighted active one.
    const themeFill = element => {
        const rects = [...element.querySelectorAll('[data-diagram-canvas] svg .node rect')];
        const fills = rects.map(rect => getComputedStyle(rect).fill);
        return fills.find(fill => fill !== 'rgb(239, 68, 68)') ?? fills[0];
    };

    const before = await widget.evaluate(themeFill);

    const counts = await page.evaluate(() => {
        window.__renderCount = 0;
        const original = window.mermaid.render.bind(window.mermaid);
        window.mermaid.render = async (...args) => {
            window.__renderCount++;
            return original(...args);
        };
        document.documentElement.setAttribute('data-theme', 'light');
        return new Promise(resolve => setTimeout(() => resolve(window.__renderCount), 500));
    });

    expect(counts).toBe(0);

    const after = await widget.evaluate(themeFill);
    expect(after).not.toBe(before);
});

test('palette coverage spans eight diagram types with no unmapped colour literal', async ({ page }) => {
    const names = ['wideTokenStream', 'wideSequenceDiagram', 'stateWalkthrough',
        'classRelations', 'entityRelations', 'petShares', 'shortSchedule',
        'serviceArchitecture'];

    let totalUnmapped = [];
    let totalVarRefs = 0;
    let sawPalette = false;

    // Mount one type at a time: deferred loading leaves below-fold widgets
    // uninitialized, so a seven-widget page never settles in one mount.
    for (const name of names) {
        await mount(page, name, { width: 1280 });

        const result = await page.evaluate(() => {
            const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
            const rgbRe = /rgba?\([^)]*\)/g;
            // #e0e0e0 is hardcoded by Mermaid for stateDiagram .alt-composit in
            // both themes (verified in vendor/mermaid/mermaid.min.js), so it is
            // theme-invariant by design like an author classDef colour.
            const knownInvariant = new Set(['#e0e0e0']);
            const unmapped = [];
            let varRefs = 0;

            const toHex = (r, g, b) => '#' + [r, g, b]
                .map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toLowerCase();

            document.querySelectorAll('[data-interactive-diagram]').forEach(widget => {
                widget.querySelectorAll('[data-diagram-canvas] svg').forEach(svg => {
                    const style = svg.querySelector('style')?.textContent ?? '';
                    const defs = svg.querySelector('defs')?.innerHTML ?? '';
                    const haystack = `${style}\n${defs}`;
                    if (haystack.includes('var(--dg-')) {
                        varRefs += (haystack.match(/var\(--dg-/g) || []).length;
                    }
                    const allowed = new Set(knownInvariant);
                    widget.querySelectorAll('[data-diagram-source]').forEach(source => {
                        source.textContent.split('\n').forEach(line => {
                            // Mirrors collectAuthorColors in interactive-diagrams.js.
                            if (/^\s*(classDef|style|linkStyle)\s/.test(line)) {
                                (line.match(hexRe) || []).forEach(h => {
                                    const lower = h.toLowerCase();
                                    allowed.add(lower);
                                    // Mermaid serialises author hexes as rgb() too.
                                    let hex = lower;
                                    if (hex.length === 4) {
                                        hex = '#' + hex.slice(1).split('').map(c => c + c).join('');
                                    }
                                    if (hex.length === 7) {
                                        const r = parseInt(hex.slice(1, 3), 16);
                                        const g = parseInt(hex.slice(3, 5), 16);
                                        const b = parseInt(hex.slice(5, 7), 16);
                                        allowed.add(toHex(r, g, b));
                                    }
                                });
                            }
                        });
                    });
                    (haystack.match(hexRe) || []).forEach(h => {
                        if (!allowed.has(h.toLowerCase())) unmapped.push(h);
                    });
                    (haystack.match(rgbRe) || []).forEach(c => {
                        if (c.includes('var(--dg-')) return;
                        const nums = c.match(/[0-9]*\.?[0-9]+/g)?.map(Number) ?? [];
                        if (nums.length >= 3) {
                            const hex = toHex(nums[0], nums[1], nums[2]);
                            if (allowed.has(hex)) return;
                        }
                        unmapped.push(c);
                    });
                });
            });

            const palette = document.getElementById('diagram-palette');
            return { unmapped: unmapped.slice(0, 40), unmappedCount: unmapped.length, varRefs, hasPalette: !!palette };
        });

        totalUnmapped.push(...result.unmapped);
        totalVarRefs += result.varRefs;
        sawPalette = sawPalette || result.hasPalette;
    }

    expect(sawPalette).toBe(true);
    expect(totalVarRefs).toBeGreaterThan(0);
    expect(totalUnmapped).toEqual([]);
});

test('a below-the-fold widget is ready before it enters the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route(`**${HARNESS_ROUTE}`, route => route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html>
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
  .spacer { height: 200vh; }
</style>
</head>
<body>
<main class="harness prose">${buildWidgetMarkup(DIAGRAM_FIXTURES.alreadyVerticalFlowchart, 0)}</main>
<div class="spacer"></div>
<main class="harness prose">${buildWidgetMarkup(DIAGRAM_FIXTURES.wideFlowchartWithoutReflow, 1)}</main>
<div class="spacer"></div>
<script src="js/interactive-diagrams.js"></script>
<script>window.__diagramsReady = window.initInteractiveDiagrams();</script>
</body>
</html>`
    }));
    await page.goto(HARNESS_ROUTE);

    const second = page.locator('[data-interactive-diagram]').nth(1);
    await expect(page.locator('[data-interactive-diagram]').nth(0))
        .toHaveAttribute('data-diagram-initialized', 'true', { timeout: 20000 });

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    let readyBeforeVisible = false;
    for (let step = 0; step < 40; step++) {
        const state = await second.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                viewportHeight: window.innerHeight,
                initialized: element.dataset.diagramInitialized
            };
        });
        if (state.top < state.viewportHeight && state.initialized === 'true') {
            readyBeforeVisible = true;
            break;
        }
        if (state.initialized === 'true' && state.top >= state.viewportHeight) {
            readyBeforeVisible = true;
            break;
        }
        await page.evaluate(() => window.scrollBy(0, 120));
        await page.waitForTimeout(50);
    }

    expect(readyBeforeVisible).toBe(true);
    await expect(second).toHaveAttribute('data-diagram-initialized', 'true', { timeout: 20000 });
});

test('architecture sprite ink stays legible in both themes', async ({ page }) => {
    // Mermaid draws its built-in architecture icons as line art with a hardcoded
    // `stroke: #fff` inside a style attribute, outside <style> and <defs>. Left
    // alone it is invisible on a light canvas: measured contrast 1.00. This test
    // is the gate for the rewrite reaching a plain presentation attribute.
    await mount(page, 'serviceArchitecture', { width: 1280 });

    const report = await page.evaluate(() => {
        const svg = document.querySelector('[data-diagram-canvas] svg');
        const sprite = [...svg.querySelectorAll('[style*="stroke"]')]
            .find(node => (node.getAttribute('style') || '').includes('var(--dg-'));

        const channels = (value) => {
            const probe = document.createElement('div');
            probe.style.color = value;
            document.body.appendChild(probe);
            const parsed = (getComputedStyle(probe).color.match(/[\d.]+/g) || []).map(Number);
            probe.remove();
            return parsed.slice(0, 3);
        };
        const luminance = (value) => {
            const [r, g, b] = channels(value).map(part => {
                const scaled = part / 255;
                return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const contrast = (a, b) => {
            const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
            return (high + 0.05) / (low + 0.05);
        };

        // Measure against Mermaid's own canvas variable, not document.body: the
        // body background is transparent here, and a transparent colour parses to
        // black, which would report a false failure.
        const readings = {};
        const before = document.documentElement.getAttribute('data-theme');
        for (const theme of ['light', 'dark']) {
            document.documentElement.setAttribute('data-theme', theme);
            const canvas = getComputedStyle(document.documentElement)
                .getPropertyValue('--dg-background').trim();
            const stroke = getComputedStyle(sprite).stroke;
            readings[theme] = {
                stroke,
                canvas,
                contrast: Number(contrast(stroke, canvas).toFixed(2))
            };
        }
        if (before) document.documentElement.setAttribute('data-theme', before);

        return { rewritten: !!sprite, readings };
    });

    expect(report.rewritten).toBe(true);
    // The literal white is gone, so the two themes must paint it differently.
    expect(report.readings.light.stroke).not.toBe(report.readings.dark.stroke);
    // 3:1 is the WCAG floor for a graphical object.
    expect(report.readings.light.contrast).toBeGreaterThanOrEqual(3);
    expect(report.readings.dark.contrast).toBeGreaterThanOrEqual(3);
});
