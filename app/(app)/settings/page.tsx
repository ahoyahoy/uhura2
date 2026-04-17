"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/lib/auth-client";

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

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [gradeStyle, setGradeStyle] = useState("numbers");

  useEffect(() => {
    setGradeStyle(localStorage.getItem("gradeStyle") ?? "numbers");
  }, []);

  function handleGradeStyle(value: string) {
    setGradeStyle(value);
    localStorage.setItem("gradeStyle", value);
  }

  return (
    <div className="flex flex-col items-stretch min-h-svh w-full max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <Link
          href="/home"
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-transform duration-200 active:translate-y-0.5 active:duration-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <button
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-transform duration-200 active:translate-y-0.5 active:duration-0 cursor-pointer"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <h1 className="mt-auto mb-16 text-4xl font-normal">Settings</h1>

      <div className="space-y-8 mb-auto">
        <div className="space-y-3">
          <label className="text-xs text-muted-foreground px-1">Theme</label>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                className={`flex-1 px-4 py-3 text-sm rounded-lg cursor-pointer transition-colors ${
                  theme === t.value
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
