'use strict';

const fs = require('fs');
const path = require('path');

const tocSource = fs.readFileSync(path.join(__dirname, '../toc.js'), 'utf8');

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
            </div>
            <div id="toc-content"></div>
            <div id="mobile-toc-content"></div>
        </article>
    `;
}

afterEach(() => {
    jest.restoreAllMocks();
    window.history.pushState({}, '', '/');
});

// ─── link structure ───────────────────────────────────────────────────────────

describe('generateTOC — link structure', () => {
    beforeEach(() => {
        buildDOM();
        Element.prototype.scrollIntoView = jest.fn();
        window.scrollTo = jest.fn();
        jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
        loadTocScript();
        window.generateTOC();
    });

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
});

// ─── replaceState vs pushState ────────────────────────────────────────────────

describe('generateTOC — replaceState vs pushState', () => {
    let replaceStateSpy;
    let pushStateSpy;

    beforeEach(() => {
        buildDOM();
        Element.prototype.scrollIntoView = jest.fn();
        window.scrollTo = jest.fn();
        replaceStateSpy = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        pushStateSpy    = jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
        loadTocScript();
        window.generateTOC();
    });

    test('clicking a TOC link calls replaceState', () => {
        const link = document.querySelector('#toc-content a[data-target="section-one"]');
        expect(link).not.toBeNull();
        link.click();
        expect(replaceStateSpy).toHaveBeenCalledWith(null, null, '#section-one');
    });

    test('clicking a TOC link does NOT call pushState', () => {
        const link = document.querySelector('#toc-content a[data-target="section-one"]');
        link.click();
        expect(pushStateSpy).not.toHaveBeenCalled();
    });

    test('mobile TOC link also calls replaceState', () => {
        const link = document.querySelector('#mobile-toc-content a[data-target="section-two"]');
        expect(link).not.toBeNull();
        link.click();
        expect(replaceStateSpy).toHaveBeenCalledWith(null, null, '#section-two');
    });
});

// ─── keyboard activation ──────────────────────────────────────────────────────

describe('generateTOC — keyboard activation', () => {
    let replaceStateSpy;

    beforeEach(() => {
        buildDOM();
        Element.prototype.scrollIntoView = jest.fn();
        window.scrollTo = jest.fn();
        replaceStateSpy = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
        loadTocScript();
        window.generateTOC();
    });

    test('Enter key on TOC link calls replaceState', () => {
        const link = document.querySelector('#toc-content a[data-target="section-one"]');
        link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(replaceStateSpy).toHaveBeenCalledWith(null, null, '#section-one');
    });

    test('Space key on TOC link calls replaceState', () => {
        const link = document.querySelector('#toc-content a[data-target="section-two"]');
        link.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        expect(replaceStateSpy).toHaveBeenCalledWith(null, null, '#section-two');
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

// ─── hashchange listener ──────────────────────────────────────────────────────

describe('generateTOC — hashchange listener', () => {
    beforeEach(() => {
        window.history.pushState({}, '', '/');
        buildDOM();
        Element.prototype.scrollIntoView = jest.fn();
        window.scrollTo = jest.fn();
        jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
        loadTocScript();
        window.generateTOC();
    });

    test('hashchange event scrolls to the matching element', () => {
        Object.getPrototypeOf(window.history).pushState.call(window.history, {}, '', '#section-one');
        window.dispatchEvent(new Event('hashchange'));
        expect(document.getElementById('section-one').scrollIntoView)
            .toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    test('hashchange with no matching element does not throw', () => {
        Object.getPrototypeOf(window.history).pushState.call(window.history, {}, '', '#does-not-exist');
        expect(() => window.dispatchEvent(new Event('hashchange'))).not.toThrow();
    });
});

// ─── scroll on load ───────────────────────────────────────────────────────────

describe('generateTOC — scroll on load', () => {
    test('generateTOC scrolls to hash present in URL on load', () => {
        window.history.pushState({}, '', '#section-two');
        buildDOM();
        Element.prototype.scrollIntoView = jest.fn();
        window.scrollTo = jest.fn();
        jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
        loadTocScript();
        window.generateTOC();
        expect(document.getElementById('section-two').scrollIntoView)
            .toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    test('generateTOC does not scroll when URL has no hash', () => {
        window.history.pushState({}, '', '/');
        buildDOM();
        Element.prototype.scrollIntoView = jest.fn();
        window.scrollTo = jest.fn();
        jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
        loadTocScript();
        window.generateTOC();
        expect(document.getElementById('section-one').scrollIntoView).not.toHaveBeenCalled();
        expect(document.getElementById('section-two').scrollIntoView).not.toHaveBeenCalled();
    });
});
