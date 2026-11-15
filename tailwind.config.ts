import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        oasis: {
          50: "#f4f8f5",
          100: "#e5f0ea",
          200: "#cee1d6",
          300: "#a9c9b7",
          400: "#7baa93",
          500: "#558d73",
          600: "#41725b",
          700: "#355b4a",
          800: "#2d4a3e",
          900: "#273f35",
          950: "#14221d",
        },
        sage: {
          light: "#eaf2ec",
          DEFAULT: "#4a7c68",
          dark: "#2c4a3e",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["Merriweather", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
