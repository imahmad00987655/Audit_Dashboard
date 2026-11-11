"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Moon,
  Sun,
  RefreshCw,
  ChevronRight,
  X,
  ShieldCheck,
  Sparkles,
  LogOut,
  FileText,
  User,
  Settings,
  Radio,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useDashboard } from "@/context/dashboard-context";
import { useAuth } from "@/context/auth-context";
import { usePermission } from "@/hooks/use-permission";
import { DayEndReportPanel } from "@/components/dashboard/day-end-report-panel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function LiveStatusBadge({ isLive, checking }: { isLive: boolean; checking?: boolean }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.25, duration: 0.4 }}
      title={
        checking
          ? "Checking data feed…"
          : isLive
            ? "Procurement & GRN data APIs are responding"
            : "Data feed unavailable — source API not responding"
      }
      className={cn(
        "relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-0.5 shadow-sm",
        isLive
          ? "border-[#0055a5]/20 bg-white/90 dark:border-white/15 dark:bg-[#0f1c30]"
          : "border-[#e31e24]/30 bg-[#fff5f5] dark:border-[#e31e24]/40 dark:bg-[#2a1518]"
      )}
    >
      {isLive && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-[#fff200]/45 to-transparent dark:via-[#3d9ae8]/25"
          animate={{ x: ["-120%", "220%"] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "linear", repeatDelay: 0.6 }}
        />
      )}

      <span className="relative flex h-2 w-2 shrink-0">
        {isLive ? (
          <>
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-[#e31e24]"
              animate={{ scale: [1, 2.2], opacity: [0.55, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.span
              className="relative inline-flex h-2 w-2 rounded-full bg-[#e31e24] shadow-[0_0_8px_rgba(227,30,36,0.65)]"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        ) : (
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#6d8499]" />
        )}
      </span>

      <svg viewBox="0 0 36 14" className="relative h-3.5 w-9 shrink-0 overflow-visible" aria-hidden>
        {isLive ? (
          <motion.path
            d="M1 7 H7 L9 3 L11 11 L13 7 H17 L19 2 L21 12 L23 7 H35"
            fill="none"
            stroke="#e31e24"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0.15, opacity: 0.5 }}
            animate={{ pathLength: [0.15, 1, 0.15], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : (
          <path
            d="M1 7 H35"
            fill="none"
            stroke="#6d8499"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        )}
      </svg>

      <motion.span
        className={cn(
          "relative text-[10px] font-extrabold uppercase tracking-[0.12em]",
          isLive ? "text-[#0055a5] dark:text-[#7eb6e8]" : "text-[#e31e24]"
        )}
        animate={isLive ? { opacity: [0.72, 1, 0.72] } : { opacity: 1 }}
        transition={isLive ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        {checking ? "Checking…" : isLive ? "Live" : "Non-Alive"}
      </motion.span>
    </motion.span>
  );
}

function AnimatedHeaderAccentLines() {
  return (
    <>
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-[#0055a5] dark:bg-[#3d9ae8]">
        <motion.div
          className="absolute inset-y-0 w-24 bg-linear-to-r from-transparent via-white/55 to-transparent dark:via-[#fff200]/70"
          animate={{ x: ["-6rem", "110%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear", repeatDelay: 0.35 }}
        />
      </div>

      <motion.div
        className="absolute inset-y-0 left-0 w-1.5 bg-[#e31e24]"
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden bg-[#fff200]">
        <motion.div
          className="absolute inset-y-0 w-20 bg-linear-to-r from-transparent via-[#0055a5]/80 to-transparent dark:via-[#3d9ae8]"
          animate={{ x: ["-5rem", "110%"] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "linear", repeatDelay: 0.45 }}
        />
      </div>
    </>
  );
}

export function DashboardHeader() {
  const { resolvedTheme, setTheme } = useTheme();
  const { drillPath, clearDrill, popDrill } = useDashboard();
  const { user, logout } = useAuth();
  const { can, isAdmin } = usePermission();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const isDark = mounted && resolvedTheme === "dark";

  const feedQ = useQuery({
    queryKey: ["data-feed-status"],
    queryFn: () => api.dataFeedStatus(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  const isLive = feedQ.data?.data?.live === true;
  const feedChecking = feedQ.isLoading || feedQ.isFetching;

  useEffect(() => {
    setMounted(true);
  }, []);

  const onRefresh = async () => {
    setSpinning(true);
    try {
      await queryClient.invalidateQueries();
      toast.success("Dashboard data refreshed");
    } catch {
      toast.error("Refresh failed");
    } finally {
      window.setTimeout(() => setSpinning(false), 400);
    }
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-[#0055a5]/15 bg-white shadow-[0_8px_30px_rgba(0,85,165,0.08)] dark:border-white/10 dark:bg-[#122238] dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 dark:hidden"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, rgba(0,85,165,0.10) 0%, transparent 55%), radial-gradient(80% 60% at 100% 0%, rgba(227,30,36,0.06) 0%, transparent 45%), linear-gradient(180deg, #f7fbff 0%, #ffffff 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, rgba(61,154,232,0.14) 0%, transparent 55%), radial-gradient(80% 60% at 100% 0%, rgba(227,30,36,0.10) 0%, transparent 45%), linear-gradient(180deg, #152a45 0%, #122238 70%)",
        }}
      />
      <AnimatedHeaderAccentLines />

      <div className="relative flex flex-col gap-3 p-4 sm:gap-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <motion.div
            whileHover={{ scale: 1.04, rotate: -2 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="relative shrink-0"
          >
            <div className="absolute -inset-1 rounded-2xl bg-[#fff200]/70 blur-[2px]" />
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border-[3px] border-[#fff200] bg-white shadow-md sm:h-16 sm:w-16">
              <Image
                src="/master-logo.png"
                alt="Master Group of Industries"
                fill
                sizes="64px"
                className="object-cover"
                priority
              />
            </div>
            <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#0055a5] text-white shadow-sm dark:border-[#122238]">
              <ShieldCheck className="h-3 w-3" strokeWidth={2.5} />
            </span>
          </motion.div>

          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#0055a5] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white shadow-sm dark:bg-[#3d9ae8] dark:text-[#0a1628]">
                <Sparkles className="h-2.5 w-2.5 text-[#fff200] dark:text-[#0a1628]" />
                <span className="hidden sm:inline">Master Group of Industries</span>
                <span className="sm:hidden">Master Group</span>
              </span>
              <LiveStatusBadge isLive={isLive} checking={feedChecking && !feedQ.data} />
            </div>

            <h1 className="font-display text-xl font-bold leading-tight tracking-tight text-[#0055a5] sm:text-2xl dark:text-[#fff200]">
              Procurement Audit Dashboard
            </h1>

            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#6d8499] sm:text-xs dark:text-[#9aa8b8]">
              <span className="font-semibold text-[#2a4a6e] dark:text-[#e8f1fa]">Since 1963</span>
              <span className="text-[#c5d4e3] dark:text-white/30">·</span>
              <span className="hidden sm:inline">Enterprise procurement analytics</span>
              <span className="hidden text-[#c5d4e3] sm:inline dark:text-white/30">·</span>
              <span className="rounded-md bg-[#fff200]/55 px-1.5 py-0.5 text-[10px] font-bold text-[#0055a5] dark:bg-[#fff200]/25 dark:text-[#fff200]">
                MoltyFoam · Master
              </span>
            </p>
          </div>
        </div>

        {/* Single-row actions — no wrap so Logout/theme stay aligned */}
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] lg:justify-end [&::-webkit-scrollbar]:hidden">
          {user && (
            <div
              title={user.fullName}
              className="hidden h-9 max-w-[9.5rem] items-center gap-1.5 truncate rounded-xl border border-[#0055a5]/12 bg-white/70 px-2.5 text-[11px] text-[#6d8499] xl:flex dark:border-white/10 dark:bg-[#0f1c30] dark:text-[#9aa8b8]"
            >
              <User className="h-3.5 w-3.5 shrink-0 text-[#0055a5]" />
              <span className="truncate font-semibold text-[#2a4a6e] dark:text-[#e8f1fa]">{user.fullName}</span>
            </div>
          )}

          <div
            title={isLive ? "Data feed online" : "Data feed offline"}
            className="hidden h-9 items-center gap-1.5 rounded-xl border border-[#0055a5]/12 bg-white/70 px-2.5 text-[11px] text-[#6d8499] 2xl:flex dark:border-white/10 dark:bg-[#0f1c30] dark:text-[#9aa8b8]"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {isLive ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3d9b6a] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3d9b6a]" />
                </>
              ) : (
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#e31e24]" />
              )}
            </span>
            <span className="whitespace-nowrap">{isLive ? "Feed online" : "Feed offline"}</span>
          </div>

          <Link href="/command-center" className="shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="h-9 rounded-xl border border-[#e31e24]/25 bg-[#fff5f5] px-2.5 text-[#e31e24] shadow-sm hover:bg-[#ffe8e8] dark:border-[#e31e24]/40 dark:bg-[#2a1518] dark:text-[#ff8a8e]"
            >
              <Radio className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Command Center</span>
            </Button>
          </Link>

          {isAdmin && (
            <Link href="/admin" className="shrink-0">
              <Button variant="secondary" size="sm" className="h-9 rounded-xl px-2.5 shadow-sm">
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Admin</span>
              </Button>
            </Link>
          )}

          {can("feature-day-end-report") && (
            <Button
              variant="secondary"
              size="sm"
              className="h-9 shrink-0 rounded-xl px-2.5 shadow-sm"
              onClick={() => setReportOpen(true)}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Day-End</span>
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            className="h-9 shrink-0 rounded-xl px-2.5 shadow-sm"
            onClick={onRefresh}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 rounded-xl px-2.5 shadow-sm"
            onClick={() => logout()}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl border-[#0055a5]/25 bg-white shadow-sm dark:border-white/20 dark:bg-[#0f1c30]"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {!mounted ? (
              <Moon className="h-4 w-4" />
            ) : isDark ? (
              <Sun className="h-4 w-4 text-[#fff200]" />
            ) : (
              <Moon className="h-4 w-4 text-[#0055a5]" />
            )}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {drillPath.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative overflow-hidden border-t border-[#0055a5]/10 bg-[#f8fbfe]/90 dark:border-white/10 dark:bg-[#0f1c30]/90"
          >
            <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 sm:px-6">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
                Drill path
              </span>
              <button
                type="button"
                className="rounded-lg bg-[#0055a5] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-[#2f7ec4] dark:bg-[#3d9ae8] dark:text-[#0a1628]"
                onClick={clearDrill}
              >
                All
              </button>
              {drillPath.map((d, i) => (
                <div key={`${d.level}-${d.value}-${i}`} className="flex items-center gap-1.5">
                  <ChevronRight className="h-3.5 w-3.5 text-[#7eb6e8]" />
                  <button
                    type="button"
                    onClick={() => popDrill(i)}
                    className="rounded-lg border border-[#0055a5]/15 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0055a5] shadow-sm transition hover:border-[#0055a5]/40 hover:bg-[#eef5fc] dark:border-white/15 dark:bg-[#122238] dark:text-[#7eb6e8] dark:hover:bg-[#1a2d4a]"
                  >
                    {d.label}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#6d8499] hover:bg-white hover:text-[#e31e24] dark:text-[#9aa8b8] dark:hover:bg-[#122238]"
                onClick={clearDrill}
              >
                <X className="h-3.5 w-3.5" /> Clear path
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {can("feature-day-end-report") && (
        <DayEndReportPanel open={reportOpen} onClose={() => setReportOpen(false)} />
      )}
    </motion.header>
  );
}
