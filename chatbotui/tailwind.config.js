/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000', // Deep black for main background
        surface: '#1c1c1e', // Slightly lighter for cards/input
        userBubble: '#00B2FF', // Bright cyan/blue for user messages
        botBubble: '#1c1c1e', // Dark for bot messages
      }
    },
  },
  plugins: [],
}
