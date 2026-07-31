/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        void: {
          bg: '#0A0A0A',
          surface: '#141414',
          border: '#2A2A2A',
          text: '#FFFFFF',
          secondary: 'rgba(255,255,255,0.65)',
          muted: 'rgba(255,255,255,0.35)',
          accent: '#3B82F6',
          'accent-light': '#60A5FA',
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '4px',
      },
    },
  },
  plugins: [],
};
