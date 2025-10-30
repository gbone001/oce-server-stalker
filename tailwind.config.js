/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#A61212',
          50: '#FFF1F1',
          100: '#FFDAD8',
          200: '#FFB3B0',
          300: '#FF8C87',
          400: '#F56461',
          500: '#D93C3B',
          600: '#A61212',
          700: '#820B0B',
          800: '#5E0606',
          900: '#3A0202',
        },
        accent: {
          DEFAULT: '#BFA14A',
          100: '#F6EDCC',
          200: '#EADAA1',
          300: '#DDC476',
          400: '#D2B45A',
          500: '#BFA14A',
          600: '#8F7634',
          700: '#6B5626',
          800: '#473818',
          900: '#231C0C',
        },
        charcoal: {
          DEFAULT: '#1F1F1F',
          600: '#1B1B1B',
          700: '#151515',
          800: '#0F0F0F',
          900: '#080808',
        },
      }
    },
  },
  plugins: [],
}
