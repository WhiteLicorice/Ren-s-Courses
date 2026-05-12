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
    // Intercept TOC anchor clicks. Without this, the browser fires a native scroll
    // before the <details> is open, causing a jarring jump to the closed summary.
    document.querySelectorAll('nav a[href^="#"]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            var hash = link.getAttribute('href');
            var id = hash.substring(1);
            var target = document.getElementById(id);
            if (target && target.tagName === 'DETAILS') {
                e.preventDefault();
                target.open = true;
                setTimeout(function () {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
                history.pushState(null, null, hash);
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
