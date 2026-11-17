/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Databricks-inspired palette
        primary: '#FF3621', // Lava Red: primary buttons, active indicators
        accent: '#0B2026', // Dark Navy
        navy: '#0B2026', // Sidebar
        canvas: '#F9F7F4', // Oat Light: main app background
        ink: '#333333', // Charcoal: headings and primary text
        muted: '#6B6B6B',
        border: '#DEDDD8', // subtle neutral grey
        surface: '#EEEDE9', // Oat Medium: secondary surfaces
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
