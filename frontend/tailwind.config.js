/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        netflix: { DEFAULT: '#E50914', hover: '#F40612' },
        surface: { DEFAULT: '#181818', hover: '#232323' },
        background: '#141414',
      },
      fontFamily: {
        sans: ['Netflix Sans', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
