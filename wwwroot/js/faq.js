// faq.js
// Handles hash-based navigation for FAQ <details> accordion elements.
// When the URL contains a hash matching a <details> id, that element is opened
// and scrolled into view. Handles both page load and runtime hash changes.

function _openDetailsForHash(hash) {
    if (!hash || hash.length <= 1) return;
    var id = hash.substring(1);
    var target = document.getElementById(id);
    if (target && target.tagName === 'DETAILS') {
        target.open = true;
        // Defer scroll so the browser has laid out the open state.
        setTimeout(function () {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    }
}

window.addEventListener('hashchange', function () {
    _openDetailsForHash(window.location.hash);
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        _openDetailsForHash(window.location.hash);
    });
} else {
    _openDetailsForHash(window.location.hash);
}
