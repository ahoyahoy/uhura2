"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { clearPrivateData } from "@/lib/clear-private-data";

export function SignOutButton({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    setFailed(false);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        const current = await authClient.getSession();
        if (current.error || current.data?.session) throw new Error("Sign-out failed");
      }

      // Navigate even when browser storage is unavailable after the server session ends.
      try { await clearPrivateData(queryClient); } catch { queryClient.clear(); }
      window.location.replace("/");
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Sign out"
        aria-busy={busy}
        disabled={busy}
        className={className ?? "inline-flex h-8 w-8 items-center justify-center rounded-full"}
        onClick={() => void handleSignOut()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      </button>
      {failed && (
        <p role="alert" className="fixed right-6 top-28 z-40 max-w-xs rounded-xl bg-card px-4 py-3 text-sm shadow-lg">
          Couldn&apos;t sign out. Check your connection and try again.
        </p>
      )}
    </>
  );
}
