import { PersistentProfileLink } from "@/components/persistent-profile-link";
import { AuthSessionBoundary } from "@/components/auth-session-boundary";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  return (
    <AuthSessionBoundary>
      <PersistentProfileLink />
      {children}
    </AuthSessionBoundary>
  );
}
