"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type Player = {
  id: number;
  name: string;
  code: string;
  avatar: string;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  xp: number;
};

type SessionValue = {
  player: Player | null;
  loading: boolean;
  setPlayer: (p: Player | null) => void;
  refresh: () => Promise<void>;
  logout: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

const KEY = "arcade_player_code";
const GUEST_KEY = "arcade_guest_player";

function createGuestPlayer(code?: string, name?: string): Player {
  const existing = typeof window !== "undefined" ? localStorage.getItem(GUEST_KEY) : null;
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed.code) return parsed;
    } catch {}
  }
  const guest: Player = {
    id: Math.floor(Math.random() * 100000) + 1,
    name: name || "Guest Player",
    code: code || Math.random().toString(36).substring(2, 8).toUpperCase(),
    avatar: "🎮",
    wins: 0,
    losses: 0,
    draws: 0,
    totalGames: 0,
    xp: 0,
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
    localStorage.setItem(KEY, guest.code);
  }
  return guest;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [player, setPlayerState] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  const setPlayer = useCallback((p: Player | null) => {
    setPlayerState(p);
    if (typeof window !== "undefined") {
      if (p) {
        localStorage.setItem(KEY, p.code);
        // Also save as guest backup
        localStorage.setItem(GUEST_KEY, JSON.stringify(p));
      } else {
        localStorage.removeItem(KEY);
        // Keep guest for offline mode
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    const code =
      typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    
    // If no code, check for guest backup
    if (!code) {
      const guestBackup = typeof window !== "undefined" ? localStorage.getItem(GUEST_KEY) : null;
      if (guestBackup) {
        try {
          const parsed = JSON.parse(guestBackup);
          setPlayerState(parsed);
          setLoading(false);
          return;
        } catch {}
      }
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/player?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.player) {
          setPlayerState(data.player);
        } else {
          // API returned ok but no player - mock DB mode, create guest from stored code
          const guestBackup = typeof window !== "undefined" ? localStorage.getItem(GUEST_KEY) : null;
          if (guestBackup) {
            try {
              const parsed = JSON.parse(guestBackup);
              setPlayerState(parsed);
            } catch {
              const guest = createGuestPlayer(code);
              setPlayerState(guest);
            }
          } else {
            const guest = createGuestPlayer(code);
            setPlayerState(guest);
          }
        }
      } else {
        // API failed - likely no DB configured - use guest mode (FIX for reading 'code' error)
        console.warn("Player API failed, using guest mode for offline play");
        const guestBackup = typeof window !== "undefined" ? localStorage.getItem(GUEST_KEY) : null;
        if (guestBackup) {
          try {
            const parsed = JSON.parse(guestBackup);
            // Update code to match requested if different
            if (parsed.code !== code) {
              parsed.code = code;
            }
            setPlayerState(parsed);
          } catch {
            const guest = createGuestPlayer(code);
            setPlayerState(guest);
          }
        } else {
          // No guest backup, create new guest with the code that was requested
          // This prevents "Cannot read properties of undefined (reading 'code')"
          const guest = createGuestPlayer(code);
          setPlayerState(guest);
        }
      }
    } catch (e) {
      // Network error - use guest mode
      console.warn("Session refresh failed, using guest mode", e);
      const guestBackup = typeof window !== "undefined" ? localStorage.getItem(GUEST_KEY) : null;
      if (guestBackup) {
        try {
          const parsed = JSON.parse(guestBackup);
          setPlayerState(parsed);
        } catch {
          const guest = createGuestPlayer(code || undefined);
          setPlayerState(guest);
        }
      } else if (code) {
        const guest = createGuestPlayer(code);
        setPlayerState(guest);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setPlayer(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(GUEST_KEY);
    }
  }, [setPlayer]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Heartbeat so other players can see we're online - only if DB configured, guarded
  useEffect(() => {
    if (!player?.code) return;
    const ping = () =>
      fetch("/api/players/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: player?.code ?? "" }),
      }).catch(() => {
        // Ignore heartbeat failure in offline/demo mode
      });
    ping();
    const iv = setInterval(ping, 30000);
    return () => clearInterval(iv);
  }, [player]);

  return (
    <SessionContext.Provider value={{ player, loading, setPlayer, refresh, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

// Export helper for components to safely get code
export function getSafePlayerCode(player: Player | null | undefined): string {
  return player?.code ?? "GUEST";
}
