'use strict';

const fs = require('fs');
const path = require('path');

const tocSource = fs.readFileSync(path.join(__dirname, '../toc.js'), 'utf8');

// Navbar clearance used by the scroll spy. Mirrors NAV_OFFSET in toc.js.
const NAV_OFFSET = 80;

function loadTocScript() {
    // eslint-disable-next-line no-new-func
    new Function(tocSource)();
}

function buildDOM() {
    document.body.innerHTML = `
        <article>
            <h1 id="main-title">Main Title</h1>
            <div class="prose">
                <h2 id="section-one">Section One</h2>
                <h3 id="section-two">Section Two</h3>
                <h2 id="build.sh-run">Build and Run</h2>
                <a id="inbody-hash" href="#section-one">jump to one</a>
                <a id="inbody-bare" href="#">bare</a>
                <a id="inbody-abs" href="/materials">materials</a>
                <a id="inbody-ext" href="https://example.com/x#frag">external</a>
            </div>
            <div id="toc-content"></div>
            <details id="mobile-details" open>
                <div id="mobile-toc-content"></div>
            </details>
        </article>
    `;
}

// Call the real pushState (bypasses any active jest.spyOn mock on pushState).
function realPushState(url) {
    Object.getPrototypeOf(window.history).pushState.call(window.history, {}, '', url);
}

// jsdom has no layout: every getBoundingClientRect() is zeroed. Stub the tops the
// scroll spy reads so section positions are deterministic.
function stubTops(tops) {
    Object.entries(tops).forEach(([id, top]) => {
        document.getElementById(id).getBoundingClientRect = () => ({
            top, bottom: top + 20, left: 0, right: 0, width: 100, height: 20
        });
    });
}

const flushRaf = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

const activeIn = selector => Array.from(document.querySelectorAll(`${selector} a`))
    .filter(a => a.classList.contains('text-accent'))
    .map(a => a.dataset.target);

// Shared arrangement: article path (not root) so base-URL bugs are observable.
function arrange() {
    realPushState('/articles/demo');
    buildDOM();
    Element.prototype.scrollIntoView = jest.fn();
    window.scrollTo = jest.fn();
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    const pushStateSpy = jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
    loadTocScript();
    window.generateTOC();
    return { replaceStateSpy, pushStateSpy };
}

afterEach(() => {
    jest.restoreAllMocks();
    realPushState('/');
});

// ─── link structure ───────────────────────────────────────────────────────────

describe('generateTOC — link structure', () => {
    beforeEach(() => { arrange(); });

    test('TOC links have no href attribute (prevents Blazor nav interception)', () => {
        const links = document.querySelectorAll('#toc-content a');
        links.forEach(link => {
            // getAttribute returns null when attribute absent; empty string when set to ''.
            const href = link.getAttribute('href');
            expect(href === null || href === '').toBe(true);
        });
    });

    test('TOC links have tabindex="0" for keyboard accessibility', () => {
        const link = document.querySelector('#toc-content a[data-target="section-one"]');
        expect(link).not.toBeNull();
        expect(link.getAttribute('tabindex')).toBe('0');
    });

    test('TOC links carry role="link" so they are announced as links', () => {
        const links = document.querySelectorAll('#toc-content a, #mobile-toc-content a');
        expect(links.length).toBeGreaterThan(0);
        links.forEach(link => expect(link.getAttribute('role')).toBe('link'));
    });
});

// ─── hash written to history ──────────────────────────────────────────────────

describe('generateTOC — hash written to history', () => {
    let replaceStateSpy;
    let pushStateSpy;

    beforeEach(() => { ({ replaceStateSpy, pushStateSpy } = arrange()); });

    test('clicking a TOC link keeps the article path in the URL', () => {
        // A bare '#id' would be resolved against document.baseURI (App.razor sets
        // <base href="/">), rewriting the URL to the site root.
        const link = document.querySelector('#toc-content a[data-target="section-one"]');
        expect(link).not.toBeNull();
        link.click();
        expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/articles/demo#section-one');
    });

    test('clicking a TOC link does NOT call pushState', () => {
        document.querySelector('#toc-content a[data-target="section-one"]').click();
        expect(pushStateSpy).not.toHaveBeenCalled();
    });

    test('mobile TOC link also keeps the article path', () => {
        const link = document.querySelector('#mobile-toc-content a[data-target="section-two"]');
        expect(link).not.toBeNull();
        link.click();
        expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/articles/demo#section-two');
    });

    test('ids containing CSS-significant characters survive the rewrite', () => {
        document.querySelector('#toc-content a[data-target="build.sh-run"]').click();
        expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/articles/demo#build.sh-run');
    });
});

// ─── keyboard activation ──────────────────────────────────────────────────────

describe('generateTOC — keyboard activation', () => {
    let replaceStateSpy;

    beforeEach(() => { ({ replaceStateSpy } = arrange()); });

    test('Enter key on TOC link updates the URL', () => {
        const link = document.querySelector('#toc-content a[data-target="section-one"]');
        link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/articles/demo#section-one');
    });

    test('Space key on TOC link updates the URL', () => {
        const link = document.querySelector('#toc-content a[data-target="section-two"]');
        link.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/articles/demo#section-two');
    });

    test('other keys do NOT call replaceState', () => {
        const link = document.querySelector('#toc-content a[data-target="section-one"]');
        link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(replaceStateSpy).not.toHaveBeenCalled();
    });

    test('Enter key on TOC link scrolls to the target heading', () => {
        const link = document.querySelector('#toc-content a[data-target="section-one"]');
        link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(document.getElementById('section-one').scrollIntoView)
            .toHaveBeenCalledWith({ behavior: 'smooth' });
    });
});

// ─── active-section highlight ─────────────────────────────────────────────────

describe('generateTOC — active-section highlight', () => {
    beforeEach(() => { arrange(); });

    test('clicking a TOC link highlights that link immediately', () => {
        document.querySelector('#toc-content a[data-target="section-two"]').click();
        expect(activeIn('#toc-content')).toEqual(['section-two']);
    });

    test('clicking highlights the matching entry in both desktop and mobile lists', () => {
        document.querySelector('#toc-content a[data-target="section-two"]').click();
        expect(activeIn('#mobile-toc-content')).toEqual(['section-two']);
    });

    test('activating a different link clears the previous highlight', () => {
        document.querySelector('#toc-content a[data-target="section-one"]').click();
        document.querySelector('#toc-content a[data-target="section-two"]').click();
        expect(activeIn('#toc-content')).toEqual(['section-two']);
    });

    test('the active link is marked with aria-current', () => {
        document.querySelector('#toc-content a[data-target="section-one"]').click();
        const marked = Array.from(document.querySelectorAll('#toc-content a'))
            .filter(a => a.hasAttribute('aria-current'))
            .map(a => a.dataset.target);
        expect(marked).toEqual(['section-one']);
    });

    test('the active link swaps its left border to the accent colour', () => {
        document.querySelector('#toc-content a[data-target="section-one"]').click();
        const link = document.querySelector('#toc-content a[data-target="section-one"]');
        expect(link.classList.contains('border-accent')).toBe(true);
        expect(link.classList.contains('border-border-muted')).toBe(false);
    });
});

// ─── scroll spy ───────────────────────────────────────────────────────────────

describe('generateTOC — scroll spy', () => {
    beforeEach(() => { arrange(); });

    test('highlights the last heading scrolled past the navbar offset', async () => {
        stubTops({
            'main-title': -500,
            'section-one': -100,
            'section-two': NAV_OFFSET + 200,
            'build.sh-run': NAV_OFFSET + 600
        });
        window.dispatchEvent(new Event('scroll'));
        await flushRaf();
        expect(activeIn('#toc-content')).toEqual(['section-one']);
    });

    test('tracks every heading rather than skipping ones passed between samples', async () => {
        const seen = [];
        for (const id of ['section-one', 'section-two', 'build.sh-run']) {
            // Put exactly one more heading above the offset line on each pass.
            const order = ['main-title', 'section-one', 'section-two', 'build.sh-run'];
            const cutoff = order.indexOf(id);
            stubTops(Object.fromEntries(
                order.map((h, i) => [h, i <= cutoff ? -100 * (cutoff - i) - 10 : NAV_OFFSET + 300])
            ));
            window.dispatchEvent(new Event('scroll'));
            await flushRaf();
            seen.push(activeIn('#toc-content')[0]);
        }
        expect(seen).toEqual(['section-one', 'section-two', 'build.sh-run']);
    });

    test('falls back to the first entry when nothing has been scrolled past', async () => {
        stubTops({
            'main-title': NAV_OFFSET + 10,
            'section-one': NAV_OFFSET + 200,
            'section-two': NAV_OFFSET + 400,
            'build.sh-run': NAV_OFFSET + 600
        });
        window.dispatchEvent(new Event('scroll'));
        await flushRaf();
        expect(activeIn('#toc-content')).toEqual(['main-title']);
    });

    test('scroll spy also drives the mobile list', async () => {
        stubTops({
            'main-title': -500,
            'section-one': -100,
            'section-two': NAV_OFFSET + 200,
            'build.sh-run': NAV_OFFSET + 600
        });
        window.dispatchEvent(new Event('scroll'));
        await flushRaf();
        expect(activeIn('#mobile-toc-content')).toEqual(['section-one']);
    });
});

// ─── mobile accordion ─────────────────────────────────────────────────────────

describe('generateTOC — mobile accordion', () => {
    beforeEach(() => { arrange(); });

    test('clicking a mobile TOC link closes the <details> so it does not cover the target', () => {
        expect(document.getElementById('mobile-details').hasAttribute('open')).toBe(true);
        document.querySelector('#mobile-toc-content a[data-target="section-one"]').click();
        expect(document.getElementById('mobile-details').hasAttribute('open')).toBe(false);
    });

    test('clicking a desktop TOC link leaves the mobile accordion alone', () => {
        document.querySelector('#toc-content a[data-target="section-one"]').click();
        expect(document.getElementById('mobile-details').hasAttribute('open')).toBe(true);
    });
});

// ─── in-body markdown anchors ─────────────────────────────────────────────────

describe('generateTOC — in-body markdown anchors', () => {
    beforeEach(() => { arrange(); });

    test('same-page fragment links are rewritten to a path-absolute href', () => {
        // href="#id" resolves against <base href="/">, which would leave the article.
        expect(document.getElementById('inbody-hash').getAttribute('href'))
            .toBe('/articles/demo#section-one');
    });

    test('a bare "#" href is left alone', () => {
        expect(document.getElementById('inbody-bare').getAttribute('href')).toBe('#');
    });

    test('site-relative and external links are untouched', () => {
        expect(document.getElementById('inbody-abs').getAttribute('href')).toBe('/materials');
        expect(document.getElementById('inbody-ext').getAttribute('href')).toBe('https://example.com/x#frag');
    });

    test('re-running generateTOC does not double-prefix the href', () => {
        window.generateTOC();
        expect(document.getElementById('inbody-hash').getAttribute('href'))
            .toBe('/articles/demo#section-one');
    });
});

// ─── hashchange listener ──────────────────────────────────────────────────────

describe('generateTOC — hashchange listener', () => {
    beforeEach(() => { arrange(); });

    test('hashchange event scrolls to the matching element', () => {
        realPushState('/articles/demo#section-one');
        window.dispatchEvent(new Event('hashchange'));
        expect(document.getElementById('section-one').scrollIntoView)
            .toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    test('hashchange with no matching element does not throw', () => {
        realPushState('/articles/demo#does-not-exist');
        expect(() => window.dispatchEvent(new Event('hashchange'))).not.toThrow();
    });

    test('re-running generateTOC does not register a duplicate hashchange listener', () => {
        window.generateTOC();
        realPushState('/articles/demo#section-one');
        window.dispatchEvent(new Event('hashchange'));
        expect(document.getElementById('section-one').scrollIntoView).toHaveBeenCalledTimes(1);
    });
});

// ─── scroll on load ───────────────────────────────────────────────────────────

describe('generateTOC — scroll on load', () => {
    test('generateTOC scrolls to hash present in URL on load', () => {
        realPushState('/articles/demo#section-two');
        buildDOM();
        Element.prototype.scrollIntoView = jest.fn();
        window.scrollTo = jest.fn();
        jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        loadTocScript();
        window.generateTOC();
        expect(document.getElementById('section-two').scrollIntoView)
            .toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    test('a hash with CSS-significant characters still resolves on load', () => {
        // '#build.sh-run' is a valid id but an invalid id selector: querySelector
        // parses it as '#build' + '.sh-run' and silently finds nothing.
        realPushState('/articles/demo#build.sh-run');
        buildDOM();
        Element.prototype.scrollIntoView = jest.fn();
        window.scrollTo = jest.fn();
        jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        loadTocScript();
        window.generateTOC();
        expect(document.getElementById('build.sh-run').scrollIntoView)
            .toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    test('a percent-encoded hash resolves on load', () => {
        realPushState('/articles/demo#build%2Esh-run');
        buildDOM();
        Element.prototype.scrollIntoView = jest.fn();
        window.scrollTo = jest.fn();
        jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        loadTocScript();
        window.generateTOC();
        expect(document.getElementById('build.sh-run').scrollIntoView)
            .toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    test('generateTOC does not scroll when URL has no hash', () => {
        realPushState('/articles/demo');
        buildDOM();
        Element.prototype.scrollIntoView = jest.fn();
        window.scrollTo = jest.fn();
        jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        loadTocScript();
        window.generateTOC();
        expect(document.getElementById('section-one').scrollIntoView).not.toHaveBeenCalled();
        expect(document.getElementById('section-two').scrollIntoView).not.toHaveBeenCalled();
    });
});
