import type { MetadataRoute } from "next";

/** Web app manifest: lets phones install We Party to the home screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "We Party",
    short_name: "WeParty",
    description: "Where We All Control the Vibes. Scan the party QR, pick songs, heart the crowd's picks, and replay the night.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07060c",
    theme_color: "#07060c",
    categories: ["music", "entertainment", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
