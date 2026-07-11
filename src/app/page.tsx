"use client";

import { useSession } from "@/lib/session";
import AuthScreen from "@/components/AuthScreen";
import Dashboard from "@/components/Dashboard";

export default function HomePage() {
  const { player, loading } = useSession();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="animate-pulse text-4xl">🎮</div>
      </div>
    );
  }

  return player ? <Dashboard /> : <AuthScreen />;
}
