/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          dark:    '#1D4ED8',
        },
        success: '#16A34A',
        warning: '#D97706',
        danger:  '#DC2626',
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          2:       'rgb(var(--color-surface-2) / <alpha-value>)',
          3:       'rgb(var(--color-surface-3) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          strong:  'rgb(var(--color-border-strong) / <alpha-value>)',
        },
        text: {
          primary:   'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          muted:     'rgb(var(--color-text-muted) / <alpha-value>)',
        },
      },
      fontSize: {
        xs:  ['12px', '16px'],
        sm:  ['14px', '20px'],
        base:['14px', '20px'],
        lg:  ['16px', '24px'],
        xl:  ['20px', '28px'],
        '2xl': ['24px', '32px'],
      },
      boxShadow: {
        raised: '0 1px 3px rgba(0,0,0,.08)',
        modal:  '0 8px 32px rgba(0,0,0,.16)',
      },
    },
  },
  plugins: [],
}
