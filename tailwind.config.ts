import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        brand: {
          cyan: "#06b6d4",
          purple: "#a855f7",
        },
        workspace: {
          bg: "#0c0f14",
          card: "#141922",
          border: "#242b38",
        },
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      letterSpacing: {
        tighter: "-0.05em",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      fontSize: {
        // Page title - 32px / 700
        'page-title': ['24px', { lineHeight: '1.2', fontWeight: '700' }],
        // Card title / insight title - 20px / 600
        'card-title': ['15px', { lineHeight: '1.4', fontWeight: '600' }],
        // Small title - 16px / 600
        'small-title': ['13px', { lineHeight: '1.4', fontWeight: '600' }],
        // Body large - 16px / 400
        'body-lg': ['14px', { lineHeight: '1.6', fontWeight: '400' }],
        // Body default - 15px / 400
        'body': ['13px', { lineHeight: '1.6', fontWeight: '400' }],
        // Small/meta text - 13px / 400
        'meta': ['11px', { lineHeight: '1.5', fontWeight: '400' }],
        // Caption - 12px / 500
        'caption': ['10px', { lineHeight: '1.4', fontWeight: '500' }],
        // Legacy tokens (for backward compatibility)
        'title': ['20px', { lineHeight: '1.2', fontWeight: '600' }],
        'section-title': ['16px', { lineHeight: '1.3', fontWeight: '600' }],
        'insight': ['14px', { lineHeight: '1.5' }],
      },
      animation: {
        "clevr-float": "clevr-float 4s ease-in-out infinite",
        "clevr-breathe": "clevr-breathe 6s ease-in-out infinite",
        "slide-in-up": "slideInUp 0.4s ease-out forwards",
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "thinking": "thinking 1.4s ease-in-out infinite",
      },
      keyframes: {
        "clevr-float": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "25%": { transform: "scale(1.02)", opacity: "0.95" },
          "50%": { transform: "scale(1.05)", opacity: "1" },
          "75%": { transform: "scale(1.02)", opacity: "0.97" },
        },
        "clevr-breathe": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        slideInUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        thinking: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
}

export default config
