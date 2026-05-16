export type ServiceInfo = {
  name: string;
  maxProfiles: number;
  category: string;
};

export const SERVICES: ServiceInfo[] = [
  // Streaming vidéo
  { name: "Netflix",               maxProfiles: 5, category: "Streaming" },   // 5 profils, 4 streams simultanés (Premium)
  { name: "Disney+",               maxProfiles: 7, category: "Streaming" },   // 7 profils, 4 streams simultanés
  { name: "Amazon Prime Video",    maxProfiles: 6, category: "Streaming" },   // 6 profils, 3 streams simultanés
  { name: "Apple TV+",             maxProfiles: 6, category: "Streaming" },   // Family Sharing 6 membres
  { name: "Max (HBO)",             maxProfiles: 5, category: "Streaming" },   // 5 profils, 4 streams (Ultimate)
  { name: "Paramount+",            maxProfiles: 6, category: "Streaming" },   // 6 profils, 3 streams simultanés
  { name: "Hulu",                  maxProfiles: 7, category: "Streaming" },   // 7 profils, 2 streams simultanés
  { name: "Crunchyroll",           maxProfiles: 5, category: "Streaming" },   // 5 profils (Premium)
  { name: "Canal+",                maxProfiles: 4, category: "Streaming" },   // 4 écrans simultanés (100% package)
  { name: "BeIN Sports",           maxProfiles: 5, category: "Streaming" },
  { name: "Peacock",               maxProfiles: 6, category: "Streaming" },   // 6 profils, 3 streams simultanés
  { name: "Discovery+",            maxProfiles: 5, category: "Streaming" },   // 5 profils
  { name: "MUBI",                  maxProfiles: 5, category: "Streaming" },   // 5 profils, 2 streams simultanés
  { name: "StarTimes",             maxProfiles: 4, category: "Streaming" },
  { name: "DStv",                  maxProfiles: 4, category: "Streaming" },   // 4 streams (Premium)
  { name: "Fubo TV",               maxProfiles: 6, category: "Streaming" },   // 6 profils
  // Musique
  { name: "Spotify",               maxProfiles: 4, category: "Musique" },     // Family plan nov 2024 → 4 pour nouveaux
  { name: "Deezer",                maxProfiles: 6, category: "Musique" },     // 1 admin + 5 membres
  { name: "Apple Music",           maxProfiles: 6, category: "Musique" },     // Family plan 6 membres
  { name: "Tidal",                 maxProfiles: 6, category: "Musique" },     // Family plan 6 membres
  { name: "YouTube Music",         maxProfiles: 6, category: "Musique" },     // Family plan 6 membres
  { name: "Amazon Music",          maxProfiles: 6, category: "Musique" },     // Family Unlimited 6 membres
  // Productivité & Outils
  { name: "YouTube Premium",       maxProfiles: 6, category: "Productivité" }, // Family plan 6 membres
  { name: "Canva Pro",             maxProfiles: 1, category: "Productivité" }, // Individuel uniquement
  { name: "Adobe Creative Cloud",  maxProfiles: 1, category: "Productivité" }, // Plan individuel, 2 appareils max
  { name: "Microsoft 365",         maxProfiles: 6, category: "Productivité" }, // Family plan 6 membres
  { name: "LinkedIn Premium",      maxProfiles: 2, category: "Productivité" }, // Plan Duo = 2 personnes
  { name: "Grammarly Premium",     maxProfiles: 1, category: "Productivité" }, // Individuel
  // IA
  { name: "ChatGPT Plus",          maxProfiles: 1, category: "IA" },           // Individuel
  { name: "Gemini Advanced",       maxProfiles: 6, category: "IA" },           // Google One Family 6 membres (2025)
  // VPN (connexions simultanées)
  { name: "NordVPN",               maxProfiles: 10, category: "VPN" },         // 10 connexions simultanées (2024)
  { name: "ExpressVPN",            maxProfiles: 10, category: "VPN" },         // 10 connexions (plan Basic)
  { name: "Surfshark",             maxProfiles: 10, category: "VPN" },         // Connexions illimitées (pratique : 10)
  // Éducation
  { name: "Duolingo Super",        maxProfiles: 6, category: "Éducation" },    // Family plan 6 membres
  { name: "Skillshare",            maxProfiles: 1, category: "Éducation" },    // Individuel
  { name: "Coursera Plus",         maxProfiles: 1, category: "Éducation" },    // Individuel
];

export const CATEGORIES = [...new Set(SERVICES.map((s) => s.category))];

export function getServiceByName(name: string): ServiceInfo | undefined {
  return SERVICES.find((s) => s.name === name);
}
