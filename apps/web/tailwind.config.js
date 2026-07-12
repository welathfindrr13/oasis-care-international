/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        oasis: {
          canvas: "#f7f5f0",
          surface: "#ffffff",
          ink: "#17211f",
          muted: "#52615d",
          border: "#d7dcd8",
          "control-border": "#87958f",
          teal: "#0f766e",
          "teal-dark": "#115e59",
          "teal-soft": "#e7f5f1",
          info: "#245d86",
          "info-soft": "#eef6fb",
          attention: "#92500a",
          "attention-soft": "#fff7e6",
          danger: "#b42318",
          "danger-soft": "#fff1f0",
          success: "#166534",
          "success-soft": "#effaf2",
        },
        base: {
          black: "#101816",
          white: "#ffffff",
          gray: {
            50: "#faf9f6",
            100: "#f1f0eb",
            300: "#d7dcd8",
            500: "#64716d",
            800: "#26332f",
          },
        },
        brand: {
          fuschia: { 100: "#b42318", 80: "#e7a6a0", 60: "#fff1f0" },
          iris: { 100: "#166534", 80: "#91c69f", 60: "#effaf2" },
          blue: { primary: "#0f766e", light: "#80c7be", medium: "#115e59" },
        },
        text: { primary: "#17211f", secondary: "#52615d", inverse: "#ffffff" },
        background: {
          primary: "#ffffff",
          secondary: "#f7f5f0",
          accent: "#e7f5f1",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: [
          "var(--font-work-sans)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        body: [
          "var(--font-source-sans)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "1.45" }],
        sm: ["14px", { lineHeight: "1.5" }],
        base: ["16px", { lineHeight: "1.6" }],
        md: ["16px", { lineHeight: "1.5" }],
        lg: ["18px", { lineHeight: "1.4" }],
        xl: ["24px", { lineHeight: "1.25" }],
        "2xl": ["32px", { lineHeight: "1.2" }],
      },
      borderRadius: { sm: "8px", md: "8px", lg: "12px", full: "999px" },
      boxShadow: {
        sm: "0 1px 2px rgba(23, 33, 31, 0.06)",
        md: "0 8px 24px rgba(23, 33, 31, 0.08)",
        lg: "0 18px 48px rgba(23, 33, 31, 0.12)",
      },
    },
  },
  plugins: [],
};
