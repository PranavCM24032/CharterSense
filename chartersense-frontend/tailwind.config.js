/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1e40af',
        success: '#16a34a',
        danger: '#dc2626',
        warning: '#ca8a04',
      },
    },
  },
  plugins: [],
};
