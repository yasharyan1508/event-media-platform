import type { Config } from "tailwindcss";

const config = {
  darkMode: "class",
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        foreground: "hsl(var(--foreground))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        "surface-container-highest": "#e4e0d8",
        "on-secondary": "#ffffff",
        "on-tertiary-fixed": "#221a05",
        "on-secondary-fixed-variant": "#4a4538",
        "on-tertiary-fixed-variant": "#554020",
        "surface-container-lowest": "#ffffff",
        "on-secondary-fixed": "#1e1a13",
        "primary-container": "#78a886",
        "outline-variant": "#c4c8bc",
        "secondary-container": "#f0e8db",
        "error": "#b83230",
        "surface-bright": "#faf6f0",
        "surface-dim": "#dbd7cf",
        "inverse-on-surface": "#f5f0e8",
        "surface-variant": "#e4e0d8",
        "surface-container-high": "#eae6de",
        "secondary-fixed": "#f0e8db",
        "primary-fixed": "#c8e8d0",
        "on-primary-fixed": "#002110",
        "on-error": "#ffffff",
        "surface-tint": "#4a7c59",
        "secondary-fixed-dim": "#d4ccbf",
        "on-secondary-container": "#5e5548",
        "tertiary-fixed": "#f8e0a8",
        "primary-fixed-dim": "#8ecf9e",
        "error-container": "#ffdad8",
        "outline": "#74796e",
        "inverse-primary": "#8ecf9e",
        "tertiary": "#705c30",
        "surface": "#faf6f0",
        "on-primary-fixed-variant": "#2a6038",
        "secondary": "#6b6358",
        "surface-container": "#f0ece4",
        "on-surface": "#2e3230",
        "on-error-container": "#690005",
        "on-primary": "#ffffff",
        "on-background": "#2e3230",
        "tertiary-container": "#c4a66a",
        "surface-container-low": "#f5f1ea",
        "on-tertiary": "#ffffff",
        "primary": "#4a7c59",
        "background": "#faf6f0",
        "on-tertiary-container": "#554020",
        "on-primary-container": "#d8f0de"
      },
      fontFamily: {
        headline: ["Literata", "serif"],
        display: ["Literata", "serif"],
        body: ["Nunito Sans", "sans-serif"],
        label: ["Nunito Sans", "sans-serif"]
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
