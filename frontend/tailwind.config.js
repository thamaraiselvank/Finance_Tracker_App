/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        aurora: {
          50: '#f3f0ff',
          100: '#e9e0ff',
          200: '#d4bfff',
          300: '#b18aff',
          400: '#8b5cf6',
          500: '#7c3aed',
          600: '#6d28d9',
          700: '#5b21b6',
          800: '#4c1d95',
          900: '#3b0f7a',
        },
        cyan: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        surface: {
          base: '#0a0e1a',
          raised: '#111827',
          card: '#141a2e',
          overlay: '#1a2140',
          glass: 'rgba(20, 26, 46, 0.80)',
          border: 'rgba(255, 255, 255, 0.06)',
          'border-glow': 'rgba(124, 58, 237, 0.25)',
        }
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'aurora-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(124, 58, 237, 0.3), 0 0 20px rgba(6, 182, 212, 0.1)' },
          '50%': { boxShadow: '0 0 16px rgba(124, 58, 237, 0.5), 0 0 40px rgba(6, 182, 212, 0.2)' },
        },
        'float-in': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'notification-ping': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.4)', opacity: '0.5' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'aurora': 'aurora-shift 8s ease-in-out infinite',
        'glow': 'glow-pulse 3s ease-in-out infinite',
        'float-in': 'float-in 0.4s ease-out',
        'notification': 'notification-ping 2s ease-in-out infinite',
        'shimmer': 'shimmer 3s ease-in-out infinite',
      },
      backgroundSize: {
        '300%': '300% 300%',
      },
    },
  },
  plugins: [],
}
