import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      animation: {
        blob: "blob 7s infinite",
        shake: "shake 0.5s",
      },
      keyframes: {
        blob: {
          "0%": {
            transform: "translate(0px, 0px) scale(1)",
          },
          "33%": {
            transform: "translate(30px, -50px) scale(1.1)",
          },
          "66%": {
            transform: "translate(-20px, 20px) scale(0.9)",
          },
          "100%": {
            transform: "translate(0px, 0px) scale(1)",
          },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-2px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(2px)" },
        },
      },
    },
  },
  plugins: [],
  safelist: [
    // Safelist dynamic color classes used in components
    'bg-blue-100', 'bg-green-100', 'bg-purple-100', 'bg-pink-100', 'bg-red-100', 'bg-gray-100',
    'bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-pink-50', 'bg-red-50', 'bg-gray-50',
    'text-blue-600', 'text-green-600', 'text-purple-600', 'text-pink-600', 'text-red-600', 'text-gray-600',
    'text-blue-800', 'text-green-800', 'text-purple-800', 'text-pink-800', 'text-red-800', 'text-gray-800',
    'border-blue-500', 'border-green-500', 'border-purple-500', 'border-pink-500', 'border-red-500', 'border-gray-500',
  ],
};

export default config;