module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#FF5A36",
        "primary-deep": "#E94B2B",
        bg: "#FFF9F4",
        card: "#FFFFFF",
        ink: "#202020",
        muted: "#777777",
        border: "#F0E7E0",
        success: "#198754",
        danger: "#D64545",
      },
    },
  },
  plugins: [],
};
