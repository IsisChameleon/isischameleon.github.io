/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        base: {
          50: "rgb(var(--base-50) / <alpha-value>)",
          100: "rgb(var(--base-100) / <alpha-value>)",
          200: "rgb(var(--base-200) / <alpha-value>)",
          300: "rgb(var(--base-300) / <alpha-value>)",
          400: "rgb(var(--base-400) / <alpha-value>)",
          500: "rgb(var(--base-500) / <alpha-value>)",
          600: "rgb(var(--base-600) / <alpha-value>)",
          700: "rgb(var(--base-700) / <alpha-value>)",
          800: "rgb(var(--base-800) / <alpha-value>)",
          900: "rgb(var(--base-900) / <alpha-value>)",
          950: "rgb(var(--base-950) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          muted: "rgb(var(--accent-muted) / <alpha-value>)",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0, 0, 0, 0.04), 0 12px 24px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
