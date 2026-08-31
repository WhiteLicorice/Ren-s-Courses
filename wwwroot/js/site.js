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

window.addEventListener("load", () => {
    if ('serviceWorker' in navigator) {
        const swUrl = new URL('service-worker.js', document.baseURI);
        navigator.serviceWorker.register(swUrl).catch(err => {
            console.warn('[SW] registration failed:', err);
        });
    }
});
