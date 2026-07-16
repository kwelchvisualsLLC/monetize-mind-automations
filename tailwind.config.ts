import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kwblack: "#0a0a0a",
        kwcard: "#121212",
        kwgold: "#C9A84C",
        kwgoldlight: "#e2c877",
      },
    },
  },
  plugins: [],
};
export default config;
