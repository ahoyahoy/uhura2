"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { LANGUAGES, getLanguageLabel } from "@/lib/languages";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SyncData } from "@/lib/hooks/use-sync";

export default function NewCoursePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [source, setSource] = useState("cs");
  const [target, setTarget] = useState("en");

  const createClass = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceLanguage: source, targetLanguage: target }),
      });
      if (!res.ok) throw new Error("Create failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData<SyncData>(["sync"], (old) => {
        if (!old) return old;
        return {
          ...old,
          classes: [
            { ...data.class, createdAt: new Date(data.class.createdAt).toISOString() },
            ...old.classes,
          ],
        };
      });
      localStorage.setItem("lastClassId", data.class.id);
      router.replace(`/classes/${data.class.id}`);
    },
  });

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <Link
        href="/classes"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>New Course</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
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
            <div>
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
            onClick={() => createClass.mutate()}
            disabled={createClass.isPending || source === target}
          >
            {createClass.isPending ? (
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
