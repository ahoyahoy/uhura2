"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }).catch(() => {
      // Installation is optional; the website remains usable without a worker.
    });
  }, []);

  return null;
}
