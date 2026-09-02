'use strict';

const fs = require('fs');
const path = require('path');

const { DIAGRAM_FIXTURES, MULTIPLE_WIDGETS, buildWidgetMarkup, buildPageMarkup } =
    require('../../../tests/fixtures/diagram-fixtures');

const source = fs.readFileSync(path.join(__dirname, '../interactive-diagrams.js'), 'utf8');

/** Width the article gives a diagram viewport. Every expectation below assumes it. */
const ARTICLE_WIDTH = 640;

/** Mirrors the renderer contract. Kept here so an accidental change fails loudly. */
const MIN_LABEL_PX = 14;
const LABEL_PX = 12;
const FALLBACK_LABEL_PX = 16;

let availableWidth = ARTICLE_WIDTH;
let resizeObservers = [];

function loadScript() {
    // eslint-disable-next-line no-new-func
    new Function(source)();
}

/**
 * Fake drawing geometry. Mermaid is not run in jsdom, so the mock returns an
 * SVG whose viewBox encodes a predictable drawing size:
 *   left-to-right: 160px per node, 100px tall
 *   top-to-bottom: 320px wide, 60px per node
 *   sequence:      180px per participant, 240px tall
 */
function geometryFor(definition) {
    const arrows = (definition.match(/-->>|->>|-->|---/g) || []).length;

    if (/^\s*sequenceDiagram/.test(definition)) {
        const participants = (definition.match(/^\s*participant\b/gm) || []).length;
        return { width: 180 * Math.max(participants, 1), height: 240 };
    }
    if (/^\s*(?:flowchart|graph)[ \t]+(?:TB|TD|BT)\b/.test(definition)) {
        return { width: 320, height: 60 * (arrows + 1) };
    }
    return { width: 160 * (arrows + 1), height: 100 };
}

function svgFor(definition, options) {
    const { labelPx = LABEL_PX, noText = false, missingRoot = false, viewBox = null } = options;
    const geometry = geometryFor(definition);
    const box = viewBox ?? `0 0 ${geometry.width} ${geometry.height}`;

    // An empty <text> carries no label, so it must not count as a measurement.
    const labels = noText
        ? '<text style="font-size: 9px"></text><text style="font-size: 9px">   </text>'
        : `<text style="font-size: ${labelPx}px">Node</text>`
          + `<text style="font-size: ${labelPx + 6}px">Edge</text>`;

    const body = missingRoot ? labels : `<g class="root">${labels}</g>`;
    return `<svg viewBox="${box}" style="max-width: 80px"><title>${definition.split('\n')[0]}</title>${body}</svg>`;
}

function createMermaid(options = {}) {
    return {
        initialize: jest.fn(),
        render: jest.fn(async (id, definition) => {
            if (options.failOn && options.failOn(definition)) throw new Error('bad syntax');
            return { svg: svgFor(definition, options) };
        })
    };
}

function mount(names) {
    document.body.innerHTML = `<div class="prose">${buildPageMarkup(names)}</div>`;
}

function widgets() {
    return [...document.querySelectorAll('[data-interactive-diagram]')];
}

function stepsOf(widget) {
    return [...widget.querySelectorAll('[data-diagram-step]')].map(element => ({
        element,
        viewport: element.querySelector('[data-diagram-viewport]'),
        stage: element.querySelector('[data-diagram-canvas]'),
        hint: element.querySelector('[data-diagram-scroll-hint]'),
        source: element.querySelector('[data-diagram-source]'),
        error: element.querySelector('[data-diagram-error]')
    }));
}

function px(value) {
    return Math.round(Number.parseFloat(value || '0'));
}

/** Definitions handed to Mermaid, in call order. */
function renderedDefinitions(mermaid) {
    return mermaid.render.mock.calls.map(call => call[1]);
}

beforeEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
    document.documentElement.setAttribute('data-theme', 'dark');
    availableWidth = ARTICLE_WIDTH;
    resizeObservers = [];

    global.ResizeObserver = class {
        constructor(callback) {
            this.callback = callback;
            this.targets = [];
            resizeObservers.push(this);
        }
        observe(target) { this.targets.push(target); }
        disconnect() { this.targets = []; this.disconnected = true; }
        trigger() { this.callback([], this); }
    };

    // jsdom performs no layout, so the viewport width and the complete step
    // height are supplied here. Playwright covers the real measurements.
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
        const width = this.matches?.('[data-diagram-viewport]') ? availableWidth : 0;
        return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON() {} };
    });

    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
        configurable: true,
        get() {
            if (!this.matches?.('[data-diagram-step]')) return 0;
            const viewport = this.querySelector('[data-diagram-viewport]');
            const stageHeight = px(viewport?.style.height);
            const sourceLength = this.querySelector('[data-diagram-source]')?.textContent.length ?? 0;
            const proseLength = Math.max(0, this.textContent.length - sourceLength);
            return Math.round(stageHeight + 80 + proseLength / 4);
        }
    });

    loadScript();
});

afterEach(() => {
    jest.restoreAllMocks();
    delete HTMLElement.prototype.offsetHeight;
    delete global.ResizeObserver;
    document.querySelectorAll('[data-diagram-measure-host]').forEach(host => host.remove());
});

// --- Layout selection ------------------------------------------------------

test('fit mode keeps the canonical drawing inside the viewport at a readable size', async () => {
    mount('alreadyVerticalFlowchart');
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    const widget = widgets()[0];
    const steps = stepsOf(widget);
    expect(widget.dataset.diagramLayout).toBe('fit');
    // 320x120 drawing at 640px is a 2.0 scale, well past the 14px label floor.
    expect(px(steps[0].stage.style.width)).toBe(ARTICLE_WIDTH);
    expect(px(steps[0].stage.style.height)).toBe(240);
    expect(steps[0].hint.hidden).toBe(true);
    expect(steps[0].viewport.hasAttribute('tabindex')).toBe(false);
    // A fitting diagram never needs the narrow variant, so only the steps render.
    expect(mermaid.render).toHaveBeenCalledTimes(steps.length);
});

test('narrow mode rewrites only the flowchart direction token', async () => {
    mount('wideTokenStream');
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    const widget = widgets()[0];
    const steps = stepsOf(widget);
    expect(widget.dataset.diagramLayout).toBe('narrow');

    const canonical = DIAGRAM_FIXTURES.wideTokenStream.steps.map(step => step.mermaid);
    const definitions = renderedDefinitions(mermaid);
    expect(definitions.slice(0, canonical.length)).toEqual(canonical);

    const narrow = definitions.slice(canonical.length);
    expect(narrow).toHaveLength(canonical.length);
    narrow.forEach((definition, index) => {
        expect(definition).toBe(canonical[index].replace('flowchart LR', 'flowchart TB'));
        // Everything except the direction token survives.
        expect(definition.split('\n').slice(1)).toEqual(canonical[index].split('\n').slice(1));
    });

    // 320x480 narrow drawing scales to the full article width.
    expect(px(steps[0].stage.style.width)).toBe(ARTICLE_WIDTH);
    expect(px(steps[0].stage.style.height)).toBe(960);
    expect(steps[0].hint.hidden).toBe(true);
});

test('pan mode widens the stage until labels reach the readability floor', async () => {
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    const widget = widgets()[0];
    const steps = stepsOf(widget);
    expect(widget.dataset.diagramLayout).toBe('pan');

    // 1280x100 drawing, 12px labels: 14/12 scale gives readable labels.
    const expectedWidth = Math.round(1280 * (MIN_LABEL_PX / LABEL_PX));
    expect(px(steps[0].stage.style.width)).toBe(expectedWidth);
    expect(px(steps[0].stage.style.height)).toBe(Math.round(100 * (MIN_LABEL_PX / LABEL_PX)));
    expect(px(steps[0].stage.style.width)).toBeGreaterThan(ARTICLE_WIDTH);

    // No narrow direction is declared, so no second render happens.
    expect(mermaid.render).toHaveBeenCalledTimes(steps.length);
});

test('a sequence diagram never receives flowchart direction rewriting', async () => {
    mount('wideSequenceDiagram');
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    const widget = widgets()[0];
    expect(widget.getAttribute('data-diagram-narrow-direction')).toBe('TB');
    expect(widget.dataset.diagramLayout).toBe('pan');

    const canonical = DIAGRAM_FIXTURES.wideSequenceDiagram.steps.map(step => step.mermaid);
    expect(renderedDefinitions(mermaid)).toEqual(canonical);
    expect(renderedDefinitions(mermaid).every(definition => definition.startsWith('sequenceDiagram'))).toBe(true);
});

test('a diagram without measurable labels falls back to a 16px label size', async () => {
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid({ noText: true });

    await window.initInteractiveDiagrams(mermaid);

    const steps = stepsOf(widgets()[0]);
    // 1280 wide at the 16px fallback: 14/16 scale, not the 14/12 used above.
    expect(px(steps[0].stage.style.width)).toBe(Math.round(1280 * (MIN_LABEL_PX / FALLBACK_LABEL_PX)));
});

// --- Stage stability -------------------------------------------------------

test('renders every step before enabling the controls', async () => {
    mount('wideTokenStream');
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'dark'
    }));
    const steps = stepsOf(widgets()[0]);
    expect(steps.every(step => step.stage.querySelector('svg'))).toBe(true);
    expect(steps.every(step => step.source.hidden)).toBe(true);
    expect(document.querySelector('[data-diagram-controls]').hidden).toBe(false);
    expect(document.querySelector('[data-diagram-action="previous"]').disabled).toBe(true);
});

test('hides every source fallback before asynchronous rendering can expose a new step', async () => {
    mount('wideTokenStream');
    const mermaid = createMermaid();

    const initialization = window.initInteractiveDiagrams(mermaid);

    expect([...document.querySelectorAll('[data-diagram-source]')].every(source => source.hidden)).toBe(true);
    await initialization;
    document.querySelector('[data-diagram-action="next"]').click();
    expect(document.querySelectorAll('[data-diagram-source]')[1].hidden).toBe(true);
});

test('reserves one stable widget height across steps of different shapes', async () => {
    mount('mixedAspectSteps');
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    const steps = stepsOf(widgets()[0]);
    // Tallest stage is the 320x300 vertical step scaled 2.0 to the article width.
    const reserved = px(steps[0].viewport.style.height);
    expect(reserved).toBe(600);
    expect(steps.map(step => px(step.viewport.style.height))).toEqual([600, 600, 600]);

    const stepHeights = steps.map(step => px(step.element.style.minHeight));
    expect(new Set(stepHeights).size).toBe(1);
    expect(stepHeights[0]).toBeGreaterThan(reserved);

    document.querySelector('[data-diagram-action="next"]').click();
    expect(steps.map(step => px(step.element.style.minHeight))).toEqual(stepHeights);
    expect(steps.map(step => px(step.viewport.style.height))).toEqual([600, 600, 600]);
});

test('overrides Mermaid intrinsic width caps so the SVG fills its stage', async () => {
    mount('alreadyVerticalFlowchart');
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    const svg = document.querySelector('[data-diagram-canvas] svg');
    expect(svg.style.maxWidth).toBe('none');
    expect(svg.style.getPropertyPriority('max-width')).toBe('important');
    expect(svg.style.getPropertyValue('width')).toBe('100%');
    expect(svg.style.getPropertyValue('height')).toBe('100%');
});

test('reframes a malformed Mermaid viewport around the actual drawing bounds', async () => {
    mount('alreadyVerticalFlowchart');
    const mermaid = createMermaid({ viewBox: '0 0 2000 2000' });
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
        configurable: true,
        value: jest.fn(() => ({ x: 10, y: 20, width: 200, height: 100 }))
    });

    try {
        await window.initInteractiveDiagrams(mermaid);

        const steps = stepsOf(widgets()[0]);
        const svg = steps[0].stage.querySelector('svg');
        expect(svg.getAttribute('viewBox')).toBe('2 12 216 116');
        // 216x116 bounds, not the declared 2000x2000 viewport.
        expect(px(steps[0].stage.style.width)).toBe(ARTICLE_WIDTH);
        expect(px(steps[0].stage.style.height)).toBe(Math.round(640 * 116 / 216));
    } finally {
        delete SVGElement.prototype.getBBox;
    }
});

test.each([
    ['a missing drawing root', { missingRoot: true }],
    ['an unusable view box', { viewBox: '0 0 0 0' }],
    ['a malformed view box', { viewBox: 'not a view box' }]
])('recovers from %s without breaking the widget', async (_label, options) => {
    mount('alreadyVerticalFlowchart');
    const mermaid = createMermaid(options);

    await window.initInteractiveDiagrams(mermaid);

    const widget = widgets()[0];
    expect(widget.dataset.diagramInitialized).toBe('true');
    expect(document.querySelector('[data-diagram-controls]').hidden).toBe(false);
    expect(stepsOf(widget).every(step => step.stage.querySelector('svg'))).toBe(true);
});

test('recovers when getBBox throws during measurement', async () => {
    mount('alreadyVerticalFlowchart');
    const mermaid = createMermaid();
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
        configurable: true,
        value: jest.fn(() => { throw new Error('not rendered'); })
    });

    try {
        await window.initInteractiveDiagrams(mermaid);

        // Falls back to the declared 320x120 view box.
        const steps = stepsOf(widgets()[0]);
        expect(px(steps[0].stage.style.width)).toBe(ARTICLE_WIDTH);
        expect(px(steps[0].stage.style.height)).toBe(240);
    } finally {
        delete SVGElement.prototype.getBBox;
    }
});

// --- Overflow cues and accessibility ---------------------------------------

test('the scroll instruction and focus target appear only while the diagram overflows', async () => {
    mount('mixedAspectSteps');
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    const steps = stepsOf(widgets()[0]);
    // Step 1 needs 746px inside a 640px viewport; steps 2 and 3 fit.
    expect(steps[0].hint.hidden).toBe(false);
    expect(steps[0].viewport.getAttribute('tabindex')).toBe('0');
    expect(steps[0].viewport.getAttribute('aria-describedby')).toBe(steps[0].hint.id);
    expect(steps[1].hint.hidden).toBe(true);
    expect(steps[1].viewport.hasAttribute('tabindex')).toBe(false);
    expect(steps[2].hint.hidden).toBe(true);
});

test('overflow cues follow the scroll position from left edge to right edge', async () => {
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    const step = stepsOf(widgets()[0])[0];
    const overflow = px(step.stage.style.width) - ARTICLE_WIDTH;
    expect(overflow).toBeGreaterThan(0);

    expect(step.viewport.dataset.overflowLeft).toBeUndefined();
    expect(step.viewport.dataset.overflowRight).toBe('true');

    step.viewport.scrollLeft = overflow / 2;
    step.viewport.dispatchEvent(new Event('scroll'));
    expect(step.viewport.dataset.overflowLeft).toBe('true');
    expect(step.viewport.dataset.overflowRight).toBe('true');

    step.viewport.scrollLeft = overflow;
    step.viewport.dispatchEvent(new Event('scroll'));
    expect(step.viewport.dataset.overflowLeft).toBe('true');
    expect(step.viewport.dataset.overflowRight).toBeUndefined();
});

// --- Controls --------------------------------------------------------------

test('next and previous controls change the visible step', async () => {
    mount('wideTokenStream');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const steps = stepsOf(widgets()[0]);
    document.querySelector('[data-diagram-action="next"]').click();

    expect(steps[0].element.hidden).toBe(true);
    expect(steps[1].element.hidden).toBe(false);
    expect(document.querySelector('[data-diagram-status]').textContent).toBe('Step 2 of 4');

    document.querySelector('[data-diagram-action="previous"]').click();
    expect(steps[0].element.hidden).toBe(false);
    expect(steps[1].element.hidden).toBe(true);
    expect(document.querySelector('[data-diagram-action="previous"]').disabled).toBe(true);
});

test('a step change keeps the proportional horizontal scroll position', async () => {
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const steps = stepsOf(widgets()[0]);
    const overflow = px(steps[0].stage.style.width) - ARTICLE_WIDTH;
    steps[0].viewport.scrollLeft = overflow / 2;
    steps[0].viewport.dispatchEvent(new Event('scroll'));

    document.querySelector('[data-diagram-action="next"]').click();

    const nextOverflow = px(steps[1].stage.style.width) - ARTICLE_WIDTH;
    expect(steps[1].viewport.scrollLeft).toBeCloseTo(nextOverflow / 2, 0);
});

test('play advances through the remaining steps and then stops', async () => {
    jest.useFakeTimers();
    mount('alreadyVerticalFlowchart');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const play = document.querySelector('[data-diagram-action="play"]');
    play.click();
    expect(play.getAttribute('aria-pressed')).toBe('true');

    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(document.querySelector('[data-diagram-status]').textContent).toBe('Step 2 of 2');
    expect(play.getAttribute('aria-pressed')).toBe('false');
    expect(play.textContent).toBe('Play');
});

test('a manual scroll of an overflowing diagram stops playback', async () => {
    jest.useFakeTimers();
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const play = document.querySelector('[data-diagram-action="play"]');
    play.click();
    expect(play.getAttribute('aria-pressed')).toBe('true');

    const step = stepsOf(widgets()[0])[0];
    step.viewport.scrollLeft = 120;
    step.viewport.dispatchEvent(new Event('scroll'));

    expect(play.getAttribute('aria-pressed')).toBe('false');
    expect(play.textContent).toBe('Play');
});

test('disables playback when a diagram has only one step', async () => {
    mount('singleStepDiagram');
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    const play = document.querySelector('[data-diagram-action="play"]');
    expect(play.disabled).toBe(true);
    play.click();
    expect(play.getAttribute('aria-pressed')).toBe('false');
});

// --- Resize and theme ------------------------------------------------------

test('a width change inside the same mode resizes without re-running Mermaid', async () => {
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const renderCalls = mermaid.render.mock.calls.length;
    const steps = stepsOf(widgets()[0]);
    const before = px(steps[0].stage.style.width);

    availableWidth = 900;
    resizeObservers.forEach(observer => observer.trigger());
    await new Promise(resolve => requestAnimationFrame(resolve));
    await Promise.resolve();

    expect(mermaid.render.mock.calls.length).toBe(renderCalls);
    expect(widgets()[0].dataset.diagramLayout).toBe('pan');
    // The readability floor still governs, so the stage keeps its width.
    expect(px(steps[0].stage.style.width)).toBe(before);
    expect(steps[0].hint.hidden).toBe(false);
});

test('a width change that removes the overflow returns the widget to fit mode', async () => {
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    expect(widgets()[0].dataset.diagramLayout).toBe('pan');

    availableWidth = 1600;
    resizeObservers.forEach(observer => observer.trigger());
    await new Promise(resolve => requestAnimationFrame(resolve));
    await Promise.resolve();

    const steps = stepsOf(widgets()[0]);
    expect(widgets()[0].dataset.diagramLayout).toBe('fit');
    expect(px(steps[0].stage.style.width)).toBe(1600);
    expect(steps[0].hint.hidden).toBe(true);
    expect(steps[0].viewport.hasAttribute('tabindex')).toBe(false);
});

test('a resize that changes nothing does not schedule repeated work', async () => {
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const frame = jest.spyOn(window, 'requestAnimationFrame');
    const renderCalls = mermaid.render.mock.calls.length;

    resizeObservers.forEach(observer => observer.trigger());
    resizeObservers.forEach(observer => observer.trigger());
    resizeObservers.forEach(observer => observer.trigger());
    await new Promise(resolve => setTimeout(resolve, 0));

    // Bursts collapse into one frame, and an unchanged width does no work.
    expect(frame).toHaveBeenCalledTimes(1);
    expect(mermaid.render.mock.calls.length).toBe(renderCalls);
});

test('a widget removed from the document disconnects its observer', async () => {
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    widgets()[0].remove();
    availableWidth = 900;
    resizeObservers.forEach(observer => observer.trigger());
    await new Promise(resolve => requestAnimationFrame(resolve));

    expect(resizeObservers.every(observer => observer.disconnected)).toBe(true);
});

test('a theme refresh rerenders every step and keeps the selected layout mode', async () => {
    mount('wideTokenStream');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    expect(widgets()[0].dataset.diagramLayout).toBe('narrow');
    const renderCalls = mermaid.render.mock.calls.length;

    document.documentElement.setAttribute('data-theme', 'light');
    await window.refreshInteractiveDiagrams();

    expect(mermaid.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'default' }));
    expect(mermaid.render.mock.calls.length).toBeGreaterThan(renderCalls);
    expect(widgets()[0].dataset.diagramLayout).toBe('narrow');
    expect(document.querySelector('[data-diagram-source]').hidden).toBe(true);
    expect(stepsOf(widgets()[0]).every(step => step.stage.querySelector('svg'))).toBe(true);
});

test('a failed theme rerender keeps the previously rendered SVG visible', async () => {
    mount('alreadyVerticalFlowchart');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const steps = stepsOf(widgets()[0]);
    const before = steps[0].stage.querySelector('svg');
    expect(before).not.toBeNull();

    mermaid.render.mockRejectedValue(new Error('renderer died'));
    document.documentElement.setAttribute('data-theme', 'light');
    await window.refreshInteractiveDiagrams();

    expect(steps[0].stage.querySelector('svg')).toBe(before);
    expect(steps[0].source.hidden).toBe(true);
    expect(steps[0].error.hidden).toBe(true);
});

// --- Failure paths ---------------------------------------------------------

test('a Mermaid error keeps the source visible and shows an error message', async () => {
    mount('alreadyVerticalFlowchart');
    const mermaid = createMermaid({ failOn: definition => definition.includes('Vote') });

    await window.initInteractiveDiagrams(mermaid);

    const steps = stepsOf(widgets()[0]);
    expect(steps[0].source.hidden).toBe(false);
    expect(steps[0].error.hidden).toBe(false);
    expect(steps[0].error.textContent).toContain('could not be rendered');
    // The other step still renders and the widget still works.
    expect(steps[1].stage.querySelector('svg')).not.toBeNull();
    expect(document.querySelector('[data-diagram-controls]').hidden).toBe(false);
});

test('a renderer that cannot load keeps the authored source and reports the failure', async () => {
    mount('alreadyVerticalFlowchart');

    await window.initInteractiveDiagrams({
        initialize: () => { throw new Error('no renderer'); },
        render: jest.fn()
    });

    const widget = widgets()[0];
    expect(widget.dataset.diagramInitialized).toBe('error');
    const visibleSource = widget.querySelector('[data-diagram-step]:not([hidden]) [data-diagram-source]');
    expect(visibleSource.hidden).toBe(false);
    expect(widget.querySelector('[data-diagram-error]').textContent).toContain('could not be loaded');
});

test('does not initialize Mermaid when the page has no diagram widgets', async () => {
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    expect(mermaid.initialize).not.toHaveBeenCalled();
    expect(mermaid.render).not.toHaveBeenCalled();
});

test('a second initialization pass leaves an already enhanced widget alone', async () => {
    mount('alreadyVerticalFlowchart');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const renderCalls = mermaid.render.mock.calls.length;
    await window.initInteractiveDiagrams(mermaid);

    expect(mermaid.render.mock.calls.length).toBe(renderCalls);
    expect(widgets()[0].dataset.diagramInitialized).toBe('true');
});

// --- Several widgets on one page -------------------------------------------

test('two widgets keep independent layout, scroll position and playback state', async () => {
    mount(MULTIPLE_WIDGETS);
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    const [first, second] = widgets();
    expect(first.dataset.diagramLayout).toBe('narrow');
    expect(second.dataset.diagramLayout).toBe('fit');

    const firstSteps = stepsOf(first);
    const secondSteps = stepsOf(second);
    expect(px(firstSteps[0].viewport.style.height))
        .not.toBe(px(secondSteps[0].viewport.style.height));

    // Element ids stay unique so aria-describedby cannot cross widgets.
    const ids = [...document.querySelectorAll('[data-diagram-viewport]')].map(node => node.id);
    expect(new Set(ids).size).toBe(ids.length);

    first.querySelector('[data-diagram-action="next"]').click();
    expect(first.querySelector('[data-diagram-status]').textContent).toBe('Step 2 of 4');
    expect(second.querySelector('[data-diagram-status]').textContent).toBe('Step 1 of 2');
});

test('the fixture markup matches the ids the component emits', () => {
    document.body.innerHTML = buildWidgetMarkup(DIAGRAM_FIXTURES.singleStepDiagram, 3);

    const viewport = document.querySelector('[data-diagram-viewport]');
    const hint = document.querySelector('[data-diagram-scroll-hint]');
    expect(viewport.id).toBe('learning-diagram-3-step-0-viewport');
    expect(hint.id).toBe('learning-diagram-3-step-0-instruction');
    expect(viewport.getAttribute('aria-describedby')).toBe(hint.id);
});
