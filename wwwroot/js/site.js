
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

document.addEventListener("DOMContentLoaded", window.addCodeFeatures);