import type { MetadataRoute } from "next";

// Lets people "Add to Home Screen" and open Health Here like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Health Here",
    short_name: "Health Here",
    description: "Find care near you that takes your insurance.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f2",
    theme_color: "#c6e47b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
