"use client";

import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignInButton() {
  return (
    <Button
      size="lg"
      onClick={() => signIn.social({ provider: "google" })}
    >
      Sign in with Google
    </Button>
  );
}
