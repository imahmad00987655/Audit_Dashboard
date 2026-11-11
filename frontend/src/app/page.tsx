"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { useAuth } from "@/context/auth-context";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f8fc] dark:bg-[#0a1628]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0055a5]" />
      </div>
    );
  }

  return <DashboardView />;
}
