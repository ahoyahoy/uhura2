"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import { useSession } from "@/lib/auth-client";

export function PersistentProfileLink() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const visible = pathname === "/home";

  return (
    <Link
      href="/settings"
      aria-label="Settings"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed right-8 top-16 z-20 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 ${visible ? "" : "invisible pointer-events-none"}`}
    >
      {session?.user?.image ? (
        <img
          src={session.user.image}
          alt=""
          className="h-9 w-9 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <UserRound aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
      )}
    </Link>
  );
}
