'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../interactive-diagrams.js'), 'utf8');

function loadScript() {
    // eslint-disable-next-line no-new-func
    new Function(source)();
}

function buildWidget() {
    document.body.innerHTML = `
        <section data-interactive-diagram>
            <div data-diagram-controls hidden>
                <button data-diagram-action="previous">Previous</button>
                <output data-diagram-status aria-live="polite">Step 1 of 2</output>
                <button data-diagram-action="next">Next</button>
                <button data-diagram-action="play" aria-pressed="false">Play</button>
            </div>
            <section data-diagram-step>
                <h3>Compare</h3>
                <div data-diagram-canvas></div>
                <pre data-diagram-source>flowchart LR\nA[5] --> B[2]</pre>
                <p data-diagram-error hidden></p>
            </section>
            <section data-diagram-step hidden>
                <h3>Swap</h3>
                <div data-diagram-canvas></div>
                <pre data-diagram-source>flowchart LR\nB[2] --> A[5]</pre>
                <p data-diagram-error hidden></p>
            </section>
        </section>`;
}

function createMermaid() {
    return {
        initialize: jest.fn(),
        render: jest.fn(async (id, definition) => ({
            svg: `<svg data-render-id="${id}" style="max-width: 80px"><title>${definition}</title></svg>`
        }))
    };
}

beforeEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
    document.documentElement.setAttribute('data-theme', 'dark');
    loadScript();
});

afterEach(() => {
    jest.restoreAllMocks();
});

test('renders every step before enabling the controls', async () => {
    buildWidget();
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'dark'
    }));
    expect(mermaid.render).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-diagram-controls]').hidden).toBe(false);
    expect([...document.querySelectorAll('[data-diagram-canvas]')]
        .every(canvas => canvas.querySelector('svg'))).toBe(true);
    expect([...document.querySelectorAll('[data-diagram-source]')]
        .every(source => source.hidden)).toBe(true);
    expect(document.querySelector('[data-diagram-action="previous"]').disabled).toBe(true);
});

test('hides every source fallback before asynchronous rendering can expose a new step', async () => {
    buildWidget();
    const mermaid = createMermaid();

    const initialization = window.initInteractiveDiagrams(mermaid);

    expect([...document.querySelectorAll('[data-diagram-source]')].every(source => source.hidden)).toBe(true);
    await initialization;
    document.querySelector('[data-diagram-action="next"]').click();
    expect(document.querySelectorAll('[data-diagram-source]')[1].hidden).toBe(true);
});

test('removes Mermaid intrinsic width caps so CSS can size the SVG to its canvas', async () => {
    buildWidget();
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    expect(document.querySelector('[data-diagram-canvas] svg').style.maxWidth).toBe('');
});

test('next and previous controls change the visible step', async () => {
    buildWidget();
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    document.querySelector('[data-diagram-action="next"]').click();
    await Promise.resolve();
    await Promise.resolve();

    const steps = document.querySelectorAll('[data-diagram-step]');
    expect(steps[0].hidden).toBe(true);
    expect(steps[1].hidden).toBe(false);
    expect(document.querySelector('[data-diagram-status]').textContent).toBe('Step 2 of 2');
    expect(document.querySelector('[data-diagram-action="next"]').disabled).toBe(true);

    document.querySelector('[data-diagram-action="previous"]').click();
    expect(steps[0].hidden).toBe(false);
    expect(steps[1].hidden).toBe(true);
});

test('play advances through the remaining steps and then stops', async () => {
    jest.useFakeTimers();
    buildWidget();
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

test('disables playback when a diagram has only one step', async () => {
    buildWidget();
    document.querySelectorAll('[data-diagram-step]')[1].remove();
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    const play = document.querySelector('[data-diagram-action="play"]');
    expect(play.disabled).toBe(true);
    play.click();
    expect(play.getAttribute('aria-pressed')).toBe('false');
});

test('a Mermaid error keeps the source visible and shows an error message', async () => {
    buildWidget();
    const mermaid = createMermaid();
    mermaid.render.mockRejectedValueOnce(new Error('bad syntax'));

    await window.initInteractiveDiagrams(mermaid);

    expect(document.querySelector('[data-diagram-source]').hidden).toBe(false);
    const error = document.querySelector('[data-diagram-error]');
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('could not be rendered');
});

test('does not initialize Mermaid when the page has no diagram widgets', async () => {
    const mermaid = createMermaid();

    await window.initInteractiveDiagrams(mermaid);

    expect(mermaid.initialize).not.toHaveBeenCalled();
    expect(mermaid.render).not.toHaveBeenCalled();
});

test('rerenders every step when the site theme changes', async () => {
    buildWidget();
    const mermaid = createMermaid();
    await window.initInteractiveDiagrams(mermaid);

    document.documentElement.setAttribute('data-theme', 'light');
    await window.refreshInteractiveDiagrams();

    expect(mermaid.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'default' }));
    expect(mermaid.render).toHaveBeenCalledTimes(4);
    expect(document.querySelector('[data-diagram-source]').hidden).toBe(true);
});
