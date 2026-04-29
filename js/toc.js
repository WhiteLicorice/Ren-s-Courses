// wwwroot/toc.js

/**
 * GENERATE DYNAMIC TABLE OF CONTENTS (TOC)
 * * Scans article headers (H1-H3) and builds a sidebar navigation menu.
 * Includes "ScrollSpy" logic to highlight the active section while scrolling.
 * * Styling: Uses semantic CSS variables (text-accent, border-muted) to support multiple themes.
 */
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

            a.href = `#${header.id}`;

            // 2. Handle Long Headers
            // Truncate text strictly to ~35 chars to prevent sidebar blowout,
            // but add a 'title' tooltip so the full text is visible on hover.
            const rawText = header.innerText;
            a.innerText = rawText.length > 35 ? rawText.substring(0, 35) + '...' : rawText;
            a.title = rawText;

            a.className = 'block truncate transition-colors duration-200 hover:text-accent';
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

            // Click Handler: Smooth Scroll
            a.addEventListener('click', (e) => {
                e.preventDefault();
                if (header === mainTitle) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    header.scrollIntoView({ behavior: 'smooth' });
                }
                history.pushState(null, null, `#${header.id}`);
            });

            li.appendChild(a);
            ul.appendChild(li);
        });
        return ul;
    };

    // Inject TOC into DOM
    if (tocContainer) { tocContainer.innerHTML = ''; tocContainer.appendChild(createList()); }
    if (mobileTocContainer) { mobileTocContainer.innerHTML = ''; mobileTocContainer.appendChild(createList()); }

    // ScrollSpy: IntersectionObserver to highlight active section
    if (tocContainer) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;

                    // Reset all links
                    tocContainer.querySelectorAll('a').forEach(link => {
                        link.classList.remove('text-accent', 'border-accent', 'font-medium');
                        if (link.classList.contains('border-l')) link.classList.add('border-border-muted');
                    });

                    // Activate current link
                    const activeLink = tocContainer.querySelector(`a[data-target="${id}"]`);
                    if (activeLink) {
                        activeLink.classList.add('text-accent', 'font-medium');
                        if (activeLink.classList.contains('border-l')) {
                            activeLink.classList.remove('border-border-muted');
                            activeLink.classList.add('border-accent');
                        }
                    }
                }
            });
        }, { rootMargin: '-100px 0px -66% 0px' }); // Offset to trigger highlight slightly before section hits top

        headers.forEach(h => observer.observe(h));
    }
};