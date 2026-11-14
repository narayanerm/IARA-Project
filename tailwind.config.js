/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['IBM Plex Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        condensed: ['IBM Plex Sans Condensed', 'IBM Plex Sans', 'ui-sans-serif', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        raised: 'hsl(var(--raised))',
        water: 'hsl(var(--water))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /* data colors, mapped onto the IARA palette */
        sar: {
          cyan: 'hsl(198 51% 57%)', // água #5AA7C9
          amber: 'hsl(19 85% 61%)', // laranja #F07A45
          crimson: 'hsl(17 75% 42%)', // laranja profundo #B9481A
          jade: 'hsl(142 32% 46%)', // folha #4F9A6A
          violet: 'hsl(265 45% 68%)',
        },
        iara: {
          bg: '#0A110E',
          surface: '#13201A',
          ink: '#E6EEE8',
          muted: '#9DB1A6',
          water: '#5AA7C9',
          'water-deep': '#2B7EA6',
          orange: '#F07A45',
          'orange-deep': '#B9481A',
          leaf: '#4F9A6A',
          mata1: '#2C5039',
          mata2: '#33593F',
          mata3: '#3B6447',
        },
      },
      borderRadius: {
        xl: 'var(--radius)',
        lg: 'var(--radius)',
        md: 'var(--radius)',
        sm: '4px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 2.4s linear infinite',
        'pulse-soft': 'pulseSoft 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
