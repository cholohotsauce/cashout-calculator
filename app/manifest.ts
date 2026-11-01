import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Ace Cash-Out",
    short_name: "Cash-Out",
    description: "Split a shift's tips between kitchen and floor staff, and keep the payday history.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
