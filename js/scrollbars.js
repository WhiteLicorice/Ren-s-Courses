// wwwroot/scrollbars.js

/**
 * HIGHLIGHT NATIVE SCROLLBAR DRAGS
 *
 * Native scrollbar thumbs do not expose a reliable cross-browser active
 * pseudo-element. Detect the pointer press in the scrollbar edge and mark the
 * matching scroll container until the pointer is released.
 */
window.initScrollbarDrag = () => {
    const scrollableSelector = '.scrollbar-slim, .prose pre, .prose table, .diagram-viewport';
    const scrollbarEdge = 16;
    let activeScroller = null;

    const canScroll = element =>
        element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;

    const isScrollbarPoint = (element, event) => {
        if (!canScroll(element)) return false;

        const rect = element.getBoundingClientRect();
        const inBounds = event.clientX >= rect.left && event.clientX <= rect.right
            && event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!inBounds) return false;

        const vertical = element.scrollHeight > element.clientHeight
            && event.clientX >= rect.right - scrollbarEdge;
        const horizontal = element.scrollWidth > element.clientWidth
            && event.clientY >= rect.bottom - scrollbarEdge;

        return vertical || horizontal;
    };

    const scrollerAt = event => {
        const target = event.target instanceof Element ? event.target : null;
        const scroller = target?.closest(scrollableSelector);
        if (scroller && isScrollbarPoint(scroller, event)) return scroller;

        const root = document.documentElement;
        if ((target === document.documentElement || target === document.body || !target)
            && isScrollbarPoint(root, event)) {
            return root;
        }

        return null;
    };

    const clearDrag = () => {
        if (!activeScroller) return;
        activeScroller.classList.remove('scrollbar-dragging');
        activeScroller = null;
    };

    document.addEventListener('pointerdown', event => {
        clearDrag();
        activeScroller = scrollerAt(event);
        activeScroller?.classList.add('scrollbar-dragging');
    }, true);

    document.addEventListener('pointerup', clearDrag, true);
    document.addEventListener('pointercancel', clearDrag, true);
    window.addEventListener('blur', clearDrag);
};
