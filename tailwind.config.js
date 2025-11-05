// File: tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,js,vue,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // tes personnalisations ici
      colors: {
        primary: '#1d4ed8',
      },
      spacing: {
        '128': '32rem',
      },
    },
    // Exemple de désactivation de “container”
    container: false,
  },
  corePlugins: {
    container: false,
    preflight: false,
  },
  plugins: [],
}
