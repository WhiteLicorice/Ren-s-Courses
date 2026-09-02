'use strict';

/**
 * Permanent, in-memory interactive-diagram fixtures.
 *
 * These fixtures are test infrastructure. They are independent of
 * Content/Materials, so no production article is required to exercise the
 * diagram renderer. Both the Jest suite (wwwroot/js/__tests__) and the
 * Playwright suite (tests/e2e) require this module, so a fixture is authored
 * exactly once.
 *
 * `buildWidgetMarkup` mirrors Components/InteractiveDiagram.razor. Keep the
 * two in step: the renderer reads the data attributes emitted here.
 */

const DIAGRAM_FIXTURES = {
    /**
     * Reproduces the reported geometry: a wide left-to-right token stream whose
     * labels become unreadable when the canonical drawing is squeezed into the
     * article width. Opts in to a vertical narrow layout.
     */
    wideTokenStream: {
        title: 'Token stream for a = 1 + 2;',
        description: 'The scanner emits one token per source lexeme.',
        narrowDirection: 'TB',
        steps: [
            {
                title: 'Scan the identifier',
                description: 'The scanner reads the assignment target.',
                active: 'T0'
            },
            {
                title: 'Scan the assignment operator',
                description: 'The equals sign separates target from expression.',
                active: 'T1'
            },
            {
                title: 'Scan the first operand',
                description: 'The first integer literal enters the stream.',
                active: 'T2'
            },
            {
                title: 'Scan the addition operator',
                description: 'The operator joins both integer literals.',
                active: 'T3'
            }
        ].map(step => ({
            title: step.title,
            description: step.description,
            mermaid: [
                'flowchart LR',
                '    T0["IDENT: identifier a"] --> T1["ASSIGN: equals sign"]',
                '    T1 --> T2["NUMBER: integer literal 1"]',
                '    T2 --> T3["PLUS: addition operator"]',
                '    T3 --> T4["NUMBER: integer literal 2"]',
                '    T4 --> T5["SEMI: statement terminator"]',
                '    T5 --> T6["EOF: end of source input"]',
                '    T6 --> T7["ACCEPT: token stream complete"]',
                '    classDef active fill:#ef4444,color:#ffffff,stroke:#991b1b,stroke-width:2px',
                `    class ${step.active} active`
            ].join('\n')
        }))
    },

    /**
     * Equally wide, but the author never approved a vertical variant. The
     * renderer must fall back to horizontal panning at a readable scale.
     */
    wideFlowchartWithoutReflow: {
        title: 'Compiler phases',
        description: 'Each phase hands its output to the next phase.',
        narrowDirection: '',
        steps: [
            { title: 'Front end', description: 'Source text becomes an annotated tree.', active: 'P0' },
            { title: 'Back end', description: 'The tree becomes machine instructions.', active: 'P5' }
        ].map(step => ({
            title: step.title,
            description: step.description,
            mermaid: [
                'flowchart LR',
                '    P0["Lexical analysis"] --> P1["Syntax analysis"]',
                '    P1 --> P2["Semantic analysis"]',
                '    P2 --> P3["Intermediate representation"]',
                '    P3 --> P4["Machine independent optimizer"]',
                '    P4 --> P5["Instruction selection"]',
                '    P5 --> P6["Register allocation"]',
                '    P6 --> P7["Object code emission"]',
                '    classDef active fill:#ef4444,color:#ffffff,stroke:#991b1b,stroke-width:2px',
                `    class ${step.active} active`
            ].join('\n')
        }))
    },

    /**
     * Declares a narrow direction that the renderer must refuse to apply: a
     * sequence diagram has no flowchart direction token. It pans instead.
     */
    wideSequenceDiagram: {
        title: 'Evaluating factorial(3)',
        description: 'Each call waits for the next smaller factorial.',
        narrowDirection: 'TB',
        steps: [
            {
                title: 'Descend into the recursion',
                description: 'Every call suspends until its callee returns.',
                mermaid: [
                    'sequenceDiagram',
                    '    participant M as main routine',
                    '    participant F3 as factorial(3)',
                    '    participant F2 as factorial(2)',
                    '    participant F1 as factorial(1)',
                    '    M->>F3: factorial(3)',
                    '    F3->>F2: factorial(2)',
                    '    F2->>F1: factorial(1)'
                ].join('\n')
            },
            {
                title: 'Unwind the call stack',
                description: 'Each frame multiplies and returns.',
                mermaid: [
                    'sequenceDiagram',
                    '    participant M as main routine',
                    '    participant F3 as factorial(3)',
                    '    participant F2 as factorial(2)',
                    '    participant F1 as factorial(1)',
                    '    F1-->>F2: 1',
                    '    F2-->>F3: 2',
                    '    F3-->>M: 6'
                ].join('\n')
            }
        ]
    },

    /**
     * Steps deliberately differ in drawing width, drawing height, title length
     * and description length. The widget must still reserve one stable height.
     */
    mixedAspectSteps: {
        title: 'Mixed aspect walkthrough',
        description: 'Step geometry changes on every step.',
        narrowDirection: '',
        steps: [
            {
                title: 'Wide and short',
                description: 'One short line.',
                mermaid: 'flowchart LR\n    A["Alpha"] --> B["Beta"]\n    B --> C["Gamma"]\n    C --> D["Delta"]'
            },
            {
                title: 'Narrow and tall',
                description: 'A much longer description that wraps onto more than one line so the '
                    + 'complete step area is taller than the previous step and the widget must not '
                    + 'resize when the reader moves between the two.',
                mermaid: 'flowchart TB\n    A["Alpha"] --> B["Beta"]\n    B --> C["Gamma"]\n    C --> D["Delta"]\n    D --> E["Epsilon"]'
            },
            {
                title: 'Square',
                description: '',
                mermaid: 'flowchart TB\n    A["Alpha"] --> B["Beta"]\n    A --> C["Gamma"]'
            }
        ]
    },

    /**
     * A short left-to-right walkthrough that hides only a little of itself, so
     * one pan crosses it in a few seconds. Playback pacing tests use this: the
     * wide fixtures above hide more than a whole viewport and take far too long
     * to cross in a browser test. It declares no narrow direction, so the
     * widget must pan rather than reflow.
     *
     * The shape follows authored material: one node per character, a highlight
     * that moves from step to step, and a step count above two.
     */
    modestOverflowWalkthrough: {
        title: 'Scanning one identifier',
        description: 'The cursor moves along the source one character at a time.',
        narrowDirection: '',
        steps: [
            {
                title: 'Read the first character',
                description: 'A letter starts an identifier.',
                active: 'C1'
            },
            {
                title: 'Continue the lexeme',
                description: 'Letters keep the identifier going.',
                active: 'C3'
            },
            {
                title: 'Close the lexeme',
                description: 'The five characters become one lexeme.',
                active: 'L'
            }
        ].map(step => ({
            title: step.title,
            description: step.description,
            mermaid: [
                'flowchart LR',
                '    C1["t<br/>col 10"] --> C2["o<br/>col 11"]',
                '    C2 --> C3["t<br/>col 12"]',
                '    C3 --> C4["a<br/>col 13"]',
                '    C4 --> C5["l<br/>col 14"]',
                '    C5 --> L["lexeme<br/>total"]',
                '    classDef current fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#111827',
                `    class ${step.active} current`
            ].join('\n')
        }))
    },

    /** Already vertical and small. Must fit without a narrow re-render. */
    alreadyVerticalFlowchart: {
        title: 'Two phase commit',
        description: 'A short vertical flow.',
        narrowDirection: 'TB',
        steps: [
            { title: 'Prepare', description: 'Ask every participant.', mermaid: 'flowchart TB\n    A["Prepare"] --> B["Vote"]' },
            { title: 'Commit', description: 'Apply the decision.', mermaid: 'flowchart TB\n    A["Prepare"] --> B["Commit"]' }
        ]
    },

    /** One step only. Playback stays disabled. */
    singleStepDiagram: {
        title: 'Single frame',
        description: 'Nothing to step through.',
        narrowDirection: '',
        steps: [
            { title: 'The only step', description: 'One frame.', mermaid: 'flowchart LR\n    A["Only"] --> B["Frame"]' }
        ]
    },

    /** A diagram whose nodes carry no text at all. */
    noTextDiagram: {
        title: 'Unlabelled graph',
        description: 'Shapes without labels.',
        narrowDirection: '',
        steps: [
            { title: 'Bare nodes', description: '', mermaid: 'flowchart LR\n    A --> B\n    B --> C' },
            { title: 'More bare nodes', description: '', mermaid: 'flowchart LR\n    A --> B\n    B --> C\n    C --> D' }
        ]
    }
};

/** Two independent widgets rendered onto one page. */
const MULTIPLE_WIDGETS = ['wideTokenStream', 'alreadyVerticalFlowchart'];

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Build the static markup that Components/InteractiveDiagram.razor emits for a
 * fixture. `index` matches the Razor `DiagramIndex`, so several widgets on one
 * page keep unique element ids.
 */
function buildWidgetMarkup(fixture, index = 0) {
    const narrow = fixture.narrowDirection
        ? ` data-diagram-narrow-direction="${escapeHtml(fixture.narrowDirection)}"`
        : '';

    const steps = fixture.steps.map((step, stepIndex) => {
        const titleId = `learning-diagram-${index}-step-${stepIndex}-title`;
        const viewportId = `learning-diagram-${index}-step-${stepIndex}-viewport`;
        const instructionId = `learning-diagram-${index}-step-${stepIndex}-instruction`;
        const description = step.description
            ? `<p class="mt-2 text-sm leading-6 text-text-dim">${escapeHtml(step.description)}</p>`
            : '';

        return `
            <section data-diagram-step${stepIndex > 0 ? ' hidden' : ''} aria-labelledby="${titleId}">
                <p class="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-accent">Step ${stepIndex + 1}</p>
                <h3 id="${titleId}" class="text-lg font-semibold text-text-main">${escapeHtml(step.title)}</h3>
                ${description}
                <div class="diagram-viewport mt-5" id="${viewportId}" data-diagram-viewport
                    aria-describedby="${instructionId}">
                    <div class="diagram-stage" data-diagram-canvas></div>
                </div>
                <p class="diagram-scroll-hint mt-2 font-mono text-xs text-text-dim" id="${instructionId}"
                    data-diagram-scroll-hint hidden>Scroll sideways to view the full diagram.</p>
                <pre class="diagram-source mt-5 overflow-x-auto rounded border border-border-muted bg-bg-base p-4 text-xs text-text-dim"
                    data-diagram-source>${escapeHtml(step.mermaid)}</pre>
                <p class="mt-3 text-sm text-accent" data-diagram-error role="alert" hidden></p>
            </section>`;
    }).join('');

    return `
        <section class="interactive-diagram not-prose my-10 overflow-hidden rounded-lg border border-border-muted bg-surface"
            data-interactive-diagram${narrow} aria-labelledby="learning-diagram-${index}-title">
            <header class="border-b border-border-muted px-5 py-4 sm:px-6">
                <h2 id="learning-diagram-${index}-title" class="font-mono text-xl font-bold text-text-main">${escapeHtml(fixture.title)}</h2>
                ${fixture.description ? `<p class="mt-2 text-sm leading-6 text-text-dim">${escapeHtml(fixture.description)}</p>` : ''}
            </header>
            <div class="diagram-controls flex flex-wrap items-center gap-2 border-b border-border-muted px-5 py-3 sm:px-6"
                data-diagram-controls hidden>
                <button type="button" data-diagram-action="previous">Previous</button>
                <output class="min-w-24 text-center font-mono text-xs text-text-dim" data-diagram-status
                    aria-live="polite">Step 1 of ${fixture.steps.length}</output>
                <button type="button" data-diagram-action="next">Next</button>
                <button type="button" data-diagram-action="play" aria-pressed="false">Play</button>
            </div>
            <div class="p-5 sm:p-6">${steps}</div>
        </section>`;
}

/** Build a whole page body from one or more fixture names. */
function buildPageMarkup(names) {
    return [].concat(names)
        .map((name, index) => buildWidgetMarkup(DIAGRAM_FIXTURES[name], index))
        .join('\n');
}

module.exports = {
    DIAGRAM_FIXTURES,
    MULTIPLE_WIDGETS,
    buildWidgetMarkup,
    buildPageMarkup
};
