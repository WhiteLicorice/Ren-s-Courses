
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('js/service-worker.js')
            .then(registration => {
                console.log('PWA ServiceWorker registered: ', registration.scope);
            })
            .catch(error => {
                console.log('PWA ServiceWorker registration failed: ', error);
            });
    });
}

window.addCodeFeatures = () => {
    const langMap = {
        'cs': 'c#', 'csharp': 'c#', 'cpp': 'c++', 'c': 'c', 'py': 'python', 'python': 'python',
        'js': 'js', 'javascript': 'js', 'ts': 'ts', 'typescript': 'ts', 'html': 'html', 'xml': 'xml',
        'json': 'json', 'yaml': 'yaml', 'md': 'markdown', 'bash': 'bash', 'sh': 'sh',
        'powershell': 'powershell', 'nasm': 'asm', 'asm': 'asm', 'gdscript': 'gdscript'
    };

    const iconCopy = `<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>`;
    const iconCheck = `<polyline points="20 6 9 17 4 12"/>`;

    // 1. TARGET ALL PRE BLOCKS inside the prose area
    const preBlocks = document.querySelectorAll('.prose pre');

    preBlocks.forEach(pre => {
        // Check if already wrapped
        if (pre.parentElement.classList.contains('code-wrapper')) return;

        // Create Wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'code-wrapper';

        // Insert Wrapper
        pre.parentElement.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        // Language Label Logic
        const className = [...pre.classList].find(c => c.startsWith('language-'));
        if (className) {
            const rawLang = className.replace('language-', '').toLowerCase();
            const label = langMap[rawLang] || rawLang;
            wrapper.setAttribute('data-language', label);
        }

        // Copy Button Logic
        const btn = document.createElement('button');
        btn.className = 'copy-button';
        btn.ariaLabel = "Copy code";
        btn.innerHTML = `<svg viewBox="0 0 24 24">${iconCopy}</svg>`;

        btn.addEventListener('click', () => {
            const code = pre.querySelector('code');
            if (!code) return;

            navigator.clipboard.writeText(code.innerText).then(() => {
                btn.classList.add('copied');
                btn.innerHTML = `<svg viewBox="0 0 24 24">${iconCheck}</svg>`;
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = `<svg viewBox="0 0 24 24">${iconCopy}</svg>`;
                }, 2000);
            }).catch(err => {
                console.error('Copy failed:', err);
            });
        });

        wrapper.appendChild(btn);
    });

    // Trigger Prism
    if (window.Prism) {
        window.Prism.highlightAll();
    }
};

window.generateTOC = () => {
    const prose = document.querySelector('.prose');
    const tocContainer = document.getElementById('toc-content');
    const mobileTocContainer = document.getElementById('mobile-toc-content');

    if (!prose || (!tocContainer && !mobileTocContainer)) return;

    // 1. Get Main Title (Outside Prose)
    const mainTitle = document.querySelector('article h1'); // Selects the page title

    // 2. Get Content Headers (Inside Prose)
    const contentHeaders = Array.from(prose.querySelectorAll('h1, h2, h3'));

    // Combine them (Title first)
    const headers = mainTitle ? [mainTitle, ...contentHeaders] : contentHeaders;

    if (headers.length === 0) return;

    const createList = () => {
        const ul = document.createElement('ul');
        ul.className = 'flex flex-col gap-2 font-mono text-xs text-gray-500';

        headers.forEach((header, index) => {
            // Generate ID if missing (Critical for scrolling)
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
            a.innerText = header.innerText;
            // Base styles
            a.className = 'block truncate transition-colors duration-200 hover:text-red-400';
            a.dataset.target = header.id;

            // HIERARCHY LOGIC
            if (header.tagName === 'H1') {
                a.classList.add('border-l', 'border-gray-800');
            }
            else if (header.tagName === 'H2') {
                a.classList.add('border-l', 'border-gray-800');
                a.style.paddingLeft = '12px';
            }
            else if (header.tagName === 'H3') {
                a.classList.add('border-l', 'border-gray-800');
                a.style.paddingLeft = '24px';
            }

            a.addEventListener('click', (e) => {
                e.preventDefault();
                // Smooth scroll to top for Title, or element for others
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

    // Inject
    if (tocContainer) { tocContainer.innerHTML = ''; tocContainer.appendChild(createList()); }
    if (mobileTocContainer) { mobileTocContainer.innerHTML = ''; mobileTocContainer.appendChild(createList()); }

    // Observer
    if (tocContainer) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    tocContainer.querySelectorAll('a').forEach(link => {
                        link.classList.remove('text-red-500', 'border-red-500', 'font-medium');
                        if (link.classList.contains('border-l')) link.classList.add('border-gray-800');
                    });

                    const activeLink = tocContainer.querySelector(`a[data-target="${id}"]`);
                    if (activeLink) {
                        activeLink.classList.add('text-red-500', 'font-medium');
                        if (activeLink.classList.contains('border-l')) {
                            activeLink.classList.remove('border-gray-800');
                            activeLink.classList.add('border-red-500');
                        }
                    }
                }
            });
        }, { rootMargin: '-100px 0px -66% 0px' });

        headers.forEach(h => observer.observe(h));
    }
};

window.initScrollButton = () => {
    const btn = document.getElementById('scroll-btn');
    if (!btn) return;

    let lastScrollY = window.scrollY;
    let isScrolling;

    const updateButton = () => {
        const currentScrollY = window.scrollY;
        const showThreshold = 300; // Must be at least 300px down to ever show

        // 1. If near the top, ALWAYS hide (regardless of direction)
        if (currentScrollY < showThreshold) {
            btn.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
            btn.classList.remove('opacity-100', 'translate-y-0');
        }
        // 2. If deep in the page, check direction
        else {
            // If current < last, we are scrolling UP -> SHOW
            if (currentScrollY < lastScrollY) {
                btn.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
                btn.classList.add('opacity-100', 'translate-y-0');
            }
            // If current > last, we are scrolling DOWN -> HIDE
            else {
                btn.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
                btn.classList.remove('opacity-100', 'translate-y-0');
            }
        }

        // Update tracker (prevent negative values for iOS bounce)
        lastScrollY = currentScrollY > 0 ? currentScrollY : 0;
    };

    window.addEventListener('scroll', () => {
        if (!isScrolling) {
            window.requestAnimationFrame(() => {
                updateButton();
                isScrolling = false;
            });
            isScrolling = true;
        }
    });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
};

document.addEventListener("DOMContentLoaded", () => {
    window.addCodeFeatures();
    window.generateTOC();
    window.initScrollButton();
});