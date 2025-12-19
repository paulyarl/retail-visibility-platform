/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // or 'media' for system preference
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic color system for consistent dark mode
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        surface: {
          light: '#ffffff',
          dark: '#1f2937', // gray-800
        },
        'surface-secondary': {
          light: '#f9fafb', // gray-50
          dark: '#374151', // gray-700
        },
        text: {
          primary: {
            light: '#111827', // gray-900
            dark: '#f9fafb', // gray-50
          },
          secondary: {
            light: '#6b7280', // gray-500
            dark: '#d1d5db', // gray-300
          },
          muted: {
            light: '#9ca3af', // gray-400
            dark: '#9ca3af', // gray-400
          },
        },
        border: {
          light: '#e5e7eb', // gray-200
          dark: '#374151', // gray-700
        },
      },
    },
  },
  plugins: [],
}
