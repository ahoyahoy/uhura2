"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";

type InstallChoice = { outcome: "accepted" | "dismissed" };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type PwaInstallContextValue = {
  canInstall: boolean;
  isInstalled: boolean;
  isIos: boolean;
  install: () => Promise<void>;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

const noSubscription = () => () => {};
const serverSnapshot = () => false;
const isIosSnapshot = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandaloneSnapshot = () =>
  window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
const subscribeToStandalone = (onChange: () => void) => {
  const standalone = window.matchMedia("(display-mode: standalone)");
  standalone.addEventListener("change", onChange);
  return () => standalone.removeEventListener("change", onChange);
};

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [appInstalled, setAppInstalled] = useState(false);
  const isIos = useSyncExternalStore(noSubscription, isIosSnapshot, serverSnapshot);
  const isInstalled = useSyncExternalStore(subscribeToStandalone, isStandaloneSnapshot, serverSnapshot) || appInstalled;

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setAppInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    const prompt = deferredPrompt;
    setDeferredPrompt(null);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // Browsers may withdraw an install offer; the menu remains available.
    }
  }

  return (
    <PwaInstallContext.Provider value={{ canInstall: Boolean(deferredPrompt) && !isInstalled, isInstalled, isIos, install }}>
      {children}
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall() {
  const context = useContext(PwaInstallContext);
  if (!context) throw new Error("usePwaInstall must be used within PwaInstallProvider");
  return context;
}
