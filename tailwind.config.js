/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2C6E76',
        accent: '#B5651D',
        ink: '#1E2229',
        muted: '#6B7280',
        border: '#E5E1D8',
        surface: '#FAF9F6',
        success: '#3D7A4E',
        warning: '#A5761E',
        danger: '#B8452F',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: '14px',
      },
    },
  },
  plugins: [],
};
