/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      "colors": {
        "surface-variant": "#e4e2dd",
        "on-secondary-container": "#6f2e00",
        "on-tertiary-fixed": "#00210f",
        "on-surface": "#1b1c19",
        "on-error-container": "#93000a",
        "background": "#fbf9f4",
        "tertiary": "#002c15",
        "error": "#ba1a1a",
        "secondary-container": "#fd9254",
        "surface-container": "#f0eee9",
        "surface-tint": "#416084",
        "inverse-on-surface": "#f2f1ec",
        "outline": "#73777f",
        "primary-fixed": "#d1e4ff",
        "on-surface-variant": "#43474e",
        "inverse-primary": "#a9c9f2",
        "on-background": "#1b1c19",
        "on-primary": "#ffffff",
        "on-primary-container": "#87a7ce",
        "surface-container-low": "#f5f3ee",
        "tertiary-container": "#004424",
        "tertiary-fixed-dim": "#88d8a1",
        "secondary-fixed": "#ffdbca",
        "on-error": "#ffffff",
        "outline-variant": "#c3c6cf",
        "on-secondary-fixed-variant": "#773200",
        "surface-container-lowest": "#ffffff",
        "primary-container": "#1a3c5e",
        "inverse-surface": "#30312e",
        "on-secondary-fixed": "#331100",
        "surface-container-highest": "#e4e2dd",
        "surface-dim": "#dcdad5",
        "on-tertiary": "#ffffff",
        "secondary-fixed-dim": "#ffb68f",
        "on-secondary": "#ffffff",
        "on-tertiary-fixed-variant": "#00522d",
        "tertiary-fixed": "#a3f4bc",
        "on-primary-fixed-variant": "#28496b",
        "primary-fixed-dim": "#a9c9f2",
        "on-primary-fixed": "#001d36",
        "on-tertiary-container": "#66b481",
        "secondary": "#E07B3F", /* Custom Branding Saffron */
        "surface-container-high": "#eae8e3",
        "primary": "#1A3C5E", /* Custom Branding Navy */
        "surface": "#fbf9f4",
        "error-container": "#ffdad6",
        "surface-bright": "#fbf9f4"
      },
      "spacing": {
        "lg": "40px",
        "gutter": "24px",
        "container-max": "1280px",
        "xl": "64px",
        "xs": "4px",
        "base": "8px",
        "sm": "12px",
        "md": "24px"
      },
      "fontFamily": {
        "body-lg": ["Inter"],
        "headline-lg-mobile": ["Rajdhani"],
        "cta-text": ["Rajdhani"],
        "headline-lg": ["Rajdhani"],
        "data-mono": ["JetBrains Mono"],
        "body-md": ["Inter"],
        "display-lg": ["Rajdhani"],
        "body-sm": ["Inter"],
        "label-caps": ["Inter"],
        "headline-md": ["Rajdhani"]
      },
      "fontSize": {
        "body-lg": ["18px", {"lineHeight": "28px", "fontWeight": "400"}],
        "headline-lg-mobile": ["28px", {"lineHeight": "36px", "fontWeight": "600"}],
        "cta-text": ["16px", {"lineHeight": "20px", "letterSpacing": "0.03em", "fontWeight": "700"}],
        "headline-lg": ["32px", {"lineHeight": "40px", "fontWeight": "600"}],
        "data-mono": ["14px", {"lineHeight": "20px", "fontWeight": "500"}],
        "body-md": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
        "display-lg": ["48px", {"lineHeight": "56px", "letterSpacing": "0.02em", "fontWeight": "700"}],
        "body-sm": ["14px", {"lineHeight": "20px", "fontWeight": "400"}],
        "label-caps": ["12px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700"}],
        "headline-md": ["24px", {"lineHeight": "32px", "fontWeight": "600"}]
      }
    }
  },
  plugins: [],
}
