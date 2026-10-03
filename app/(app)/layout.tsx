import { PersistentProfileLink } from "@/components/persistent-profile-link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PersistentProfileLink />
      {children}
    </>
  );
}
