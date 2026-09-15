// wwwroot/toc.js

/**
 * GENERATE DYNAMIC TABLE OF CONTENTS (TOC)
 * * Scans article headers (H1-H3) and builds a sidebar navigation menu.
 * Includes "ScrollSpy" logic to highlight the active section while scrolling.
 * * Styling: Uses semantic CSS variables (text-accent, border-muted) to support multiple themes.
 */

// Clearance for the fixed navbar (NavMenu.razor, h-16) plus breathing room.
// Keep in sync with the scroll-margin-top on .prose headings in Styles/app.css.
const TOC_NAV_OFFSET = 80;

window.generateTOC = () => {
    const prose = document.querySelector('.prose');
    const tocContainer = document.getElementById('toc-content');
    const mobileTocContainer = document.getElementById('mobile-toc-content');

    // Exit if no content or no TOC containers exist
    if (!prose || (!tocContainer && !mobileTocContainer)) return;

    // Grab Main Title + Content Headers
    const mainTitle = document.querySelector('article h1');
    const contentHeaders = Array.from(prose.querySelectorAll('h1, h2, h3'));
    const headers = mainTitle ? [mainTitle, ...contentHeaders] : contentHeaders;

    if (headers.length === 0) return;

    // Same-document URL with a fresh fragment. A bare '#id' would be resolved
    // against document.baseURI, and App.razor's <base href="/"> makes that the
    // site root — which is how the article path used to get dropped.
    const hashUrl = (id) => `${window.location.pathname}${window.location.search}#${id}`;

    const bothContainers = [tocContainer, mobileTocContainer].filter(Boolean);

    // Move the active-section highlight to the entry for `id`, in every TOC list.
    const setActive = (id) => {
        bothContainers.forEach(container => {
            container.querySelectorAll('a').forEach(link => {
                const isActive = link.dataset.target === id;

                link.classList.toggle('text-accent', isActive);
                link.classList.toggle('font-medium', isActive);
                if (link.classList.contains('border-l')) {
                    link.classList.toggle('border-accent', isActive);
                    link.classList.toggle('border-border-muted', !isActive);
                }

                if (isActive) link.setAttribute('aria-current', 'true');
                else link.removeAttribute('aria-current');
            });
        });
    };

    // Helper: Builds the UL/LI structure
    const createList = () => {
        const ul = document.createElement('ul');
        ul.className = 'flex flex-col gap-2 font-mono text-xs text-text-dim';

        // 1. Add "On this page" Header (Seems ugly lol)
        //const tocHeader = document.createElement('li');
        //tocHeader.className = 'mb-2 font-bold uppercase tracking-wider text-text-dim';
        //tocHeader.innerText = 'On this page';
        //ul.appendChild(tocHeader);

        headers.forEach((header, index) => {
            // Generate ID if missing (required for anchor links)
            if (!header.id) {
                header.id = header.innerText
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '');
                if (!header.id) header.id = `section-${index}`;
            }

            const li = document.createElement('li');
            const a = document.createElement('a');

            // No href — avoids <base href> resolution and Blazor navigation interception,
            // both of which would push an unwanted history entry before our replaceState.
            // data-target is the source of truth; click/keydown handlers use it directly.
            // role="link" restores the semantics an href-less anchor loses.
            a.setAttribute('tabindex', '0');
            a.setAttribute('role', 'link');

            // 2. Handle Long Headers
            // Truncate text strictly to ~35 chars to prevent sidebar blowout,
            // but add a 'title' tooltip so the full text is visible on hover.
            const rawText = header.innerText;
            a.innerText = rawText.length > 35 ? rawText.substring(0, 35) + '...' : rawText;
            a.title = rawText;

            a.className = 'block truncate transition-colors duration-200 hover:text-accent cursor-pointer';
            a.dataset.target = header.id;

            // Indentation based on hierarchy
            if (header.tagName === 'H1') {
                a.classList.add('border-l', 'border-border-muted');
            }
            else if (header.tagName === 'H2') {
                a.classList.add('border-l', 'border-border-muted');
                a.style.paddingLeft = '12px';
            }
            else if (header.tagName === 'H3') {
                a.classList.add('border-l', 'border-border-muted');
                a.style.paddingLeft = '24px';
            }

            // Shared activate handler — used for both click and keyboard (Enter/Space).
            const activate = (e) => {
                e.preventDefault();
                if (header === mainTitle) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    header.scrollIntoView({ behavior: 'smooth' });
                }
                // Highlight now rather than waiting for the smooth scroll to settle.
                setActive(header.id);
                // Collapse the mobile accordion so it stops covering the target.
                const accordion = a.closest('details');
                if (accordion) accordion.removeAttribute('open');
                // replaceState (not pushState) — hash updates are not separate history entries.
                history.replaceState(null, '', hashUrl(header.id));
            };

            a.addEventListener('click', activate);
            // Keyboard: Enter scrolls; Space scrolls (and prevents page-scroll default).
            a.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') activate(e);
            });

            li.appendChild(a);
            ul.appendChild(li);
        });
        return ul;
    };

    // Inject TOC into DOM
    if (tocContainer) { tocContainer.innerHTML = ''; tocContainer.appendChild(createList()); }
    if (mobileTocContainer) { mobileTocContainer.innerHTML = ''; mobileTocContainer.appendChild(createList()); }

    // Markdown-authored [text](#heading) links render as href="#heading", which
    // <base href="/"> resolves to the site root. Rewriting to a path-absolute href
    // keeps native fragment navigation on this page — and makes copy-link,
    // middle-click and open-in-new-tab point at the right article.
    prose.querySelectorAll('a[href^="#"]').forEach(link => {
        const fragment = link.getAttribute('href');
        if (fragment.length <= 1) return; // bare '#'
        link.setAttribute('href', `${window.location.pathname}${window.location.search}${fragment}`);
    });

    // Scroll to hash on load and on browser-driven hash changes (shared links, refresh, cross-page nav).
    // getElementById, not querySelector: heading ids come from Markdig and can contain
    // dots (e.g. 'build.sh-run'), which querySelector would read as a class selector.
    var scrollToHash = function () {
        var id = decodeURIComponent(window.location.hash.slice(1));
        if (!id) return;
        var target = document.getElementById(id);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    };

    scrollToHash();

    // ScrollSpy: the last heading scrolled past the navbar line is the active one.
    // A position check beats IntersectionObserver here — an observer band leaves
    // dead zones, so headings crossing it between samples were skipped entirely.
    const activeHeaderId = () => {
        // The last headings on a page can never reach the navbar line. The document
        // runs out of scroll height first, so the position check below stalls on
        // the second-to-last entry. At the bottom, the last heading is active by definition.
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (maxScroll > 0 && window.scrollY >= maxScroll - 2) {
            return headers[headers.length - 1].id;
        }

        let id = headers[0].id;
        headers.forEach(header => {
            if (header.getBoundingClientRect().top - TOC_NAV_OFFSET <= 1) id = header.id;
        });
        return id;
    };

    let spyPending = false;
    const onScroll = () => {
        if (spyPending) return;
        spyPending = true;
        window.requestAnimationFrame(() => {
            setActive(activeHeaderId());
            spyPending = false;
        });
    };

    // Re-running generateTOC (or reloading the script) must not stack listeners.
    if (window.__tocWindowListeners) {
        window.removeEventListener('hashchange', window.__tocWindowListeners.hashchange);
        window.removeEventListener('scroll', window.__tocWindowListeners.scroll);
    }
    window.addEventListener('hashchange', scrollToHash);
    window.addEventListener('scroll', onScroll);
    window.__tocWindowListeners = { hashchange: scrollToHash, scroll: onScroll };

    setActive(activeHeaderId());
};
