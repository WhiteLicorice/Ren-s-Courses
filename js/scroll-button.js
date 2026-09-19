// wwwroot/scroll-button.js

/**
 * INITIALIZE SCROLL-TO-TOP BUTTON
 * * Manages the visibility of the FAB (Floating Action Button).
 * Logic:
 * 1. Hide when near top of page.
 * 2. Show when scrolling UP.
 * 3. Hide when scrolling DOWN (to clear view while reading).
 */
window.initScrollButton = () => {
    const btn = document.getElementById('scroll-btn');
    if (!btn) return;

    let lastScrollY = window.scrollY;
    let isScrolling;

    const updateButton = () => {
        const currentScrollY = window.scrollY;
        const showThreshold = 300; // Pixels from top before button enables

        if (currentScrollY < showThreshold) {
            // Near Top: Always Hide
            btn.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
            btn.classList.remove('opacity-100', 'translate-y-0');
        }
        else {
            if (currentScrollY < lastScrollY) {
                // Scrolling UP: Show
                btn.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
                btn.classList.add('opacity-100', 'translate-y-0');
            }
            else {
                // Scrolling DOWN: Hide
                btn.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
                btn.classList.remove('opacity-100', 'translate-y-0');
            }
        }
        // Prevent negative scroll values (iOS bounce effect)
        lastScrollY = currentScrollY > 0 ? currentScrollY : 0;
    };

    // Throttle scroll events via requestAnimationFrame
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