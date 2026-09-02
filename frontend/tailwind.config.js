/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#F6F8FA',
        surface: '#FFFFFF',
        surfaceBorder: '#DCE4EA',
        primary: {
          50: '#EAF4FB',
          500: '#245B84',
          600: '#173F5F',
          700: '#0B2338',
        },
        accent: {
          teal: '#2A7F83',
          success: '#2E7D5B',
          warning: '#B7791F',
          danger: '#C85D5D',
          info: '#2B6CB0',
        }
      },
    },
  },
  plugins: [],
};
