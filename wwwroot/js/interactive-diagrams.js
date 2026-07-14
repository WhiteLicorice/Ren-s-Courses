// wwwroot/js/interactive-diagrams.js

const MERMAID_MODULE_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs';
const DIAGRAM_PLAY_INTERVAL_MS = 2000;

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
        mermaidPromise = import(MERMAID_MODULE_URL).then(module => module.default);
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

function stopPlayback(state) {
    if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
    }

    state.playButton.textContent = 'Play';
    state.playButton.setAttribute('aria-pressed', 'false');
}

async function renderStep(state, index) {
    const step = state.steps[index];
    const source = step.querySelector('[data-diagram-source]');
    const canvas = step.querySelector('[data-diagram-canvas]');
    const error = step.querySelector('[data-diagram-error]');
    const theme = getDiagramTheme();

    if (step.dataset.renderedTheme === theme) return;

    try {
        const definition = source.textContent.trim();
        const result = await state.mermaid.render(`learning-diagram-${renderId++}`, definition);
        canvas.innerHTML = result.svg;
        canvas.querySelector('svg')?.style.removeProperty('max-width');
        if (result.bindFunctions) result.bindFunctions(canvas);
        source.hidden = true;
        error.hidden = true;
        error.textContent = '';
        step.dataset.renderedTheme = theme;
    } catch {
        canvas.replaceChildren();
        source.hidden = false;
        error.textContent = 'This diagram could not be rendered. Check the Mermaid source shown below.';
        error.hidden = false;
    }
}

function showStep(state, index) {
    state.current = index;
    state.steps.forEach((step, stepIndex) => {
        step.hidden = stepIndex !== index;
    });

    state.status.textContent = `Step ${index + 1} of ${state.steps.length}`;
    state.previousButton.disabled = index === 0;
    state.nextButton.disabled = index === state.steps.length - 1;
    void renderStep(state, index);
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

function enhanceDiagram(widget, mermaid) {
    const steps = Array.from(widget.querySelectorAll('[data-diagram-step]'));
    if (steps.length === 0) return;

    const state = {
        widget,
        mermaid,
        steps,
        current: 0,
        timer: null,
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

    widget.querySelector('[data-diagram-controls]').hidden = false;
    state.playButton.disabled = steps.length < 2;
    widget.dataset.diagramInitialized = 'true';
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
        widgets.forEach(widget => enhanceDiagram(widget, mermaid));
    } catch {
        widgets.forEach(widget => {
            widget.dataset.diagramInitialized = 'error';
            const error = widget.querySelector('[data-diagram-error]');
            const visibleSource = widget.querySelector('[data-diagram-step]:not([hidden]) [data-diagram-source]');
            if (visibleSource) visibleSource.hidden = false;
            if (error) {
                error.textContent = 'The interactive diagram renderer could not be loaded.';
                error.hidden = false;
            }
        });
    }
};

window.refreshInteractiveDiagrams = async () => {
    if (diagramStates.length === 0) return;

    configuredTheme = undefined;
    configureMermaid(diagramStates[0].mermaid);

    await Promise.all(diagramStates.map(state => {
        state.steps.forEach(step => {
            delete step.dataset.renderedTheme;
            step.querySelector('[data-diagram-canvas]').replaceChildren();
        });
        return renderStep(state, state.current);
    }));
};
