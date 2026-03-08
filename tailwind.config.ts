import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          50:  '#f0faf8',
          100: '#d0f0ea',
          200: '#a3e0d3',
          300: '#63CAB7',
          400: '#3db5a0',
          500: '#2a9080',
          600: '#226b5f',
          700: '#1a4f46',
          800: '#12332e',
          900: '#0a1f1c',
          950: '#060f0d',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'monospace'],
        display: ['var(--font-playfair)', 'serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'grid-teal': 'linear-gradient(rgba(99,202,183,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,202,183,0.04) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
  },
  plugins: [],
}
export default config
