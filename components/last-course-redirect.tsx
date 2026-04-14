"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function LastCourseRedirect() {
  const router = useRouter();

  useEffect(() => {
    const lastClassId = localStorage.getItem("lastClassId");
    if (lastClassId) {
      router.replace(`/classes/${lastClassId}`);
    } else {
      router.replace("/classes");
    }
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
