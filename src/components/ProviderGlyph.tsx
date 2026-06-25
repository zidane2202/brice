const PROVIDERS: Record<string, { bg: string; fg: string }> = {
  "Netflix":     { bg: "#E50914", fg: "#FFFFFF" },
  "Spotify":     { bg: "#1DB954", fg: "#0B0D10" },
  "Disney+":     { bg: "#0E2A6B", fg: "#FFFFFF" },
  "HBO Max":     { bg: "#5B27D6", fg: "#FFFFFF" },
  "Max":         { bg: "#5B27D6", fg: "#FFFFFF" },
  "Prime Video": { bg: "#00A8E1", fg: "#0B0D10" },
  "Amazon Prime":{ bg: "#00A8E1", fg: "#0B0D10" },
  "YouTube":     { bg: "#FF0000", fg: "#FFFFFF" },
  "YouTube Premium": { bg: "#FF0000", fg: "#FFFFFF" },
  "ChatGPT":     { bg: "#10A37F", fg: "#0B0D10" },
  "OpenAI":      { bg: "#10A37F", fg: "#0B0D10" },
  "Claude":      { bg: "#D97757", fg: "#FFFFFF" },
  "Apple TV":    { bg: "#1D1D1F", fg: "#FFFFFF" },
  "Apple TV+":   { bg: "#1D1D1F", fg: "#FFFFFF" },
  "Apple Music": { bg: "#FC3C44", fg: "#FFFFFF" },
  "Crunchyroll": { bg: "#F47521", fg: "#FFFFFF" },
  "Deezer":      { bg: "#A238FF", fg: "#FFFFFF" },
  "Tidal":       { bg: "#000000", fg: "#FFFFFF" },
  "Canva":       { bg: "#00C4CC", fg: "#0B0D10" },
  "Notion":      { bg: "#FFFFFF", fg: "#0B0D10" },
  "Figma":       { bg: "#F24E1E", fg: "#FFFFFF" },
  "Microsoft 365": { bg: "#D83B01", fg: "#FFFFFF" },
  "Office 365":  { bg: "#D83B01", fg: "#FFFFFF" },
  "Google One":  { bg: "#4285F4", fg: "#FFFFFF" },
  "NordVPN":     { bg: "#4687FF", fg: "#FFFFFF" },
  "ExpressVPN":  { bg: "#DA3940", fg: "#FFFFFF" },
  "Surfshark":   { bg: "#1EBFBF", fg: "#FFFFFF" },
  "Coursera":    { bg: "#0056D2", fg: "#FFFFFF" },
  "Udemy":       { bg: "#A435F0", fg: "#FFFFFF" },
  "LinkedIn Learning": { bg: "#0A66C2", fg: "#FFFFFF" },
  "Duolingo":    { bg: "#58CC02", fg: "#FFFFFF" },
};

type Props = { name: string; size?: number };

export function ProviderGlyph({ name, size = 22 }: Props) {
  const p = PROVIDERS[name];
  const bg = p?.bg ?? "#262A32";
  const fg = p?.fg ?? "#F5F6F7";
  const mono = (name ?? "?").trim()[0]?.toUpperCase() ?? "?";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 4,
        background: bg,
        color: fg,
        font: `700 ${size * 0.5}px/1 var(--font-geist-sans)`,
        flex: "0 0 auto",
      }}
    >
      {mono}
    </span>
  );
}
