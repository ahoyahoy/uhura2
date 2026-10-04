"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { makeQueryClient } from "@/lib/query-client";
import { PwaInstallProvider } from "@/components/pwa-install-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem themes={["light", "dark", "oled", "system"]}>
      <QueryClientProvider client={queryClient}>
        <PwaInstallProvider>{children}</PwaInstallProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
