import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const floatingIconButtonClassName =
  "pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/90 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function FloatingBackButton({ href, label }: { href: string; label: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30">
      <div className="mx-auto w-full max-w-2xl px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <Link href={href} aria-label={label} className={floatingIconButtonClassName}>
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
