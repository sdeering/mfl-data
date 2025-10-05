/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // Safelist dynamic background colors for position ratings
    {
      pattern: /bg-\[#[0-9a-fA-F]{6}\]/,
    },
    // Also safelist specific colors we know we use
    'bg-[#87f6f8]',
    'bg-[#7dffad]',
    'bg-[#9dffb3]',
    'bg-[#bdffc9]',
    'bg-[#ddffdf]',
    'bg-[#f0fff2]',
    'bg-[#e0ffe3]',
    'bg-red-50',
    'bg-red-100',
    'bg-red-200',
    'bg-red-300',
    'bg-red-400',
    'bg-red-500',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
    },
  },
  plugins: [],
}
