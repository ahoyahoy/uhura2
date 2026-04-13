"use client";

import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signOut()}
    >
      <LogOut className="h-4 w-4 mr-2" />
      Odhlásit
    </Button>
  );
}
