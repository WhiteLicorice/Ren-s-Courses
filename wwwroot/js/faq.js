// faq.js
// FAQ accordion: hash-based deep linking and TOC in-page scroll handling.

function _openDetailsForHash(hash) {
    if (!hash || hash.length <= 1) return;
    var id = hash.substring(1);
    var target = document.getElementById(id);
    if (target && target.tagName === 'DETAILS') {
        target.open = true;
        // Defer scroll so layout reflects the open state before scrolling.
        setTimeout(function () {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    }
}

window.initFaqToc = function () {
    // TOC links use data-faq-target (not href) to avoid <base href> resolution,
    // which would cause href="#slug" to navigate to the base URL instead of
    // scrolling within the current page.
    document.querySelectorAll('[data-faq-target]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            var id = link.getAttribute('data-faq-target');
            var target = document.getElementById(id);
            if (target && target.tagName === 'DETAILS') {
                target.open = true;
                setTimeout(function () {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
                // replaceState (not pushState) — hash updates are not separate history entries.
                history.replaceState(null, null, '#' + id);
            }
        });
    });

    // Handle browser back/forward navigation and external deep links.
    window.addEventListener('hashchange', function () {
        _openDetailsForHash(window.location.hash);
    });

    // Handle hash present on initial page load (e.g., shared link with anchor).
    _openDetailsForHash(window.location.hash);
};
