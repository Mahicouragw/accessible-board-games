import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Accessible Board Games",
    short_name: "Accessible Games",
    description:
      "Fully accessible board games - Ludo, Carrom, Snake Ladder, Chess, Memory, 2048. WCAG AA, multiplayer, voice chat.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#7c3aed",
    categories: ["games", "entertainment", "accessibility"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
