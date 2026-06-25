export type ProviderTheme = { bg: string; fg: string };

export const PROVIDERS: Record<string, ProviderTheme> = {
  "Netflix":           { bg: "#E50914", fg: "#FFFFFF" },
  "Spotify":           { bg: "#1DB954", fg: "#0B0D10" },
  "Disney+":           { bg: "#0E2A6B", fg: "#FFFFFF" },
  "HBO Max":           { bg: "#5B27D6", fg: "#FFFFFF" },
  "Max":               { bg: "#5B27D6", fg: "#FFFFFF" },
  "Prime Video":       { bg: "#00A8E1", fg: "#0B0D10" },
  "Amazon Prime":      { bg: "#00A8E1", fg: "#0B0D10" },
  "YouTube":           { bg: "#FF0000", fg: "#FFFFFF" },
  "YouTube Premium":   { bg: "#FF0000", fg: "#FFFFFF" },
  "ChatGPT":           { bg: "#10A37F", fg: "#0B0D10" },
  "OpenAI":            { bg: "#10A37F", fg: "#0B0D10" },
  "Claude":            { bg: "#D97757", fg: "#FFFFFF" },
  "Apple TV":          { bg: "#1D1D1F", fg: "#FFFFFF" },
  "Apple TV+":         { bg: "#1D1D1F", fg: "#FFFFFF" },
  "Apple Music":       { bg: "#FC3C44", fg: "#FFFFFF" },
  "Crunchyroll":       { bg: "#F47521", fg: "#FFFFFF" },
  "Deezer":            { bg: "#A238FF", fg: "#FFFFFF" },
  "Tidal":             { bg: "#000000", fg: "#FFFFFF" },
  "Canva":             { bg: "#00C4CC", fg: "#0B0D10" },
  "Notion":            { bg: "#FFFFFF", fg: "#0B0D10" },
  "Figma":             { bg: "#F24E1E", fg: "#FFFFFF" },
  "Microsoft 365":     { bg: "#D83B01", fg: "#FFFFFF" },
  "Office 365":        { bg: "#D83B01", fg: "#FFFFFF" },
  "Google One":        { bg: "#4285F4", fg: "#FFFFFF" },
  "NordVPN":           { bg: "#4687FF", fg: "#FFFFFF" },
  "ExpressVPN":        { bg: "#DA3940", fg: "#FFFFFF" },
  "Surfshark":         { bg: "#1EBFBF", fg: "#FFFFFF" },
  "Coursera":          { bg: "#0056D2", fg: "#FFFFFF" },
  "Udemy":             { bg: "#A435F0", fg: "#FFFFFF" },
  "LinkedIn Learning": { bg: "#0A66C2", fg: "#FFFFFF" },
  "Duolingo":          { bg: "#58CC02", fg: "#FFFFFF" },
};

const DEFAULT_THEME: ProviderTheme = { bg: "#262A32", fg: "#F5F6F7" };

export function getProviderTheme(name: string | null | undefined): ProviderTheme {
  if (!name) return DEFAULT_THEME;
  return PROVIDERS[name] ?? DEFAULT_THEME;
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
