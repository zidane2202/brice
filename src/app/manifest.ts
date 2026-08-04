import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SubResell",
    short_name: "SubResell",
    description: "Gestion d’abonnements pour vendeurs",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0b0d0f",
    theme_color: "#0b0d0f",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/pwa-icon-192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Nouveau client", short_name: "Nouveau client", url: "/clients?new=1", icons: [{ src: "/pwa-icon-192", sizes: "192x192", type: "image/png" }] },
      { name: "Clients à relancer", short_name: "Relances", url: "/relances", icons: [{ src: "/pwa-icon-192", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
