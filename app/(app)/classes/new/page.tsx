"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { LANGUAGES } from "@/lib/languages";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SyncData } from "@/lib/hooks/use-sync";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";
import { useScreenBg } from "@/lib/hooks/use-screen-bg";

export default function NewCoursePage() {
  useScreenBg("tinted");
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
    <div className="flex flex-col items-stretch min-h-svh w-full max-w-2xl mx-auto p-6 pb-44">
      <Link
        href="/classes"
        className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-transform duration-200 active:translate-y-0.5 active:duration-0"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <h1 className="mt-auto mb-16 text-4xl font-normal px-2">New Class</h1>
      <div className="mb-8 px-2 space-y-3">
        <div className="relative">
          <ArrowUpRight className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <select
            className="w-full rounded-lg px-4 py-3 pr-9 text-sm bg-card appearance-none"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-center">
          <ArrowDown className="h-6 w-6 text-primary" />
        </div>
        <div className="relative">
          <ArrowUpRight className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <select
            className="w-full rounded-lg px-4 py-3 pr-9 text-sm bg-card appearance-none"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {LANGUAGES.filter((l) => l.code !== source).map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <FloatingBar>
        <ActionButton
          onClick={() => createClass.mutate()}
          disabled={createClass.isPending || source === target}
          icon={createClass.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
        >
          Create course
        </ActionButton>
      </FloatingBar>
    </div>
  );
}
