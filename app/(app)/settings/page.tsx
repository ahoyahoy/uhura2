"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { LogOut } from "lucide-react";
import { FloatingBackButton, floatingIconButtonClassName } from "@/components/floating-back-button";
import { signOut } from "@/lib/auth-client";
import { setStoredString, useStoredString } from "@/lib/hooks/use-stored-string";

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "oled", label: "OLED" },
  { value: "system", label: "System" },
] as const;

const GRADE_STYLES = [
  { value: "numbers", label: "1 – 5" },
  { value: "letters", label: "A – E" },
] as const;

const subscribe = () => () => {};
const mountedOnClient = () => true;
const renderingOnServer = () => false;

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, mountedOnClient, renderingOnServer);
  const gradeStyle = useStoredString("gradeStyle", "numbers");

  function handleGradeStyle(value: string) {
    setStoredString("gradeStyle", value);
  }

  return (
    <div className="flex flex-col items-stretch min-h-svh w-full max-w-2xl mx-auto p-6">
      <FloatingBackButton href="/home" label="Back to home" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30">
        <div className="mx-auto flex w-full max-w-2xl justify-end px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <button
            aria-label="Sign out"
            className={`${floatingIconButtonClassName} cursor-pointer`}
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="h-9" aria-hidden="true" />

      <h1 className="mt-auto mb-16 text-4xl font-normal">Settings</h1>

      <div className="space-y-8 mb-auto">
        <div className="space-y-3">
          <label className="text-xs text-muted-foreground px-1">Theme</label>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                aria-pressed={mounted && theme === t.value}
                className={`flex-1 px-4 py-3 text-sm rounded-lg cursor-pointer transition-colors ${
                  mounted && theme === t.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-card hover:bg-primary/10"
                }`}
                onClick={() => setTheme(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs text-muted-foreground px-1">Rating style</label>
          <div className="flex gap-2">
            {GRADE_STYLES.map((g) => (
              <button
                key={g.value}
                className={`flex-1 px-4 py-3 text-sm rounded-lg cursor-pointer transition-colors ${
                  gradeStyle === g.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-card hover:bg-primary/10"
                }`}
                onClick={() => handleGradeStyle(g.value)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
