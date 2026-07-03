/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: "#0b0f19",
          900: "#111827",
          800: "#1f2937",
          700: "#374151",
          600: "#4b5563"
        },
        brand: {
          primary: "#6366f1", // Violet
          secondary: "#06b6d4", // Cyan
          accent: "#ec4899", // Pink
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Courier New", "monospace"]
      }
    },
  },
  plugins: [],
}
