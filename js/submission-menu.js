// wwwroot/js/submission-menu.js

window.initSubmissionMenus = () => {
    const menus = Array.from(document.querySelectorAll('[data-submission-menu]'));

    const closeMenu = (menu, returnFocus = false, suppressHover = false) => {
        const trigger = menu.querySelector('[data-submission-trigger]');
        menu.removeAttribute('data-open');
        trigger.setAttribute('aria-expanded', 'false');
        if (suppressHover) menu.setAttribute('data-hover-suppressed', '');
        if (returnFocus) trigger.focus();
    };

    menus.forEach(menu => {
        if (menu.dataset.submissionMenuInitialized) return;

        const trigger = menu.querySelector('[data-submission-trigger]');
        trigger.addEventListener('click', () => {
            const willOpen = !menu.hasAttribute('data-open');
            menus.forEach(otherMenu => closeMenu(otherMenu));
            if (willOpen) {
                menu.removeAttribute('data-hover-suppressed');
                menu.setAttribute('data-open', '');
                trigger.setAttribute('aria-expanded', 'true');
            } else {
                closeMenu(menu, false, true);
            }
        });

        menu.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            closeMenu(menu, true, true);
        });

        menu.addEventListener('pointerleave', () => menu.removeAttribute('data-hover-suppressed'));

        menu.dataset.submissionMenuInitialized = 'true';
    });

    if (document.documentElement.dataset.submissionMenuOutsideClick) return;
    document.addEventListener('click', event => {
        menus.forEach(menu => {
            if (!menu.contains(event.target)) closeMenu(menu);
        });
    });
    document.documentElement.dataset.submissionMenuOutsideClick = 'true';
};
