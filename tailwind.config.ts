import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#08070d",
        plum: "#17111f",
        panel: "#211729",
        line: "rgba(255,255,255,0.11)",
        ember: "#ff637d",
        aqua: "#66e3ff",
      },
      boxShadow: {
        aura: "0 24px 80px rgba(255, 99, 125, 0.18)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
