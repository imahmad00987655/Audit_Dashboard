"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/context/auth-context";
import { DashboardProvider } from "@/context/dashboard-context";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 120_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="mgi-audit-theme">
      <QueryClientProvider client={client}>
        <AuthProvider>
          <DashboardProvider>
            {children}
            <Toaster richColors position="top-right" />
          </DashboardProvider>
        </AuthProvider>
      </QueryClientProvider>
    </NextThemesProvider>
  );
}
