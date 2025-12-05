import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        "light": {
          "primary": "#0d0d0d", // lofi primary
          "secondary": "#1a1919", // lofi secondary
          "accent": "#262626", // lofi accent
          "neutral": "#000000", // lofi neutral
          "base-100": "#ffffff", // lofi base-100
          "base-200": "#f9fafb",
          "base-300": "#d1d5db",
          "base-content": "#000000",
          "info": "#00b5ff",
          "success": "#00a96e",
          "warning": "#ffbe00",
          "error": "#ff5861",
          "--rounded-box": "0",
          "--rounded-btn": "0",
          "--rounded-badge": "0",
          "--animation-btn": "0",
          "--animation-input": "0",
          "--btn-focus-scale": "1",
          "--tab-radius": "0",
        }
      },
      {
        "dark": {
          "primary": "#7aa2f7",
          "secondary": "#bb9af7",
          "accent": "#7dcfff",
          "neutral": "#414868",
          "base-100": "#1a1b26",
          "base-200": "#24283b",
          "base-300": "#414868",
          "base-content": "#c0caf5",
          "info": "#7aa2f7",
          "success": "#9ece6a",
          "warning": "#e0af68",
          "error": "#f7768e",
          "--rounded-box": "0",
          "--rounded-btn": "0",
          "--rounded-badge": "0",
          "--animation-btn": "0",
          "--animation-input": "0",
          "--btn-focus-scale": "1",
          "--tab-radius": "0",
        },
      },
    ],
  },
}