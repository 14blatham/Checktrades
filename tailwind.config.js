/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./**/*.html"],
  theme: {
    extend: {
      colors: {
        "error": "#ba1a1a",
        "on-secondary-container": "#5f6178",
        "on-secondary-fixed": "#181a2e",
        "on-tertiary-fixed-variant": "#5d4201",
        "surface-tint": "#545e76",
        "error-container": "#ffdad6",
        "on-secondary": "#ffffff",
        "on-secondary-fixed-variant": "#43455b",
        "outline-variant": "#c5c6cd",
        "on-tertiary-container": "#ab8844",
        "inverse-primary": "#bbc6e2",
        "secondary-fixed-dim": "#c4c4df",
        "outline": "#75777d",
        "on-primary": "#ffffff",
        "on-primary-fixed": "#101b30",
        "on-error": "#ffffff",
        "surface-bright": "#fbf8ff",
        "on-background": "#181a2e",
        "tertiary-fixed-dim": "#e9c176",
        "primary-fixed-dim": "#bbc6e2",
        "surface-container": "#edecff",
        "surface-container-highest": "#e0e0fc",
        "tertiary-fixed": "#ffdea5",
        "on-tertiary-fixed": "#261900",
        "inverse-on-surface": "#f1efff",
        "surface-container-lowest": "#ffffff",
        "primary-fixed": "#d7e2ff",
        "surface-container-high": "#e6e6ff",
        "surface-variant": "#e0e0fc",
        "inverse-surface": "#2d2f44",
        "on-tertiary": "#ffffff",
        "secondary-container": "#ddddf9",
        "secondary": "#5b5d74",
        "surface-dim": "#d7d8f4",
        "tertiary": "#190f00",
        "secondary-fixed": "#e0e0fc",
        "on-primary-container": "#828da7",
        "on-primary-fixed-variant": "#3c475d",
        "on-surface-variant": "#45474d",
        "background": "#fbf8ff",
        "surface-container-low": "#f4f2ff",
        "surface": "#fbf8ff",
        "primary-container": "#1b263b",
        "tertiary-container": "#342300",
        "primary": "#051125",
        "on-error-container": "#93000a",
        "on-surface": "#181a2e"
      },
      fontFamily: {
        "headline": ["Newsreader", "serif"],
        "body": ["Manrope", "sans-serif"],
        "label": ["Manrope", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ]
};
