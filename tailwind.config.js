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
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        sand: {
          50: '#fefdf9',
          100: '#fefbf3',
          200: '#fdf6e3',
          300: '#faedc4',
          400: '#f7dfa5',
          500: '#f0ca7c',
          600: '#e8b563',
          700: '#d69e2e',
          800: '#b7791f',
          900: '#975a16',
        },
        olive: {
          50: '#f7f8f0',
          100: '#eef0e0',
          200: '#dde2c2',
          300: '#c6ce9a',
          400: '#b0bc75',
          500: '#9ca156',
          600: '#7d8142',
          700: '#606235',
          800: '#4f512d',
          900: '#434529',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/aspect-ratio'),
  ],
}

