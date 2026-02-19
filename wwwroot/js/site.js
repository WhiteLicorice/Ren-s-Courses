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
    if (window.initScrollButton) window.initScrollButton();
    if (window.initCalendarNav) window.initCalendarNav();
    if (window.initCalendarExpansion) window.initCalendarExpansion();
});