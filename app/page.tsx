import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/sign-in-button";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/topics");
  }

  return (
    <main className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">Uhura</h1>
        <p className="text-muted-foreground text-lg">
          AI Sentence Trainer
        </p>
        <SignInButton />
      </div>
    </main>
  );
}
