"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { CACHE_OWNER_KEY, clearPrivateData } from "@/lib/clear-private-data";

export function AuthSessionBoundary({ children }: { children: React.ReactNode }) {
  const { data: session, error, isPending, refetch } = useSession();
  const queryClient = useQueryClient();
  const [readyForUser, setReadyForUser] = useState<string | null>(null);
  const [cacheError, setCacheError] = useState(false);
  const userId = session?.user.id;

  useEffect(() => {
    if (isPending || error) return;

    let cancelled = false;
    if (!userId) {
      void clearPrivateData(queryClient).finally(() => {
        if (!cancelled) window.location.replace("/");
      });
      return () => { cancelled = true; };
    }

    if (localStorage.getItem(CACHE_OWNER_KEY) === userId) {
      queueMicrotask(() => {
        if (!cancelled) setReadyForUser(userId);
      });
      return () => { cancelled = true; };
    }

    void clearPrivateData(queryClient).then(() => {
      if (cancelled) return;
      localStorage.setItem(CACHE_OWNER_KEY, userId);
      setReadyForUser(userId);
    }).catch(() => {
      if (!cancelled) setCacheError(true);
    });
    return () => { cancelled = true; };
  }, [error, isPending, queryClient, userId]);

  if (error && !session) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p>Couldn&apos;t check your sign-in. Check your connection and try again.</p>
        <button className="rounded-full bg-primary px-6 py-3 text-primary-foreground" onClick={() => void refetch()}>
          Try again
        </button>
      </main>
    );
  }

  if (cacheError) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p>Couldn&apos;t load this device&apos;s data.</p>
        <button className="rounded-full bg-primary px-6 py-3 text-primary-foreground" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  }

  if (isPending || readyForUser !== userId) {
    return (
      <div className="flex flex-1 items-center justify-center" role="status" aria-label="Checking sign-in">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return children;
}
