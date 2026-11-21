import type { Config } from "tailwindcss";

const config: Config = {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                rechabite: {
                    black: "#0F0F0F",
                    white: "#FFFFFF",
                    purple: "#9947B7",
                    border: "#374151",
                },
                venue: {
                    rooftop: "#007AD8",
                    hall: "#FF5598",
                    rainbow: "#FE2902",
                    goodwill: "#9947B7",
                },
            },
            fontFamily: {
                display: ["Anton", "Impact", "sans-serif"],
                heading: ["'Archivo Variable'", "Archivo", "sans-serif"],
                body: ["'Archivo Variable'", "Archivo", "sans-serif"],
                action: ["'Archivo Variable'", "Archivo", "sans-serif"],
            },
            borderRadius: {
                cta: "4px",
                card: "8px",
            },
            boxShadow: {
                none: "none",
            },
            spacing: {
                "rech-xs": "4px",
                "rech-sm": "14px",
                "rech-md": "18px",
                "rech-lg": "28px",
                "rech-xl": "82px",
            },
        },
    },
    plugins: [],
};

export default config;