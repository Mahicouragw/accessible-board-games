// Admin (site owner) gate — e.g. Sound Studio upload/publish rights.
// Admin is decided by PLAYER NAME (Player IDs are login-only).
// Override with env ADMIN_PLAYER_NAMES="name1,name2" (comma-separated).

const DEFAULT_ADMINS = ["mahi couragw", "mahcouragw", "mahi", "owner", "admin"];

export function adminNames(): string[] {
  const env =
    (typeof process !== "undefined" ? process.env.ADMIN_PLAYER_NAMES : undefined) ?? "";
  const fromEnv = env
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ADMINS;
}

export function isAdminName(name?: string | null): boolean {
  if (!name) return false;
  return adminNames().includes(name.trim().toLowerCase());
}
