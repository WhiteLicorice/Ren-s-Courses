// wwwroot/site.js

/**
 * MAIN ENTRY POINT
 * Initializes all dynamic features once the DOM is ready.
 * * Note: Individual feature files (calendar.js, toc.js, etc.) must be 
 * loaded BEFORE this file in App.razor for these calls to work.
 */
document.addEventListener("DOMContentLoaded", () => {
    if (window.addCodeFeatures) window.addCodeFeatures();
    if (window.generateTOC) window.generateTOC();
    if (window.initScrollbarDrag) window.initScrollbarDrag();
    if (window.initScrollButton) window.initScrollButton();
    if (window.initCalendarNav) window.initCalendarNav();
    if (window.initFaqToc) window.initFaqToc();
    if (window.initInteractiveDiagrams) window.initInteractiveDiagrams();
    if (window.initSubmissionMenus) window.initSubmissionMenus();
});

if ('serviceWorker' in navigator) {
    const swUrl = new URL('service-worker.js', document.baseURI);
    navigator.serviceWorker.register(swUrl).catch(err => {
        console.warn('[SW] registration failed:', err);
    });

    window.addEventListener('online', () => {
        const controller = navigator.serviceWorker.controller;
        if (!controller) return;

        controller.postMessage({ type: 'retry-external-assets' });
        controller.postMessage({ type: 'refresh-route', url: window.location.href });
    });
}
