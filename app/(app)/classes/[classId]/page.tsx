"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { FloatingBackButton } from "@/components/floating-back-button";
import { TopicsList } from "@/components/topics-list";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";
import { useTopicsWithCounts } from "@/lib/hooks/use-topics-with-counts";
import { setStoredString } from "@/lib/hooks/use-stored-string";

export default function ClassTopicsPage() {
  const { classId } = useParams<{ classId: string }>();
  const { topicsWithCounts, isLoading } = useTopicsWithCounts(classId);

  // Remember last visited course
  useEffect(() => {
    setStoredString("lastClassId", classId);
  }, [classId]);

  if (isLoading) {
    return (
      <>
        <FloatingBackButton href="/home" label="Back to home" />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  return (
    <>
    <FloatingBackButton href="/home" label="Back to home" />
    <div className="fixed top-0 left-0 right-0 z-10 px-6 py-6 bg-[var(--background)]/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between">
        <div className="w-9" aria-hidden="true" />
        <h1 className="text-2xl font-normal">Sentences</h1>
        <div className="w-9" />
      </div>
    </div>
    <div className="w-full max-w-2xl mx-auto p-6 pt-20 pb-44 space-y-6">

      {topicsWithCounts.length === 0 ? (
        <>
          <p className="text-muted-foreground text-center py-12">
            No topics yet. Create your first one!
          </p>
          <FloatingBar>
            <Link href={`/classes/${classId}/new`}>
              <ActionButton variant="soft" icon={<ArrowUpRight className="h-5 w-5" />}>
                New topic
              </ActionButton>
            </Link>
          </FloatingBar>
        </>
      ) : (
        <TopicsList topics={topicsWithCounts} classId={classId} />
      )}
    </div>
    </>
  );
}
