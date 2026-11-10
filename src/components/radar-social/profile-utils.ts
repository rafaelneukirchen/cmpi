export type DraftSocialProfile = {
  nome: string;
  username: string;
  url: string;
  plataforma: string;
};

export function buildProfileUrl(username: string, platform: string): string {
  switch (platform) {
    case "instagram":
      return `https://www.instagram.com/${username}/`;
    case "facebook":
      return `https://www.facebook.com/${username}`;
    case "youtube":
      return `https://www.youtube.com/@${username}`;
    case "twitter":
      return `https://x.com/${username}`;
    case "tiktok":
      return `https://www.tiktok.com/@${username}`;
    default:
      return "";
  }
}

export function detectPlatformFromInput(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("instagram.com")) return "instagram";
  if (normalized.includes("facebook.com")) return "facebook";
  if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) return "youtube";
  if (normalized.includes("x.com") || normalized.includes("twitter.com")) return "twitter";
  if (normalized.includes("tiktok.com")) return "tiktok";
  return null;
}

export function extractUsernameFromInput(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";

  if (!/^https?:\/\//i.test(normalized)) {
    return normalized.replace(/^@/, "").replace(/\/+$/, "");
  }

  try {
    const url = new URL(normalized);
    const segments = url.pathname.split("/").filter(Boolean);
    return (segments[0] || "").replace(/^@/, "").replace(/\/+$/, "");
  } catch {
    return normalized.replace(/^@/, "").replace(/\/+$/, "");
  }
}

export function normalizeDraftProfile(row: DraftSocialProfile) {
  const plataforma = detectPlatformFromInput(row.url) || row.plataforma;
  const username = extractUsernameFromInput(row.url || row.username);
  const url = row.url.trim() || buildProfileUrl(username, plataforma);

  return {
    nome: row.nome.trim(),
    username,
    plataforma,
    url,
  };
}