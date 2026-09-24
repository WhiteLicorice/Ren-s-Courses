'use strict';

/**
 * Permanent, in-memory article fixture for the table of contents.
 *
 * This fixture is test infrastructure. It is independent of Content/Materials,
 * so no production article is required to exercise toc.js.
 *
 * `buildTocHarnessPage` mirrors three files. Keep them in step:
 * - Components/Layout/MainLayout.razor, for the page shell.
 * - Components/Layout/NavMenu.razor, for the fixed #main-navbar and its h-16 bar.
 * - Components/Pages/Blog.razor, for the article grid, the mobile <details>,
 *   the .prose body, and the sticky sidebar box around #toc-content.
 * toc.js reads the ids. The classes must exist in the built stylesheet, so copy
 * them from the Razor files rather than writing new ones.
 */

const { DIAGRAM_FIXTURES, buildWidgetMarkup } = require('./diagram-fixtures');

/** toc.js derives this id from the <h1> text, as Blog.razor emits no id. */
const TITLE_TEXT = 'TOC Harness';
const TITLE_ID = 'toc-harness';

/**
 * The authored outline, in document order. It has enough entries to overflow
 * the sidebar box at 1440x900. `kotlin` is the hash-load target. `build.sh-run`
 * carries a dot, which breaks an id selector.
 */
const SECTIONS = [];
for (let part = 1; part <= 12; part++) {
    SECTIONS.push({ level: 'h2', id: `part-${part}`, text: `Part ${part}` });
    for (const letter of ['a', 'b', 'c']) {
        SECTIONS.push({ level: 'h3', id: `part-${part}-${letter}`, text: `Part ${part}${letter.toUpperCase()}` });
    }
}
SECTIONS.splice(SECTIONS.findIndex(s => s.id === 'part-3'), 0,
    { level: 'h3', id: 'kotlin', text: 'Kotlin' });
SECTIONS.splice(SECTIONS.findIndex(s => s.id === 'part-6'), 0,
    { level: 'h2', id: 'build.sh-run', text: 'build.sh run' });

/** The diagram widget follows this section, so its hidden steps sit mid-page. */
const DIAGRAM_AFTER = 'part-4-c';

/** Every id the TOC must list, in order. */
const OUTLINE_IDS = [TITLE_ID, ...SECTIONS.map(section => section.id)];

const PARAGRAPH = 'The reader follows this section from top to bottom. Each sentence adds '
    + 'height, so the page scrolls far enough for every heading to cross the navbar line. '
    + 'The words carry no meaning beyond their length and their place on the page.';

function buildSection(section, index) {
    // The last section stays short, so its heading cannot reach the navbar line.
    const isLast = index === SECTIONS.length - 1;
    const body = isLast
        ? '<p>The document ends here.</p>'
        : `<p>${PARAGRAPH}</p><p>${PARAGRAPH}</p>`;
    // A Markdown [text](#heading) link renders as a bare fragment href.
    const inBodyLink = index === 0 ? '<p>Jump to <a id="inbody-hash" href="#kotlin">Kotlin</a>.</p>' : '';
    const widget = section.id === DIAGRAM_AFTER ? buildWidgetMarkup(DIAGRAM_FIXTURES.wideTokenStream) : '';
    return `<${section.level} id="${section.id}">${section.text}</${section.level}>${inBodyLink}${body}${widget}`;
}

function buildTocHarnessPage() {
    return `<!doctype html>
<html lang="en" data-theme="dark" class="scroll-smooth">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<base href="/">
<link rel="stylesheet" href="css/app.css">
<link rel="stylesheet" href="css/site.css">
</head>
<body class="min-h-screen bg-bg-base font-sans text-text-dim antialiased selection:bg-accent selection:text-white">
<div class="flex min-h-screen flex-col bg-bg-base transition-colors duration-300">
    <header id="main-navbar"
        class="fixed top-0 left-0 right-0 z-40 w-full border-b border-border-muted bg-bg-base transition-transform duration-300">
        <div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 xl:px-0"></div>
    </header>
    <header id="header"> </header>
    <main id="main" class="flex-grow w-full mx-auto max-w-5xl px-4 sm:px-6 xl:px-0">
        <div class="w-full px-4 animate-fade-in">
            <div class="grid grid-cols-1 xl:grid-cols-[1fr_minmax(auto,65ch)_1fr] gap-8 relative max-w-[1920px] mx-auto">
                <div class="hidden xl:block"></div>
                <article class="min-w-0 w-full mx-auto max-w-[65ch]">
                    <header class="border-b border-border-muted pb-10 pt-10 text-center">
                        <h1 class="text-3xl font-bold text-text-main sm:text-5xl font-mono">${TITLE_TEXT}</h1>
                    </header>
                    <div class="xl:hidden mt-8 mb-4">
                        <details class="group bg-surface border border-border-muted rounded-lg overflow-hidden">
                            <summary class="flex items-center justify-between p-4 cursor-pointer list-none text-text-dim font-mono text-sm font-bold">
                                <span><span class="text-accent mr-2">>></span>Table of Contents</span>
                            </summary>
                            <div class="p-4 pt-0 border-t border-border-muted/50">
                                <nav id="mobile-toc-content" class="mt-2"></nav>
                            </div>
                        </details>
                    </div>
                    <div class="prose max-w-none py-10">${SECTIONS.map(buildSection).join('\n')}</div>
                    <div class="border-t border-border-muted pt-8 pb-12">
                        <a href="" class="group flex items-center gap-2 text-sm font-medium text-text-dim hover:text-accent transition-colors">
                            <span>&larr;</span> Home
                        </a>
                    </div>
                </article>
                <aside class="hidden xl:block relative">
                    <div class="sticky top-8 overflow-y-auto max-h-[calc(100vh-4rem)] pt-10 pl-8 scrollbar-slim">
                        <nav id="toc-content"></nav>
                    </div>
                </aside>
            </div>
        </div>
    </main>
</div>
<script src="js/toc.js"></script>
<script>document.addEventListener('DOMContentLoaded', () => window.generateTOC());</script>
</body>
</html>`;
}

module.exports = {
    OUTLINE_IDS,
    DIAGRAM_AFTER,
    buildTocHarnessPage
};
