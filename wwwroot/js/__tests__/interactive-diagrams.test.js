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

/** Playback pacing, mirrored from the renderer for the same reason. */
const PLAY_INITIAL_HOLD_MS = 10000;
const PLAY_VIEWPORT_TRAVERSAL_MS = 8000;
const PLAY_END_HOLD_MS = 5000;
const PLAY_REDUCED_MOTION_HOLD_MS = 10000;
const PLAY_REDUCED_MOTION_PAGE_FRACTION = 0.9;

/** Interval Jest's fake `requestAnimationFrame` uses. Confirmed, not assumed. */
const FRAME_MS = 16;

let availableWidth = ARTICLE_WIDTH;
let resizeObservers = [];
let reducedMotion = false;
let motionListeners = [];

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
    const themeVariables = {};
    for (let i = 0; i < 150; i++) {
        const hex = `#${(0x200000 + i).toString(16).padStart(6, '0')}`;
        themeVariables[`testColor${i}`] = hex;
    }
    themeVariables.primaryColor = '#ECECFF';
    themeVariables.mainBkg = '#ECECFF';
    themeVariables.dropShadow = 'drop-shadow(0 0 5px rgba(185, 185, 185, 1))';
    return {
        initialize: jest.fn(),
        mermaidAPI: {
            getConfig: jest.fn(() => ({ themeVariables: { ...themeVariables } }))
        },
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

function control(action, scope = document) {
    return scope.querySelector(`[data-diagram-action="${action}"]`);
}

function statusText(scope = document) {
    return scope.querySelector('[data-diagram-status]').textContent;
}

/** Hidden width of one step, in CSS pixels. */
function overflowOf(step) {
    return px(step.stage.style.width) - ARTICLE_WIDTH;
}

/** Milliseconds the pan needs to cross `overflow` at one viewport per 8 seconds. */
function panDurationMs(overflow) {
    return overflow / (ARTICLE_WIDTH / PLAY_VIEWPORT_TRAVERSAL_MS);
}

/**
 * Fake clock reading at which the last movement frame of a pan runs. The first
 * frame only seeds the timestamp, so one frame carries no movement.
 */
function panEndMs(overflow) {
    return PLAY_INITIAL_HOLD_MS + FRAME_MS
        + Math.ceil(panDurationMs(overflow) / FRAME_MS) * FRAME_MS;
}

/** Whole automatic duration of one overflowing step. */
function overflowingStepMs(overflow) {
    return panEndMs(overflow) + PLAY_END_HOLD_MS;
}

/**
 * jsdom ships no `matchMedia`, so the renderer's motion query is supplied here.
 * `setReducedMotion` also notifies listeners, which covers a reader changing the
 * preference while a diagram is playing.
 */
function installMatchMedia() {
    window.matchMedia = jest.fn(query => ({
        media: query,
        get matches() {
            return /prefers-reduced-motion:\s*reduce/.test(query) && reducedMotion;
        },
        addEventListener(type, listener) {
            if (type === 'change') motionListeners.push(listener);
        },
        removeEventListener(type, listener) {
            motionListeners = motionListeners.filter(entry => entry !== listener);
        }
    }));
}

function setReducedMotion(value) {
    reducedMotion = value;
    motionListeners.slice().forEach(listener => listener({ matches: value }));
}

beforeEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
    document.documentElement.setAttribute('data-theme', 'dark');
    availableWidth = ARTICLE_WIDTH;
    resizeObservers = [];
    reducedMotion = false;
    motionListeners = [];
    installMatchMedia();

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
    delete window.matchMedia;
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
        theme: 'base'
    }));
    const initCall = mermaid.initialize.mock.calls.find(call => call[0]?.theme === 'base');
    expect(initCall).toBeDefined();
    expect(initCall[0].themeVariables).toBeDefined();
    expect(Object.keys(initCall[0].themeVariables).length).toBeGreaterThan(100);
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

test('disables playback when a diagram has only one step', async () => {
    mount('singleStepDiagram');
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    const play = document.querySelector('[data-diagram-action="play"]');
    expect(play.disabled).toBe(true);
    play.click();
    expect(play.getAttribute('aria-pressed')).toBe('false');
});

// --- Playback scheduling ---------------------------------------------------
//
// Every step holds its opening view, and a step whose drawing overflows then
// pans at one viewport width per 8 seconds and holds the right edge. A step
// that fits is the opening hold and nothing else.

test('a step that fits lasts exactly one opening hold, the last step included', async () => {
    jest.useFakeTimers();
    mount('alreadyVerticalFlowchart');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const play = control('play');
    play.click();
    expect(play.getAttribute('aria-pressed')).toBe('true');
    expect(play.textContent).toBe('Pause');

    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS - 1);
    expect(statusText()).toBe('Step 1 of 2');

    jest.advanceTimersByTime(2);
    expect(statusText()).toBe('Step 2 of 2');
    // The last step is shown for its own two seconds before playback releases.
    expect(play.getAttribute('aria-pressed')).toBe('true');

    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS);
    expect(play.getAttribute('aria-pressed')).toBe('false');
    expect(play.textContent).toBe('Play');
});

test('an overflowing step holds its opening view before any panning starts', async () => {
    jest.useFakeTimers();
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const step = stepsOf(widgets()[0])[0];
    expect(overflowOf(step)).toBeGreaterThan(0);

    control('play').click();
    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS - 1);
    expect(step.viewport.scrollLeft).toBe(0);
    expect(statusText()).toBe('Step 1 of 2');

    jest.advanceTimersByTime(1 + FRAME_MS * 2);
    expect(step.viewport.scrollLeft).toBeGreaterThan(0);
    // The step must not change while its own pan is still running.
    expect(statusText()).toBe('Step 1 of 2');
});

test('the pan moves one viewport width every eight seconds', async () => {
    jest.useFakeTimers();
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const step = stepsOf(widgets()[0])[0];
    control('play').click();

    // Clear the opening hold plus the one frame that seeds the timestamp.
    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS + FRAME_MS);
    const start = step.viewport.scrollLeft;

    jest.advanceTimersByTime(1600);
    const first = step.viewport.scrollLeft;
    jest.advanceTimersByTime(1600);
    const second = step.viewport.scrollLeft;

    const expected = 1600 * (ARTICLE_WIDTH / PLAY_VIEWPORT_TRAVERSAL_MS);
    expect(first - start).toBeCloseTo(expected, 0);
    expect(second - first).toBeCloseTo(expected, 0);
});

test('an overflowing step holds the right edge for one second before the next step', async () => {
    jest.useFakeTimers();
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const step = stepsOf(widgets()[0])[0];
    const overflow = overflowOf(step);
    control('play').click();

    jest.advanceTimersByTime(panEndMs(overflow));
    expect(step.viewport.scrollLeft).toBeCloseTo(overflow, 0);
    expect(statusText()).toBe('Step 1 of 2');
    expect(step.viewport.dataset.overflowRight).toBeUndefined();

    jest.advanceTimersByTime(PLAY_END_HOLD_MS - 1);
    expect(statusText()).toBe('Step 1 of 2');

    jest.advanceTimersByTime(2);
    expect(statusText()).toBe('Step 2 of 2');
});

test('an automatic step change starts the new step at its left edge', async () => {
    jest.useFakeTimers();
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const steps = stepsOf(widgets()[0]);
    const overflow = overflowOf(steps[0]);
    control('play').click();

    // Step 1 ends at its right edge, so preserving the ratio would open step 2
    // at its right edge too.
    jest.advanceTimersByTime(overflowingStepMs(overflow) + 1);
    expect(steps[0].viewport.scrollLeft).toBeCloseTo(overflow, 0);
    expect(statusText()).toBe('Step 2 of 2');
    expect(steps[1].viewport.scrollLeft).toBe(0);
    expect(steps[1].viewport.dataset.overflowLeft).toBeUndefined();
    expect(steps[1].viewport.dataset.overflowRight).toBe('true');
});

test('the last step completes its pan and end hold before playback stops', async () => {
    jest.useFakeTimers();
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const steps = stepsOf(widgets()[0]);
    const overflow = overflowOf(steps[1]);
    const stepMs = overflowingStepMs(overflow);
    const play = control('play');
    play.click();

    jest.advanceTimersByTime(stepMs + 1);
    expect(statusText()).toBe('Step 2 of 2');
    expect(play.getAttribute('aria-pressed')).toBe('true');

    // Half way through the last step's own pan, playback is still running.
    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS + FRAME_MS + panDurationMs(overflow) / 2);
    expect(steps[1].viewport.scrollLeft).toBeGreaterThan(0);
    expect(steps[1].viewport.scrollLeft).toBeLessThan(overflow);
    expect(play.getAttribute('aria-pressed')).toBe('true');

    jest.advanceTimersByTime(stepMs);
    expect(steps[1].viewport.scrollLeft).toBeCloseTo(overflow, 0);
    expect(play.getAttribute('aria-pressed')).toBe('false');
    expect(play.textContent).toBe('Play');
    expect(statusText()).toBe('Step 2 of 2');
});

test('pause freezes the pan and resume continues from the same scroll position', async () => {
    jest.useFakeTimers();
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const step = stepsOf(widgets()[0])[0];
    const play = control('play');
    play.click();
    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS + FRAME_MS + 1600);

    const paused = step.viewport.scrollLeft;
    expect(paused).toBeGreaterThan(0);

    play.click();
    expect(play.getAttribute('aria-pressed')).toBe('false');
    expect(play.textContent).toBe('Play');

    jest.advanceTimersByTime(30000);
    expect(step.viewport.scrollLeft).toBe(paused);
    expect(statusText()).toBe('Step 1 of 2');

    play.click();
    expect(play.textContent).toBe('Pause');
    // Resume never returns the step to its left edge.
    expect(step.viewport.scrollLeft).toBe(paused);

    jest.advanceTimersByTime(FRAME_MS + 1600);
    const expected = 1600 * (ARTICLE_WIDTH / PLAY_VIEWPORT_TRAVERSAL_MS);
    expect(step.viewport.scrollLeft).toBeCloseTo(paused + expected, 0);
});

test('pause during the opening hold resumes with only the remaining hold left', async () => {
    jest.useFakeTimers();
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const step = stepsOf(widgets()[0])[0];
    const play = control('play');
    play.click();
    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS - 500);
    play.click();

    jest.advanceTimersByTime(30000);
    expect(step.viewport.scrollLeft).toBe(0);

    play.click();
    jest.advanceTimersByTime(499);
    expect(step.viewport.scrollLeft).toBe(0);

    jest.advanceTimersByTime(2 + FRAME_MS * 2);
    expect(step.viewport.scrollLeft).toBeGreaterThan(0);
});

test('a manual scroll cancels playback and leaves no stale callback', async () => {
    jest.useFakeTimers();
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const step = stepsOf(widgets()[0])[0];
    const play = control('play');
    play.click();
    expect(play.getAttribute('aria-pressed')).toBe('true');

    jest.advanceTimersByTime(500);
    step.viewport.scrollLeft = 120;
    step.viewport.dispatchEvent(new Event('scroll'));

    expect(play.getAttribute('aria-pressed')).toBe('false');
    expect(play.textContent).toBe('Play');

    jest.advanceTimersByTime(30000);
    expect(statusText()).toBe('Step 1 of 2');
    expect(step.viewport.scrollLeft).toBe(120);

    // Manual input clears the resumable session, so Play starts afresh.
    play.click();
    expect(step.viewport.scrollLeft).toBe(0);
});

test('next cancels playback, keeps the proportional scroll and clears resume', async () => {
    jest.useFakeTimers();
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const steps = stepsOf(widgets()[0]);
    const play = control('play');
    play.click();
    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS + FRAME_MS + 1600);
    const moved = steps[0].viewport.scrollLeft;
    expect(moved).toBeGreaterThan(0);

    control('next').click();
    expect(play.getAttribute('aria-pressed')).toBe('false');
    // Manual navigation keeps the proportional position. Both steps share one
    // geometry, so that is the same number of pixels.
    expect(steps[1].viewport.scrollLeft).toBeCloseTo(moved, 0);

    jest.advanceTimersByTime(30000);
    expect(statusText()).toBe('Step 2 of 2');

    // Play from the last step restarts the walkthrough at step 1, left edge.
    play.click();
    expect(statusText()).toBe('Step 1 of 2');
    expect(steps[0].viewport.scrollLeft).toBe(0);

    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS - 1);
    expect(steps[0].viewport.scrollLeft).toBe(0);
    jest.advanceTimersByTime(1 + FRAME_MS * 2);
    expect(steps[0].viewport.scrollLeft).toBeGreaterThan(0);
});

test('previous cancels playback and discards the paused session', async () => {
    jest.useFakeTimers();
    mount('wideTokenStream');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    control('next').click();
    expect(statusText()).toBe('Step 2 of 4');

    const play = control('play');
    play.click();
    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS - 500);
    play.click();
    expect(play.getAttribute('aria-pressed')).toBe('false');

    control('previous').click();
    expect(statusText()).toBe('Step 1 of 4');

    // Previous throws the paused session away, so Play holds the whole two
    // seconds again rather than resuming with the 500ms that were left.
    play.click();
    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS - 1);
    expect(statusText()).toBe('Step 1 of 4');

    jest.advanceTimersByTime(1);
    expect(statusText()).toBe('Step 2 of 4');
});

test('two widgets schedule playback independently', async () => {
    jest.useFakeTimers();
    mount(['wideFlowchartWithoutReflow', 'alreadyVerticalFlowchart']);
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const [first, second] = widgets();
    const panning = stepsOf(first)[0];
    control('play', first).click();
    control('play', second).click();

    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS + FRAME_MS + 1600);
    // The fitting widget already advanced; the panning widget is still on step 1.
    expect(statusText(first)).toBe('Step 1 of 2');
    expect(statusText(second)).toBe('Step 2 of 2');
    expect(panning.viewport.scrollLeft).toBeGreaterThan(0);

    control('play', first).click();
    const frozen = panning.viewport.scrollLeft;
    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS);
    expect(panning.viewport.scrollLeft).toBe(frozen);
    expect(control('play', first).getAttribute('aria-pressed')).toBe('false');
    // Pausing one widget never touches the other, which ends on its own.
    expect(control('play', second).getAttribute('aria-pressed')).toBe('false');
    expect(statusText(second)).toBe('Step 2 of 2');
});

test('a panning step announces its own step once, however far it scrolls', async () => {
    jest.useFakeTimers();
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const status = document.querySelector('[data-diagram-status]');
    let announcements = 0;
    new MutationObserver(() => announcements++)
        .observe(status, { childList: true, characterData: true, subtree: true });

    control('play').click();
    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS + FRAME_MS + 4000);
    // Hundreds of scroll updates must not re-announce the unchanged step.
    await Promise.resolve();
    expect(announcements).toBe(0);
});

test('reduced motion pages the diagram in overlapping static jumps', async () => {
    jest.useFakeTimers();
    reducedMotion = true;
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const steps = stepsOf(widgets()[0]);
    const overflow = overflowOf(steps[0]);
    const jump = ARTICLE_WIDTH * PLAY_REDUCED_MOTION_PAGE_FRACTION;
    expect(overflow).toBeGreaterThan(jump);

    const frame = jest.spyOn(window, 'requestAnimationFrame');
    control('play').click();

    jest.advanceTimersByTime(PLAY_REDUCED_MOTION_HOLD_MS - 1);
    expect(steps[0].viewport.scrollLeft).toBe(0);

    jest.advanceTimersByTime(1);
    // One instant jump of 90% of the viewport keeps a tenth of the view in common.
    expect(steps[0].viewport.scrollLeft).toBe(jump);
    expect(statusText()).toBe('Step 1 of 2');

    jest.advanceTimersByTime(PLAY_REDUCED_MOTION_HOLD_MS);
    expect(steps[0].viewport.scrollLeft).toBe(overflow);
    expect(statusText()).toBe('Step 1 of 2');

    // The rightmost view is held as long as any other before the step changes.
    jest.advanceTimersByTime(PLAY_REDUCED_MOTION_HOLD_MS - 1);
    expect(statusText()).toBe('Step 1 of 2');

    jest.advanceTimersByTime(1);
    expect(statusText()).toBe('Step 2 of 2');
    expect(steps[1].viewport.scrollLeft).toBe(0);

    // Nothing was animated at any point.
    expect(frame).not.toHaveBeenCalled();
});

test('reduced motion still stops after the last step reaches its right edge', async () => {
    jest.useFakeTimers();
    reducedMotion = true;
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const steps = stepsOf(widgets()[0]);
    const play = control('play');
    play.click();

    // Two steps, each holding an opening view and two further pages.
    jest.advanceTimersByTime(PLAY_REDUCED_MOTION_HOLD_MS * 3);
    expect(statusText()).toBe('Step 2 of 2');
    expect(play.getAttribute('aria-pressed')).toBe('true');

    jest.advanceTimersByTime(PLAY_REDUCED_MOTION_HOLD_MS * 3 - 1);
    expect(play.getAttribute('aria-pressed')).toBe('true');
    expect(steps[1].viewport.scrollLeft).toBe(overflowOf(steps[1]));

    jest.advanceTimersByTime(2);
    expect(play.getAttribute('aria-pressed')).toBe('false');
    expect(play.textContent).toBe('Play');
});

test('a motion preference change mid-playback continues from the current position', async () => {
    jest.useFakeTimers();
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const step = stepsOf(widgets()[0])[0];
    const overflow = overflowOf(step);
    const play = control('play');
    play.click();

    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS + FRAME_MS + 1600);
    const reached = step.viewport.scrollLeft;
    expect(reached).toBeGreaterThan(0);

    setReducedMotion(true);
    jest.advanceTimersByTime(PLAY_REDUCED_MOTION_HOLD_MS - 1);
    // The pan stops at once and the current view is held instead.
    expect(step.viewport.scrollLeft).toBe(reached);

    jest.advanceTimersByTime(2);
    const jump = ARTICLE_WIDTH * PLAY_REDUCED_MOTION_PAGE_FRACTION;
    expect(step.viewport.scrollLeft).toBe(Math.min(overflow, reached + jump));
    expect(play.getAttribute('aria-pressed')).toBe('true');
});

test('playback without a motion query still pans', async () => {
    jest.useFakeTimers();
    delete window.matchMedia;
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const step = stepsOf(widgets()[0])[0];
    control('play').click();
    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS + FRAME_MS * 3);
    expect(step.viewport.scrollLeft).toBeGreaterThan(0);
});

test('a widget removed mid-playback cancels its scheduled work', async () => {
    jest.useFakeTimers();
    mount('wideFlowchartWithoutReflow');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const widget = widgets()[0];
    const play = control('play');
    play.click();
    jest.advanceTimersByTime(PLAY_INITIAL_HOLD_MS + FRAME_MS * 3);

    widget.remove();
    jest.advanceTimersByTime(60000);
    expect(play.getAttribute('aria-pressed')).toBe('false');
    expect(statusText(widget)).toBe('Step 1 of 2');
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

test('a data-theme flip performs zero Mermaid work and keeps the layout', async () => {
    mount('wideTokenStream');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    expect(widgets()[0].dataset.diagramLayout).toBe('narrow');
    expect(window.refreshInteractiveDiagrams).toBeUndefined();
    const renderCalls = mermaid.render.mock.calls.length;
    const initCalls = mermaid.initialize.mock.calls.length;

    document.documentElement.setAttribute('data-theme', 'light');
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mermaid.render.mock.calls.length).toBe(renderCalls);
    expect(mermaid.initialize.mock.calls.length).toBe(initCalls);
    expect(widgets()[0].dataset.diagramLayout).toBe('narrow');
    expect(document.querySelector('[data-diagram-source]').hidden).toBe(true);
    expect(stepsOf(widgets()[0]).every(step => step.stage.querySelector('svg'))).toBe(true);
});

test('a failing renderer after commit never blanks the stage on a theme flip', async () => {
    mount('alreadyVerticalFlowchart');
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    const steps = stepsOf(widgets()[0]);
    const before = steps[0].stage.querySelector('svg');
    expect(before).not.toBeNull();
    const renderCalls = mermaid.render.mock.calls.length;

    mermaid.render.mockRejectedValue(new Error('renderer died'));
    document.documentElement.setAttribute('data-theme', 'light');
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mermaid.render.mock.calls.length).toBe(renderCalls);
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
