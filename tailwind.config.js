/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#00338D',
        'navy-deep': '#1A1F36',
        'navy-darker': '#002A73',
        accent: '#005EB8',
        blue: '#005EB8',
        teal: '#00B0A0',
        crimson: '#C8102E',
        'accent-light': '#1A8FE3',
        success: '#00B0A0',
        amber: '#E87722',
        danger: '#C8102E',
        'danger-light': '#FEF2F2',
        'amber-light': '#FFFBEB',
        'success-light': '#F0FDF4',
        'grey-bg': '#F0F2F5',
        'grey-border': '#D8DCE3',
        'text-primary': '#1A1F36',
        'text-secondary': '#6B7280',
        'text-muted': '#9CA3AF',
      },
      fontFamily: {
        heading: ["'Inter'", "'Segoe UI'", 'sans-serif'],
        body: ["'Inter'", "'Segoe UI'", 'sans-serif'],
        mono: ["'JetBrains Mono'", 'monospace'],
      },
    },
  },
  plugins: [],
};
