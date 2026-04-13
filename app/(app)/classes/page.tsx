"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Loader2 } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { LANGUAGES, getLanguageLabel, getLanguageFlag } from "@/lib/languages";

type LanguageClass = {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
};

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<LanguageClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [source, setSource] = useState("cs");
  const [target, setTarget] = useState("en");

  useEffect(() => {
    fetch("/api/classes")
      .then((r) => r.json())
      .then((d) => {
        setClasses(d.classes);
        setLoading(false);
      });
  }, []);

  async function createClass() {
    setCreating(true);
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceLanguage: source, targetLanguage: target }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/classes/${data.class.id}`);
    }
    setCreating(false);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Courses</h1>
        <SignOutButton />
      </div>

      {classes.length > 0 && (
        <div className="space-y-2">
          {classes.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => router.push(`/classes/${c.id}`)}
            >
              <span className="text-lg">
                {getLanguageFlag(c.sourceLanguage)}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="text-lg">
                {getLanguageFlag(c.targetLanguage)}
              </span>
              <span className="flex-1 font-medium">
                {getLanguageLabel(c.sourceLanguage)} → {getLanguageLabel(c.targetLanguage)}
              </span>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="py-6 space-y-4">
          <p className="text-sm font-medium">New course</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                I speak
              </label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-muted-foreground mt-5">→</span>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                I want to learn
              </label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                {LANGUAGES.filter((l) => l.code !== source).map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={createClass}
            disabled={creating || source === target}
          >
            {creating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Create Course
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
