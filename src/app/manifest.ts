import type { MetadataRoute } from "next";

// Lets people "Add to Home Screen" and open Health Here like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Health Here",
    short_name: "Health Here",
    description: "Find care near you that takes your insurance.",
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#c6e47b",
    theme_color: "#c6e47b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
