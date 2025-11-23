/** @type {import('tailwindcss').Config} */
module.exports = {
  // Point to ALL razor files in the project
  content: [
    "./**/*.{razor,html,cshtml}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // We can use hex codes directly here without requiring the colors import
        primary: {
          DEFAULT: '#ef4444', // Red-500
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        bgDark: '#0d1117',   
        cardDark: '#161b22', 
        borderDark: '#30363d',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme('colors.gray.300'),
            '--tw-prose-links': theme('colors.primary.400'),
            '--tw-prose-headings': theme('colors.gray.100'),
            '--tw-prose-pre-bg': '#010409',
            pre: {
              border: '1px solid ' + theme('colors.borderDark'),
            },
            code: {
              color: theme('colors.primary.400'),
              fontWeight: '400',
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}