/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#05070a",
        surface: "#0f1117",
        accent: {
          primary: "#3b82f6",
          secondary: "#10b981",
          danger: "#ef4444",
        },
        muted: "#94a3b8",
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-premium': 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        'gradient-glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }
    },
  },
  plugins: [],
}

