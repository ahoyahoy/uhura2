"use client";

import { useCallback, useSyncExternalStore } from "react";

export function useStoredString(key: string, fallback: string): string;
export function useStoredString(key: string, fallback: null): string | null;
export function useStoredString(key: string, fallback: string | null): string | null {
  const subscribe = useCallback((notify: () => void) => {
    const eventName = `uhura:storage:${key}`;
    window.addEventListener("storage", notify);
    window.addEventListener(eventName, notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener(eventName, notify);
    };
  }, [key]);
  const snapshot = useCallback(() => localStorage.getItem(key) ?? fallback, [key, fallback]);
  const serverSnapshot = useCallback(() => fallback, [fallback]);
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function setStoredString(key: string, value: string) {
  localStorage.setItem(key, value);
  window.dispatchEvent(new Event(`uhura:storage:${key}`));
}
