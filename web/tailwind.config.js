/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'cad-bg': '#0a0f1a',
        'cad-surface': '#111827',
        'cad-card': '#1a2332',
        'cad-border': '#2a3a4e',
        'cad-ink': '#d4dce8',
        'cad-muted': '#7a8ea6',
        'cad-accent': '#0052C2',
        'cad-accent-light': '#2b7fff',
        'cad-accent-dim': '#032261',
        'vicpol-navy': '#032261',
        'cad-green': '#10b981',
        'cad-red': '#ef4444',
        'cad-amber': '#f59e0b',
        'cad-gold': '#D8B46C',
        'cad-teal': '#14b8a6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
