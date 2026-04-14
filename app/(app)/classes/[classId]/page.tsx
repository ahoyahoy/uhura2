"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowLeft, Loader2 } from "lucide-react";
import { TopicsList } from "@/components/topics-list";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";
import { useSync } from "@/lib/hooks/use-sync";
import { useTopicsWithCounts } from "@/lib/hooks/use-topics-with-counts";

export default function ClassTopicsPage() {
  const { classId } = useParams<{ classId: string }>();
  const { data, isLoading } = useSync();
  const { topicsWithCounts } = useTopicsWithCounts(classId);

  // Remember last visited course
  useEffect(() => {
    localStorage.setItem("lastClassId", classId);
  }, [classId]);

  const cls = data?.classes.find((c) => c.id === classId);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center">
        <Link
          href="/classes"
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>

      {topicsWithCounts.length === 0 ? (
        <>
          <p className="text-muted-foreground text-center py-12">
            No topics yet. Create your first one!
          </p>
          <FloatingBar>
            <Link href={`/classes/${classId}/new`}>
              <ActionButton variant="soft" icon={<ArrowUpRight className="h-5 w-5" />}>
                Create new topic
              </ActionButton>
            </Link>
          </FloatingBar>
        </>
      ) : (
        <TopicsList topics={topicsWithCounts} classId={classId} />
      )}
    </div>
  );
}
