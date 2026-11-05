import type { Config } from 'tailwindcss';

const token = (v: string) => `hsl(var(--${v}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        destructive: { DEFAULT: token('destructive'), foreground: token('destructive-foreground') },
        warning: token('warning'),
        // Paleta da marca
        deep: '#123D2A',
        tech: '#27C77B',
        mint: '#B7F3D0',
        night: '#0B1511',
        snow: '#F5F8F5',
        stone: '#89958E',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: { lg: '14px', md: '10px', sm: '7px' },
      boxShadow: {
        glow: '0 0 0 1px hsl(var(--primary) / 0.25), 0 8px 40px -8px hsl(var(--primary) / 0.35)',
        soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.18)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        pulse2: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.4' } },
      },
      animation: { 'fade-up': 'fade-up .35s ease-out both', pulse2: 'pulse2 2s ease-in-out infinite' },
    },
  },
  plugins: [],
} satisfies Config;
