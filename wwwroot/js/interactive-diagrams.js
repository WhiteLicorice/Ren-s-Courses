// wwwroot/js/interactive-diagrams.js

const MERMAID_SCRIPT_URL = 'vendor/mermaid/mermaid.min.js';
const DIAGRAM_PLAY_INTERVAL_MS = 2000;

// A normal Mermaid label must never render below this size. Everything the
// layout does follows from that floor.
const MIN_LABEL_PX = 14;

// Used when a drawing carries no measurable label at all.
const FALLBACK_LABEL_PX = 16;

const VIEWBOX_PADDING = 8;
const SUPPORTED_NARROW_DIRECTIONS = new Set(['TB', 'BT']);

// A complete flowchart or graph declaration on its own line. Only such a line
// can take a new direction token without disturbing the rest of the source.
// The .NET twin lives in Models/DiagramNarrowDirection.cs.
const FLOWCHART_DECLARATION = /^([ \t]*)(flowchart|graph)(?:[ \t]+(?:TB|TD|BT|RL|LR))?([ \t]*;?[ \t]*\r?)$/;

const LABEL_SELECTOR = 'text, tspan, .nodeLabel, .edgeLabel, '
    + 'foreignObject span, foreignObject p, foreignObject div';

const RENDER_ERROR = 'This diagram could not be rendered. Check the Mermaid source shown below.';
const LOAD_ERROR = 'The interactive diagram renderer could not be loaded.';

let mermaidPromise;
let configuredMermaid;
let configuredTheme;
let renderId = 0;
const diagramStates = [];

function getDiagramTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'default' : 'dark';
}

async function getMermaid(providedMermaid) {
    if (providedMermaid) return providedMermaid;

    if (!mermaidPromise) {
        mermaidPromise = new Promise((resolve, reject) => {
            if (window.mermaid) {
                resolve(window.mermaid);
                return;
            }

            const script = document.createElement('script');
            script.src = new URL(MERMAID_SCRIPT_URL, document.baseURI).href;
            script.async = true;
            script.onload = () => window.mermaid
                ? resolve(window.mermaid)
                : reject(new Error('The local Mermaid bundle did not expose a renderer'));
            script.onerror = () => reject(new Error('The local Mermaid bundle could not be loaded'));
            document.head.appendChild(script);
        });
    }

    return mermaidPromise;
}

function configureMermaid(mermaid) {
    const theme = getDiagramTheme();
    if (configuredMermaid === mermaid && configuredTheme === theme) return;

    mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme
    });
    configuredMermaid = mermaid;
    configuredTheme = theme;
}

// --- Source selection ------------------------------------------------------

/**
 * Return the source with its first flowchart declaration set to `direction`.
 * Every other character survives. Returns null when the definition carries no
 * rewritable declaration, which includes every non-flowchart diagram type.
 */
function rewriteFlowchartDirection(source, direction) {
    if (!SUPPORTED_NARROW_DIRECTIONS.has(direction)) return null;

    const lines = source.split('\n');
    for (let index = 0; index < lines.length; index++) {
        const match = FLOWCHART_DECLARATION.exec(lines[index]);
        if (!match) continue;

        lines[index] = `${match[1]}${match[2]} ${direction}${match[3]}`;
        return lines.join('\n');
    }
    return null;
}

/**
 * Build the narrow variant of a whole widget. A widget reflows only when every
 * step can honour the direction, so a mixed diagram keeps one consistent
 * layout instead of reflowing part of a walkthrough.
 */
function buildNarrowSources(sources, direction) {
    if (!SUPPORTED_NARROW_DIRECTIONS.has(direction)) return null;

    const narrow = [];
    for (const source of sources) {
        const rewritten = rewriteFlowchartDirection(source, direction);
        if (!rewritten) return null;
        narrow.push(rewritten);
    }
    return narrow;
}

// --- Measurement -----------------------------------------------------------

function readViewBox(svg) {
    const parts = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
    return parts?.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0
        ? { width: parts[2], height: parts[3] }
        : null;
}

/**
 * Force the SVG to fill its stage and reframe its viewport around the real
 * drawing bounds. Mermaid's own viewBox and intrinsic size cannot be trusted.
 * Returns the drawing size in view-box units, or null when nothing is usable.
 */
function normalizeSvg(svg) {
    svg.style.setProperty('display', 'block', 'important');
    svg.style.setProperty('height', '100%', 'important');
    svg.style.setProperty('max-width', 'none', 'important');
    svg.style.setProperty('width', '100%', 'important');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const drawing = svg.querySelector('.root');
    if (drawing && typeof drawing.getBBox === 'function') {
        let bounds = null;
        try {
            bounds = drawing.getBBox();
        } catch {
            bounds = null;
        }

        const usable = bounds
            && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
            && bounds.width > 0 && bounds.height > 0;

        if (usable) {
            const width = bounds.width + VIEWBOX_PADDING * 2;
            const height = bounds.height + VIEWBOX_PADDING * 2;
            svg.setAttribute('viewBox',
                `${bounds.x - VIEWBOX_PADDING} ${bounds.y - VIEWBOX_PADDING} ${width} ${height}`);
            return { width, height };
        }
    }

    return readViewBox(svg);
}

/** Smallest positive label size in the drawing, in view-box units. */
function measureLabelSize(svg) {
    const scope = svg.querySelector('.root') ?? svg;
    let smallest = null;

    for (const label of scope.querySelectorAll(LABEL_SELECTOR)) {
        if (!label.textContent || !label.textContent.trim()) continue;
        const size = Number.parseFloat(window.getComputedStyle(label).fontSize);
        if (!Number.isFinite(size) || size <= 0) continue;
        if (smallest === null || size < smallest) smallest = size;
    }

    return smallest ?? FALLBACK_LABEL_PX;
}

function readAvailableWidth(state) {
    const step = state.steps.find(candidate => !candidate.element.hidden) ?? state.steps[0];
    if (!step) return 0;

    const width = step.viewport.getBoundingClientRect?.().width || step.viewport.clientWidth || 0;
    return width > 0 ? width : 0;
}

// --- Layout ----------------------------------------------------------------

/**
 * Decide the stage size of every step at the given width. A step is scaled to
 * fill the width unless that would push its labels below the floor, in which
 * case it keeps the wider readable size and the viewport scrolls.
 */
function planLayout(measurements, availableWidth) {
    let fits = true;

    const stages = measurements.map(measurement => {
        if (!measurement) return null;

        const fitScale = availableWidth / measurement.width;
        const readableScale = MIN_LABEL_PX / measurement.labelPx;
        if (readableScale > fitScale + 1e-6) fits = false;

        const scale = Math.max(fitScale, readableScale);
        return { width: measurement.width * scale, height: measurement.height * scale };
    });

    return { fits, stages };
}

function applyLayout(state, plan, availableWidth) {
    const heights = plan.stages.filter(Boolean).map(stage => stage.height);
    const reserved = heights.length > 0 ? Math.round(Math.max(...heights)) : 0;

    state.steps.forEach((step, index) => {
        const stage = plan.stages[index];
        if (!stage) {
            // Nothing measurable. Give the drawing the article width and let it
            // keep its own height rather than collapsing to nothing.
            step.stage.style.width = `${Math.round(availableWidth)}px`;
            step.stage.style.removeProperty('height');
            step.stage.querySelector('svg')?.style.removeProperty('height');
            step.overflow = 0;
            return;
        }

        const width = Math.round(stage.width);
        step.stage.style.width = `${width}px`;
        step.stage.style.height = `${Math.round(stage.height)}px`;
        step.overflow = Math.max(0, width - availableWidth);
    });

    // One reserved stage height keeps the page still while stepping.
    if (reserved > 0) {
        state.steps.forEach(step => {
            step.viewport.style.height = `${reserved}px`;
        });
    }
}

/** Make hidden steps measurable without letting them paint. */
function withStepsMeasurable(state, action) {
    const restored = state.steps.map(step => {
        const wasHidden = step.element.hidden;
        const style = step.element.getAttribute('style');
        if (wasHidden) {
            step.element.hidden = false;
            step.element.style.setProperty('visibility', 'hidden');
        }
        return { step, wasHidden, style };
    });

    try {
        return action();
    } finally {
        restored.forEach(({ step, wasHidden, style }) => {
            if (!wasHidden) return;
            step.element.hidden = true;
            if (style === null) step.element.removeAttribute('style');
            else step.element.setAttribute('style', style);
        });
    }
}

/**
 * Reserve the tallest complete step area, so Previous, Next and Play never
 * move the surrounding page. Titles and descriptions count, not only stages.
 */
function reserveStepHeight(state) {
    state.steps.forEach(step => step.element.style.removeProperty('min-height'));

    let tallest = 0;
    withStepsMeasurable(state, () => {
        state.steps.forEach(step => {
            tallest = Math.max(tallest, step.element.offsetHeight || 0);
        });
    });

    if (tallest <= 0) return;
    state.steps.forEach(step => {
        step.element.style.minHeight = `${Math.round(tallest)}px`;
    });
}

function updateOverflowCues(step) {
    const overflow = step.overflow ?? 0;
    const scrollable = overflow > 1;

    step.hint.hidden = !scrollable;
    if (scrollable) step.viewport.setAttribute('tabindex', '0');
    else step.viewport.removeAttribute('tabindex');

    const scrollLeft = step.viewport.scrollLeft || 0;
    if (scrollable && scrollLeft > 1) step.viewport.dataset.overflowLeft = 'true';
    else delete step.viewport.dataset.overflowLeft;

    if (scrollable && scrollLeft < overflow - 1) step.viewport.dataset.overflowRight = 'true';
    else delete step.viewport.dataset.overflowRight;
}

function scrollRatio(step) {
    const overflow = step.overflow ?? 0;
    if (overflow <= 0) return 0;
    return Math.min(1, Math.max(0, (step.viewport.scrollLeft || 0) / overflow));
}

function setScrollRatio(step, ratio) {
    const target = (step.overflow ?? 0) * ratio;
    step.commandedScrollLeft = target;
    step.viewport.scrollLeft = target;
}

// --- Rendering lifecycle ---------------------------------------------------

function measureHostCell(state, name) {
    if (!state.measureHost?.isConnected) {
        const host = document.createElement('div');
        host.dataset.diagramMeasureHost = '';
        host.setAttribute('aria-hidden', 'true');
        host.style.cssText = 'position:absolute;left:-99999px;top:0;'
            + 'visibility:hidden;pointer-events:none;';
        document.body.appendChild(host);
        state.measureHost = host;
    }

    let cell = state.measureHost.querySelector(`[data-diagram-variant="${name}"]`);
    if (!cell) {
        cell = document.createElement('div');
        cell.dataset.diagramVariant = name;
        state.measureHost.appendChild(cell);
    }
    cell.replaceChildren();
    cell.style.width = `${Math.round(readAvailableWidth(state)) || 0}px`;
    return cell;
}

/**
 * Render one variant off screen and measure it there, so the visible SVG stays
 * on the page for the whole recalculation.
 */
async function runRender(state, name) {
    const cell = measureHostCell(state, name);
    const results = [];

    for (const source of state.sources[name]) {
        const slot = document.createElement('div');
        cell.appendChild(slot);

        try {
            const result = await state.mermaid.render(`learning-diagram-${renderId++}`, source);
            slot.innerHTML = result.svg;
            const svg = slot.querySelector('svg');
            if (!svg) {
                results.push({});
                continue;
            }

            const size = normalizeSvg(svg);
            results.push({
                node: svg,
                bind: result.bindFunctions,
                measurement: size
                    ? { width: size.width, height: size.height, labelPx: measureLabelSize(svg) }
                    : null
            });
        } catch {
            results.push({});
        }
    }

    return results;
}

async function renderVariant(state, name) {
    const previous = state.variants[name];
    const results = await runRender(state, name);
    const complete = results.every(result => result.node);

    // A failed recalculation must never replace a working diagram. Keep the
    // last good measurements and retry on the next pass.
    if (!complete && state.committed && previous) {
        previous.stale = true;
        previous.nodesAvailable = false;
        return previous;
    }

    const variant = {
        results,
        measurements: results.map(result => result.measurement ?? null),
        stale: false,
        nodesAvailable: true
    };
    state.variants[name] = variant;
    return variant;
}

function measureVariant(state, name) {
    const variant = state.variants[name];
    if (variant && !variant.stale) return variant;
    return renderVariant(state, name);
}

async function commitVariant(state, name) {
    let variant = state.variants[name];
    if (!variant || variant.stale || !variant.nodesAvailable) {
        variant = await renderVariant(state, name);
    }
    if (!variant.nodesAvailable) return false;

    // One update for every step, so no reader sees a half-replaced widget.
    state.steps.forEach((step, index) => {
        const result = variant.results[index];
        if (!result?.node) {
            step.stage.replaceChildren();
            step.source.hidden = false;
            step.error.textContent = RENDER_ERROR;
            step.error.hidden = false;
            return;
        }

        step.stage.replaceChildren(result.node);
        if (result.bind) result.bind(step.stage);
        step.source.hidden = true;
        step.error.hidden = true;
        step.error.textContent = '';
    });

    variant.nodesAvailable = false;
    state.committed = true;
    return true;
}

async function refresh(state, { rerender = false } = {}) {
    const availableWidth = readAvailableWidth(state);
    if (availableWidth <= 0) return;

    if (rerender) {
        Object.values(state.variants).forEach(variant => {
            variant.stale = true;
        });
    }

    const canonical = await measureVariant(state, 'canonical');
    if (state.committed && !canonical.measurements.some(Boolean)) return;

    let selected = 'canonical';
    let plan = planLayout(canonical.measurements, availableWidth);
    let mode = plan.fits ? 'fit' : 'pan';

    if (!plan.fits && state.sources.narrow) {
        const narrow = await measureVariant(state, 'narrow');
        const narrowPlan = planLayout(narrow.measurements, availableWidth);
        if (narrow.measurements.some(Boolean) && narrowPlan.fits) {
            selected = 'narrow';
            plan = narrowPlan;
            mode = 'narrow';
        }
    }

    if (rerender || !state.committed || state.selected !== selected) {
        if (!await commitVariant(state, selected)) return;
        state.selected = selected;
    }

    state.mode = mode;
    state.availableWidth = availableWidth;
    state.widget.dataset.diagramLayout = mode;
    applyLayout(state, plan, availableWidth);
    reserveStepHeight(state);
    state.steps.forEach(updateOverflowCues);
}

function observeResize(state) {
    if (typeof ResizeObserver !== 'function') return;

    state.observer = new ResizeObserver(() => {
        if (!state.widget.isConnected) {
            state.observer.disconnect();
            return;
        }
        if (state.frame) return;

        state.frame = window.requestAnimationFrame(() => {
            state.frame = null;
            if (!state.widget.isConnected) {
                state.observer.disconnect();
                return;
            }

            // Only a real width change is work. Height changes are our own
            // output, so ignoring them is what stops an observer loop.
            const availableWidth = readAvailableWidth(state);
            if (availableWidth <= 0 || Math.abs(availableWidth - state.availableWidth) < 1) return;
            refresh(state, { rerender: false });
        });
    });

    state.observer.observe(state.widget);
}

// --- Controls --------------------------------------------------------------

function stopPlayback(state) {
    if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
    }

    state.playButton.textContent = 'Play';
    state.playButton.setAttribute('aria-pressed', 'false');
}

function showStep(state, index) {
    const previous = state.steps[state.current];
    const ratio = previous ? scrollRatio(previous) : 0;

    state.current = index;
    state.steps.forEach((step, stepIndex) => {
        step.element.hidden = stepIndex !== index;
    });

    const step = state.steps[index];
    setScrollRatio(step, ratio);
    updateOverflowCues(step);

    state.status.textContent = `Step ${index + 1} of ${state.steps.length}`;
    state.previousButton.disabled = index === 0;
    state.nextButton.disabled = index === state.steps.length - 1;
}

function startPlayback(state) {
    if (state.steps.length < 2) return;
    if (state.current === state.steps.length - 1) showStep(state, 0);

    state.playButton.textContent = 'Pause';
    state.playButton.setAttribute('aria-pressed', 'true');
    state.timer = setInterval(() => {
        showStep(state, state.current + 1);
        if (state.current === state.steps.length - 1) stopPlayback(state);
    }, DIAGRAM_PLAY_INTERVAL_MS);
}

function collectSteps(widget) {
    return Array.from(widget.querySelectorAll('[data-diagram-step]')).map(element => ({
        element,
        viewport: element.querySelector('[data-diagram-viewport]'),
        stage: element.querySelector('[data-diagram-canvas]'),
        hint: element.querySelector('[data-diagram-scroll-hint]'),
        source: element.querySelector('[data-diagram-source]'),
        error: element.querySelector('[data-diagram-error]'),
        overflow: 0,
        commandedScrollLeft: 0
    }));
}

async function enhanceDiagram(widget, mermaid) {
    const steps = collectSteps(widget);
    if (steps.length === 0 || steps.some(step => !step.viewport || !step.stage)) return;

    const canonical = steps.map(step => step.source.textContent.trim());
    const state = {
        widget,
        mermaid,
        steps,
        current: 0,
        timer: null,
        committed: false,
        selected: null,
        mode: null,
        availableWidth: 0,
        variants: {},
        sources: {
            canonical,
            narrow: buildNarrowSources(canonical, widget.dataset.diagramNarrowDirection ?? '')
        },
        status: widget.querySelector('[data-diagram-status]'),
        previousButton: widget.querySelector('[data-diagram-action="previous"]'),
        nextButton: widget.querySelector('[data-diagram-action="next"]'),
        playButton: widget.querySelector('[data-diagram-action="play"]')
    };

    state.previousButton.addEventListener('click', () => {
        stopPlayback(state);
        if (state.current > 0) showStep(state, state.current - 1);
    });
    state.nextButton.addEventListener('click', () => {
        stopPlayback(state);
        if (state.current < state.steps.length - 1) showStep(state, state.current + 1);
    });
    state.playButton.addEventListener('click', () => {
        if (state.timer) stopPlayback(state);
        else startPlayback(state);
    });

    steps.forEach(step => {
        step.viewport.addEventListener('scroll', () => {
            updateOverflowCues(step);
            // A scroll we did not command is the reader taking over.
            const moved = Math.abs((step.viewport.scrollLeft || 0) - (step.commandedScrollLeft ?? 0));
            if ((step.overflow ?? 0) > 1 && moved > 1) stopPlayback(state);
        });
    });

    await refresh(state, { rerender: true });

    widget.querySelector('[data-diagram-controls]').hidden = false;
    state.playButton.disabled = steps.length < 2;
    widget.dataset.diagramInitialized = 'true';
    observeResize(state);
    diagramStates.push(state);
    showStep(state, 0);
}

window.initInteractiveDiagrams = async (providedMermaid) => {
    const widgets = Array.from(document.querySelectorAll('[data-interactive-diagram]'))
        .filter(widget => !widget.dataset.diagramInitialized);
    if (widgets.length === 0) return;

    widgets.forEach(widget => {
        widget.dataset.diagramInitialized = 'loading';
        widget.querySelectorAll('[data-diagram-source]').forEach(source => source.hidden = true);
    });

    try {
        const mermaid = await getMermaid(providedMermaid);
        configureMermaid(mermaid);
        for (const widget of widgets) {
            await enhanceDiagram(widget, mermaid);
        }
    } catch {
        widgets.forEach(widget => {
            widget.dataset.diagramInitialized = 'error';
            const error = widget.querySelector('[data-diagram-error]');
            const visibleSource = widget.querySelector('[data-diagram-step]:not([hidden]) [data-diagram-source]');
            if (visibleSource) visibleSource.hidden = false;
            if (error) {
                error.textContent = LOAD_ERROR;
                error.hidden = false;
            }
        });
    }
};

window.refreshInteractiveDiagrams = async () => {
    if (diagramStates.length === 0) return;

    configuredTheme = undefined;
    configureMermaid(diagramStates[0].mermaid);

    for (const state of diagramStates) {
        if (!state.widget.isConnected) continue;
        await refresh(state, { rerender: true });
        showStep(state, state.current);
    }
};
