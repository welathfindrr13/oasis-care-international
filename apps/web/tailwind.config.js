/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Colors from Figma design tokens
      colors: {
        base: {
          black: '#000000',
          white: '#ffffff',
          gray: {
            50: '#fafafa',
            100: '#edf5fa',
            300: '#d8d8d8',
            500: '#afafaf',
            800: 'rgba(0, 0, 0, 0.8)',
          }
        },
        brand: {
          fuschia: {
            100: '#ef5da8',
            80: '#f178b6',
            60: '#fcddec',
          },
          iris: {
            100: '#5d5fef',
            80: '#7879f1',
            60: '#a5a6f6',
          },
          blue: {
            primary: '#007be5',
            light: '#56ccf2',
            medium: '#359dd9',
          }
        },
        text: {
          primary: '#0e0e2c',
          secondary: 'rgba(0, 0, 0, 0.8)',
          inverse: '#ffffff',
        },
        background: {
          primary: '#ffffff',
          secondary: '#fafafa',
          accent: '#edf5fa',
        }
      },
      
      // Typography from Figma
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Work Sans', 'system-ui', 'sans-serif'],
        body: ['Droid Sans', 'system-ui', 'sans-serif'],
      },
      
      fontSize: {
        xs: ['11px', { lineHeight: '1.45' }],
        sm: ['12px', { lineHeight: '1.33' }],
        base: ['13px', { lineHeight: '1.17' }],
        md: ['14px', { lineHeight: '1.17' }],
        lg: ['20px', { lineHeight: '1.17' }],
        xl: ['34px', { lineHeight: '1.17' }],
        '2xl': ['72px', { lineHeight: '1.21' }],
      },
      
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      
      letterSpacing: {
        tight: '-0.02em',
        normal: '0em',
        wide: '0.005em',
      },
      
      // Spacing scale
      spacing: {
        '0': '0px',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
      },
      
      // Border radius
      borderRadius: {
        'none': '0px',
        'sm': '3px',
        'md': '6px',
        'lg': '12px',
        'full': '1000px',
      },
      
      // Box shadows
      boxShadow: {
        'sm': '0px 1px 3px 0px rgba(0, 0, 0, 0.1)',
        'md': '0px 4px 6px -1px rgba(0, 0, 0, 0.1)',
        'lg': '0px 10px 15px -3px rgba(0, 0, 0, 0.1)',
      },
      
      // Animation and transitions
      transitionTimingFunction: {
        'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      
      transitionDuration: {
        '200': '200ms',
      }
    },
  },
  plugins: [],
}
